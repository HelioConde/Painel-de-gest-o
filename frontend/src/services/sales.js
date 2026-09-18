import { supabase, supabaseConfigured } from '../lib/supabase'

const TABLE = 'superus_period_snapshots'
const COLUMNS = [
  'snapshot_key',
  'reference_date',
  'snapshot_type',
  'slug',
  'event_slug',
  'event_name',
  'name',
  'mode',
  'metric',
  'unit',
  'current_start',
  'current_end',
  'previous_start',
  'previous_end',
  'current_value',
  'previous_value',
  'difference_value',
  'variation_percent',
  'sector_count',
  'store_count',
  'subgroup_count',
  'run_id',
  'details',
  'quality',
  'updated_at',
].join(',')

function ensureConfigured() {
  if (!supabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }
}

export async function getLatestSnapshot({ type, slug }) {
  ensureConfigured()

  let query = supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq('snapshot_type', type)
    .order('reference_date', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)

  if (slug) query = query.eq('slug', slug)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function getLatestMonthlySnapshot() {
  ensureConfigured()

  // Em dias normais o backend grava MONTHLY/monthly; o tipo MONTHLY_CLOSE
  // fica disponível para evoluções futuras sem quebrar a página.
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .in('snapshot_type', ['MONTHLY', 'MONTHLY_CLOSE'])
    .order('reference_date', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error) throw error
  if (!data?.length) return null

  return data.find((row) => row.slug === 'monthly') ?? data[0]
}

export async function getLatestEvents() {
  ensureConfigured()

  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq('snapshot_type', 'EVENT')
    .order('reference_date', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) throw error

  const latestBySlug = new Map()
  for (const row of data ?? []) {
    const slug = row.event_slug || row.slug
    if (slug && !latestBySlug.has(slug)) latestBySlug.set(slug, row)
  }

  return [...latestBySlug.values()]
}
