import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { haalCalDAVEvents, bepaalTaakStatus, dagenTotDatum } from '@/lib/kalender'
import { getConfig, agendaItemsOphalen, laatsteUitvoering } from '@/lib/supabase'
import { haalSchoolData, haalSchoolSignaleringen } from '@/lib/school'

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const [takenConfig, verjaardagenConfig, feestdagenConfig, instellingen, agendaItems, calEvents, schoolData] =
    await Promise.all([
      getConfig('huishoudtaken') as Promise<{ naam: string; interval_dagen: number }[]>,
      getConfig('verjaardagen') as Promise<{ naam: string; datum: string; relatie: string }[]>,
      getConfig('feestdagen') as Promise<{ naam: string; datum: string }[]>,
      getConfig('instellingen') as Promise<{ locatie: string; vakantie_regio: string; werk_regio: string }>,
      agendaItemsOphalen(),
      haalCalDAVEvents(21),
      haalSchoolData(),
    ])

  // Taken met status
  const takenMetStatus = await Promise.all(
    (takenConfig || []).map(async (taak) => {
      const laatste = await laatsteUitvoering(taak.naam)
      const { status, dagenTotVolgende } = bepaalTaakStatus(taak.interval_dagen, laatste)
      return {
        naam: taak.naam,
        intervalDagen: taak.interval_dagen,
        laatsteUitvoering: laatste,
        dagenTotVolgende,
        status,
      }
    })
  )
  takenMetStatus.sort((a, b) => {
    const volgorde = { te_doen: 0, onbekend: 1, binnenkort: 2, ok: 3 }
    return (volgorde[a.status] ?? 9) - (volgorde[b.status] ?? 9) || a.dagenTotVolgende - b.dagenTotVolgende
  })

  // Handmatige agenda items samenvoegen
  const handmatigItems = agendaItems
    .filter(i => i.datum)
    .map(i => ({
      datum: i.datum!,
      titel: i.titel,
      locatie: i.notitie || '',
      kalender: 'Handmatig',
      bron: 'handmatig' as const,
      id: i.id,
    }))

  const alleEvents = [...calEvents, ...handmatigItems]
    .sort((a, b) => a.datum.localeCompare(b.datum))

  // Verjaardagen binnen 21 dagen
  const verjaardagen = (verjaardagenConfig || [])
    .map(v => ({ ...v, dagenTot: dagenTotDatum(v.datum) }))
    .filter(v => v.dagenTot <= 21)
    .sort((a, b) => a.dagenTot - b.dagenTot)

  // Feestdagen binnen 60 dagen
  const feestdagen = (feestdagenConfig || [])
    .map(f => ({ ...f, dagenTot: dagenTotDatum(f.datum) }))
    .filter(f => f.dagenTot <= 60)
    .sort((a, b) => a.dagenTot - b.dagenTot)

  const schoolSignaleringen = haalSchoolSignaleringen(schoolData, 30)

  return NextResponse.json({
    events: alleEvents,
    taken: takenMetStatus,
    verjaardagen,
    feestdagen,
    schoolSignaleringen,
    instellingen,
  })
}
