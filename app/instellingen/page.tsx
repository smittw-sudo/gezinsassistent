'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Taak { naam: string; intervalDagen: number }
interface Verjaardag { naam: string; datum: string; relatie: string }
interface AgendaItem { id: number; titel: string; datum: string | null; herhaal_interval_dagen: number | null; notitie: string }

export default function Instellingen() {
  const [taken, setTaken] = useState<Taak[]>([])
  const [verjaardagen, setVerjaardagen] = useState<Verjaardag[]>([])
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])
  const [locatie, setLocatie] = useState('')
  const [vakantieRegio, setVakantieRegio] = useState('')
  const [werkRegio, setWerkRegio] = useState('')
  const [status, setStatus] = useState<{ tekst: string; type: 'ok' | 'fout' } | null>(null)

  // Nieuwe taak state
  const [nieuweTaakNaam, setNieuweTaakNaam] = useState('')
  const [nieuweTaakInterval, setNieuweTaakInterval] = useState(7)
  const [bewerkTaak, setBewerkTaak] = useState<string | null>(null)
  const [bewerkInterval, setBewerkInterval] = useState(7)

  // Nieuwe verjaardag state
  const [nieuweVjNaam, setNieuweVjNaam] = useState('')
  const [nieuweVjDatum, setNieuweVjDatum] = useState('')
  const [nieuweVjRelatie, setNieuweVjRelatie] = useState('')

  // Nieuwe agenda state
  const [nieuweAgendaTitel, setNieuweAgendaTitel] = useState('')
  const [nieuweAgendaDatum, setNieuweAgendaDatum] = useState('')
  const [nieuweAgendaNotitie, setNieuweAgendaNotitie] = useState('')

  async function laadData() {
    const [configResp, vjResp, agendaResp, takenResp] = await Promise.all([
      fetch('/api/config'),
      fetch('/api/verjaardagen'),
      fetch('/api/agenda'),
      fetch('/api/dashboard'),
    ])
    if (configResp.ok) {
      const c = await configResp.json()
      setLocatie(c.locatie || '')
      setVakantieRegio(c.vakantie_regio || '')
      setWerkRegio(c.werk_regio || '')
    }
    if (vjResp.ok) setVerjaardagen(await vjResp.json())
    if (agendaResp.ok) setAgendaItems(await agendaResp.json())
    if (takenResp.ok) {
      const d = await takenResp.json()
      setTaken(d.taken?.map((t: { naam: string; intervalDagen: number }) => ({ naam: t.naam, intervalDagen: t.intervalDagen })) || [])
    }
  }

  useEffect(() => { laadData() }, [])

  function toonStatus(tekst: string, type: 'ok' | 'fout' = 'ok') {
    setStatus({ tekst, type })
    setTimeout(() => setStatus(null), 3000)
  }

  async function slaInstellingenOp() {
    const resp = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locatie, vakantie_regio: vakantieRegio, werk_regio: werkRegio }),
    })
    toonStatus(resp.ok ? 'Instellingen opgeslagen' : 'Fout bij opslaan', resp.ok ? 'ok' : 'fout')
  }

  async function voegTaakToe() {
    if (!nieuweTaakNaam.trim()) return
    const resp = await fetch('/api/taken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actie: 'toevoegen', taakNaam: nieuweTaakNaam.trim(), intervalDagen: nieuweTaakInterval }),
    })
    if (resp.ok) {
      setNieuweTaakNaam('')
      setNieuweTaakInterval(7)
      toonStatus('Taak toegevoegd')
      laadData()
    } else {
      toonStatus((await resp.json()).error || 'Fout', 'fout')
    }
  }

  async function verwijderTaak(naam: string) {
    await fetch('/api/taken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actie: 'verwijderen', taakNaam: naam }),
    })
    toonStatus('Taak verwijderd')
    laadData()
  }

  async function slaIntervalOp(naam: string) {
    await fetch('/api/taken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actie: 'wijzigen', taakNaam: naam, intervalDagen: bewerkInterval }),
    })
    setBewerkTaak(null)
    toonStatus('Interval bijgewerkt')
    laadData()
  }

  async function voegVerjaardagToe() {
    if (!nieuweVjNaam.trim() || !nieuweVjDatum) return
    const resp = await fetch('/api/verjaardagen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actie: 'toevoegen', naam: nieuweVjNaam.trim(), datum: nieuweVjDatum, relatie: nieuweVjRelatie }),
    })
    if (resp.ok) {
      setNieuweVjNaam(''); setNieuweVjDatum(''); setNieuweVjRelatie('')
      toonStatus('Verjaardag toegevoegd')
      laadData()
    }
  }

  async function verwijderVerjaardag(naam: string) {
    await fetch('/api/verjaardagen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actie: 'verwijderen', naam }),
    })
    toonStatus('Verjaardag verwijderd')
    laadData()
  }

  async function voegAgendaItemToe() {
    if (!nieuweAgendaTitel.trim()) return
    const resp = await fetch('/api/agenda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titel: nieuweAgendaTitel.trim(),
        datum: nieuweAgendaDatum || null,
        notitie: nieuweAgendaNotitie,
      }),
    })
    if (resp.ok) {
      setNieuweAgendaTitel(''); setNieuweAgendaDatum(''); setNieuweAgendaNotitie('')
      toonStatus('Agenda item toegevoegd')
      laadData()
    }
  }

  async function verwijderAgendaItem(id: number) {
    await fetch('/api/agenda', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    toonStatus('Item verwijderd')
    laadData()
  }

  async function uitloggen() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-slate-800 to-blue-800 text-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/70 hover:text-white transition-colors text-sm">← Terug</Link>
          <h1 className="text-xl font-bold">⚙️ Instellingen</h1>
        </div>
        <button onClick={uitloggen} className="text-sm border border-white/30 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
          Uitloggen
        </button>
      </header>

      {status && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${status.type === 'ok' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {status.tekst}
        </div>
      )}

      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Locatie */}
        <Sectie titel="Locatie & regio" icoon="📍">
          <div className="space-y-3">
            <Veld label="Woonplaats">
              <input value={locatie} onChange={e => setLocatie(e.target.value)} className={invoerKlasse} placeholder="Hilversum" />
            </Veld>
            <Veld label="Vakantie regio (voor activiteitensuggesties)">
              <input value={vakantieRegio} onChange={e => setVakantieRegio(e.target.value)} className={invoerKlasse} placeholder="Noord-Holland, Hemnes omgeving" />
            </Veld>
            <Veld label="Werk regio">
              <input value={werkRegio} onChange={e => setWerkRegio(e.target.value)} className={invoerKlasse} placeholder="Regio Midden" />
            </Veld>
            <button onClick={slaInstellingenOp} className={knopKlasse}>Opslaan</button>
          </div>
        </Sectie>

        {/* Huishoudtaken */}
        <Sectie titel="Huishoudtaken" icoon="🏠">
          <div className="space-y-2 mb-4">
            {taken.map(taak => (
              <div key={taak.naam} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                <span className="flex-1 text-sm text-slate-700">{taak.naam}</span>
                {bewerkTaak === taak.naam ? (
                  <>
                    <input
                      type="number"
                      value={bewerkInterval}
                      onChange={e => setBewerkInterval(Number(e.target.value))}
                      className="w-16 border border-slate-300 rounded px-2 py-1 text-sm"
                      min={1}
                    />
                    <span className="text-xs text-slate-400">d</span>
                    <button onClick={() => slaIntervalOp(taak.naam)} className="text-xs text-green-600 hover:text-green-800">Opslaan</button>
                    <button onClick={() => setBewerkTaak(null)} className="text-xs text-slate-400 hover:text-slate-600">Annuleer</button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-slate-400">elke {taak.intervalDagen} dagen</span>
                    <button
                      onClick={() => { setBewerkTaak(taak.naam); setBewerkInterval(taak.intervalDagen) }}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >Wijzig</button>
                    <button onClick={() => verwijderTaak(taak.naam)} className="text-xs text-red-400 hover:text-red-600">Verwijder</button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              value={nieuweTaakNaam}
              onChange={e => setNieuweTaakNaam(e.target.value)}
              className={invoerKlasse + ' flex-1 min-w-32'}
              placeholder="Naam taak"
              onKeyDown={e => e.key === 'Enter' && voegTaakToe()}
            />
            <input
              type="number"
              value={nieuweTaakInterval}
              onChange={e => setNieuweTaakInterval(Number(e.target.value))}
              className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              min={1}
            />
            <span className="self-center text-sm text-slate-500">d</span>
            <button onClick={voegTaakToe} className={knopKlasse}>+ Toevoegen</button>
          </div>
        </Sectie>

        {/* Verjaardagen */}
        <Sectie titel="Verjaardagen" icoon="🎂">
          <div className="space-y-1 mb-4">
            {verjaardagen.map(v => (
              <div key={v.naam} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                <span className="flex-1 text-sm text-slate-700">{v.naam}</span>
                <span className="text-xs text-slate-400">{v.datum}{v.relatie ? ` · ${v.relatie}` : ''}</span>
                <button onClick={() => verwijderVerjaardag(v.naam)} className="text-xs text-red-400 hover:text-red-600">Verwijder</button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={nieuweVjNaam} onChange={e => setNieuweVjNaam(e.target.value)} className={invoerKlasse} placeholder="Naam" />
            <input value={nieuweVjDatum} onChange={e => setNieuweVjDatum(e.target.value)} className={invoerKlasse} placeholder="MM-DD (bijv. 03-15)" />
            <input value={nieuweVjRelatie} onChange={e => setNieuweVjRelatie(e.target.value)} className={invoerKlasse} placeholder="Relatie (vriend, familie...)" />
            <button onClick={voegVerjaardagToe} className={knopKlasse}>+ Toevoegen</button>
          </div>
        </Sectie>

        {/* Handmatige agenda items */}
        <Sectie titel="Handmatige agenda items" icoon="📝">
          <div className="space-y-1 mb-4">
            {agendaItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                <span className="flex-1 text-sm text-slate-700">{item.titel}</span>
                {item.datum && <span className="text-xs text-slate-400">{item.datum}</span>}
                {item.notitie && <span className="text-xs text-slate-400 italic">{item.notitie}</span>}
                <button onClick={() => verwijderAgendaItem(item.id)} className="text-xs text-red-400 hover:text-red-600">Verwijder</button>
              </div>
            ))}
            {agendaItems.length === 0 && <p className="text-sm text-slate-400 italic">Nog geen handmatige items</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={nieuweAgendaTitel} onChange={e => setNieuweAgendaTitel(e.target.value)} className={invoerKlasse} placeholder="Titel" />
            <input type="date" value={nieuweAgendaDatum} onChange={e => setNieuweAgendaDatum(e.target.value)} className={invoerKlasse} />
            <input value={nieuweAgendaNotitie} onChange={e => setNieuweAgendaNotitie(e.target.value)} className={invoerKlasse} placeholder="Notitie (optioneel)" />
            <button onClick={voegAgendaItemToe} className={knopKlasse}>+ Toevoegen</button>
          </div>
        </Sectie>

      </div>
    </div>
  )
}

function Sectie({ titel, icoon, children }: { titel: string; icoon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
        <span className="text-lg">{icoon}</span>
        <h2 className="font-semibold text-slate-800 text-sm">{titel}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

const invoerKlasse = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const knopKlasse = 'bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors'
