export interface SchoolItem {
  datum: string
  omschrijving: string
  leerling: 'dochter' | 'zoon' | 'beiden'
  type: 'vakantie' | 'examen' | 'vrij' | 'toets' | 'rooster'
}

export interface Vakantieperiode {
  naam: string
  start: string   // YYYY-MM-DD
  einde: string   // YYYY-MM-DD
  regio: 'prive' | 'werk' | 'school' | 'beide'
  events?: { datum: string; titel: string; kalender: string }[]
}

// Regio Noord privévakanties 2025-2026
const PRIVE_VAKANTIES: Vakantieperiode[] = [
  { naam: 'Herfstvakantie', start: '2025-10-11', einde: '2025-10-19', regio: 'prive' },
  { naam: 'Kerstvakantie', start: '2025-12-27', einde: '2026-01-04', regio: 'prive' },
  { naam: 'Voorjaarsvakantie', start: '2026-02-14', einde: '2026-02-22', regio: 'prive' },
  { naam: 'Meivakantie', start: '2026-04-25', einde: '2026-05-10', regio: 'prive' },
  { naam: 'Zomervakantie', start: '2026-07-11', einde: '2026-08-23', regio: 'prive' },
]

// ARHC (A. Roland Holst College) vakanties 2025-2026 — kinderen
const SCHOOL_VAKANTIES: Vakantieperiode[] = [
  { naam: 'Herfstvakantie', start: '2025-10-18', einde: '2025-10-26', regio: 'school' },
  { naam: 'Kerstvakantie (ARHC)', start: '2025-12-20', einde: '2026-01-04', regio: 'school' },
  { naam: 'Roland Holst week', start: '2026-01-19', einde: '2026-01-23', regio: 'school' },
  { naam: 'Voorjaarsvakantie', start: '2026-02-21', einde: '2026-03-01', regio: 'school' },
  { naam: 'Meivakantie (ARHC)', start: '2026-04-18', einde: '2026-05-03', regio: 'school' },
  { naam: 'Roland Holst week', start: '2026-05-26', einde: '2026-05-29', regio: 'school' },
  { naam: 'Zomervakantie (ARHC)', start: '2026-07-04', einde: '2026-08-16', regio: 'school' },
]

// Kalsbeek College vakanties 2025-2026 — werk
const WERK_VAKANTIES: Vakantieperiode[] = [
  { naam: 'Herfstvakantie', start: '2025-10-18', einde: '2025-10-26', regio: 'werk' },
  { naam: 'Kerstvakantie', start: '2025-12-27', einde: '2026-01-04', regio: 'werk' },
  { naam: 'Voorjaarsvakantie', start: '2026-02-21', einde: '2026-03-01', regio: 'werk' },
  { naam: 'Meivakantie', start: '2026-04-25', einde: '2026-05-10', regio: 'werk' },
  { naam: 'Zomervakantie', start: '2026-07-04', einde: '2026-08-16', regio: 'werk' },
]

// Vaste Nederlandse feestdagen (YYYY-MM-DD)
const FEESTDAGEN_2025_2026 = [
  '2025-12-25', // 1e Kerstdag
  '2025-12-26', // 2e Kerstdag
  '2026-01-01', // Nieuwjaarsdag
  '2026-04-03', // Goede Vrijdag
  '2026-04-05', // 1e Paasdag
  '2026-04-06', // 2e Paasdag
  '2026-04-27', // Koningsdag
  '2026-05-05', // Bevrijdingsdag
  '2026-05-14', // Hemelvaartsdag
  '2026-05-15', // Vrijdag na Hemelvaart (ARHC vrij)
  '2026-05-25', // 2e Pinksterdag
]

export function haalVakantieperiodes(): Vakantieperiode[] {
  return [...PRIVE_VAKANTIES, ...SCHOOL_VAKANTIES, ...WERK_VAKANTIES]
}

