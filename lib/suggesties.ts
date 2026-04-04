import Anthropic from '@anthropic-ai/sdk'
import { format, getDay } from 'date-fns'
import { nl } from 'date-fns/locale'
import { cacheOpslaan, cacheLezen } from './supabase'
import { eerstvolgendeVrijeDag, komende2Vakanties } from './school'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function genereerWeekendSuggesties(
  locatie: string,
  events: { datum: string; titel: string }[],
  feedback: { tekst: string; oordeel: number }[],
  ververs = false
): Promise<string> {
  const vandaag = new Date()
  const cacheKey = `suggesties_${format(vandaag, 'yyyy-MM-dd')}`

  if (!ververs) {
    const gecached = await cacheLezen(cacheKey, 12)
    if (gecached) return gecached
  }

  // Bepaal het eerstvolgende vrije moment (weekend of vakantie)
  const vrijeMoment = eerstvolgendeVrijeDag(vandaag)
  const vakanties = komende2Vakanties(vandaag)
  const eersteVakantie = vakanties[0]

  // Vrije weekenddagen de komende 3 weken zonder afspraken
  const komende21 = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(vandaag)
    d.setDate(d.getDate() + i)
    return d
  })
  const vrijeWeekend = komende21
    .filter(d => getDay(d) === 0 || getDay(d) === 6)
    .filter(d => !events.some(e => e.datum === format(d, 'yyyy-MM-dd')))
    .slice(0, 4) // max 4 vrije weekenddagen tonen

  // Activiteiten tijdens aankomende vakantie
  const vakantieEvents = eersteVakantie
    ? events.filter(e => e.datum >= eersteVakantie.start && e.datum <= eersteVakantie.einde)
    : []

  const liked = feedback.filter(f => f.oordeel === 1).slice(0, 5).map(f => `- ${f.tekst}`).join('\n')
  const disliked = feedback.filter(f => f.oordeel === -1).slice(0, 5).map(f => `- ${f.tekst}`).join('\n')

  const fokusLabel = vrijeMoment
    ? vrijeMoment.naam === 'Weekend'
      ? `aankomend weekend (${format(new Date(vrijeMoment.datum), 'EEEE d MMMM', { locale: nl })})`
      : `${vrijeMoment.naam} (start ${format(new Date(vrijeMoment.datum), 'd MMMM', { locale: nl })})`
    : 'komend weekend'

  const prompt = `Je bent persoonlijke gezinsassistent voor een gezin in ${locatie}, Noord-Holland.
Gezin: twee ouders, twee kinderen (middelbare school Hilversum).

Vandaag: ${format(vandaag, 'EEEE d MMMM yyyy', { locale: nl })}
Focus op: ${fokusLabel}

Vrije weekenddagen zonder afspraken: ${vrijeWeekend.map(d => format(d, 'EEEE d MMMM', { locale: nl })).join(', ') || 'geen'}
${eersteVakantie ? `\nAankomende vakantie: ${eersteVakantie.naam} (${eersteVakantie.start} t/m ${eersteVakantie.einde})${vakantieEvents.length ? `\nAl gepland in vakantie: ${vakantieEvents.map(e => e.titel).join(', ')}` : ''}` : ''}
${liked ? `\nEerder gewaardeerd (doe meer zo):\n${liked}` : ''}${disliked ? `\nMinder geschikt (vermijd):\n${disliked}` : ''}

Geef precies 3 concrete activiteitensuggesties gericht op ${fokusLabel}.
Kies uitjes in Noord-Holland, Gooi, Vechtstreek of Eemnes-omgeving.
Wees specifiek: noem plaatsnamen, routes, evenementen of adressen.
Houd rekening met het seizoen (${format(vandaag, 'MMMM', { locale: nl })}).
Formaat: emoji + **naam** op de eerste regel, daarna 2 zinnen uitleg.`

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
