import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware-check'
import { genereerDigestTekst } from '@/lib/suggesties'
import { getConfig, agendaItemsOphalen, suggestieFeedbackOphalen } from '@/lib/supabase'
import { haalCalDAVEvents, bepaalTaakStatus, dagenTotDatum } from '@/lib/kalender'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const authFout = await requireAuth(req)
  if (authFout) return authFout

  const [takenConfig, verjaardagenConfig, feestdagenConfig, calEvents, agendaItems] =
    await Promise.all([
      getConfig('huishoudtaken') as Promise<{ naam: string; interval_dagen: number }[]>,
      getConfig('verjaardagen') as Promise<{ naam: string; datum: string; relatie: string }[]>,
      getConfig('feestdagen') as Promise<{ naam: string; datum: string }[]>,
      haalCalDAVEvents(21),
      agendaItemsOphalen(),
    ])

  const handmatig = agendaItems
    .filter(i => i.datum)
    .map(i => ({ datum: i.datum!, titel: i.titel, kalender: 'Handmatig' }))

  const events = [...calEvents.map(e => ({ datum: e.datum, titel: e.titel, kalender: e.kalender })), ...handmatig]
    .sort((a, b) => a.datum.localeCompare(b.datum))

  const taken = (takenConfig || []).map(t => ({
    naam: t.naam,
    ...bepaalTaakStatus(t.interval_dagen, null),
  }))

  const verjaardagen = (verjaardagenConfig || [])
    .map(v => ({ naam: v.naam, dagenTot: dagenTotDatum(v.datum), relatie: v.relatie }))
    .filter(v => v.dagenTot <= 21)

  const feestdagen = (feestdagenConfig || [])
    .map(f => ({ naam: f.naam, dagenTot: dagenTotDatum(f.datum) }))
    .filter(f => f.dagenTot <= 60)

  const digestTekst = await genereerDigestTekst({
    events,
    taken,
    verjaardagen,
    feestdagen,
    schoolSignaleringen: [],
  })

  // E-mail versturen
  const emailVan = process.env.EMAIL_VAN
  const emailNaar = process.env.EMAIL_NAAR
  const smtpServer = process.env.EMAIL_SMTP_SERVER || 'smtp.mail.me.com'
  const smtpPort = Number(process.env.EMAIL_SMTP_PORT || 587)
  const wachtwoord = process.env.EMAIL_WACHTWOORD

  if (!emailVan || !emailNaar || !wachtwoord) {
    return NextResponse.json({ ok: false, bericht: 'E-mailinstellingen ontbreken in omgevingsvariabelen' })
  }

  const transporter = nodemailer.createTransport({
    host: smtpServer,
    port: smtpPort,
    secure: false,
    auth: { user: emailVan, pass: wachtwoord },
  })

  await transporter.sendMail({
    from: emailVan,
    to: emailNaar,
    subject: 'Weekoverzicht gezin',
    text: digestTekst,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#2c3e50">Weekoverzicht gezin</h2>
<div style="background:#f8f9fa;padding:16px;border-radius:8px;white-space:pre-wrap">${digestTekst}</div>
<p style="color:#999;font-size:12px;margin-top:24px">Gezinsassistent</p>
</div>`,
  })

  return NextResponse.json({ ok: true, bericht: 'Digest verstuurd' })
}
