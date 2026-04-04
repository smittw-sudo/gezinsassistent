import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { vakantiePlanOphalen, vakantiePlanToevoegen, vakantiePlanAfvinken, vakantiePlanVerwijderen } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const start = req.nextUrl.searchParams.get('start')
  if (!start) return NextResponse.json({ error: 'start vereist' }, { status: 400 })
  return NextResponse.json(await vakantiePlanOphalen(start))
}

export async function POST(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const body = await req.json()
  const { actie } = body

  if (actie === 'toevoegen') {
    await vakantiePlanToevoegen(body.vakantieNaam, body.vakantieStart, body.idee, body.toegewezenAan, body.boekingsdatum)
  } else if (actie === 'afvinken') {
    await vakantiePlanAfvinken(body.id, body.klaar)
  } else if (actie === 'verwijderen') {
    await vakantiePlanVerwijderen(body.id)
  } else {
    return NextResponse.json({ error: 'onbekende actie' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
