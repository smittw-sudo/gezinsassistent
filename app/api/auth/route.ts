import { NextRequest, NextResponse } from 'next/server'
import { maakSessionToken, setCookieEnRedirect, verwijderCookieEnRedirect } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { wachtwoord } = await req.json()
  const correct = process.env.APP_PASSWORD

  if (!correct || wachtwoord !== correct) {
    return NextResponse.json({ error: 'Onjuist wachtwoord' }, { status: 401 })
  }

  const token = await maakSessionToken()
  const origin = req.nextUrl.origin
  return setCookieEnRedirect(token, `${origin}/`)
}

export async function DELETE(req: NextRequest) {
  return verwijderCookieEnRedirect(`${req.nextUrl.origin}/login`)
}
