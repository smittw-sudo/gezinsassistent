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
  regio: 'prive' | 'werk' | 'beide'
  events?: { datum: string; titel: string; kalender: string }[]
}

export function haalVakantieperiodes(): Vakantieperiode[] {
  return [
    // 2025-2026 schooljaar regio Midden
    { naam: 'Meivakantie', start: '2026-04-25', einde: '2026-05-10', regio: 'beide' },
    { naam: 'Zomervakantie', start: '2026-07-04', einde: '2026-08-16', regio: 'beide' },
    // Werkvakantie (Kalsbeek College regio Midden - iets andere data)
    { naam: 'Herfstvakantie', start: '2025-10-18', einde: '2025-10-26', regio: 'beide' },
    { naam: 'Kerstvakantie', start: '2025-12-27', einde: '2026-01-04', regio: 'beide' },
    { naam: 'Voorjaarsvakantie', start: '2026-02-21', einde: '2026-03-01', regio: 'beide' },
    { naam: 'Goede Vrijdag & Pasen', start: '2026-04-03', einde: '2026-04-06', regio: 'beide' },
  ]
}

export function komende2Vakanties(vandaag: Date = new Date()): Vakantieperiode[] {
  const iso = vandaag.toISOString().slice(0, 10)
  return haalVakantieperiodes()
    .filter(v => v.einde >= iso)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 2)
}

export function eerstvolgendeVrijeDag(vandaag: Date = new Date()): { datum: string; naam: string } | null {
  // Kijk of we in een vakantie zitten of een vakantie nadert
  const iso = vandaag.toISOString().slice(0, 10)
  const vakanties = haalVakantieperiodes()

  // In vakantie?
  const huidige = vakanties.find(v => v.start <= iso && v.einde >= iso)
  if (huidige) return { datum: huidige.einde, naam: `${huidige.naam} (nog bezig)` }

  // Aankomend weekend
  const dag = vandaag.getDay()
  const dagenTotWeekend = dag === 6 ? 0 : dag === 0 ? 0 : 6 - dag
  const weekend = new Date(vandaag)
  weekend.setDate(weekend.getDate() + dagenTotWeekend)
  const weekendIso = weekend.toISOString().slice(0, 10)

  // Aankomende vakantie vóór het weekend?
  const aankomend = vakanties.find(v => v.start > iso)
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
    { datum: '2025-12-27', omschrijving: 'Kerstvakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-01-04', omschrijving: 'Kerstvakantie (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-02-21', omschrijving: 'Voorjaarsvakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-03-01', omschrijving: 'Voorjaarsvakantie (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-04-03', omschrijving: 'Goede Vrijdag (vrij)', leerling: 'beiden', type: 'vrij' },
    { datum: '2026-04-06', omschrijving: '2e Paasdag (vrij)', leerling: 'beiden', type: 'vrij' },
    { datum: '2026-04-25', omschrijving: 'Meivakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-05-10', omschrijving: 'Meivakantie (einde)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-05-11', omschrijving: 'Centraal examen start — dochter', leerling: 'dochter', type: 'examen' },
    { datum: '2026-07-04', omschrijving: 'Zomervakantie (start)', leerling: 'beiden', type: 'vakantie' },
    { datum: '2026-08-16', omschrijving: 'Zomervakantie (einde)', leerling: 'beiden', type: 'vakantie' },
  ]
}
