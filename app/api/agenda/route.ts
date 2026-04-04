import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { agendaItemToevoegen, agendaItemsOphalen, agendaItemVerwijderen } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout
  const items = await agendaItemsOphalen()
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const { titel, datum, herhaalIntervalDagen, notitie } = await req.json()
  if (!titel) return NextResponse.json({ error: 'Titel vereist' }, { status: 400 })

  const id = await agendaItemToevoegen(titel, datum || null, herhaalIntervalDagen || null, notitie || '')
  return NextResponse.json({ ok: true, id })
}

export async function DELETE(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const { id } = await req.json()
  await agendaItemVerwijderen(Number(id))
  return NextResponse.json({ ok: true })
}
