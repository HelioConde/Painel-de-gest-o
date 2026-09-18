import { supabase, supabaseConfigured } from '../lib/supabase'
import { sanitizeLossRow } from '../utils/lossProducts'

const TABLE = 'loss_period_snapshots'
const COLUMNS = [
  'store_code',
  'store_name',
  'current_start',
  'current_end',
  'previous_start',
  'previous_end',
  'current_record_count',
  'previous_record_count',
  'current_loss_quantity',
  'previous_loss_quantity',
  'current_total_value',
  'previous_total_value',
  'current_sales_value',
  'previous_sales_value',
  'current_loss_sales_percent',
  'previous_loss_sales_percent',
  'loss_difference',
  'loss_variation_percent',
  'sales_difference',
  'sales_variation_percent',
  'run_id',
  'details',
  'quality',
  'updated_at',
].join(',')

const STORE_ORDER = ['307', '212', '600', '120', '033', '018']

function ensureConfigured() {
  if (!supabaseConfigured) throw new Error('SUPABASE_NOT_CONFIGURED')
}

function number(value) {
  return Number(value || 0)
}

function variation(current, previous) {
  const cur = number(current)
  const prev = number(previous)
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}

function lossSalesPercent(loss, sales) {
  const salesValue = number(sales)
  if (!salesValue) return null
  return (number(loss) / salesValue) * 100
}

function aggregate(rows) {
  const currentLoss = rows.reduce((sum, row) => sum + number(row.current_total_value), 0)
  const previousLoss = rows.reduce((sum, row) => sum + number(row.previous_total_value), 0)
  const currentSales = rows.reduce((sum, row) => sum + number(row.current_sales_value), 0)
  const previousSales = rows.reduce((sum, row) => sum + number(row.previous_sales_value), 0)

  return {
    store_count: rows.length,
    current_record_count: rows.reduce((sum, row) => sum + number(row.current_record_count), 0),
    previous_record_count: rows.reduce((sum, row) => sum + number(row.previous_record_count), 0),
    current_loss_quantity: rows.reduce((sum, row) => sum + number(row.current_loss_quantity), 0),
    previous_loss_quantity: rows.reduce((sum, row) => sum + number(row.previous_loss_quantity), 0),
    current_total_value: currentLoss,
    previous_total_value: previousLoss,
    loss_difference: currentLoss - previousLoss,
    loss_variation_percent: variation(currentLoss, previousLoss),
    current_sales_value: currentSales,
    previous_sales_value: previousSales,
    current_loss_sales_percent: lossSalesPercent(currentLoss, currentSales),
    previous_loss_sales_percent: lossSalesPercent(previousLoss, previousSales),
  }
}

export async function getLatestLossRun() {
  ensureConfigured()

  const { data: latest, error: latestError } = await supabase
    .from(TABLE)
    .select('run_id,current_start,current_end,previous_start,previous_end,updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) throw latestError
  if (!latest) return null

  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq('run_id', latest.run_id)
    .eq('current_start', latest.current_start)
    .eq('current_end', latest.current_end)
    .eq('previous_start', latest.previous_start)
    .eq('previous_end', latest.previous_end)
    .limit(20)

  if (error) throw error
  if (!data?.length) return null

  const rows = data.map(sanitizeLossRow).sort((a, b) => {
    const ai = STORE_ORDER.indexOf(String(a.store_code).padStart(3, '0'))
    const bi = STORE_ORDER.indexOf(String(b.store_code).padStart(3, '0'))
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  return {
    run_id: latest.run_id,
    current_start: latest.current_start,
    current_end: latest.current_end,
    previous_start: latest.previous_start,
    previous_end: latest.previous_end,
    updated_at: latest.updated_at,
    rows,
    totals: aggregate(rows),
  }
}
