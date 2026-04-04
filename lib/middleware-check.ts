import { NextRequest, NextResponse } from 'next/server'
import { controleerSession } from './auth'

/**
 * Gedeelde helper voor API routes om te controleren of de gebruiker ingelogd is.
 * Geeft null terug als OK, of een 401 response als niet ingelogd.
 */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const ok = await controleerSession(req)
  if (!ok) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }
  return null
}
