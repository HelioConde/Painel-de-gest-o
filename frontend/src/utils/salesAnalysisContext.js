import { getEventMetricFields, getScope } from './snapshot'

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null

function value(scope, snapshot, field) {
  return number(scope?.[field] ?? snapshot?.[field])
}

function variation(current, previous, provided) {
  const direct = number(provided)
  if (direct !== null) return direct
  if (!previous) return null
  return ((number(current) || 0) - previous) / previous * 100
}

function buildSectorData(scope) {
  const subgrupos = []
  const setores = (scope?.sectors || []).map((sector) => {
    const vendaAtual = number(sector.current_value)
    const vendaAnterior = number(sector.previous_value)
    const diferenca = number(sector.difference_value) ?? ((vendaAtual || 0) - (vendaAnterior || 0))
    const sectorSubgroups = (sector.subgroups || sector.groups || []).map((subgroup) => ({
      nome: subgroup.name || subgroup.nome || 'Subgrupo sem identificação',
      vendaAtual: number(subgroup.current_value),
      vendaAnterior: number(subgroup.previous_value),
      diferenca: number(subgroup.difference_value) ?? ((number(subgroup.current_value) || 0) - (number(subgroup.previous_value) || 0)),
      variacaoPercentual: variation(subgroup.current_value, subgroup.previous_value, subgroup.variation_percent),
    })).filter((subgroup) => subgroup.vendaAtual !== null || subgroup.vendaAnterior !== null)

    subgrupos.push(...sectorSubgroups.map((subgroup) => ({ setor: sector.name || 'Setor sem identificação', subgrupo: subgroup.nome, ...subgroup })))

    return {
      setor: sector.name || 'Setor sem identificação',
      vendaAtual,
      vendaAnterior,
      diferenca,
      variacaoPercentual: variation(vendaAtual, vendaAnterior, sector.variation_percent),
      ...(sectorSubgroups.length ? { subgrupos: sectorSubgroups } : {}),
    }
  }).filter((sector) => sector.vendaAtual !== null || sector.vendaAnterior !== null)

  return {
    setores: setores.sort((left, right) => Math.abs(right.diferenca || 0) - Math.abs(left.diferenca || 0)),
    subgrupos: subgrupos.sort((left, right) => Math.abs(right.diferenca || 0) - Math.abs(left.diferenca || 0)),
  }
}

function buildEvents(events, storeCode) {
  return (events || []).flatMap((snapshot) => {
    const fields = getEventMetricFields(snapshot)
    if (fields.metric !== 'monetary') return []
    const scope = getScope(snapshot, storeCode)
    if (!scope) return []

    const vendaAtual = number(scope[fields.current])
    const vendaAnterior = number(scope[fields.previous])
    if (vendaAtual === null && vendaAnterior === null) return []

    return [{
      nome: snapshot.event_name || snapshot.name || snapshot.slug || 'Evento',
      periodoAtual: { inicio: snapshot.current_start, fim: snapshot.current_end },
      vendaAtual,
      vendaAnterior,
      diferenca: number(scope[fields.difference]) ?? ((vendaAtual || 0) - (vendaAnterior || 0)),
      variacaoPercentual: variation(vendaAtual, vendaAnterior, scope[fields.variation]),
    }]
  })
}

export function buildSalesAnalysisContext({ monthly, daily, events }, storeCode) {
  const snapshot = monthly || daily
  if (!snapshot) return null

  const scope = getScope(snapshot, storeCode)
  if (!scope) return null

  const vendaAtual = value(scope, snapshot, 'current_value')
  const vendaAnterior = value(scope, snapshot, 'previous_value')
  const diferenca = value(scope, snapshot, 'difference_value') ?? ((vendaAtual || 0) - (vendaAnterior || 0))

  const sectorData = buildSectorData(scope)
  const contagemSetores = sectorData.setores.reduce((counts, sector) => {
    if (sector.variacaoPercentual > 0) counts.emAlta += 1
    else if (sector.variacaoPercentual < 0) counts.emQueda += 1
    else counts.estaveis += 1
    return counts
  }, { emAlta: 0, emQueda: 0, estaveis: 0 })

  return {
    loja: {
      codigo: String(scope.store_code || storeCode).padStart(3, '0'),
      nome: scope.store_name || `LOJA ${String(storeCode).padStart(3, '0')}`,
    },
    periodoAtual: { inicio: snapshot.current_start, fim: snapshot.current_end },
    periodoComparativo: { inicio: snapshot.previous_start, fim: snapshot.previous_end },
    resumoVendas: {
      vendaAtual,
      vendaAnterior,
      diferenca,
      variacaoPercentual: variation(vendaAtual, vendaAnterior, value(scope, snapshot, 'variation_percent')),
    },
    setores: sectorData.setores,
    subgrupos: sectorData.subgrupos,
    eventos: buildEvents(events, storeCode),
    contagemSetores,
    fonte: snapshot.snapshot_type === 'MONTHLY' || snapshot.snapshot_type === 'MONTHLY_CLOSE' ? 'Venda Mensal' : 'Venda Diária',
  }
}
