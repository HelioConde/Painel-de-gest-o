import { LOSS_SECTOR_ORDER, LOSS_SECTOR_TARGETS } from '../config/lossTargets.js'
import { normalizeName, sectorLossValue } from './losses.js'
import { isExcludedLossProduct } from './lossProducts.js'

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

export const LOSS_RANKING_OPTIONS = {
  value: { label: 'Valor R$', field: 'total_value' },
  quantity: { label: 'Quantidade', field: 'loss_quantity' },
  percent: { label: '% Perda', field: 'loss_quantity_sales_percent' },
}

function productKey(product) {
  const code = String(product?.product_code || '').replace(/\D/g, '')
  if (code) return `code:${code}`
  return `fallback:${normalizeName(product?.product_name)}:${normalizeName(product?.unit)}`
}

function productsByCanonicalSector(side) {
  const sectors = new Map()
  for (const sector of side?.sectors || []) {
    const sectorName = canonicalLossSectorName(sector?.name)
    if (!sectorName) continue
    const products = sectors.get(sectorName) || []
    for (const mip of sector?.mips || []) {
      products.push(...(mip?.products || []).filter((product) => !isExcludedLossProduct(product)))
    }
    sectors.set(sectorName, products)
  }
  return sectors
}

function aggregateProducts(products = []) {
  const grouped = new Map()
  for (const product of products) {
    if (number(product?.loss_quantity) <= 0) continue
    const key = productKey(product)
    const previous = grouped.get(key) || {
      ...product,
      product_key: key,
      loss_quantity: 0,
      total_value: 0,
      gross_cost_total: 0,
      sale_price_total: 0,
      quantity_sold: null,
      record_count: 0,
    }
    previous.loss_quantity += number(product?.loss_quantity)
    previous.total_value += number(product?.total_value)
    previous.gross_cost_total += number(product?.gross_cost_total)
    previous.sale_price_total += number(product?.sale_price_total)
    const sold = product?.quantity_sold
    if (sold !== null && sold !== undefined && Number.isFinite(Number(sold))) {
      previous.quantity_sold = Math.max(number(previous.quantity_sold), number(sold))
    }
    previous.record_count += 1
    grouped.set(key, previous)
  }
  return grouped
}

function comparison(current, previous, ranking) {
  if (!previous) return { kind: 'new', value: null }
  const field = LOSS_RANKING_OPTIONS[ranking]?.field || LOSS_RANKING_OPTIONS.value.field
  const currentValue = number(current?.[field])
  const previousValue = previous?.[field]
  if (previousValue === null || previousValue === undefined || !number(previousValue)) {
    return currentValue ? { kind: 'no-base', value: null } : { kind: 'equal', value: 0 }
  }
  const variation = ((currentValue - number(previousValue)) / number(previousValue)) * 100
  if (Math.abs(variation) < 0.005) return { kind: 'equal', value: 0 }
  return { kind: variation > 0 ? 'up' : 'down', value: variation }
}

function rankingValue(product, ranking) {
  return number(product?.[LOSS_RANKING_OPTIONS[ranking]?.field || 'total_value'])
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

export function buildTopLossesBySector(row, ranking = 'value') {
  const currentBySector = productsByCanonicalSector(row?.details?.current)
  const previousBySector = productsByCanonicalSector(row?.details?.previous)
  return LOSS_SECTOR_ORDER.map((name) => {
    const current = aggregateProducts(currentBySector.get(name) || [])
    if (!current.size) return null
    const previous = aggregateProducts(previousBySector.get(name) || [])
    const sectorTotalValue = [...current.values()].reduce((sum, product) => sum + number(product.total_value), 0)
    const products = [...current.values()]
      .map((item) => {
        const lossQuantitySalesPercent = ratio(item.loss_quantity, item.quantity_sold)
        const currentProduct = { ...item, loss_quantity_sales_percent: lossQuantitySalesPercent }
        const previousItem = previous.get(item.product_key)
        const previousProduct = previousItem
          ? { ...previousItem, loss_quantity_sales_percent: ratio(previousItem.loss_quantity, previousItem.quantity_sold) }
          : null
        return {
          ...currentProduct,
          sector_share_percent: sectorTotalValue ? (number(item.total_value) / sectorTotalValue) * 100 : null,
          comparison: comparison(currentProduct, previousProduct, ranking),
        }
      })
      .sort((a, b) => rankingValue(b, ranking) - rankingValue(a, ranking)
        || number(b.total_value) - number(a.total_value)
        || String(a.product_name || '').localeCompare(String(b.product_name || ''), 'pt-BR'))
      .slice(0, 10)
      .map((item, index) => ({ ...item, rank: index + 1 }))
    if (!products.length) return null
    return { name, products, productCount: current.size, totalValue: sectorTotalValue }
  }).filter(Boolean)
}

export function targetTone(percentValue, target) {
  if (target === null || target === undefined || percentValue === null || percentValue === undefined) return 'neutral'
  return Number(percentValue) <= Number(target) ? 'good' : 'bad'
}
