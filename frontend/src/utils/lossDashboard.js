import { LOSS_SECTOR_ORDER, LOSS_SECTOR_TARGETS } from '../config/lossTargets'
import { normalizeName, sectorLossValue } from './losses'
import { isExcludedLossProduct } from './lossProducts'

const CANONICAL_BY_KEY = new Map(LOSS_SECTOR_ORDER.map((name) => [normalizeName(name), name]))

const ALIASES = new Map([
  [normalizeName('AÇOUGUE'), 'ACOUGUE'],
  [normalizeName('EMPÓRIO'), 'EMPORIO'],
  [normalizeName('PERECÍVEIS'), 'PERECIVEIS'],
  // Regra comercial existente: Produtos Naturais fica junto do FLV Manipulados.
  [normalizeName('PRODUTOS NATURAIS'), 'FLV MANIPULADOS'],
])

export function canonicalLossSectorName(value) {
  const key = normalizeName(value)
  return ALIASES.get(key) || CANONICAL_BY_KEY.get(key) || null
}

function number(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function ratio(loss, sales) {
  if (sales === null || sales === undefined) return null
  const saleValue = number(sales)
  if (!saleValue) return number(loss) ? null : 0
  return (number(loss) / saleValue) * 100
}

function mergeLossSectors(sectors = []) {
  const map = new Map()
  for (const sector of sectors) {
    const name = canonicalLossSectorName(sector?.name)
    if (!name) continue
    const current = map.get(name) || { name, lossValue: 0, sourceSectors: [], topLosses: [] }
    current.lossValue += sectorLossValue(sector)
    current.sourceSectors.push(sector)
    current.topLosses.push(...(sector?.top_losses || []).filter((product) => !isExcludedLossProduct(product)))
    map.set(name, current)
  }
  return map
}

function salesMap(side) {
  const sectors = side?.sales?.sectors || []
  const result = new Map()
  for (const sector of sectors) {
    const name = canonicalLossSectorName(sector?.name)
    if (!name) continue
    const previous = result.get(name) || 0
    result.set(name, previous + number(sector?.sales_value))
  }
  return { map: result, complete: sectors.length >= 17 }
}

function fallbackSalesFromLoss(mergedLoss) {
  const map = new Map()
  for (const [name, merged] of mergedLoss) {
    let total = 0
    let found = false
    for (const source of merged.sourceSectors) {
      const value = source?.sales_context?.sales_value
      if (value !== null && value !== undefined) {
        total += number(value)
        found = true
      }
    }
    if (found) map.set(name, total)
  }
  return map
}

export function buildSectorSummary(row) {
  const currentSide = row?.details?.current || {}
  const previousSide = row?.details?.previous || {}
  const currentLoss = mergeLossSectors(currentSide.sectors || [])
  const previousLoss = mergeLossSectors(previousSide.sectors || [])
  const currentSales = salesMap(currentSide)
  const previousSales = salesMap(previousSide)
  const currentFallback = fallbackSalesFromLoss(currentLoss)
  const previousFallback = fallbackSalesFromLoss(previousLoss)

  const sectors = LOSS_SECTOR_ORDER.map((name) => {
    const curLoss = currentLoss.get(name)?.lossValue || 0
    const prevLoss = previousLoss.get(name)?.lossValue || 0

    const curSales = currentSales.map.has(name)
      ? currentSales.map.get(name)
      : currentSales.complete
        ? 0
        : currentFallback.has(name)
          ? currentFallback.get(name)
          : null

    const prevSales = previousSales.map.has(name)
      ? previousSales.map.get(name)
      : previousSales.complete
        ? 0
        : previousFallback.has(name)
          ? previousFallback.get(name)
          : null

    const target = LOSS_SECTOR_TARGETS[name] ?? null
    return {
      name,
      target,
      current: { sales: curSales, loss: curLoss, percent: ratio(curLoss, curSales) },
      previous: { sales: prevSales, loss: prevLoss, percent: ratio(prevLoss, prevSales) },
    }
  })

  return {
    sectors,
    hasCompleteSalesContext: currentSales.complete && previousSales.complete,
  }
}

export function buildTopLossesBySector(row) {
  const merged = mergeLossSectors(row?.details?.current?.sectors || [])
  return LOSS_SECTOR_ORDER.map((name) => {
    const sector = merged.get(name)
    if (!sector) return null
    const products = sector.topLosses
      .filter((item) => number(item?.loss_quantity) > 0)
      .sort((a, b) => number(b?.loss_quantity) - number(a?.loss_quantity))
      .slice(0, 10)
      .map((item, index) => ({ ...item, rank: index + 1 }))
    if (!products.length) return null
    return { name, products }
  }).filter(Boolean)
}

export function targetTone(percentValue, target) {
  if (target === null || target === undefined || percentValue === null || percentValue === undefined) return 'neutral'
  return Number(percentValue) <= Number(target) ? 'good' : 'bad'
}
