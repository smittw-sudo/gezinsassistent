import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { getConfig, setConfig } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout
  const data = await getConfig('verjaardagen')
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const { actie, naam, datum, relatie } = await req.json()
  const lijst = (await getConfig('verjaardagen') as { naam: string; datum: string; relatie: string }[]) || []

  if (actie === 'toevoegen') {
    lijst.push({ naam, datum, relatie: relatie || '' })
    await setConfig('verjaardagen', lijst)
    return NextResponse.json({ ok: true })
  }

  if (actie === 'verwijderen') {
    await setConfig('verjaardagen', lijst.filter(v => v.naam !== naam))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 })
}
