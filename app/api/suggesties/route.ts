import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { genereerWeekendSuggesties } from '@/lib/suggesties'
import { getConfig, suggestieLike, suggestieFeedbackOphalen } from '@/lib/supabase'
import { haalCalDAVEvents } from '@/lib/kalender'

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const ververs = req.nextUrl.searchParams.get('ververs') === '1'
  const modus = (req.nextUrl.searchParams.get('modus') || 'gezin') as 'gezin' | 'stel'
  const instellingen = await getConfig('instellingen') as { locatie?: string } | null
  const events = await haalCalDAVEvents(21)
  const feedback = await suggestieFeedbackOphalen()

  const tekst = await genereerWeekendSuggesties(
    instellingen?.locatie || 'Hilversum',
    events,
    feedback,
    ververs,
    modus
  )

  return NextResponse.json({ suggesties: tekst })
}

export async function POST(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const { tekst, oordeel } = await req.json()
  if (![1, -1].includes(oordeel)) {
    return NextResponse.json({ error: 'oordeel moet 1 of -1 zijn' }, { status: 400 })
  }

  await suggestieLike(tekst, oordeel as 1 | -1)
  return NextResponse.json({ ok: true })
}
