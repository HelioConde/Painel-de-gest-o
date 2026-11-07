import { buildSectorSummary } from './lossDashboard.js'
import { LOSS_STORE_ORDER } from './losses.js'

function numeric(value) {
  if (value === null || value === undefined || value === '') return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}

function codeOf(value) {
  return String(value || '').padStart(3, '0')
}

function ratio(value, base) {
  if (value === null || base === null || base <= 0) return null
  return (value / base) * 100
}

function variation(current, previous) {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function sumWhenComplete(stores, field) {
  if (stores.length !== LOSS_STORE_ORDER.length || stores.some((row) => row[field] === null)) return null
  return stores.reduce((total, row) => total + row[field], 0)
}

/**
 * Consolida apenas leituras já autorizadas pela tela.
 * Vendas e perdas mantêm seus períodos independentes: jamais cruzar totais
 * de competências diferentes nem tratar ausência de coleta como valor zero.
 */
export function buildStoreIntelligence({ salesSnapshot = null, lossRun = null } = {}) {
  const salesStores = new Map((salesSnapshot?.details?.stores || []).map(
    (row) => [codeOf(row.store_code), row],
  ))
  const lossStores = new Map((lossRun?.rows || []).map(
    (row) => [codeOf(row.store_code), row],
  ))
  const hotspots = []

  const stores = LOSS_STORE_ORDER.map((code, index) => {
    const sale = salesStores.get(code) || null
    const loss = lossStores.get(code) || null
    const saleCurrent = numeric(sale?.current_value)
    const salePrevious = numeric(sale?.previous_value)
    const lossValue = numeric(loss?.current_total_value)
    const lossSalesValue = numeric(loss?.current_sales_value)
    const lossRate = numeric(loss?.current_loss_sales_percent) ?? ratio(lossValue, lossSalesValue)
    const sectors = loss ? buildSectorSummary(loss).sectors : []
    const exceeded = sectors.filter((sector) => {
      const target = numeric(sector.target)
      const actual = numeric(sector.current.percent)
      return target !== null && actual !== null && actual > target
    })
    for (const sector of exceeded) {
      const sales = numeric(sector.current.sales)
      const lossAmount = numeric(sector.current.loss)
      const target = numeric(sector.target)
      const theoreticalExcess = sales !== null && lossAmount !== null && target !== null
        ? Math.max(0, lossAmount - (sales * target) / 100)
        : null
      hotspots.push({
        code,
        store: sale?.store_name || loss?.store_name || `Loja ${index + 1}`,
        sector: sector.name,
        current: numeric(sector.current.percent),
        target,
        theoreticalExcess,
      })
    }
    const salesVariation = numeric(sale?.variation_percent) ?? variation(saleCurrent, salePrevious)
    const missingSales = Boolean(salesSnapshot && !sale)
    const missingLoss = Boolean(lossRun && !loss)
    return {
      code,
      label: `Loja ${String(index + 1).padStart(2, '0')} · ${code}`,
      name: sale?.store_name || loss?.store_name || `Loja ${code}`,
      salesValue: saleCurrent,
      salesVariation,
      lossValue,
      lossRate,
      lossSalesValue,
      exceededTargets: exceeded.length,
      missingSales,
      missingLoss,
      attention: missingSales || missingLoss || exceeded.length > 0 || (salesVariation !== null && salesVariation < 0),
    }
  })

  const completeSales = Boolean(salesSnapshot) && stores.every((row) => row.salesValue !== null)
  const completeLosses = Boolean(lossRun) && stores.every((row) => row.lossValue !== null)
  const completeLossSales = Boolean(lossRun) && stores.every((row) => row.lossSalesValue !== null)
  const totalLoss = completeLosses ? sumWhenComplete(stores, 'lossValue') : null
  const totalLossSales = completeLossSales ? sumWhenComplete(stores, 'lossSalesValue') : null

  return {
    stores,
    missingSales: salesSnapshot ? stores.filter((row) => row.missingSales).map((row) => row.code) : [],
    missingLosses: lossRun ? stores.filter((row) => row.missingLoss).map((row) => row.code) : [],
    completeSales,
    completeLosses,
    alignedPeriods: Boolean(salesSnapshot && lossRun &&
      salesSnapshot.current_start === lossRun.current_start &&
      salesSnapshot.current_end === lossRun.current_end),
    salesPeriod: salesSnapshot ? { start: salesSnapshot.current_start, end: salesSnapshot.current_end } : null,
    lossPeriod: lossRun ? { start: lossRun.current_start, end: lossRun.current_end } : null,
    totals: {
      sales: completeSales ? sumWhenComplete(stores, 'salesValue') : null,
      loss: totalLoss,
      lossRate: ratio(totalLoss, totalLossSales),
    },
    hotspots: hotspots.sort((a, b) =>
      (b.theoreticalExcess ?? -1) - (a.theoreticalExcess ?? -1) ||
      (b.current - b.target) - (a.current - a.target)
    ),
  }
}
