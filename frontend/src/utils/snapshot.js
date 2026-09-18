export const EVENT_META = {
  segunda_pizza: { label: 'Segunda da Pizza', className: 'event-pizza' },
  terca_carne: { label: 'Terça da Carne', className: 'event-carne' },
  quarta_quinta_verde: { label: 'Quarta e Quinta Verde', className: 'event-verde' },
  sexta_pao: { label: 'Sexta do Pão', className: 'event-pao' },
  fim_semana: { label: 'Fim de semana', className: 'event-weekend' },
}

export function getDetails(snapshot) {
  return snapshot?.details && typeof snapshot.details === 'object' ? snapshot.details : null
}

export function getStoreOptions(snapshot) {
  const details = getDetails(snapshot)
  const stores = Array.isArray(details?.stores) ? details.stores : []
  return [
    { value: 'network', label: 'Todas as lojas' },
    ...stores.map((store) => ({
      value: String(store.store_code),
      label: `${String(store.store_code).padStart(3, '0')} · ${store.store_name || 'Loja'}`,
    })),
  ]
}

export function getScope(snapshot, storeCode = 'network') {
  const details = getDetails(snapshot)
  if (!details) return null
  if (storeCode === 'network') return details.network ?? null
  return (details.stores ?? []).find((store) => String(store.store_code) === String(storeCode)) ?? null
}

function findFilteredItem(scope, filterSector) {
  if (!scope) return null
  if (!filterSector) return scope
  return (scope.sectors || []).find((sector) => sector.name === filterSector) ?? null
}

function hasQuantityEventData(details, filterSector) {
  const scopes = [details?.network, ...(Array.isArray(details?.stores) ? details.stores : [])]
  return scopes.some((scope) => {
    const item = findFilteredItem(scope, filterSector)
    return item && [item.current_quantity, item.previous_quantity].some((value) => value !== null && value !== undefined)
  })
}

export function getEventMetricFields(snapshot) {
  const details = getDetails(snapshot)
  const filterSector = details?.event_filter_sector || null
  const slug = snapshot?.event_slug || snapshot?.slug
  const quantityAvailable = hasQuantityEventData(details, filterSector)

  // Regra operacional: Segunda da Pizza é leitura em unidades.
  // Snapshots antigos podem ter salvo a quantidade nos campos monetários;
  // nesse caso reaproveitamos os mesmos números, mas formatamos como UND.
  if (slug === 'segunda_pizza') {
    return quantityAvailable
      ? {
          current: 'current_quantity',
          previous: 'previous_quantity',
          difference: 'quantity_difference',
          variation: 'quantity_variation_percent',
          filterSector,
          metric: 'quantity',
          unit: 'UND',
        }
      : {
          current: 'current_value',
          previous: 'previous_value',
          difference: 'difference_value',
          variation: 'variation_percent',
          filterSector,
          metric: 'quantity',
          unit: 'UND',
        }
  }

  const metric = snapshot?.metric || 'monetary'
  if (metric === 'quantity') {
    return {
      current: 'current_quantity',
      previous: 'previous_quantity',
      difference: 'quantity_difference',
      variation: 'quantity_variation_percent',
      filterSector,
      metric: 'quantity',
      unit: snapshot?.unit || 'UND',
    }
  }

  return {
    current: 'current_value',
    previous: 'previous_value',
    difference: 'difference_value',
    variation: 'variation_percent',
    filterSector,
    metric: 'monetary',
    unit: snapshot?.unit || null,
  }
}

export function hasEventStoreData(snapshot) {
  if (!snapshot) return false
  const fields = getEventMetricFields(snapshot)
  const rows = getEventStoreRows(snapshot)
  return rows.some(({ item }) => {
    if (!item) return false
    return [item?.[fields.current], item?.[fields.previous]].some((value) => value !== null && value !== undefined)
  })
}

const STORE_ORDER = ['307', '212', '600', '120', '033', '018']
const STORE_SEQUENCE = Object.fromEntries(STORE_ORDER.map((code, index) => [code, String(index + 1).padStart(2, '0')]))

export function getEventMetricItem(snapshot, scope) {
  if (!scope) return null
  const { filterSector } = getEventMetricFields(snapshot)
  return findFilteredItem(scope, filterSector)
}

export function getEventStoreRows(snapshot) {
  const details = getDetails(snapshot)
  const stores = Array.isArray(details?.stores) ? details.stores : []

  return stores
    .map((store) => {
      const storeCode = String(store.store_code || '').padStart(3, '0')
      return {
        storeCode,
        sequence: STORE_SEQUENCE[storeCode] || storeCode,
        storeName: store.store_name || `SUPERMERCADO PRIMOR ${STORE_SEQUENCE[storeCode] || ''} ${storeCode}`.trim(),
        item: getEventMetricItem(snapshot, store),
      }
    })
    .sort((a, b) => {
      const ai = STORE_ORDER.indexOf(a.storeCode)
      const bi = STORE_ORDER.indexOf(b.storeCode)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
}

export function getEventNetworkSummary(snapshot) {
  const details = getDetails(snapshot)
  const networkItem = getEventMetricItem(snapshot, details?.network ?? null)
  if (networkItem) return networkItem

  const fields = getEventMetricFields(snapshot)
  const storeRows = getEventStoreRows(snapshot)
  const storeItems = storeRows.map((row) => row.item).filter(Boolean)

  if (storeItems.length) {
    const current = storeItems.reduce((sum, item) => sum + Number(item?.[fields.current] || 0), 0)
    const previous = storeItems.reduce((sum, item) => sum + Number(item?.[fields.previous] || 0), 0)
    const difference = current - previous
    const variation = previous ? (difference / previous) * 100 : null
    return {
      [fields.current]: current,
      [fields.previous]: previous,
      [fields.difference]: difference,
      [fields.variation]: variation,
    }
  }

  const current = snapshot?.[fields.current]
  const previous = snapshot?.[fields.previous]
  const difference = snapshot?.[fields.difference]
  const variation = snapshot?.[fields.variation]

  const hasAnyValue = [current, previous, difference, variation].some((value) => value !== null && value !== undefined)
  if (!hasAnyValue) return null

  return {
    [fields.current]: current,
    [fields.previous]: previous,
    [fields.difference]: difference,
    [fields.variation]: variation,
  }
}

export function visibleSectors(snapshot, scope) {
  const sectors = Array.isArray(scope?.sectors) ? scope.sectors : []
  if (snapshot?.snapshot_type !== 'EVENT') return sectors

  const { filterSector } = getEventMetricFields(snapshot)
  if (!filterSector) return sectors
  return sectors.filter((sector) => sector.name === filterSector)
}
