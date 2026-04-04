import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { getConfig, setConfig, taakAfvinken } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const body = await req.json()
  const { actie, taakNaam, intervalDagen } = body

  const taken = (await getConfig('huishoudtaken') as { naam: string; interval_dagen: number }[]) || []

  switch (actie) {
    case 'afvinken': {
      await taakAfvinken(taakNaam)
      return NextResponse.json({ ok: true })
    }

    case 'toevoegen': {
      if (taken.some(t => t.naam === taakNaam)) {
        return NextResponse.json({ error: 'Taak bestaat al' }, { status: 400 })
      }
      taken.push({ naam: taakNaam, interval_dagen: intervalDagen })
      await setConfig('huishoudtaken', taken)
      return NextResponse.json({ ok: true })
    }

    case 'verwijderen': {
      await setConfig('huishoudtaken', taken.filter(t => t.naam !== taakNaam))
      return NextResponse.json({ ok: true })
    }

    case 'wijzigen': {
      const taak = taken.find(t => t.naam === taakNaam)
      if (!taak) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
      taak.interval_dagen = intervalDagen
      await setConfig('huishoudtaken', taken)
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 })
  }
}
