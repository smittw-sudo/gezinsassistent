import Anthropic from '@anthropic-ai/sdk'
import { format, getDay } from 'date-fns'
import { nl } from 'date-fns/locale'
import { cacheOpslaan, cacheLezen } from './supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function genereerWeekendSuggesties(
  locatie: string,
  events: { datum: string; titel: string }[],
  feedback: { tekst: string; oordeel: number }[],
  ververs = false
): Promise<string> {
  const cacheKey = `suggesties_${format(new Date(), 'yyyy-MM-dd')}`

  if (!ververs) {
    const gecached = await cacheLezen(cacheKey, 12)
    if (gecached) return gecached
  }

  const vandaag = new Date()
  const komende21Dagen = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(vandaag)
    d.setDate(d.getDate() + i)
    return d
  })

  const weekenddagen = komende21Dagen.filter(d => getDay(d) === 0 || getDay(d) === 6)
  const vrij = weekenddagen.filter(d => {
    const iso = format(d, 'yyyy-MM-dd')
    return !events.some(e => e.datum === iso)
  })

  const likedTekst = feedback
    .filter(f => f.oordeel === 1)
    .slice(0, 5)
    .map(f => `- ${f.tekst}`)
    .join('\n')

  const dislikedTekst = feedback
    .filter(f => f.oordeel === -1)
    .slice(0, 5)
    .map(f => `- ${f.tekst}`)
    .join('\n')

  const prompt = `Je bent een persoonlijke gezinsassistent voor een gezin in de omgeving van ${locatie} (Noord-Holland).
Gezin: twee ouders, twee kinderen op het Roland Holst College in Hilversum.

Vandaag: ${format(vandaag, 'EEEE d MMMM yyyy', { locale: nl })}
Vrije weekenddagen komende 3 weken: ${vrij.map(d => format(d, 'EEEE d MMMM', { locale: nl })).join(', ') || 'geen'}

${likedTekst ? `Eerder gewaardeerde suggesties (doe meer zo):\n${likedTekst}\n` : ''}${dislikedTekst ? `Minder geschikte suggesties (vermijd dit):\n${dislikedTekst}\n` : ''}
Geef 4 concrete activiteitensuggesties voor de vrije weekenddagen. Wees specifiek: noem plaatsnamen, routes, evenementen, restaurants of uitjes in Noord-Holland/Gooi/Vechtstreek.
Formaat: geef elke suggestie als één alinea van 2-3 zinnen. Begin elke suggestie met een emoji en de naam van de activiteit in **vet**.`

  const bericht = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const tekst = (bericht.content[0] as { type: string; text: string }).text
  await cacheOpslaan(cacheKey, tekst)
  return tekst
}

export async function genereerDigestTekst(dashboardData: {
  events: { datum: string; titel: string; kalender: string }[]
  taken: { naam: string; status: string; dagenTotVolgende: number }[]
  verjaardagen: { naam: string; dagenTot: number; relatie: string }[]
  feestdagen: { naam: string; dagenTot: number }[]
  schoolSignaleringen: { omschrijving: string; datum: string; leerling: string }[]
}): Promise<string> {
  const vandaag = format(new Date(), 'EEEE d MMMM yyyy', { locale: nl })

  const context = `Vandaag: ${vandaag}

KALENDER:
${dashboardData.events.slice(0, 10).map(e => `- ${e.datum}: ${e.titel} (${e.kalender})`).join('\n') || 'Geen afspraken'}

HUISHOUDTAKEN TE DOEN:
${dashboardData.taken.filter(t => ['te_doen', 'binnenkort', 'onbekend'].includes(t.status)).map(t => `- ${t.naam}`).join('\n') || 'Alles bij'}

VERJAARDAGEN:
${dashboardData.verjaardagen.map(v => `- ${v.naam} over ${v.dagenTot} dagen (${v.relatie})`).join('\n') || 'Geen'}

FEESTDAGEN:
${dashboardData.feestdagen.map(f => `- ${f.naam} over ${f.dagenTot} dagen`).join('\n') || 'Geen'}

SCHOOL:
${dashboardData.schoolSignaleringen.map(s => `- ${s.omschrijving} (${s.datum}) - ${s.leerling}`).join('\n') || 'Geen bijzonderheden'}`

  const bericht = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Je bent een vriendelijke gezinsassistent. Schrijf een beknopte wekelijkse samenvatting (max 150 woorden) voor een druk gezin. Wees praktisch en direct. Noem de belangrijkste aandachtspunten voor deze week.\n\n${context}`,
    }],
  })

  return (bericht.content[0] as { type: string; text: string }).text
}
