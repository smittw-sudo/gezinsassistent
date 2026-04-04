'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Event { datum: string; titel: string; locatie: string; kalender: string; bron: string; id?: number }
interface Taak { naam: string; intervalDagen: number; dagenTotVolgende: number; status: 'te_doen' | 'binnenkort' | 'ok' | 'onbekend' }
interface Signaal { naam?: string; omschrijving?: string; dagenTot: number; relatie?: string; type: string; leerling?: string }
interface Todo { id: number; tekst: string }
interface Vakantie { naam: string; start: string; einde: string; regio: string; dagenTot: number; events: Event[] }

interface DashboardData {
  events: Event[]
  vandaagEvents: Event[]
  taken: Taak[]
  verjaardagen: Signaal[]
  feestdagen: Signaal[]
  schoolSignaleringen: Signaal[]
  todos: Todo[]
  nuNodig: Todo[]
  vakanties: Vakantie[]
}

const DAGEN = ['zo','ma','di','wo','do','vr','za']
const MAANDEN = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
const MAANDEN_LANG = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']

function fmtDatum(iso: string, lang = false) {
  const d = new Date(iso + 'T00:00:00')
  return `${DAGEN[d.getDay()]} ${d.getDate()} ${lang ? MAANDEN_LANG[d.getMonth()] : MAANDEN[d.getMonth()]}`
}
function fmtPeriode(start: string, einde: string) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(einde + 'T00:00:00')
  return `${s.getDate()} ${MAANDEN_LANG[s.getMonth()]} – ${e.getDate()} ${MAANDEN_LANG[e.getMonth()]}`
}
function isVandaag(iso: string) { return iso === new Date().toISOString().slice(0, 10) }

function DagenBadge({ d }: { d: number }) {
  if (d <= 0) return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">vandaag!</span>
  if (d === 1) return <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">morgen</span>
  if (d <= 7) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">over {d}d</span>
  return <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">over {d}d</span>
}

function TaakBadge({ t }: { t: Taak }) {
  const s = { te_doen: 'bg-red-100 text-red-700', binnenkort: 'bg-amber-100 text-amber-700', onbekend: 'bg-purple-100 text-purple-700', ok: 'bg-green-100 text-green-700' }[t.status]
  const l = { te_doen: `te doen`, binnenkort: `over ${t.dagenTotVolgende}d`, onbekend: 'nooit gedaan', ok: `over ${t.dagenTotVolgende}d` }[t.status]
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s}`}>{l}</span>
}

function Kaart({ titel, icoon, children, extra, accent }: { titel: string; icoon: string; children: React.ReactNode; extra?: React.ReactNode; accent?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden ${accent ? `border-${accent}-200` : 'border-slate-100'}`}>
      <div className={`flex items-center justify-between px-5 py-3.5 border-b ${accent ? `border-${accent}-100 bg-${accent}-50` : 'border-slate-100'}`}>
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

