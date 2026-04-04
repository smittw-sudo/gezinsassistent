'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Event {
  datum: string
  titel: string
  locatie: string
  kalender: string
  bron: string
  id?: number
}

interface Taak {
  naam: string
  intervalDagen: number
  dagenTotVolgende: number
  status: 'te_doen' | 'binnenkort' | 'ok' | 'onbekend'
}

interface Signaal {
  naam?: string
  omschrijving?: string
  datum?: string
  dagenTot: number
  relatie?: string
  type: string
  leerling?: string
}

interface DashboardData {
  events: Event[]
  taken: Taak[]
  verjaardagen: Signaal[]
  feestdagen: Signaal[]
  schoolSignaleringen: Signaal[]
}

const DAGEN_NL = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const MAANDEN_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function formatDatum(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return `${DAGEN_NL[d.getDay()]} ${d.getDate()} ${MAANDEN_NL[d.getMonth()]}`
}

function isVandaag(iso: string) {
  return iso === new Date().toISOString().slice(0, 10)
}

function DagenBadge({ dagen }: { dagen: number }) {
  if (dagen <= 0) return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">vandaag!</span>
  if (dagen === 1) return <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">morgen</span>
  if (dagen <= 7) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">over {dagen}d</span>
  return <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">over {dagen}d</span>
}

