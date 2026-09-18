function number(value) {
  return Number(value || 0)
}

export const LOSS_STORE_ORDER = ['307', '212', '600', '120', '033', '018']
export const LOSS_STORE_SEQUENCE = Object.fromEntries(
  LOSS_STORE_ORDER.map((code, index) => [code, String(index + 1).padStart(2, '0')]),
)

export function variation(current, previous) {
  const cur = number(current)
  const prev = number(previous)
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}

export function lossTone(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric === 0) return ''
  // Em perdas, aumentar é ruim e reduzir é bom.
  return numeric > 0 ? 'negative-text' : 'positive-text'
}

export function lossCardTone(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric === 0) return ''
  return numeric > 0 ? 'negative' : 'positive'
}

export function rowLossDifference(row) {
  if (row?.loss_difference !== null && row?.loss_difference !== undefined) return number(row.loss_difference)
  return number(row?.current_total_value) - number(row?.previous_total_value)
}

export function rowLossVariation(row) {
  if (row?.loss_variation_percent !== null && row?.loss_variation_percent !== undefined) {
    return Number(row.loss_variation_percent)
  }
  return variation(row?.current_total_value, row?.previous_total_value)
}

export function sectorLossValue(sector) {
  const reported = sector?.reported_totals?.total_value
  if (reported !== null && reported !== undefined) return number(reported)
  return number(sector?.calculated_monetary_totals?.total_value)
}

export function mipLossValue(mip) {
  return (mip?.products || []).reduce((sum, product) => sum + number(product?.total_value), 0)
}

export function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleUpperCase('pt-BR')
}

export function pairByName(current = [], previous = [], nameField = 'name') {
  const previousMap = new Map(previous.map((item) => [normalizeName(item?.[nameField]), item]))
  const result = []
  const seen = new Set()

  for (const currentItem of current) {
    const key = normalizeName(currentItem?.[nameField])
    result.push({ key, current: currentItem, previous: previousMap.get(key) || null })
    seen.add(key)
  }
  for (const previousItem of previous) {
    const key = normalizeName(previousItem?.[nameField])
    if (!seen.has(key)) result.push({ key, current: null, previous: previousItem })
  }
  return result
}

export function pairProducts(current = [], previous = []) {
  const keyOf = (product) => String(product?.product_code || normalizeName(product?.product_name))
  const previousMap = new Map(previous.map((item) => [keyOf(item), item]))
  const result = []
  const seen = new Set()

  for (const currentItem of current) {
    const key = keyOf(currentItem)
    result.push({ key, current: currentItem, previous: previousMap.get(key) || null })
    seen.add(key)
  }
  for (const previousItem of previous) {
    const key = keyOf(previousItem)
    if (!seen.has(key)) result.push({ key, current: null, previous: previousItem })
  }
  return result
}