function Laden() { return <p className="text-slate-400 text-sm italic">Laden...</p> }

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [suggesties, setSuggesties] = useState('')
  const [suggestiesLaden, setSuggestiesLaden] = useState(true)
  const [afgevinkteItems, setAfgevinkteItems] = useState<Set<string>>(new Set())
  const [nuNodigItems, setNuNodigItems] = useState<Set<string>>(new Set())
  const [afgevinktSignaleringen, setAfgevinktSignaleringen] = useState<Set<string>>(new Set())
  const [likedSug, setLikedSug] = useState<Set<string>>(new Set())
  const [dislikedSug, setDislikedSug] = useState<Set<string>>(new Set())
  const [digestStatus, setDigestStatus] = useState('')
  const [digestLaden, setDigestLaden] = useState(false)
  const [nieuweTodo, setNieuweTodo] = useState('')
  const [todoToevoegen, setTodoToevoegen] = useState(false)

  const laadDashboard = useCallback(async () => {
    const r = await fetch('/api/dashboard')
    if (r.ok) setData(await r.json())
  }, [])

  const laadSuggesties = useCallback(async (ververs = false) => {
    setSuggestiesLaden(true)
    const r = await fetch(`/api/suggesties${ververs ? '?ververs=1' : ''}`)
    if (r.ok) setSuggesties((await r.json()).suggesties)
    setSuggestiesLaden(false)
  }, [])

  useEffect(() => { laadDashboard(); laadSuggesties() }, [laadDashboard, laadSuggesties])

  async function afvinken(naam: string) {
    setAfgevinkteItems(p => new Set(p).add(naam))
    await fetch('/api/taken', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actie: 'afvinken', taakNaam: naam }) })
    setTimeout(laadDashboard, 800)
  }

  async function nuNodig(naam: string) {
    setNuNodigItems(p => new Set(p).add(naam))
    await fetch('/api/taken', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actie: 'nu_nodig', taakNaam: naam }) })
    laadDashboard()
  }

  async function afvinkSignalering(item: { type: string; key: string; id?: number; label: string }) {
    // Direct visueel verbergen
    setAfgevinktSignaleringen(p => new Set(p).add(item.key))
    if (item.type === 'taak') {
      const naam = item.label.replace(/^🏠 /, '')
      setAfgevinkteItems(p => new Set(p).add(naam))
      await fetch('/api/taken', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actie: 'afvinken', taakNaam: naam }) })
      setTimeout(laadDashboard, 800)
    } else if (item.type === 'todo' || item.type === 'nu_nodig') {
      if (item.id != null) {
        await fetch('/api/signaleringen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actie: 'verwijderen', id: item.id }) })
        laadDashboard()
      }
    }
    // event/verjaardag/feestdag/school: alleen lokaal verbergen
  }

  async function voegTodoToe() {
    if (!nieuweTodo.trim()) return
    await fetch('/api/signaleringen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actie: 'todo_toevoegen', tekst: nieuweTodo.trim() }) })
    setNieuweTodo('')
    setTodoToevoegen(false)
    laadDashboard()
  }

  async function verwijderTodo(id: number) {
    await fetch('/api/signaleringen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actie: 'verwijderen', id }) })
    laadDashboard()
  }

  async function sugFeedback(tekst: string, oordeel: 1 | -1) {
    if (oordeel === 1) setLikedSug(p => new Set(p).add(tekst))
    else setDislikedSug(p => new Set(p).add(tekst))
    await fetch('/api/suggesties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tekst, oordeel }) })
  }

  async function stuurDigest() {
    setDigestLaden(true); setDigestStatus('')
    const r = await fetch('/api/digest', { method: 'POST' })
    const d = await r.json()
    setDigestStatus(d.bericht || (d.ok ? 'Verstuurd!' : 'Fout'))
    setDigestLaden(false)
  }

  const nu = new Date()
  const vandaagStr = `${DAGEN[nu.getDay()]} ${nu.getDate()} ${MAANDEN_LANG[nu.getMonth()]} ${nu.getFullYear()}`

  // Bouw signaleringen samen
  const alleSignaleringen = data ? [
    // Vandaag's agenda-events
    ...data.vandaagEvents.map(e => ({ label: `📅 ${e.titel}`, subLabel: e.locatie || e.kalender, dagen: 0, type: 'event', key: `ev-${e.titel}` })),
    // Urgente taken
    ...data.taken.filter(t => t.status === 'te_doen' || t.status === 'onbekend').map(t => ({ label: `🏠 ${t.naam}`, subLabel: t.status === 'onbekend' ? 'nooit gedaan' : 'al te lang geleden', dagen: 0, type: 'taak', key: `taak-${t.naam}` })),
    // Nu nodig taken
    ...data.nuNodig.map(n => ({ label: `⚡ ${n.tekst}`, subLabel: 'nu nodig', dagen: 0, type: 'nu_nodig', key: `nn-${n.id}`, id: n.id })),
    // Dagelijkse todos
    ...data.todos.map(t => ({ label: `✅ ${t.tekst}`, subLabel: 'taak vandaag', dagen: 0, type: 'todo', key: `todo-${t.id}`, id: t.id })),
    // Verjaardagen
    ...data.verjaardagen.map(v => ({ label: `🎂 ${v.naam}${v.relatie ? ` (${v.relatie})` : ''}`, subLabel: '', dagen: v.dagenTot, type: 'verjaardag', key: `vj-${v.naam}` })),
    // Feestdagen
    ...data.feestdagen.map(f => ({ label: `🎉 ${f.naam}`, subLabel: '', dagen: f.dagenTot, type: 'feestdag', key: `fd-${f.naam}` })),
    // School
    ...data.schoolSignaleringen.map(s => ({ label: `📚 ${s.omschrijving}${s.leerling ? ` – ${s.leerling}` : ''}`, subLabel: '', dagen: s.dagenTot, type: 'school', key: `sc-${s.omschrijving}` })),
  ].sort((a, b) => a.dagen - b.dagen).filter(item => !afgevinktSignaleringen.has(item.key)) : []

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-slate-800 to-blue-800 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">🏡 Gezinsassistent</h1>
          <p className="text-blue-200 text-sm">{vandaagStr}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { laadDashboard(); laadSuggesties() }} className="text-sm border border-white/30 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">Vernieuwen</button>
          <Link href="/instellingen" className="text-sm border border-white/30 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">⚙️ Instellingen</Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        {/* ── SIGNALERINGEN ── */}
        <Kaart titel="Signaleringen van vandaag" icoon="🔔" extra={
          <button onClick={() => setTodoToevoegen(v => !v)} className="text-lg text-slate-400 hover:text-blue-600 transition-colors font-bold leading-none" title="Todo toevoegen">+</button>
        }>
          {!data ? <Laden /> : (
            <div>
              {todoToevoegen && (
                <div className="flex gap-2 mb-3">
                  <input
                    autoFocus
                    value={nieuweTodo}
                    onChange={e => setNieuweTodo(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') voegTodoToe(); if (e.key === 'Escape') setTodoToevoegen(false) }}
                    placeholder="Taak voor vandaag..."
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={voegTodoToe} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm">+</button>
                </div>
              )}
              {alleSignaleringen.length === 0
                ? <p className="text-slate-400 text-sm italic">Niets bijzonders vandaag</p>
                : alleSignaleringen.map(item => (
                  <div key={item.key} className="flex justify-between items-start py-2 border-b border-slate-50 last:border-0 gap-2">
                    <button
                      onClick={() => afvinkSignalering(item)}
                      title="Afvinken"
                      className="mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 border-slate-300 hover:border-green-500 hover:bg-green-50 transition-colors flex items-center justify-center"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{item.label}</p>
                      {item.subLabel && <p className="text-xs text-slate-400">{item.subLabel}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <DagenBadge d={item.dagen} />
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </Kaart>

        {/* ── AGENDA ── */}
        <Kaart titel="Agenda — 3 weken" icoon="📅">
          {!data ? <Laden /> : data.events.length === 0
            ? <p className="text-slate-400 text-sm italic">Geen afspraken</p>
            : data.events.map((e, i) => (
              <div key={i} className={`py-2 border-b border-slate-50 last:border-0 ${isVandaag(e.datum) ? 'bg-blue-50 -mx-4 px-4 rounded' : ''}`}>
                <p className={`text-xs ${isVandaag(e.datum) ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>{fmtDatum(e.datum)}</p>
                <p className="text-sm font-medium text-slate-800">{e.titel}</p>
                {e.locatie && <p className="text-xs text-slate-400">{e.locatie}</p>}
              </div>
            ))
          }
        </Kaart>

        {/* ── HUISHOUDTAKEN ── */}
        <Kaart titel="Huishoudtaken" icoon="🏠">
          {!data ? <Laden /> : data.taken.map(taak => (
            <div key={taak.naam} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 gap-1">
              <span className="text-sm text-slate-700 flex-1 truncate">{taak.naam}</span>
              <TaakBadge t={taak} />
              <button
                onClick={() => nuNodig(taak.naam)}
                disabled={nuNodigItems.has(taak.naam)}
                title="Nu nodig — zet in signaleringen"
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 disabled:opacity-40 px-2 py-1 rounded-lg transition-colors shrink-0"
              >
                ⚡
              </button>
              <button
                onClick={() => afvinken(taak.naam)}
                disabled={afgevinkteItems.has(taak.naam)}
                className="text-xs bg-slate-100 hover:bg-green-100 hover:text-green-700 disabled:bg-green-100 disabled:text-green-700 px-2 py-1 rounded-lg transition-colors shrink-0"
              >
                {afgevinkteItems.has(taak.naam) ? '✓' : 'Gedaan'}
              </button>
            </div>
          ))}
        </Kaart>

        {/* ── VAKANTIES ── */}
        <Kaart titel="Aankomende vakanties" icoon="🏖️">
          {!data ? <Laden /> : data.vakanties.length === 0
            ? <p className="text-slate-400 text-sm italic">Geen vakanties binnenkort</p>
            : data.vakanties.map((v, i) => (
              <div key={i} className="mb-5 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-slate-800 text-sm">{v.naam}</h3>
                  <DagenBadge d={v.dagenTot} />
                </div>
                <p className="text-xs text-slate-400 mb-2">{fmtPeriode(v.start, v.einde)}</p>
                {v.events.length === 0
                  ? <p className="text-xs text-slate-300 italic">Nog niets gepland</p>
                  : v.events.map((e, j) => (
                    <div key={j} className="flex gap-2 py-1 border-b border-slate-50 last:border-0">
                      <span className="text-xs text-slate-400 shrink-0">{fmtDatum(e.datum)}</span>
                      <span className="text-xs text-slate-700 truncate">{e.titel}</span>
                    </div>
                  ))
                }
              </div>
            ))
          }
        </Kaart>

        {/* ── SUGGESTIES ── */}
        <Kaart titel="Activiteitensuggesties" icoon="💡" extra={
          <button onClick={() => laadSuggesties(true)} className="text-xs text-blue-500 hover:text-blue-700">↻ Ververs</button>
        }>
          {suggestiesLaden ? <Laden /> : (
            <div className="space-y-4">
              {suggesties.split('\n\n').filter(Boolean).map((alinea, i) => {
                const liked = likedSug.has(alinea); const disliked = dislikedSug.has(alinea)
                return (
                  <div key={i} className={`pb-3 border-b border-slate-50 last:border-0 ${disliked ? 'opacity-40' : ''}`}>
                    <p className="text-sm text-slate-700 leading-relaxed">{alinea}</p>
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => sugFeedback(alinea, 1)} className={`text-xs transition-colors ${liked ? 'text-green-600 font-medium' : 'text-slate-400 hover:text-green-600'}`}>👍 {liked ? 'Geliked!' : 'Leuk idee'}</button>
                      <button onClick={() => sugFeedback(alinea, -1)} className={`text-xs transition-colors ${disliked ? 'text-red-500 font-medium' : 'text-slate-400 hover:text-red-500'}`}>👎 {disliked ? 'Overgeslagen' : 'Niet voor ons'}</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Kaart>

        {/* ── DIGEST ── */}
        <Kaart titel="Wekelijkse digest" icoon="📧">
          <p className="text-sm text-slate-500 mb-3">Stuur een samenvatting van de komende week naar je e-mail.</p>
          <button onClick={stuurDigest} disabled={digestLaden} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            {digestLaden ? 'Versturen...' : 'Digest versturen'}
          </button>
          {digestStatus && <p className={`text-sm mt-2 ${digestStatus.includes('Fout') || digestStatus.includes('ontbreken') ? 'text-red-500' : 'text-green-600'}`}>{digestStatus}</p>}
        </Kaart>

      </div>
    </div>
  )
}
