
import { LOSS_STORE_ORDER } from './losses.js'
import { isExcludedLossProduct } from './lossProducts.js'
import { buildSectorSummary } from './lossDashboard.js'

const STORE_LABELS = new Map(LOSS_STORE_ORDER.map((code, index) => [code, 'Loja ' + String(index + 1).padStart(2, '0') + ' · ' + code]))

export function safeNumber(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function storeCode(value) {
  return String(value ?? '').padStart(3, '0')
}

function variation(current, previous) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null
}

function collectSalesNodes(store, level, sectorFilter, groupFilter) {
  const result = []
  for (const sector of store?.sectors || []) {
    const sectorName = String(sector?.name || '').trim()
    if (!sectorName) continue
    if (level === 'sector') {
      result.push({ name: sectorName, sector: sectorName, node: sector })
      continue
    }
    if (sectorFilter && sectorName !== sectorFilter) continue
    for (const group of sector.groups || []) {
      const groupName = String(group?.name || '').trim()
      if (!groupName) continue
      if (level === 'group') {
        result.push({ name: groupName, sector: sectorName, group: groupName, node: group })
        continue
      }
      if (groupFilter && groupName !== groupFilter) continue
      for (const subgroup of group.subgroups || []) {
        if (subgroup?.name) result.push({ name: subgroup.name, sector: sectorName, group: groupName, node: subgroup })
      }
    }
  }
  return result
}

/** Mesmo snapshot e nível da hierarquia; jamais soma setor e seus grupos. */
export function diagnoseSales(snapshot, { store = '', level = 'sector', sector = '', group = '' } = {}) {
  const stores = (snapshot?.details?.stores || []).filter((row) => !store || storeCode(row.store_code) === storeCode(store))
  const aggregate = new Map()
  const selectedLevel = ['sector', 'group', 'subgroup'].includes(level) ? level : 'sector'
  for (const row of stores) {
    const code = storeCode(row.store_code)
    for (const item of collectSalesNodes(row, selectedLevel, sector, group)) {
      const current = safeNumber(item.node.current_value)
      const previous = safeNumber(item.node.previous_value)
      if (current === null || previous === null) continue
      const key = [item.sector, selectedLevel === 'sector' ? '' : (item.group || ''), selectedLevel === 'subgroup' ? item.name : ''].join('::')
      const actualKey = selectedLevel === 'sector' ? item.sector : selectedLevel === 'group' ? item.sector + '::' + item.name : key
      const existing = aggregate.get(actualKey) || {
        name: item.name, sector: item.sector, group: item.group || '',
        current: 0, previous: 0, stores: new Set(),
      }
      existing.current += current
      existing.previous += previous
      existing.stores.add(code)
      aggregate.set(actualKey, existing)
    }
  }
  const items = [...aggregate.values()].map(({ stores: present, ...row }) => ({
    ...row, storeCount: present.size, difference: row.current - row.previous,
    variation: variation(row.current, row.previous),
  })).sort((a, b) => a.difference - b.difference)
  const totalDecline = items.reduce((sum, row) => sum + Math.max(0, -row.difference), 0)
  const totalGrowth = items.reduce((sum, row) => sum + Math.max(0, row.difference), 0)
  const rows = items.map((row) => ({
    ...row, declineContribution: row.difference < 0 && totalDecline > 0
      ? (-row.difference / totalDecline) * 100 : 0,
  }))
  return {
    rows, declines: rows.filter((row) => row.difference < 0),
    growth: rows.filter((row) => row.difference > 0).sort((a, b) => b.difference - a.difference),
    totalDecline, totalGrowth, netDifference: totalGrowth - totalDecline,
    storeCount: new Set(stores.map((row) => storeCode(row.store_code))).size,
    period: snapshot ? { start: snapshot.current_start, end: snapshot.current_end, previousStart: snapshot.previous_start, previousEnd: snapshot.previous_end } : null,
    quality: snapshot?.quality?.status || null,
  }
}

/** ABC/Pareto: último snapshot da competência, lojas/sectores opcionais. */
export function lossPareto(lossRun, { store = '', sector = '' } = {}) {
  const grouped = new Map()
  const includedStores = new Set()
  for (const row of lossRun?.rows || []) {
    const code = storeCode(row.store_code)
    if (store && storeCode(store) !== code) continue
    includedStores.add(code)
    for (const itemSector of row.details?.current?.sectors || []) {
      if (sector && itemSector.name !== sector) continue
      for (const mip of itemSector.mips || []) {
        for (const product of mip.products || []) {
          if (isExcludedLossProduct(product)) continue
          const value = safeNumber(product.total_value)
          const productCode = String(product.product_code || '').trim()
          if (!productCode || value === null || value <= 0) continue
          const current = grouped.get(productCode) || {
            code: productCode, name: product.product_name || productCode,
            value: 0, stores: new Set(), sectors: new Set(),
          }
          current.value += value
          current.stores.add(code)
          current.sectors.add(itemSector.name)
          grouped.set(productCode, current)
        }
      }
    }
  }
  const ordered = [...grouped.values()].sort((a, b) => b.value - a.value || a.code.localeCompare(b.code))
  const total = ordered.reduce((sum, row) => sum + row.value, 0)
  let cumulative = 0
  const products = ordered.map(({ stores, sectors, ...row }) => {
    const before = total > 0 ? (cumulative / total) * 100 : 0
    const classification = before < 80 ? 'A' : before < 95 ? 'B' : 'C'
    cumulative += row.value
    return {
      ...row, storeCount: stores.size, sectors: [...sectors].sort(),
      share: total > 0 ? (row.value / total) * 100 : 0,
      cumulative: total > 0 ? Math.min(100, (cumulative / total) * 100) : 0,
      classification,
    }
  })
  const classes = Object.fromEntries(['A', 'B', 'C'].map((name) => {
    const items = products.filter((row) => row.classification === name)
    const value = items.reduce((sum, row) => sum + row.value, 0)
    return [name, { count: items.length, value, share: total > 0 ? (value / total) * 100 : 0 }]
  }))
  return { products, total, classes, storeCount: includedStores.size,
    period: lossRun ? { start: lossRun.current_start, end: lossRun.current_end } : null,
    complete: Boolean(lossRun?.complete), count: products.length }
}

