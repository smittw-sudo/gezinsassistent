/**
 * Kalender reader via CalDAV (iCloud) — directe HTTP fetch zonder tsdav.
 */
import ical from 'node-ical'
import { addDays, format, parseISO, isWithinInterval, startOfDay } from 'date-fns'

export interface KalenderEvent {
  datum: string
  titel: string
  locatie: string
  kalender: string
  bron: 'caldav' | 'handmatig'
  id?: string | number
}

// Haalt de CalDAV principal URL op voor iCloud
async function haalPrincipalUrl(username: string, password: string): Promise<string> {
  const auth = Buffer.from(`${username}:${password}`).toString('base64')

  // iCloud CalDAV principal
  const resp = await fetch('https://caldav.icloud.com/', {
    method: 'PROPFIND',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Depth': '0',
      'Content-Type': 'application/xml',
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop>
    <current-user-principal/>
  </prop>
</propfind>`,
  })

  const text = await resp.text()
  const match = text.match(/<href>([^<]*principal[^<]*)<\/href>/)
  if (match) return `https://caldav.icloud.com${match[1]}`
  return `https://caldav.icloud.com/${username.split('@')[0]}/`
}

// Haalt kalender-URLs op via PROPFIND
async function haalKalenders(principalUrl: string, auth: string): Promise<{ url: string; naam: string }[]> {
  // Haal home-set op
  const resp = await fetch(principalUrl, {
    method: 'PROPFIND',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Depth': '0',
      'Content-Type': 'application/xml',
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:" xmlns:cd="urn:ietf:params:xml:ns:caldav">
  <prop>
    <cd:calendar-home-set/>
  </prop>
</propfind>`,
  })

  const text = await resp.text()
  const homeMatch = text.match(/<href>([^<]*)<\/href>/)
  const homeUrl = homeMatch ? `https://caldav.icloud.com${homeMatch[1]}` : principalUrl

  // Haal kalenders op uit home-set
  const resp2 = await fetch(homeUrl, {
    method: 'PROPFIND',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Depth': '1',
      'Content-Type': 'application/xml',
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:" xmlns:cd="urn:ietf:params:xml:ns:caldav">
  <prop>
    <displayname/>
    <resourcetype/>
  </prop>
</propfind>`,
  })

  const text2 = await resp2.text()
  const kalenders: { url: string; naam: string }[] = []

  // Parse responses
  const responses = text2.match(/<response>([\s\S]*?)<\/response>/g) || []
  for (const r of responses) {
    if (!r.includes('calendar')) continue
    const hrefMatch = r.match(/<href>([^<]+)<\/href>/)
    const nameMatch = r.match(/<displayname>([^<]*)<\/displayname>/)
    if (hrefMatch) {
      const url = hrefMatch[1].startsWith('http')
        ? hrefMatch[1]
        : `https://caldav.icloud.com${hrefMatch[1]}`
      kalenders.push({ url, naam: nameMatch?.[1] || 'iCloud' })
    }
  }

  return kalenders
}

// Haalt events op via REPORT
async function haalEventsVanKalender(
  kalenderUrl: string,
  kalenderNaam: string,
  auth: string,
  vandaag: Date,
  einddatum: Date
): Promise<KalenderEvent[]> {
  const start = format(vandaag, "yyyyMMdd'T'000000'Z'")
  const end = format(einddatum, "yyyyMMdd'T'235959'Z'")

  const resp = await fetch(kalenderUrl, {
    method: 'REPORT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Depth': '1',
      'Content-Type': 'application/xml',
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<calendar-query xmlns="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:prop>
    <d:getetag/>
    <calendar-data/>
  </d:prop>
  <filter>
    <comp-filter name="VCALENDAR">
      <comp-filter name="VEVENT">
        <time-range start="${start}" end="${end}"/>
      </comp-filter>
    </comp-filter>
  </filter>
</calendar-query>`,
  })

  const text = await resp.text()
  const events: KalenderEvent[] = []

  // Extraheer calendar-data blokken
  const dataBlokken = text.match(/<calendar-data[^>]*>([\s\S]*?)<\/calendar-data>/g) || []

  for (const blok of dataBlokken) {
    const icsData = blok
      .replace(/<calendar-data[^>]*>/, '')
      .replace(/<\/calendar-data>/, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .trim()

    if (!icsData.includes('BEGIN:VCALENDAR')) continue

    try {
      const parsed = ical.sync.parseICS(icsData)
      for (const comp of Object.values(parsed)) {
        if (!comp || comp.type !== 'VEVENT') continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = comp as any
        const start = ev.start as Date | undefined
        if (!start) continue

        const eventDatum = startOfDay(start)
        if (!isWithinInterval(eventDatum, { start: vandaag, end: einddatum })) continue

        events.push({
          datum: format(start, 'yyyy-MM-dd'),
          titel: String(ev.summary || ''),
          locatie: String(ev.location || ''),
          kalender: kalenderNaam,
          bron: 'caldav',
        })
      }
    } catch {
      // Ongeldige ICS data — overslaan
    }
  }

  return events
}

export async function haalCalDAVEvents(dagenVooruit = 21): Promise<KalenderEvent[]> {
  const username = process.env.ICLOUD_USERNAME
  const password = process.env.ICLOUD_APP_PASSWORD

  if (!username || !password) {
    console.log('CalDAV: geen credentials ingesteld')
    return []
  }

  const vandaag = startOfDay(new Date())
  const einddatum = addDays(vandaag, dagenVooruit)
  const auth = Buffer.from(`${username}:${password}`).toString('base64')

  try {
    const principalUrl = await haalPrincipalUrl(username, password)
    const kalenders = await haalKalenders(principalUrl, auth)

    if (kalenders.length === 0) {
      console.log('CalDAV: geen kalenders gevonden')
      return []
    }

    const alleEvents: KalenderEvent[] = []
    for (const kal of kalenders) {
      const events = await haalEventsVanKalender(kal.url, kal.naam, auth, vandaag, einddatum)
      alleEvents.push(...events)
    }

    alleEvents.sort((a, b) => a.datum.localeCompare(b.datum))
    console.log(`CalDAV: ${alleEvents.length} events gevonden`)
    return alleEvents
  } catch (err) {
    console.error('CalDAV fout:', err)
    return []
  }
}

export function bepaalTaakStatus(
  intervalDagen: number,
  laatsteUitvoering: string | null
): { status: 'te_doen' | 'binnenkort' | 'ok' | 'onbekend'; dagenTotVolgende: number } {
  const vandaag = startOfDay(new Date())

  if (!laatsteUitvoering) {
    return { status: 'onbekend', dagenTotVolgende: 0 }
  }

  const laatste = startOfDay(parseISO(laatsteUitvoering))
  const volgende = addDays(laatste, intervalDagen)
  const dagenTotVolgende = Math.round((volgende.getTime() - vandaag.getTime()) / 86400000)

  if (dagenTotVolgende <= 0) return { status: 'te_doen', dagenTotVolgende }
  if (dagenTotVolgende <= 2) return { status: 'binnenkort', dagenTotVolgende }
  return { status: 'ok', dagenTotVolgende }
}

export function dagenTotDatum(maandDag: string): number {
  const [maand, dag] = maandDag.split('-').map(Number)
  const vandaag = startOfDay(new Date())
  let kandidaat = new Date(vandaag.getFullYear(), maand - 1, dag)
  if (kandidaat < vandaag) kandidaat = new Date(vandaag.getFullYear() + 1, maand - 1, dag)
  return Math.round((kandidaat.getTime() - vandaag.getTime()) / 86400000)
}
