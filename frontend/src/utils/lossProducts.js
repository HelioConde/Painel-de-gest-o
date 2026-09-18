import { LOSS_STORE_ORDER } from './losses.js'

const EXCLUDED_CODES = new Set(['410364'])
const EXCLUDED_NAMES = new Set(['MUCHIBA OSSO'])

function number(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

export function normalizeLossSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR')
}

export function isExcludedLossProduct(product) {
  const code = String(product?.product_code || '').replace(/\D/g, '')
  return EXCLUDED_CODES.has(code) || EXCLUDED_NAMES.has(normalizeLossSearch(product?.product_name))
}

function productSort(a, b) {
  return number(b?.loss_quantity) - number(a?.loss_quantity)
    || number(b?.total_value) - number(a?.total_value)
    || String(a?.product_name || '').localeCompare(String(b?.product_name || ''), 'pt-BR')
}

function topProducts(products) {
  return [...products]
    .filter((product) => number(product?.loss_quantity) > 0)
    .sort(productSort)
    .slice(0, 10)
    .map((product, index) => ({ ...product, rank: index + 1 }))
}

function totals(products) {
  return {
    loss_quantity: products.reduce((sum, product) => sum + number(product?.loss_quantity), 0),
    gross_cost_total: products.reduce((sum, product) => sum + number(product?.gross_cost_total), 0),
    sale_price_total: products.reduce((sum, product) => sum + number(product?.sale_price_total), 0),
    total_value: products.reduce((sum, product) => sum + number(product?.total_value), 0),
  }
}

function sanitizeSide(side) {
  if (!side?.sectors) return side
  const allProducts = []
  const sectors = side.sectors.map((sector) => {
    const sectorProducts = []
    const mips = (sector.mips || []).map((mip) => {
      const products = (mip.products || []).filter((product) => !isExcludedLossProduct(product))
      sectorProducts.push(...products)
      return { ...mip, products }
    }).filter((mip) => mip.products.length > 0)
    const sectorTotals = totals(sectorProducts)
    allProducts.push(...sectorProducts)
    return {
      ...sector,
      mips,
      product_count: sectorProducts.length,
      top_losses: topProducts(sectorProducts),
      reported_totals: sectorTotals,
      calculated_monetary_totals: {
        gross_cost_total: sectorTotals.gross_cost_total,
        sale_price_total: sectorTotals.sale_price_total,
        total_value: sectorTotals.total_value,
      },
    }
  })
  return { ...side, sectors, grand_totals: { record_count: allProducts.length, ...totals(allProducts) } }
}

function variation(current, previous) {
  return previous ? ((current - previous) / previous) * 100 : null
}

function ratio(loss, sales) {
  return sales ? (loss / sales) * 100 : null
}

export function sanitizeLossRow(row) {
  const current = sanitizeSide(row?.details?.current)
  const previous = sanitizeSide(row?.details?.previous)
  if (!current?.grand_totals || !previous?.grand_totals) return row
  const currentLoss = number(current.grand_totals.total_value)
  const previousLoss = number(previous.grand_totals.total_value)
  const currentSales = number(row.current_sales_value)
  const previousSales = number(row.previous_sales_value)
  return {
    ...row,
    current_record_count: current.grand_totals.record_count,
    previous_record_count: previous.grand_totals.record_count,
    current_loss_quantity: current.grand_totals.loss_quantity,
    previous_loss_quantity: previous.grand_totals.loss_quantity,
    current_total_value: currentLoss,
    previous_total_value: previousLoss,
    loss_difference: currentLoss - previousLoss,
    loss_variation_percent: variation(currentLoss, previousLoss),
    current_loss_sales_percent: ratio(currentLoss, currentSales),
    previous_loss_sales_percent: ratio(previousLoss, previousSales),
    details: { ...row.details, current, previous },
  }
}

function canonicalSector(value) {
  const normalized = normalizeLossSearch(value)
  return normalized === 'PRODUTOS NATURAIS' ? 'FLV MANIPULADOS' : normalized
}

export function currentProductsForStore(row) {
  const products = []
  for (const sector of row?.details?.current?.sectors || []) {
    for (const mip of sector?.mips || []) {
      for (const product of mip?.products || []) {
        if (isExcludedLossProduct(product)) continue
        products.push({
          ...product,
          sector_name: canonicalSector(sector.name),
          store_code: String(row.store_code || '').padStart(3, '0'),
          store_name: row.store_name,
        })
      }
    }
  }
  return products
}

export function groupLossProductsByStore(rows, { query = '', sector = null, limitPerStore = null } = {}) {
  const needle = normalizeLossSearch(query)
  const selectedSector = sector ? canonicalSector(sector) : null
  const groups = [...(rows || [])]
    .sort((a, b) => LOSS_STORE_ORDER.indexOf(String(a.store_code).padStart(3, '0')) - LOSS_STORE_ORDER.indexOf(String(b.store_code).padStart(3, '0')))
    .map((row) => {
      let products = currentProductsForStore(row)
        .filter((product) => number(product.loss_quantity) > 0)
        .filter((product) => !selectedSector || product.sector_name === selectedSector)
        .filter((product) => {
          if (!needle) return true
          return normalizeLossSearch(`${product.product_code || ''} ${product.product_name || ''}`).includes(needle)
        })
        .sort(productSort)
      if (limitPerStore) products = products.slice(0, limitPerStore)
      products = products.map((product, index) => ({ ...product, rank: index + 1 }))
      return {
        store_code: String(row.store_code || '').padStart(3, '0'),
        store_name: row.store_name,
        products,
      }
    })
    .filter((group) => group.products.length > 0)

  return {
    groups,
    productCount: groups.reduce((sum, group) => sum + group.products.length, 0),
    storeCount: groups.length,
  }
}