/** Geeft de komende N vakanties terug, prive + school gecombineerd (deduplicatie op naam) */
export function komende2Vakanties(vandaag: Date = new Date()): Vakantieperiode[] {
  const iso = vandaag.toISOString().slice(0, 10)
  // Combineer prive en school, pak de eerstvolgende 2 unieke periodes
  const relevant = [...PRIVE_VAKANTIES, ...SCHOOL_VAKANTIES]
    .filter(v => v.einde >= iso)
    .sort((a, b) => a.start.localeCompare(b.start))

  // Dedupliceer: als prive en school tegelijk beginnen, merge ze
  const gezien = new Set<string>()
  const result: Vakantieperiode[] = []
  for (const v of relevant) {
    const key = v.naam.replace(' (ARHC)', '').replace(' (regio Noord)', '').trim()
    if (!gezien.has(key)) {
      gezien.add(key)
      result.push(v)
    }
    if (result.length >= 2) break
  }
  return result
}

/** Geeft true als de gegeven ISO-datum een vrije dag is (weekend, feestdag of vakantie) */
export function isVrijeDag(iso: string): boolean {
  const d = new Date(iso + 'T12:00:00')
  const dag = d.getDay()
  if (dag === 0 || dag === 6) return true // weekend
  if (FEESTDAGEN_2025_2026.includes(iso)) return true
  return haalVakantieperiodes().some(v => iso >= v.start && iso <= v.einde)
}

export function eerstvolgendeVrijeDag(vandaag: Date = new Date()): { datum: string; naam: string } | null {
  const iso = vandaag.toISOString().slice(0, 10)
  const vakanties = [...PRIVE_VAKANTIES, ...SCHOOL_VAKANTIES]

  const huidige = vakanties.find(v => v.start <= iso && v.einde >= iso)
  if (huidige) return { datum: huidige.einde, naam: `${huidige.naam} (nog bezig)` }

  const dag = vandaag.getDay()
  const dagenTotWeekend = dag === 6 ? 0 : dag === 0 ? 0 : 6 - dag
  const weekend = new Date(vandaag)
  weekend.setDate(weekend.getDate() + dagenTotWeekend)
  const weekendIso = weekend.toISOString().slice(0, 10)

  const aankomend = vakanties.filter(v => v.start > iso).sort((a, b) => a.start.localeCompare(b.start))[0]
  if (aankomend && aankomend.start < weekendIso) {
    return { datum: aankomend.start, naam: aankomend.naam }
  }

  return { datum: weekendIso, naam: 'Weekend' }
}

export async function haalSchoolData(): Promise<SchoolItem[]> {
  const vandaag = new Date()
  const items = fallbackVakanties()
  return items.filter(item => {
    const d = new Date(item.datum)
    return Math.round((d.getTime() - vandaag.getTime()) / 86400000) >= 0
  })
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
    { datum: '2025-12-20', omschrijving: 'Kerstvakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-01-04', omschrijving: 'Kerstvakantie (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-01-19', omschrijving: 'Roland Holst week (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-01-23', omschrijving: 'Roland Holst week (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-02-21', omschrijving: 'Voorjaarsvakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-03-01', omschrijving: 'Voorjaarsvakantie (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-04-03', omschrijving: 'Goede Vrijdag (vrij)', leerling: 'beiden', type: 'vrij' },
    { datum: '2026-04-05', omschrijving: '1e Paasdag (vrij)', leerling: 'beiden', type: 'vrij' },
    { datum: '2026-04-06', omschrijving: '2e Paasdag (vrij)', leerling: 'beiden', type: 'vrij' },
    { datum: '2026-04-18', omschrijving: 'Meivakantie ARHC (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-05-03', omschrijving: 'Meivakantie ARHC (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-05-05', omschrijving: 'Bevrijdingsdag (vrij)', leerling: 'beiden', type: 'vrij' },
    { datum: '2026-05-11', omschrijving: 'Centraal examen start — dochter', leerling: 'dochter', type: 'examen' },
    { datum: '2026-05-14', omschrijving: 'Hemelvaartsdag (vrij)', leerling: 'beiden', type: 'vrij' },
    { datum: '2026-05-25', omschrijving: '2e Pinksterdag (vrij)', leerling: 'beiden', type: 'vrij' },
    { datum: '2026-05-26', omschrijving: 'Roland Holst week (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-05-29', omschrijving: 'Roland Holst week (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-07-04', omschrijving: 'Zomervakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-08-16', omschrijving: 'Zomervakantie (einde)', leerling: 'beiden', type: 'vakantie' },
  ]
}
