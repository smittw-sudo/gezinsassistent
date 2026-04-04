/**
 * Kalender reader via CalDAV (iCloud)
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

async function caldavRequest(
  url: string,
  method: string,
  auth: string,
  depth: string,
  body: string
): Promise<string> {
  const resp = await fetch(url, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Depth': depth,
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body,
    redirect: 'follow',
  })
  if (!resp.ok && resp.status !== 207) {
    throw new Error(`CalDAV ${method} ${url} -> HTTP ${resp.status}`)
  }
  return resp.text()
}

function parseHrefs(xml: string): string[] {
  const matches = xml.matchAll(/<[^>]*:?href[^>]*>([^<]+)<\/[^>]*:?href>/g)
  return Array.from(matches).map(m => m[1].trim())
}

function absoluteUrl(base: string, href: string): string {
  if (href.startsWith('http')) return href
  const u = new URL(base)
  return `${u.protocol}//${u.host}${href}`
}

/** Haal alleen de kalender-namen op (zonder events) */
export async function haalCalDAVKalenderNamen(): Promise<string[]> {
  const username = process.env.ICLOUD_USERNAME
  const password = process.env.ICLOUD_APP_PASSWORD
  if (!username || !password) return []
  const auth = Buffer.from(`${username}:${password}`).toString('base64')
  try {
    const wellKnownResp = await fetch('https://caldav.icloud.com/.well-known/caldav', {
      method: 'GET', headers: { 'Authorization': `Basic ${auth}` }, redirect: 'follow',
    })
    const serverBase = wellKnownResp.url.split('/').slice(0, 3).join('/')
    const principalXml = await caldavRequest(`${serverBase}/`, 'PROPFIND', auth, '0',
      `<?xml version="1.0"?><propfind xmlns="DAV:"><prop><current-user-principal/></prop></propfind>`)
    const principalHrefs = parseHrefs(principalXml).filter(h => h.includes('/') && !h.includes('caldav.icloud.com/'))
    const principalPath = principalHrefs.find(h => h.length > 1) || ''
    const principalUrl = principalPath.startsWith('http') ? principalPath : `${serverBase}${principalPath}`
    const homeXml = await caldavRequest(principalUrl, 'PROPFIND', auth, '0',
      `<?xml version="1.0"?><propfind xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><prop><c:calendar-home-set/></prop></propfind>`)
    const homeHrefs = parseHrefs(homeXml).filter(h => h.includes('calendars') || h.includes('calendar'))
    const homeUrl = homeHrefs.length > 0 ? absoluteUrl(serverBase, homeHrefs[0]) : `${principalUrl}calendars/`
    const kalsXml = await caldavRequest(homeUrl, 'PROPFIND', auth, '1',
      `<?xml version="1.0"?><propfind xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><prop><displayname/><resourcetype/></prop></propfind>`)
    const responses = kalsXml.match(/<[^>]*:?response[^>]*>[\s\S]*?<\/[^>]*:?response>/g) || []
    const namen: string[] = []
    for (const r of responses) {
      if (!r.toLowerCase().includes('calendar')) continue
      if (r.toLowerCase().includes('inbox') || r.toLowerCase().includes('outbox')) continue
      const nameMatch = r.match(/<[^>]*:?displayname[^>]*>([^<]+)<\/[^>]*:?displayname>/)
      if (nameMatch?.[1]) namen.push(nameMatch[1])
    }
    return namen
  } catch { return [] }
}

