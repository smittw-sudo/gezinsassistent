import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { getConfig, setConfig } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const instellingen = await getConfig('instellingen')
  return NextResponse.json(instellingen || {})
}

export async function POST(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const updates = await req.json()
  const huidig = (await getConfig('instellingen') as Record<string, string>) || {}

  // Alleen bekende velden updaten
  const toegestaan = ['locatie', 'vakantie_regio', 'werk_regio']
  for (const veld of toegestaan) {
    if (updates[veld] !== undefined) huidig[veld] = updates[veld]
  }

  await setConfig('instellingen', huidig)
  return NextResponse.json({ ok: true })
}
