/**
 * Kalender reader via CalDAV (iCloud) en ICS parsing.
 * Werkt server-side op Vercel.
 */
import { DAVClient } from 'tsdav'
import ical from 'node-ical'
import { addDays, format, parseISO, isWithinInterval, startOfDay } from 'date-fns'

export interface KalenderEvent {
  datum: string       // YYYY-MM-DD
  titel: string
  locatie: string
  kalender: string
  bron: 'caldav' | 'handmatig'
  id?: string | number
}

export async function haalCalDAVEvents(dagenVooruit = 21): Promise<KalenderEvent[]> {
  const username = process.env.ICLOUD_USERNAME
  const password = process.env.ICLOUD_APP_PASSWORD

  if (!username || !password) return []

  const vandaag = startOfDay(new Date())
  const einddatum = addDays(vandaag, dagenVooruit)

  try {
    const client = new DAVClient({
      serverUrl: 'https://caldav.icloud.com',
      credentials: { username, password },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    })

    await client.login()
    const calendars = await client.fetchCalendars()

    const events: KalenderEvent[] = []

    for (const cal of calendars) {
      const objects = await client.fetchCalendarObjects({
        calendar: cal,
        timeRange: {
          start: format(vandaag, "yyyyMMdd'T'HHmmss'Z'"),
          end: format(einddatum, "yyyyMMdd'T'HHmmss'Z'"),
        },
      })

      for (const obj of objects) {
        if (!obj.data) continue
        const parsed = ical.sync.parseICS(obj.data)

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
            kalender: String(cal.displayName || 'iCloud'),
            bron: 'caldav',
          })
        }
      }
    }

    events.sort((a, b) => a.datum.localeCompare(b.datum))
    return events
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
