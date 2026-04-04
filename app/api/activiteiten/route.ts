import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { activiteitenOphalen, activiteitOpslaan, activiteitVerwijderen, activiteitGedaan } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout
  return NextResponse.json(await activiteitenOphalen())
}

export async function POST(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const body = await req.json()
  const { actie } = body

  if (actie === 'opslaan') {
    await activiteitOpslaan(body.tekst, body.modus || 'gezin')
  } else if (actie === 'verwijderen') {
    await activiteitVerwijderen(body.id)
  } else if (actie === 'gedaan') {
    await activiteitGedaan(body.id, body.gedaan)
  } else {
    return NextResponse.json({ error: 'onbekende actie' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
