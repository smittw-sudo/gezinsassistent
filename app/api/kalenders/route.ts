import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { haalCalDAVKalenderNamen } from '@/lib/kalender'
import { getConfig, setConfig } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const [beschikbaar, geselecteerd] = await Promise.all([
    haalCalDAVKalenderNamen(),
    getConfig('geselecteerde_kalenders') as Promise<string[] | null>,
  ])

  return NextResponse.json({
    beschikbaar,
    geselecteerd: geselecteerd ?? beschikbaar, // standaard alles aan
  })
}

export async function POST(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const { geselecteerd } = await req.json()
  await setConfig('geselecteerde_kalenders', geselecteerd)
  return NextResponse.json({ ok: true })
}
