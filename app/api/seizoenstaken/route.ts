import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { haalSeizoensTaken } from '@/lib/seizoenstaken'

export async function GET(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout
  return NextResponse.json(haalSeizoensTaken())
}