/** Oportunidades por departamento: quedas de venda e excesso teórico de perdas são separados. */
export function buildOpportunityRadar({ salesSnapshot = null, lossRun = null } = {}) {
  const sales = []
  const losses = []
  const errors = []
  if (salesSnapshot && salesSnapshot.quality?.status !== 'PASS') errors.push('Qualidade do relatório de vendas não aprovada.')
  if (lossRun && (!lossRun.complete || lossRun.rows?.some((row) => row.quality?.status !== 'PASS'))) {
    errors.push('Competência de perdas incompleta ou com qualidade pendente.')
  }
  if (salesSnapshot?.quality?.status === 'PASS') {
    for (const row of salesSnapshot.details?.stores || []) {
      const code = storeCode(row.store_code)
      const current = safeNumber(row.current_value)
      const previous = safeNumber(row.previous_value)
      if (current === null || previous === null || previous <= 0) continue
      const delta = current - previous
      const pct = variation(current, previous)
      if (delta >= -10000 || pct > -5) continue
      const drivers = [...(row.sectors || [])]
        .filter((s) => safeNumber(s.current_value) !== null && safeNumber(s.previous_value) !== null)
        .map((s) => ({ name: s.name, delta: Number(s.current_value) - Number(s.previous_value) }))
        .filter((s) => s.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 2)
      sales.push({
        kind: 'VENDAS', storeCode: code, storeName: STORE_LABELS.get(code) || row.store_name || code,
        sector: drivers[0]?.name || '', title: 'Investigar queda de vendas na loja ' + code,
        description: 'Vendas de ' + salesSnapshot.current_start + ' a ' + salesSnapshot.current_end
          + ' comparadas a ' + salesSnapshot.previous_start + ' a ' + salesSnapshot.previous_end
          + '. Principais setores: ' + drivers.map((s) => s.name + ': ' + s.delta.toFixed(2) + ' reais').join('; '),
        impact: -delta, variation: pct, current, previous,
        periodStart: salesSnapshot.current_start, periodEnd: salesSnapshot.current_end,
      })
    }
  }
  const lossQualityOk = Boolean(lossRun?.complete && lossRun.rows.every((row) => row.quality?.status === 'PASS'))
  if (lossQualityOk) {
    for (const row of lossRun.rows) {
      for (const sector of buildSectorSummary(row).sectors || []) {
        const target = safeNumber(sector.target)
        const currentPercent = safeNumber(sector.current?.percent)
        const sectorLoss = safeNumber(sector.current?.loss)
        const sectorSales = safeNumber(sector.current?.sales)
        if (target === null || currentPercent === null || sectorLoss === null || sectorSales === null ||
            sectorSales <= 0 || currentPercent <= target) continue
        const excess = Math.max(0, sectorLoss - sectorSales * target / 100)
        if (excess < 500) continue
        const code = storeCode(row.store_code)
        losses.push({
          kind: 'PERDAS', storeCode: code, storeName: STORE_LABELS.get(code) || row.store_name || code,
          sector: sector.name, title: 'Reduzir perdas em ' + sector.name + ' — loja ' + code,
          description: 'De ' + lossRun.current_start + ' a ' + lossRun.current_end + ': '
            + currentPercent.toFixed(2) + '% em perdas ante meta de ' + target.toFixed(2)
            + '%. Excesso teórico, não economia garantida.',
          impact: excess, current: sectorLoss, targetValue: sectorSales * target / 100,
          currentRate: currentPercent, targetRate: target,
          periodStart: lossRun.current_start, periodEnd: lossRun.current_end,
        })
      }
    }
  }
  sales.sort((a, b) => b.impact - a.impact)
  losses.sort((a, b) => b.impact - a.impact)
  return { sales, losses, errors, criteria: { salesMinimumPct: 5, salesMinimumValue: 10000, lossExcessMinimum: 500 } }
}

export function actionPlanLink(opportunity) {
  const params = new URLSearchParams({
    department: opportunity.kind,
    store_code: opportunity.storeCode,
    sector: opportunity.sector || '',
    title: opportunity.title,
    description: opportunity.description || '',
    baseline_value: String(opportunity.current ?? ''),
    target_value: String(opportunity.targetValue ?? opportunity.previous ?? ''),
  })
  return '/planos-acao?' + params.toString()
}