export async function haalCalDAVEvents(dagenVooruit = 21, filterKalenders?: string[]): Promise<KalenderEvent[]> {
  const username = process.env.ICLOUD_USERNAME
  const password = process.env.ICLOUD_APP_PASSWORD

  if (!username || !password) {
    console.log('CalDAV: geen credentials')
    return []
  }

  const auth = Buffer.from(`${username}:${password}`).toString('base64')
  const vandaag = startOfDay(new Date())
  const einddatum = addDays(vandaag, dagenVooruit)

  try {
    // Stap 1: ontdek de echte server URL via well-known redirect
    const wellKnownResp = await fetch('https://caldav.icloud.com/.well-known/caldav', {
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` },
      redirect: 'follow',
    })
    const serverBase = wellKnownResp.url.split('/').slice(0, 3).join('/')
    console.log('CalDAV server:', serverBase)

    // Stap 2: principal URL
    const principalXml = await caldavRequest(
      `${serverBase}/`,
      'PROPFIND', auth, '0',
      `<?xml version="1.0"?><propfind xmlns="DAV:"><prop><current-user-principal/></prop></propfind>`
    )

    const principalHrefs = parseHrefs(principalXml).filter(h => h.includes('/') && !h.includes('caldav.icloud.com/'))
    let principalPath = principalHrefs.find(h => h.length > 1) || ''
    const principalUrl = principalPath.startsWith('http') ? principalPath : `${serverBase}${principalPath}`
    console.log('CalDAV principal:', principalUrl)

    // Stap 3: calendar-home-set
    const homeXml = await caldavRequest(
      principalUrl,
      'PROPFIND', auth, '0',
      `<?xml version="1.0"?><propfind xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><prop><c:calendar-home-set/></prop></propfind>`
    )

    const homeHrefs = parseHrefs(homeXml).filter(h => h.includes('calendars') || h.includes('calendar'))
    const homeUrl = homeHrefs.length > 0
      ? absoluteUrl(serverBase, homeHrefs[0])
      : `${principalUrl}calendars/`
    console.log('CalDAV home:', homeUrl)

    // Stap 4: kalenders ophalen
    const kalsXml = await caldavRequest(
      homeUrl,
      'PROPFIND', auth, '1',
      `<?xml version="1.0"?><propfind xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><prop><displayname/><resourcetype/></prop></propfind>`
    )

    // Splits op <response> blokken
    const responses = kalsXml.match(/<[^>]*:?response[^>]*>[\s\S]*?<\/[^>]*:?response>/g) || []
    const kalenders: { url: string; naam: string }[] = []

    for (const r of responses) {
      if (!r.toLowerCase().includes('calendar')) continue
      if (r.toLowerCase().includes('inbox') || r.toLowerCase().includes('outbox')) continue
      const hrefMatch = r.match(/<[^>]*:?href[^>]*>([^<]+)<\/[^>]*:?href>/)
      const nameMatch = r.match(/<[^>]*:?displayname[^>]*>([^<]*)<\/[^>]*:?displayname>/)
      if (hrefMatch) {
        kalenders.push({
          url: absoluteUrl(serverBase, hrefMatch[1].trim()),
          naam: nameMatch?.[1] || 'iCloud',
        })
      }
    }

    console.log(`CalDAV: ${kalenders.length} kalenders gevonden:`, kalenders.map(k => k.naam))

    if (kalenders.length === 0) return []

    // Filter op geselecteerde kalenders (als opgegeven)
    const actieveKalenders = filterKalenders && filterKalenders.length > 0
      ? kalenders.filter(k => filterKalenders.includes(k.naam))
      : kalenders

    // Stap 5: events ophalen per kalender
    const startStr = format(vandaag, "yyyyMMdd'T'000000'Z'")
    const endStr = format(einddatum, "yyyyMMdd'T'235959'Z'")
    const alleEvents: KalenderEvent[] = []

    for (const kal of actieveKalenders) {
      try {
        const eventsXml = await caldavRequest(
          kal.url,
          'REPORT', auth, '1',
          `<?xml version="1.0"?><c:calendar-query xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:prop><d:getetag/><c:calendar-data/></d:prop>
  <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">
    <c:time-range start="${startStr}" end="${endStr}"/>
  </c:comp-filter></c:comp-filter></c:filter>
</c:calendar-query>`
        )

        const dataBlokken = eventsXml.match(/<[^>]*calendar-data[^>]*>([\s\S]*?)<\/[^>]*calendar-data>/g) || []

        for (const blok of dataBlokken) {
          const icsData = blok
            .replace(/<[^>]*calendar-data[^>]*>/, '')
            .replace(/<\/[^>]*calendar-data>/, '')
            .replace(/&#13;/g, '').trim()

          if (!icsData.includes('BEGIN:VCALENDAR')) continue

          try {
            const parsed = ical.sync.parseICS(icsData)
            for (const comp of Object.values(parsed)) {
              if (!comp || comp.type !== 'VEVENT') continue
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const ev = comp as any
              const evStart = ev.start as Date | undefined
              if (!evStart) continue

              const eventDatum = startOfDay(evStart)
              if (!isWithinInterval(eventDatum, { start: vandaag, end: einddatum })) continue

              alleEvents.push({
                datum: format(evStart, 'yyyy-MM-dd'),
                titel: String(ev.summary || ''),
                locatie: String(ev.location || ''),
                kalender: kal.naam,
                bron: 'caldav',
              })
            }
          } catch { /* ongeldige ICS */ }
        }
      } catch (e) {
        console.error(`CalDAV events fout voor ${kal.naam}:`, e)
      }
    }

    alleEvents.sort((a, b) => a.datum.localeCompare(b.datum))
    console.log(`CalDAV: ${alleEvents.length} events totaal`)
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
  if (!laatsteUitvoering) return { status: 'onbekend', dagenTotVolgende: 0 }
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
