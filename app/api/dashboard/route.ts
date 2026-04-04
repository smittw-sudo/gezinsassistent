import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { haalCalDAVEvents, bepaalTaakStatus, dagenTotDatum } from '@/lib/kalender'
import { getConfig, agendaItemsOphalen, laatsteUitvoering } from '@/lib/supabase'
import { haalSchoolData, haalSchoolSignaleringen, komende2Vakanties } from '@/lib/school'

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const vandaagIso = new Date().toISOString().slice(0, 10)

  // Haal alle data parallel op — langere range voor vakantie-events
  const [takenConfig, verjaardagenConfig, feestdagenConfig, instellingen, agendaItems, calEvents60, schoolData] =
    await Promise.all([
      getConfig('huishoudtaken') as Promise<{ naam: string; interval_dagen: number }[]>,
      getConfig('verjaardagen') as Promise<{ naam: string; datum: string; relatie: string }[]>,
      getConfig('feestdagen') as Promise<{ naam: string; datum: string }[]>,
      getConfig('instellingen') as Promise<{ locatie: string; vakantie_regio: string; werk_regio: string }>,
      agendaItemsOphalen(),
      haalCalDAVEvents(90), // 90 dagen voor vakantie-blok
      haalSchoolData(),
    ])

  // Events splitsen: 21 dagen voor agenda, vandaag apart, vakanties apart
  const events21 = calEvents60.filter(e => e.datum >= vandaagIso && e.datum <= addDaysIso(vandaagIso, 21))
  const vandaagEvents = calEvents60.filter(e => e.datum === vandaagIso)

  // Handmatige agenda items (geen todos/nu_nodig)
  const handmatigItems = agendaItems
    .filter(i => i.datum && i.notitie !== '__todo__' && i.notitie !== '__nu_nodig__')
    .map(i => ({
      datum: i.datum!,
      titel: i.titel,
      locatie: i.notitie || '',
      kalender: 'Handmatig',
      bron: 'handmatig' as const,
      id: i.id,
    }))

  const alleEvents = [...events21, ...handmatigItems].sort((a, b) => a.datum.localeCompare(b.datum))

  // Taken met status
  const takenMetStatus = await Promise.all(
    (takenConfig || []).map(async (taak) => {
      const laatste = await laatsteUitvoering(taak.naam)
      const { status, dagenTotVolgende } = bepaalTaakStatus(taak.interval_dagen, laatste)
      return { naam: taak.naam, intervalDagen: taak.interval_dagen, dagenTotVolgende, status }
    })
  )
  takenMetStatus.sort((a, b) => {
    const v = { te_doen: 0, onbekend: 1, binnenkort: 2, ok: 3 }
    return (v[a.status] ?? 9) - (v[b.status] ?? 9) || a.dagenTotVolgende - b.dagenTotVolgende
  })

  // Verjaardagen & feestdagen
  const verjaardagen = (verjaardagenConfig || [])
    .map(v => ({ ...v, dagenTot: dagenTotDatum(v.datum) }))
    .filter(v => v.dagenTot <= 21).sort((a, b) => a.dagenTot - b.dagenTot)

  const feestdagen = (feestdagenConfig || [])
    .map(f => ({ ...f, dagenTot: dagenTotDatum(f.datum) }))
    .filter(f => f.dagenTot <= 60).sort((a, b) => a.dagenTot - b.dagenTot)

  // School
  const schoolSignaleringen = haalSchoolSignaleringen(schoolData, 30)

  // Dagelijkse todos & nu-nodig
  const todos = agendaItems
    .filter(i => i.datum === vandaagIso && i.notitie === '__todo__')
    .map(i => ({ id: i.id, tekst: i.titel }))
  const nuNodig = agendaItems
    .filter(i => i.datum === vandaagIso && i.notitie === '__nu_nodig__')
    .map(i => ({ id: i.id, tekst: i.titel }))

  // Komende 2 vakanties + events binnen die periodes
  const vakanties = komende2Vakanties()
  const vakantiesMetEvents = vakanties.map(v => ({
    ...v,
    events: calEvents60
      .filter(e => e.datum >= v.start && e.datum <= v.einde)
      .sort((a, b) => a.datum.localeCompare(b.datum)),
    dagenTot: Math.round((new Date(v.start).getTime() - new Date().getTime()) / 86400000),
  }))

  return NextResponse.json({
    events: alleEvents,
    vandaagEvents,
    taken: takenMetStatus,
    verjaardagen,
    feestdagen,
    schoolSignaleringen,
    todos,
    nuNodig,
    vakanties: vakantiesMetEvents,
    instellingen,
  })
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