function TaakBadge({ taak }: { taak: Taak }) {
  const stijl = {
    te_doen: 'bg-red-100 text-red-700',
    binnenkort: 'bg-amber-100 text-amber-700',
    onbekend: 'bg-purple-100 text-purple-700',
    ok: 'bg-green-100 text-green-700',
  }[taak.status]

  const label = {
    te_doen: `te doen (${Math.abs(taak.dagenTotVolgende)}d geleden)`,
    binnenkort: `over ${taak.dagenTotVolgende}d`,
    onbekend: 'nooit gedaan',
    ok: `over ${taak.dagenTotVolgende}d`,
  }[taak.status]

  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stijl}`}>{label}</span>
}

function Kaart({ titel, icoon, children, extra }: {
  titel: string
  icoon: string
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icoon}</span>
          <h2 className="font-semibold text-slate-800 text-sm">{titel}</h2>
        </div>
        {extra}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function Laden() {
  return <p className="text-slate-400 text-sm italic">Laden...</p>
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [suggesties, setSuggesties] = useState<string>('')
  const [suggestiesLaden, setSuggestiesLaden] = useState(true)
  const [afgevinkteItems, setAfgevinkteItems] = useState<Set<string>>(new Set())
  const [digestStatus, setDigestStatus] = useState('')
  const [digestLaden, setDigestLaden] = useState(false)
  const [likedSuggesties, setLikedSuggesties] = useState<Set<string>>(new Set())
  const [dislikedSuggesties, setDislikedSuggesties] = useState<Set<string>>(new Set())

  const laadDashboard = useCallback(async () => {
    const resp = await fetch('/api/dashboard')
    if (resp.ok) setData(await resp.json())
  }, [])

  const laadSuggesties = useCallback(async (ververs = false) => {
    setSuggestiesLaden(true)
    const resp = await fetch(`/api/suggesties${ververs ? '?ververs=1' : ''}`)
    if (resp.ok) {
      const d = await resp.json()
      setSuggesties(d.suggesties)
    }
    setSuggestiesLaden(false)
  }, [])

  useEffect(() => {
    laadDashboard()
    laadSuggesties()
  }, [laadDashboard, laadSuggesties])

  async function afvinken(taakNaam: string) {
    setAfgevinkteItems(prev => new Set(prev).add(taakNaam))
    await fetch('/api/taken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actie: 'afvinken', taakNaam }),
    })
    setTimeout(laadDashboard, 800)
  }

  async function stuurDigest() {
    setDigestLaden(true)
    setDigestStatus('')
    const resp = await fetch('/api/digest', { method: 'POST' })
    const d = await resp.json()
    setDigestStatus(d.bericht || (d.ok ? 'Verstuurd!' : 'Fout'))
    setDigestLaden(false)
  }

  async function suggestieFeedback(alinea: string, oordeel: 1 | -1) {
    if (oordeel === 1) setLikedSuggesties(prev => new Set(prev).add(alinea))
    else setDislikedSuggesties(prev => new Set(prev).add(alinea))
    await fetch('/api/suggesties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tekst: alinea, oordeel }),
    })
  }

  const vandaag = new Date()
  const vandaagStr = `${DAGEN_NL[vandaag.getDay()]} ${vandaag.getDate()} ${MAANDEN_NL[vandaag.getMonth()]} ${vandaag.getFullYear()}`

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-slate-800 to-blue-800 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">🏡 Gezinsassistent</h1>
          <p className="text-blue-200 text-sm">{vandaagStr}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { laadDashboard(); laadSuggesties() }}
            className="text-sm border border-white/30 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            Vernieuwen
          </button>
          <Link
            href="/instellingen"
            className="text-sm border border-white/30 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            ⚙️ Instellingen
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        {/* Signaleringen */}
        <Kaart titel="Signaleringen" icoon="🔔">
          {!data ? (
            <Laden />
          ) : (() => {
            const alle = [
              ...data.verjaardagen.map(v => ({ label: `🎂 ${v.naam}${v.relatie ? ` (${v.relatie})` : ''}`, dagen: v.dagenTot })),
              ...data.feestdagen.map(f => ({ label: `🎉 ${f.naam}`, dagen: f.dagenTot })),
              ...data.schoolSignaleringen.map(s => ({ label: `📚 ${s.omschrijving}${s.leerling ? ` – ${s.leerling}` : ''}`, dagen: s.dagenTot })),
            ].sort((a, b) => a.dagen - b.dagen)

            return alle.length === 0
              ? <p className="text-slate-400 text-sm italic">Niets bijzonders de komende periode</p>
              : alle.map((item, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-700">{item.label}</span>
                  <DagenBadge dagen={item.dagen} />
                </div>
              ))
          })()}
        </Kaart>

        {/* Agenda */}
        <Kaart titel="Agenda — 3 weken" icoon="📅">
          {!data ? <Laden /> : data.events.length === 0
            ? <p className="text-slate-400 text-sm italic">Geen afspraken de komende 3 weken</p>
            : data.events.map((e, i) => (
              <div key={i} className={`py-2 border-b border-slate-50 last:border-0 ${isVandaag(e.datum) ? 'bg-blue-50 -mx-4 px-4 rounded' : ''}`}>
                <p className={`text-xs ${isVandaag(e.datum) ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
                  {formatDatum(e.datum)}
                </p>
                <p className="text-sm font-medium text-slate-800">{e.titel}</p>
                {e.locatie && <p className="text-xs text-slate-400">{e.locatie}</p>}
                {e.kalender === 'Handmatig' && (
                  <span className="text-xs text-purple-500">handmatig toegevoegd</span>
                )}
              </div>
            ))
          }
        </Kaart>

        {/* Huishoudtaken */}
        <Kaart titel="Huishoudtaken" icoon="🏠">
          {!data ? <Laden /> : data.taken.map(taak => (
            <div key={taak.naam} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 gap-2">
              <span className="text-sm text-slate-700 flex-1">{taak.naam}</span>
              <TaakBadge taak={taak} />
              <button
                onClick={() => afvinken(taak.naam)}
                disabled={afgevinkteItems.has(taak.naam)}
                className="text-xs bg-slate-100 hover:bg-green-100 hover:text-green-700 disabled:bg-green-100 disabled:text-green-700 px-2 py-1 rounded-lg transition-colors ml-1 shrink-0"
              >
                {afgevinkteItems.has(taak.naam) ? '✓' : 'Gedaan'}
              </button>
            </div>
          ))}
        </Kaart>

        {/* Weekend suggesties */}
        <Kaart
          titel="Weekend suggesties"
          icoon="💡"
          extra={
            <button
              onClick={() => laadSuggesties(true)}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              ↻ Ververs
            </button>
          }
        >
          {suggestiesLaden ? <Laden /> : (
            <div className="space-y-4">
              {suggesties.split('\n\n').filter(Boolean).map((alinea, i) => {
                const isLiked = likedSuggesties.has(alinea)
                const isDisliked = dislikedSuggesties.has(alinea)
                return (
                  <div key={i} className={`group pb-3 border-b border-slate-50 last:border-0 ${isDisliked ? 'opacity-40' : ''}`}>
                    <p className="text-sm text-slate-700 leading-relaxed">{alinea}</p>
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={() => suggestieFeedback(alinea, 1)}
                        className={`text-xs transition-colors ${isLiked ? 'text-green-600 font-medium' : 'text-slate-400 hover:text-green-600'}`}
                      >
                        👍 {isLiked ? 'Geliked!' : 'Leuk idee'}
                      </button>
                      <button
                        onClick={() => suggestieFeedback(alinea, -1)}
                        className={`text-xs transition-colors ${isDisliked ? 'text-red-500 font-medium' : 'text-slate-400 hover:text-red-500'}`}
                      >
                        👎 {isDisliked ? 'Overgeslagen' : 'Niet voor ons'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Kaart>

        {/* Digest */}
        <Kaart titel="Wekelijkse digest" icoon="📧">
          <p className="text-sm text-slate-500 mb-3">
            Stuur een samenvatting van de komende week naar je e-mail.
          </p>
          <button
            onClick={stuurDigest}
            disabled={digestLaden}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {digestLaden ? 'Versturen...' : 'Digest versturen'}
          </button>
          {digestStatus && (
            <p className={`text-sm mt-2 ${digestStatus.includes('Fout') || digestStatus.includes('ontbreken') ? 'text-red-500' : 'text-green-600'}`}>
              {digestStatus}
            </p>
          )}
        </Kaart>

      </div>
    </div>
  )
}
