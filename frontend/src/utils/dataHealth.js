/**
 * Comparador de preços implícitos em snapshots de Tabloide.
 * Auxilia o QA sem sobrescrever relatórios originais.
 */
export function detectProductPriceAnomalies(rows, { factor = 3, minimumDifference = 1000 } = {}) {
  const byProduct = new Map()
  for (const row of rows || []) {
    const quantity = Number(row.quantity)
    const sales = Number(row.sales_value)
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(sales) || sales < 0) continue
    const key = String(row.product_code || '').trim()
    if (!key) continue
    if (!byProduct.has(key)) byProduct.set(key, [])
    byProduct.get(key).push({ ...row, unit: sales / quantity, quantity, sales })
  }
  const alerts = []
  for (const observations of byProduct.values()) {
    if (new Set(observations.map((x) => x.store_code)).size < 3) continue
    const values = observations.map((x) => x.unit).sort((a, b) => a - b)
    const midpoint = Math.floor(values.length / 2)
    const benchmark = values.length % 2 ? values[midpoint] : (values[midpoint - 1] + values[midpoint]) / 2
    if (benchmark <= 0) continue
    for (const row of observations) {
      const difference = row.sales - benchmark * row.quantity
      if ((row.unit > benchmark * factor || row.unit < benchmark / factor) &&
        Math.abs(difference) >= minimumDifference) {
        alerts.push({ ...row, benchmark, difference })
      }
    }
  }
  return alerts.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
}
