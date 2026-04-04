import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { getConfig, setConfig } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  try {
    const instellingen = await getConfig('instellingen')
    return NextResponse.json(instellingen || {})
  } catch (e) {
    console.error('GET /api/config fout:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  try {
    const updates = await req.json()
    const huidig = (await getConfig('instellingen') as Record<string, string>) || {}

    const toegestaan = ['locatie', 'vakantie_regio', 'werk_regio']
    for (const veld of toegestaan) {
      if (updates[veld] !== undefined) huidig[veld] = updates[veld]
    }

    await setConfig('instellingen', huidig)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/config fout:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
