import { createClient, SupabaseClient } from '@supabase/supabase-js'

function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars niet ingesteld')
  return createClient(url, key)
}

// ── Config helpers ─────────────────────────────────────────────────────────────

export async function getConfig(sleutel: string): Promise<unknown> {
  const { data } = await db()
    .from('app_config')
    .select('waarde')
    .eq('sleutel', sleutel)
    .single()
  return data?.waarde ?? null
}

export async function setConfig(sleutel: string, waarde: unknown): Promise<void> {
  await db()
    .from('app_config')
    .upsert({ sleutel, waarde, bijgewerkt_op: new Date().toISOString() })
}

// ── Taken ──────────────────────────────────────────────────────────────────────

export async function taakAfvinken(taakNaam: string, datum?: string): Promise<void> {
  await db().from('taak_uitvoering').insert({
    taak_naam: taakNaam,
    uitgevoerd_op: datum || new Date().toISOString().slice(0, 10),
  })
}

export async function laatsteUitvoering(taakNaam: string): Promise<string | null> {
  const { data } = await db()
    .from('taak_uitvoering')
    .select('uitgevoerd_op')
    .eq('taak_naam', taakNaam)
    .order('uitgevoerd_op', { ascending: false })
    .limit(1)
    .single()
  return data?.uitgevoerd_op ?? null
}

// ── Agenda items ───────────────────────────────────────────────────────────────

export interface AgendaItem {
  id: number
  titel: string
  datum: string | null
  herhaal_interval_dagen: number | null
  notitie: string
  aangemaakt_op: string
}

export async function agendaItemsOphalen(): Promise<AgendaItem[]> {
  const { data } = await db()
    .from('agenda_items')
    .select('*')
    .order('datum', { ascending: true })
  return data ?? []
}

export async function agendaItemToevoegen(
  titel: string,
  datum: string | null,
  herhaalIntervalDagen: number | null,
  notitie: string
): Promise<number> {
  const { data } = await db()
    .from('agenda_items')
    .insert({ titel, datum, herhaal_interval_dagen: herhaalIntervalDagen, notitie })
    .select('id')
    .single()
  return data?.id
}

export async function agendaItemVerwijderen(id: number): Promise<void> {
  await db().from('agenda_items').delete().eq('id', id)
}

// ── Suggestie feedback ─────────────────────────────────────────────────────────

export async function suggestieLike(tekst: string, oordeel: 1 | -1): Promise<void> {
  await db().from('suggestie_feedback').insert({ tekst, oordeel })
}

export async function suggestieFeedbackOphalen(): Promise<{ tekst: string; oordeel: number }[]> {
  const { data } = await db()
    .from('suggestie_feedback')
    .select('tekst, oordeel')
    .order('aangemaakt_op', { ascending: false })
    .limit(50)
  return data ?? []
}

// ── Cache ──────────────────────────────────────────────────────────────────────

export async function cacheOpslaan(sleutel: string, waarde: string): Promise<void> {
  await db()
    .from('cache')
    .upsert({ sleutel, waarde, bijgewerkt_op: new Date().toISOString() })
}

export async function cacheLezen(sleutel: string, maxUurOud = 24): Promise<string | null> {
  const { data } = await db()
    .from('cache')
    .select('waarde, bijgewerkt_op')
    .eq('sleutel', sleutel)
    .single()
  if (!data) return null
  const oud = (Date.now() - new Date(data.bijgewerkt_op).getTime()) / 3600000
  if (oud > maxUurOud) return null
  return data.waarde
}
