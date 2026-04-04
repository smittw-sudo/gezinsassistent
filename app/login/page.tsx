'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [wachtwoord, setWachtwoord] = useState('')
  const [fout, setFout] = useState('')
  const [laden, setLaden] = useState(false)
  const router = useRouter()

  async function inloggen(e: React.FormEvent) {
    e.preventDefault()
    setLaden(true)
    setFout('')

    const resp = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wachtwoord }),
    })

    if (resp.ok || resp.redirected) {
      router.push('/')
      router.refresh()
    } else {
      setFout('Onjuist wachtwoord')
      setLaden(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏡</div>
          <h1 className="text-2xl font-bold text-slate-800">Gezinsassistent</h1>
          <p className="text-slate-500 text-sm mt-1">Persoonlijk overzicht voor het gezin</p>
        </div>

        <form onSubmit={inloggen} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Wachtwoord
            </label>
            <input
              type="password"
              value={wachtwoord}
              onChange={e => setWachtwoord(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              autoFocus
              required
            />
          </div>

          {fout && (
            <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{fout}</p>
          )}

          <button
            type="submit"
            disabled={laden}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {laden ? 'Inloggen...' : 'Inloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}
