import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { agendaItemToevoegen, agendaItemsOphalen, agendaItemVerwijderen } from '@/lib/supabase'

const TODO_TAG = '__todo__'
const NU_NODIG_TAG = '__nu_nodig__'

function vandaagIso() {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const alle = await agendaItemsOphalen()
  const vandaag = vandaagIso()

  const todos = alle
    .filter(i => i.datum === vandaag && i.notitie === TODO_TAG)
    .map(i => ({ id: i.id, tekst: i.titel, type: 'todo' as const }))

  const nuNodig = alle
    .filter(i => i.datum === vandaag && i.notitie === NU_NODIG_TAG)
    .map(i => ({ id: i.id, tekst: i.titel, type: 'nu_nodig' as const }))

  return NextResponse.json({ todos, nuNodig })
}

export async function POST(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const { actie, tekst, id } = await req.json()
  const vandaag = vandaagIso()

  if (actie === 'todo_toevoegen') {
    const itemId = await agendaItemToevoegen(tekst, vandaag, null, TODO_TAG)
    return NextResponse.json({ ok: true, id: itemId })
  }

  if (actie === 'nu_nodig_toevoegen') {
    const itemId = await agendaItemToevoegen(tekst, vandaag, null, NU_NODIG_TAG)
    return NextResponse.json({ ok: true, id: itemId })
  }

  if (actie === 'verwijderen') {
    await agendaItemVerwijderen(Number(id))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 })
}
