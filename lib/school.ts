/**
 * School scraper voor arhc.nl (Adolphe Reineveld Holland College / Roland Holst College)
 * Haalt vakantiedagen, PTA en roosterwijzigingen op.
 */

export interface SchoolItem {
  datum: string       // YYYY-MM-DD
  omschrijving: string
  leerling: 'dochter' | 'zoon' | 'beiden'
  type: 'vakantie' | 'examen' | 'vrij' | 'toets' | 'rooster'
}

const ARHC_URL = 'https://www.arhc.nl'

async function haalPagina(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      next: { revalidate: 3600 }, // cache 1 uur
    })
    if (!resp.ok) return null
    return resp.text()
  } catch {
    return null
  }
}

function vindDatumPatronen(tekst: string): { datum: string; context: string }[] {
  const maanden: Record<string, number> = {
    januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
    juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
  }

  const resultaten: { datum: string; context: string }[] = []
  const patroon = /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/gi

  let match: RegExpExecArray | null
  while ((match = patroon.exec(tekst)) !== null) {
    const dag = match[1].padStart(2, '0')
    const maand = String(maanden[match[2].toLowerCase()]).padStart(2, '0')
    const jaar = match[3]
    const datum = `${jaar}-${maand}-${dag}`
    const context = tekst.slice(Math.max(0, match.index - 100), match.index + 100)
    resultaten.push({ datum, context })
  }

  return resultaten
}

function bepaalType(context: string): SchoolItem['type'] {
  const laag = context.toLowerCase()
  if (laag.includes('examen') || laag.includes('eindexamen')) return 'examen'
  if (laag.includes('toets') || laag.includes('proefwerk')) return 'toets'
  if (laag.includes('vakantie')) return 'vakantie'
  if (laag.includes('rooster') || laag.includes('vrij')) return 'vrij'
  return 'vrij'
}

export async function haalSchoolData(): Promise<SchoolItem[]> {
  const vandaag = new Date()
  const items: SchoolItem[] = []

  // Probeer meerdere pagina's
  const paden = ['/kalender', '/vakanties', '/nieuws', '/leerlingen', '/']
  for (const pad of paden) {
    const html = await haalPagina(ARHC_URL + pad)
    if (!html) continue

    const gevonden = vindDatumPatronen(html)
    for (const { datum, context } of gevonden) {
      const d = new Date(datum)
      const dagenTot = Math.round((d.getTime() - vandaag.getTime()) / 86400000)
      if (dagenTot < 0 || dagenTot > 60) continue

      items.push({
        datum,
        omschrijving: context.replace(/<[^>]*>/g, '').trim().slice(0, 80),
        leerling: 'beiden',
        type: bepaalType(context),
      })
    }

    if (items.length > 0) break
  }

  // Altijd fallback schoolvakanties 2025-2026 (regio Midden) toevoegen als er niets gevonden is
  if (items.length === 0) {
    return fallbackVakanties().filter(item => {
      const dagenTot = Math.round((new Date(item.datum).getTime() - vandaag.getTime()) / 86400000)
      return dagenTot >= 0 && dagenTot <= 60
    })
  }

  // Verwijder duplicaten op basis van datum
  const uniek = items.filter((item, i) => items.findIndex(x => x.datum === item.datum) === i)
  return uniek.sort((a, b) => a.datum.localeCompare(b.datum))
}

export function haalSchoolSignaleringen(alleItems: SchoolItem[], vensterdagen = 30) {
  const vandaag = new Date()
  return alleItems
    .map(item => {
      const d = new Date(item.datum)
      const dagenTot = Math.round((d.getTime() - vandaag.getTime()) / 86400000)
      return { ...item, dagenTot }
    })
    .filter(item => item.dagenTot >= 0 && item.dagenTot <= vensterdagen)
    .sort((a, b) => a.dagenTot - b.dagenTot)
}

function fallbackVakanties(): SchoolItem[] {
  return [
    { datum: '2025-10-18', omschrijving: 'Herfstvakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2025-10-26', omschrijving: 'Herfstvakantie (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2025-12-27', omschrijving: 'Kerstvakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-01-04', omschrijving: 'Kerstvakantie (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-02-21', omschrijving: 'Voorjaarsvakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-03-01', omschrijving: 'Voorjaarsvakantie (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-04-04', omschrijving: 'Goede Vrijdag (schoolvrij)', leerling: 'beiden', type: 'vrij' },
    { datum: '2026-04-06', omschrijving: '2e Paasdag (schoolvrij)', leerling: 'beiden', type: 'vrij' },
    { datum: '2026-04-25', omschrijving: 'Meivakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-05-10', omschrijving: 'Meivakantie (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-05-11', omschrijving: 'Centraal examen start — dochter (6-VWO)', leerling: 'dochter', type: 'examen' },
    { datum: '2026-06-07', omschrijving: 'Zomervakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-08-16', omschrijving: 'Zomervakantie (einde)', leerling: 'beiden', type: 'vakantie' },
  ]
}
