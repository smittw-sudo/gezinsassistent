'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Event { datum: string; titel: string; locatie: string; kalender: string; bron: string; id?: number }
interface Taak { naam: string; intervalDagen: number; dagenTotVolgende: number; status: 'te_doen' | 'binnenkort' | 'ok' | 'onbekend' }
interface Todo { id: number; tekst: string }
interface Vakantie { naam: string; start: string; einde: string; regio: string; dagenTot: number; events: Event[] }
interface Signaal { naam?: string; omschrijving?: string; dagenTot: number; relatie?: string; type: string; leerling?: string }
interface BewaardActiviteit { id: number; tekst: string; modus: string; gedaan: boolean }
interface VakantiePlanItem { id: number; idee: string; toegewezen_aan: string | null; boekingsdatum: string | null; klaar: boolean }

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

function fmtDatum(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]}`
}
function fmtPeriode(start: string, einde: string) {
  const s = new Date(start + 'T00:00:00'); const e = new Date(einde + 'T00:00:00')
  return `${s.getDate()} ${MAANDEN_LANG[s.getMonth()]} – ${e.getDate()} ${MAANDEN_LANG[e.getMonth()]}`
}
function fmtBoekingsdatum(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  const nu = new Date(); nu.setHours(0,0,0,0)
  const dagen = Math.round((d.getTime() - nu.getTime()) / 86400000)
  if (dagen < 0) return { label: `⚠️ ${d.getDate()} ${MAANDEN[d.getMonth()]}`, alarm: true }
  if (dagen <= 7) return { label: `🔔 ${d.getDate()} ${MAANDEN[d.getMonth()]}`, alarm: true }
  return { label: `📅 ${d.getDate()} ${MAANDEN[d.getMonth()]}`, alarm: false }
}

function DagenBadge({ d }: { d: number }) {
  if (d <= 0) return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">vandaag!</span>
  if (d === 1) return <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">morgen</span>
  if (d <= 7) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">over {d}d</span>
  return <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">over {d}d</span>
}
function TaakBadge({ t }: { t: Taak }) {
  const s = { te_doen: 'bg-red-100 text-red-700', binnenkort: 'bg-amber-100 text-amber-700', onbekend: 'bg-purple-100 text-purple-700', ok: 'bg-green-100 text-green-700' }[t.status]
  const l = { te_doen: 'te doen', binnenkort: `over ${t.dagenTotVolgende}d`, onbekend: 'nooit gedaan', ok: `over ${t.dagenTotVolgende}d` }[t.status]
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s}`}>{l}</span>
}
function Kaart({ titel, icoon, children, extra, accent }: { titel: string; icoon: string; children: React.ReactNode; extra?: React.ReactNode; accent?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden ${accent ? `border-${accent}-200` : 'border-slate-100'}`}>
      <div className={`flex items-center justify-between px-5 py-3.5 border-b ${accent ? `border-${accent}-100 bg-${accent}-50` : 'border-slate-100'}`}>
        <div className="flex items-center gap-2"><span className="text-lg">{icoon}</span><h2 className="font-semibold text-slate-800 text-sm">{titel}</h2></div>
        {extra}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}
function Laden() { return <p className="text-slate-400 text-sm italic">Laden...</p> }

// Vakantie + blok data
const FEESTDAGEN: Record<string, string> = {
  '2025-12-25': '1e Kerstdag','2025-12-26': '2e Kerstdag','2026-01-01': 'Nieuwjaarsdag',
  '2026-04-03': 'Goede Vrijdag','2026-04-05': '1e Paasdag','2026-04-06': '2e Paasdag',
  '2026-04-27': 'Koningsdag','2026-05-05': 'Bevrijdingsdag','2026-05-14': 'Hemelvaartsdag',
  '2026-05-15': 'Vrijdag na Hemelvaart','2026-05-25': '2e Pinksterdag',
}
const VAKANTIE_PERIODES = [
  { naam: 'Herfstvakantie (Noord)', start: '2025-10-11', einde: '2025-10-19' },
  { naam: 'Herfstvakantie (ARHC)', start: '2025-10-18', einde: '2025-10-26' },
  { naam: 'Kerstvakantie', start: '2025-12-20', einde: '2026-01-04' },
  { naam: 'Roland Holst week', start: '2026-01-19', einde: '2026-01-23' },
  { naam: 'Voorjaarsvakantie (Noord)', start: '2026-02-14', einde: '2026-02-22' },
  { naam: 'Voorjaarsvakantie (ARHC)', start: '2026-02-21', einde: '2026-03-01' },
  { naam: 'Meivakantie (ARHC)', start: '2026-04-18', einde: '2026-05-03' },
  { naam: 'Meivakantie (Noord)', start: '2026-04-25', einde: '2026-05-10' },
  { naam: 'Roland Holst week', start: '2026-05-26', einde: '2026-05-29' },
  { naam: 'Zomervakantie', start: '2026-07-04', einde: '2026-08-23' },
]

interface AgendaBlok { label: string; type: 'weekend'|'vakantie'|'feestdag'; start: string; einde: string; events: Event[] }

function bouwAgendaBlokken(events: Event[], vandaag: Date): AgendaBlok[] {
  const blokken = new Map<string, AgendaBlok>()
  const vandaagIso = vandaag.toISOString().slice(0,10)
  const over90Iso = new Date(vandaag.getTime() + 90*86400000).toISOString().slice(0,10)

  for (let i = 0; i < 56; i++) {
    const d = new Date(vandaag); d.setDate(vandaag.getDate() + i)
    if (d.getDay() === 6) {
      const zon = new Date(d); zon.setDate(d.getDate() + 1)
      const iso = d.toISOString().slice(0,10); const zonIso = zon.toISOString().slice(0,10)
      blokken.set(`weekend-${iso}`, { label: `${d.getDate()}–${zon.getDate()} ${MAANDEN_LANG[d.getMonth()]}`, type: 'weekend', start: iso, einde: zonIso, events: [] })
    }
  }
  for (const v of VAKANTIE_PERIODES) {
    if (v.einde >= vandaagIso && v.start <= over90Iso)
      blokken.set(`vakantie-${v.start}`, { label: v.naam, type: 'vakantie', start: v.start, einde: v.einde, events: [] })
  }
  for (const event of events) {
    const vKey = [...blokken.entries()].find(([,b]) => b.type === 'vakantie' && event.datum >= b.start && event.datum <= b.einde)?.[0]
    if (vKey) { blokken.get(vKey)!.events.push(event); continue }
    const wKey = [...blokken.entries()].find(([,b]) => b.type === 'weekend' && event.datum >= b.start && event.datum <= b.einde)?.[0]
    if (wKey) { blokken.get(wKey)!.events.push(event); continue }
    const feestNaam = FEESTDAGEN[event.datum]
    if (feestNaam) {
      const key = `feestdag-${event.datum}`
      if (!blokken.has(key)) blokken.set(key, { label: feestNaam, type: 'feestdag', start: event.datum, einde: event.datum, events: [] })
      blokken.get(key)!.events.push(event)
    }
  }
  return [...blokken.values()].sort((a,b) => a.start.localeCompare(b.start))
}

// ──────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [suggesties, setSuggesties] = useState('')
  const [suggestiesLaden, setSuggestiesLaden] = useState(true)
  const [modus, setModus] = useState<'gezin'|'stel'>('gezin')
  const [afgevinkteItems, setAfgevinkteItems] = useState<Set<string>>(new Set())
  const [afgevinktSignaleringen, setAfgevinktSignaleringen] = useState<Set<string>>(new Set())
  const [nuNodigItems, setNuNodigItems] = useState<Set<string>>(new Set())
  const [likedSug, setLikedSug] = useState<Set<string>>(new Set())
  const [dislikedSug, setDislikedSug] = useState<Set<string>>(new Set())
  const [digestStatus, setDigestStatus] = useState('')
  const [digestLaden, setDigestLaden] = useState(false)
  const [nieuweTodo, setNieuweTodo] = useState('')
  const [todoToevoegen, setTodoToevoegen] = useState(false)

  // Bewaarde activiteiten
  const [bewaardActiviteiten, setBewaardActiviteiten] = useState<BewaardActiviteit[]>([])
  const [bewaarStatus, setBewaarStatus] = useState<Record<string, boolean>>({})

  // Vakantie-planbord
  const [vakantieplannen, setVakantieplannen] = useState<Record<string, VakantiePlanItem[]>>({})
  const [vakantieInputOpen, setVakantieInputOpen] = useState<string | null>(null)
  const [nieuwVakantieIdee, setNieuwVakantieIdee] = useState('')
  const [nieuwVakantieWie, setNieuwVakantieWie] = useState('')
  const [nieuwVakantieBoek, setNieuwVakantieBoek] = useState('')

  // Seizoenstaken
  const [seizoenstaken, setSeizoensTaken] = useState<{naam: string; tip: string; intervalDagen: number}[]>([])
  const [toegevoegdeSeizoen, setToegevoegdeSeizoen] = useState<Set<string>>(new Set())

  const laadDashboard = useCallback(async () => {
    const r = await fetch('/api/dashboard')
    if (r.ok) setData(await r.json())
  }, [])

  const laadSuggesties = useCallback(async (ververs = false, mod?: 'gezin'|'stel') => {
    setSuggestiesLaden(true)
    const m = mod ?? modus
    const r = await fetch(`/api/suggesties?modus=${m}${ververs ? '&ververs=1' : ''}`)
    if (r.ok) setSuggesties((await r.json()).suggesties)
    setSuggestiesLaden(false)
  }, [modus])

  const laadBewaardActiviteiten = useCallback(async () => {
    const r = await fetch('/api/activiteiten')
    if (r.ok) setBewaardActiviteiten(await r.json())
  }, [])

  const laadVakantieplan = useCallback(async (vakantieStart: string) => {
    const r = await fetch(`/api/vakantieplan?start=${vakantieStart}`)
    if (r.ok) setVakantieplannen(p => ({ ...p, [vakantieStart]: (async () => await r.json())() as unknown as VakantiePlanItem[] }))
    if (r.ok) {
      const items = await fetch(`/api/vakantieplan?start=${vakantieStart}`).then(r => r.json())
      setVakantieplannen(p => ({ ...p, [vakantieStart]: items }))
    }
  }, [])

  useEffect(() => {
    const opgeslagen = (() => { try { return new Set<string>(JSON.parse(localStorage.getItem('afgevinkt') || '[]')) } catch { return new Set<string>() } })()
    if (opgeslagen.size > 0) setAfgevinktSignaleringen(opgeslagen)
    const modusOpgeslagen = localStorage.getItem('modus') as 'gezin'|'stel' | null
    if (modusOpgeslagen) setModus(modusOpgeslagen)
  }, [])

  useEffect(() => {
    try { localStorage.setItem('afgevinkt', JSON.stringify([...afgevinktSignaleringen])) } catch {}
  }, [afgevinktSignaleringen])

  useEffect(() => { laadDashboard(); laadSuggesties(); laadBewaardActiviteiten() }, [laadDashboard, laadSuggesties, laadBewaardActiviteiten])

  // Laad seizoenstaken client-side
  useEffect(() => {
    fetch('/api/seizoenstaken').then(r => r.ok ? r.json() : null).then(d => { if (d) setSeizoensTaken(d) })
  }, [])

  // Laad vakantieplannen zodra data beschikbaar is
  useEffect(() => {
    if (!data) return
    for (const v of data.vakanties) laadVakantieplan(v.start)
  }, [data, laadVakantieplan])

  function wisselModus(nieuw: 'gezin'|'stel') {
    setModus(nieuw)
    localStorage.setItem('modus', nieuw)
    laadSuggesties(true, nieuw)
  }

  function afvinkSignalering(item: { type: string; key: string; id?: number; label: string }) {
    setAfgevinktSignaleringen(p => new Set(p).add(item.key))
    if (item.type === 'taak') {
      const naam = item.key.slice('taak-'.length)
      setAfgevinkteItems(p => new Set(p).add(naam))
      fetch('/api/taken', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ actie: 'afvinken', taakNaam: naam }) })
        .then(() => setTimeout(laadDashboard, 800))
    } else if ((item.type === 'todo' || item.type === 'nu_nodig') && item.id != null) {
      fetch('/api/signaleringen', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ actie: 'verwijderen', id: item.id }) })
        .then(() => setTimeout(laadDashboard, 400))
    }
  }

  async function afvinkenTaak(naam: string) {
    setAfgevinkteItems(p => new Set(p).add(naam))
    await fetch('/api/taken', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ actie: 'afvinken', taakNaam: naam }) })
    setTimeout(laadDashboard, 800)
  }
  async function nuNodig(naam: string) {
    setNuNodigItems(p => new Set(p).add(naam))
    await fetch('/api/taken', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ actie: 'nu_nodig', taakNaam: naam }) })
    laadDashboard()
  }
  async function voegTodoToe() {
    if (!nieuweTodo.trim()) return
    await fetch('/api/signaleringen', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ actie: 'todo_toevoegen', tekst: nieuweTodo.trim() }) })
    setNieuweTodo(''); setTodoToevoegen(false); laadDashboard()
  }
  async function sugFeedback(tekst: string, oordeel: 1 | -1) {
    if (oordeel === 1) setLikedSug(p => new Set(p).add(tekst))
    else setDislikedSug(p => new Set(p).add(tekst))
    await fetch('/api/suggesties', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tekst, oordeel }) })
  }
  async function bewaarActiviteit(tekst: string) {
    setBewaarStatus(p => ({ ...p, [tekst]: true }))
    await fetch('/api/activiteiten', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ actie: 'opslaan', tekst, modus }) })
    laadBewaardActiviteiten()
    setTimeout(() => setBewaarStatus(p => { const n = {...p}; delete n[tekst]; return n }), 2000)
  }
  async function verwijderActiviteit(id: number) {
    await fetch('/api/activiteiten', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ actie: 'verwijderen', id }) })
    laadBewaardActiviteiten()
  }
  async function toggleActiviteitGedaan(id: number, huidigeWaarde: boolean) {
    await fetch('/api/activiteiten', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ actie: 'gedaan', id, gedaan: !huidigeWaarde }) })
    laadBewaardActiviteiten()
  }
  async function voegVakantieIdee(vakantieNaam: string, vakantieStart: string) {
    if (!nieuwVakantieIdee.trim()) return
    await fetch('/api/vakantieplan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({
      actie: 'toevoegen', vakantieNaam, vakantieStart, idee: nieuwVakantieIdee.trim(),
      toegewezenAan: nieuwVakantieWie.trim() || undefined, boekingsdatum: nieuwVakantieBoek || undefined,
    })})
    setNieuwVakantieIdee(''); setNieuwVakantieWie(''); setNieuwVakantieBoek(''); setVakantieInputOpen(null)
    laadVakantieplan(vakantieStart)
  }
  async function toggleVakantieKlaar(id: number, klaar: boolean, vakantieStart: string) {
    await fetch('/api/vakantieplan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ actie: 'afvinken', id, klaar: !klaar }) })
    laadVakantieplan(vakantieStart)
  }
  async function verwijderVakantieItem(id: number, vakantieStart: string) {
    await fetch('/api/vakantieplan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ actie: 'verwijderen', id }) })
    laadVakantieplan(vakantieStart)
  }
  async function voegSeizoenstaakToe(naam: string, intervalDagen: number) {
    setToegevoegdeSeizoen(p => new Set(p).add(naam))
    await fetch('/api/taken', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ actie: 'toevoegen', taakNaam: naam, intervalDagen }) })
    setTimeout(laadDashboard, 500)
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

  const alleSignaleringen = data ? [
    ...data.vandaagEvents.map(e => ({ label: `📅 ${e.titel}`, subLabel: e.locatie || e.kalender, dagen: 0, type: 'event', key: `ev-${e.titel}` })),
    ...data.taken.filter(t => t.status === 'te_doen' || t.status === 'onbekend').map(t => ({ label: `🏠 ${t.naam}`, subLabel: t.status === 'onbekend' ? 'nooit gedaan' : 'al te lang geleden', dagen: 0, type: 'taak', key: `taak-${t.naam}` })),
    ...data.nuNodig.map(n => ({ label: `⚡ ${n.tekst}`, subLabel: 'nu nodig', dagen: 0, type: 'nu_nodig', key: `nn-${n.id}`, id: n.id })),
    ...data.todos.map(t => ({ label: `✅ ${t.tekst}`, subLabel: 'taak vandaag', dagen: 0, type: 'todo', key: `todo-${t.id}`, id: t.id })),
  ].filter(item => !afgevinktSignaleringen.has(item.key)) : []

  const alleHerinneringen = data ? [
    ...data.verjaardagen.map(v => ({ label: `🎂 ${v.naam}${v.relatie ? ` (${v.relatie})` : ''}`, dagen: v.dagenTot, type: 'verjaardag', key: `vj-${v.naam}` })),
    ...data.feestdagen.map(f => ({ label: `🎉 ${f.naam}`, dagen: f.dagenTot, type: 'feestdag', key: `fd-${f.naam}` })),
    ...data.schoolSignaleringen.map(s => ({ label: `📚 ${s.omschrijving}${s.leerling ? ` – ${s.leerling}` : ''}`, dagen: s.dagenTot, type: 'school', key: `sc-${s.omschrijving}` })),
  ].sort((a,b) => a.dagen - b.dagen).filter(item => !afgevinktSignaleringen.has(item.key)) : []

  const bestaandeTaken = data ? new Set(data.taken.map(t => t.naam)) : new Set<string>()
  const seizoensSuggesties = seizoenstaken.filter(t => !bestaandeTaken.has(t.naam) && !toegevoegdeSeizoen.has(t.naam))

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

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ════════════ KOLOM 1: VANDAAG & TAKEN ════════════ */}
        <div className="space-y-5">

          {/* Signaleringen */}
          <Kaart titel="Signaleringen van vandaag" icoon="🔔" extra={
            <button type="button" onClick={() => setTodoToevoegen(v => !v)} className="text-lg text-slate-400 hover:text-blue-600 font-bold leading-none" title="Todo toevoegen">+</button>
          }>
            {!data ? <Laden /> : (
              <div>
                {todoToevoegen && (
                  <div className="flex gap-2 mb-3">
                    <input autoFocus value={nieuweTodo} onChange={e => setNieuweTodo(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') voegTodoToe(); if (e.key === 'Escape') setTodoToevoegen(false) }}
                      placeholder="Taak voor vandaag..." className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="button" onClick={voegTodoToe} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm">+</button>
                  </div>
                )}
                {alleSignaleringen.length === 0
                  ? <p className="text-slate-400 text-sm italic">Niets bijzonders vandaag</p>
                  : alleSignaleringen.map(item => (
                    <div key={item.key} className="flex items-start py-2 border-b border-slate-50 last:border-0 gap-2">
                      <button type="button" onClick={() => afvinkSignalering(item)} title="Afvinken"
                        className="mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 border-slate-300 hover:border-green-500 hover:bg-green-50 transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{item.label}</p>
                        {'subLabel' in item && item.subLabel && <p className="text-xs text-slate-400">{item.subLabel as string}</p>}
                      </div>
                      <DagenBadge d={item.dagen} />
                    </div>
                  ))
                }
              </div>
            )}
          </Kaart>

          {/* Seizoenstaken */}
          {seizoensSuggesties.length > 0 && (
            <Kaart titel="Seizoenstaken" icoon="🌿">
              <p className="text-xs text-slate-400 mb-3">Relevant voor dit seizoen — klik + om toe te voegen aan je taken</p>
              {seizoensSuggesties.map(t => (
                <div key={t.naam} className="flex items-start gap-2 py-2 border-b border-slate-50 last:border-0">
                  <button type="button" onClick={() => voegSeizoenstaakToe(t.naam, t.intervalDagen)}
                    className="shrink-0 w-6 h-6 rounded-full bg-green-50 hover:bg-green-100 text-green-700 text-sm font-bold flex items-center justify-center transition-colors">+</button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{t.naam}</p>
                    <p className="text-xs text-slate-400">{t.tip}</p>
                  </div>
                </div>
              ))}
            </Kaart>
          )}

          {/* Huishoudtaken */}
          <Kaart titel="Huishoudtaken" icoon="🏠">
            {!data ? <Laden /> : data.taken.length === 0
              ? <p className="text-sm text-slate-400 italic">Geen taken ingesteld</p>
              : data.taken.map(taak => (
                <div key={taak.naam} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 gap-1">
                  <span className="text-sm text-slate-700 flex-1 truncate">{taak.naam}</span>
                  <TaakBadge t={taak} />
                  <button type="button" onClick={() => nuNodig(taak.naam)} disabled={nuNodigItems.has(taak.naam)}
                    title="Nu nodig" className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 disabled:opacity-40 px-2 py-1 rounded-lg transition-colors shrink-0">⚡</button>
                  <button type="button" onClick={() => afvinkenTaak(taak.naam)} disabled={afgevinkteItems.has(taak.naam)}
                    className="text-xs bg-slate-100 hover:bg-green-100 hover:text-green-700 disabled:bg-green-100 disabled:text-green-700 px-2 py-1 rounded-lg transition-colors shrink-0">
                    {afgevinkteItems.has(taak.naam) ? '✓' : 'Gedaan'}
                  </button>
                </div>
              ))
            }
          </Kaart>

          {/* Verjaardagen & herinneringen */}
          <Kaart titel="Verjaardagen & herinneringen" icoon="🎂">
            {!data ? <Laden /> : alleHerinneringen.length === 0
              ? <p className="text-slate-400 text-sm italic">Niets binnenkort</p>
              : alleHerinneringen.map(item => (
                <div key={item.key} className="flex items-start py-2 border-b border-slate-50 last:border-0 gap-2">
                  <button type="button" onClick={() => afvinkSignalering(item)} title="Afvinken"
                    className="mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 border-slate-300 hover:border-green-500 hover:bg-green-50 transition-colors" />
                  <span className="text-sm text-slate-700 flex-1 truncate">{item.label}</span>
                  <DagenBadge d={item.dagen} />
                </div>
              ))
            }
          </Kaart>

        </div>

        {/* ════════════ KOLOM 2: VRIJE TIJD ════════════ */}
        <div className="space-y-5">

          {/* Aankomende vakanties + planbord */}
          <Kaart titel="Aankomende vakanties" icoon="🏖️">
            {!data ? <Laden /> : data.vakanties.length === 0
              ? <p className="text-slate-400 text-sm italic">Geen vakanties binnenkort</p>
              : data.vakanties.map(v => {
                const planItems = vakantieplannen[v.start] || []
                const openToevoegen = vakantieInputOpen === v.start
                return (
                  <div key={v.start} className="mb-6 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-slate-800 text-sm">{v.naam}</h3>
                      <DagenBadge d={v.dagenTot} />
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{fmtPeriode(v.start, v.einde)}</p>

                    {/* Agenda-events uit iCloud */}
                    {v.events.length > 0 && (
                      <div className="mb-3">
                        {v.events.map((e,j) => (
                          <div key={j} className="flex gap-2 py-1">
                            <span className="text-xs text-slate-400 shrink-0">{fmtDatum(e.datum)}</span>
                            <span className="text-xs text-slate-600 truncate">📅 {e.titel}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Planbord */}
                    {planItems.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {planItems.map(item => {
                          const boek = item.boekingsdatum ? fmtBoekingsdatum(item.boekingsdatum) : null
                          return (
                            <div key={item.id} className={`flex items-start gap-2 py-1.5 px-2 rounded-lg text-sm ${item.klaar ? 'bg-green-50 opacity-60' : 'bg-slate-50'}`}>
                              <button type="button" onClick={() => toggleVakantieKlaar(item.id, item.klaar, v.start)}
                                className={`shrink-0 w-4 h-4 mt-0.5 rounded border-2 transition-colors ${item.klaar ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-green-500'}`}>
                                {item.klaar && <span className="text-white text-xs leading-none">✓</span>}
                              </button>
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm ${item.klaar ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.idee}</span>
                                <div className="flex gap-2 mt-0.5 flex-wrap">
                                  {item.toegewezen_aan && <span className="text-xs text-slate-400">👤 {item.toegewezen_aan}</span>}
                                  {boek && <span className={`text-xs ${boek.alarm ? 'text-red-500 font-medium' : 'text-slate-400'}`}>{boek.label}</span>}
                                </div>
                              </div>
                              <button type="button" onClick={() => verwijderVakantieItem(item.id, v.start)} className="text-slate-300 hover:text-red-400 text-xs">✕</button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {openToevoegen ? (
                      <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                        <input value={nieuwVakantieIdee} onChange={e => setNieuwVakantieIdee(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') voegVakantieIdee(v.naam, v.start); if (e.key === 'Escape') setVakantieInputOpen(null) }}
                          placeholder="Idee of taak..." autoFocus
                          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <div className="flex gap-2">
                          <input value={nieuwVakantieWie} onChange={e => setNieuwVakantieWie(e.target.value)}
                            placeholder="Wie regelt dit? (optioneel)"
                            className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <input type="date" value={nieuwVakantieBoek} onChange={e => setNieuwVakantieBoek(e.target.value)}
                            title="Boekingsdatum"
                            className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => voegVakantieIdee(v.naam, v.start)} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg">+ Toevoegen</button>
                          <button type="button" onClick={() => setVakantieInputOpen(null)} className="text-xs text-slate-400 hover:text-slate-600 px-2">Annuleer</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setVakantieInputOpen(v.start)}
                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1">
                        <span className="text-base font-bold leading-none">+</span> Idee of taak toevoegen
                      </button>
                    )}
                  </div>
                )
              })
            }
          </Kaart>

          {/* Weekenden & vrije dagen */}
          {(() => {
            if (!data) return <Kaart titel="Weekenden & vrije dagen" icoon="📅"><Laden /></Kaart>
            const blokken = bouwAgendaBlokken(data.events, nu).filter(b => b.events.length > 0)
            return (
              <Kaart titel="Weekenden & vrije dagen" icoon="📅">
                {blokken.length === 0
                  ? <p className="text-slate-400 text-sm italic">Nog geen afspraken in vrije periodes</p>
                  : blokken.map((blok, i) => (
                    <div key={blok.start} className={i > 0 ? 'mt-4 pt-4 border-t border-slate-200' : ''}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {blok.type === 'vakantie' ? '🏖️' : blok.type === 'feestdag' ? '🎉' : '📅'} {blok.label}
                        </span>
                        {blok.type !== 'weekend' && <span className="text-xs text-slate-400">{fmtPeriode(blok.start, blok.einde)}</span>}
                      </div>
                      {blok.events.map((e,j) => (
                        <div key={j} className="py-1.5 pl-3 border-l-2 border-slate-100 mb-1 last:mb-0">
                          <p className="text-xs text-slate-400">{fmtDatum(e.datum)}</p>
                          <p className="text-sm font-medium text-slate-800">{e.titel}</p>
                          {e.locatie && <p className="text-xs text-slate-400">{e.locatie}</p>}
                        </div>
                      ))}
                    </div>
                  ))
                }
              </Kaart>
            )
          })()}

        </div>

        {/* ════════════ KOLOM 3: IDEEËN ════════════ */}
        <div className="space-y-5">

          {/* Activiteitensuggesties */}
          <Kaart titel="Activiteitensuggesties" icoon="💡"
            extra={
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs">
                  <button type="button" onClick={() => wisselModus('gezin')}
                    className={`px-2.5 py-1 transition-colors ${modus === 'gezin' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                    👨‍👩‍👧‍👦 Gezin
                  </button>
                  <button type="button" onClick={() => wisselModus('stel')}
                    className={`px-2.5 py-1 transition-colors ${modus === 'stel' ? 'bg-pink-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                    👫 Stel
                  </button>
                </div>
                <button type="button" onClick={() => laadSuggesties(true)} className="text-xs text-blue-500 hover:text-blue-700">↻</button>
              </div>
            }>
            {suggestiesLaden ? <Laden /> : (
              <div className="space-y-4">
                {suggesties.split('\n\n').filter(Boolean).map((alinea, i) => {
                  const liked = likedSug.has(alinea); const disliked = dislikedSug.has(alinea)
                  const bewaard = bewaarStatus[alinea]
                  return (
                    <div key={i} className={`pb-3 border-b border-slate-50 last:border-0 ${disliked ? 'opacity-40' : ''}`}>
                      <p className="text-sm text-slate-700 leading-relaxed">{alinea}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <button type="button" onClick={() => sugFeedback(alinea, 1)} className={`text-xs transition-colors ${liked ? 'text-green-600 font-medium' : 'text-slate-400 hover:text-green-600'}`}>👍</button>
                        <button type="button" onClick={() => sugFeedback(alinea, -1)} className={`text-xs transition-colors ${disliked ? 'text-red-500 font-medium' : 'text-slate-400 hover:text-red-500'}`}>👎</button>
                        <button type="button" onClick={() => bewaarActiviteit(alinea)}
                          disabled={bewaard}
                          className={`text-xs ml-auto transition-colors ${bewaard ? 'text-green-600 font-medium' : 'text-slate-400 hover:text-blue-600'}`}>
                          {bewaard ? '✓ Bewaard!' : '💾 Bewaar'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Kaart>

          {/* Bewaarde ideeën */}
          <Kaart titel="Bewaarde ideeën" icoon="📌">
            {bewaardActiviteiten.length === 0
              ? <p className="text-slate-400 text-sm italic">Nog geen ideeën bewaard. Klik op 💾 bij een suggestie.</p>
              : <div className="space-y-2">
                  {bewaardActiviteiten.map(a => (
                    <div key={a.id} className={`flex items-start gap-2 py-2 border-b border-slate-50 last:border-0 ${a.gedaan ? 'opacity-50' : ''}`}>
                      <button type="button" onClick={() => toggleActiviteitGedaan(a.id, a.gedaan)}
                        className={`shrink-0 mt-0.5 w-4 h-4 rounded border-2 transition-colors ${a.gedaan ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-green-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${a.gedaan ? 'line-through text-slate-400' : 'text-slate-700'} line-clamp-2`}>{a.tekst}</p>
                        <span className={`text-xs ${a.modus === 'stel' ? 'text-pink-400' : 'text-blue-400'}`}>{a.modus === 'stel' ? '👫 stel' : '👨‍👩‍👧‍👦 gezin'}</span>
                      </div>
                      <button type="button" onClick={() => verwijderActiviteit(a.id)} className="text-slate-300 hover:text-red-400 text-xs shrink-0">✕</button>
                    </div>
                  ))}
                </div>
            }
          </Kaart>

          {/* Wekelijkse digest */}
          <Kaart titel="Wekelijkse digest" icoon="📧">
            <p className="text-sm text-slate-500 mb-3">Stuur een samenvatting van de komende week naar je e-mail.</p>
            <button type="button" onClick={stuurDigest} disabled={digestLaden}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              {digestLaden ? 'Versturen...' : 'Digest versturen'}
            </button>
            {digestStatus && <p className={`text-sm mt-2 ${digestStatus.includes('Fout') ? 'text-red-500' : 'text-green-600'}`}>{digestStatus}</p>}
          </Kaart>

        </div>
      </div>
    </div>
  )
}
