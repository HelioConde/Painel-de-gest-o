import { buildSectorSummary, buildTopLossesBySector } from './lossDashboard'

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null

export function buildAnalysisContext(row) {
  const sectorSummary = buildSectorSummary(row)
  const sectors = sectorSummary.sectors.map((sector) => ({
    setor: sector.name,
    venda: number(sector.current.sales),
    perda: number(sector.current.loss),
    percentualPerda: number(sector.current.percent),
    meta: number(sector.target),
    vendaAnterior: number(sector.previous.sales),
    perdaAnterior: number(sector.previous.loss),
    percentualAnterior: number(sector.previous.percent),
  }))
  const topPerdas = buildTopLossesBySector(row, 'value').flatMap((group) => group.products.map((product) => ({
    setor: group.name,
    codigo: String(product.product_code || ''),
    produto: product.product_name || 'Produto sem descrição',
    quantidadePerdida: number(product.loss_quantity),
    quantidadeVendida: number(product.quantity_sold),
    valorPerda: number(product.total_value),
    percentualPerda: number(product.loss_quantity_sales_percent),
  }))).sort((a, b) => (b.valorPerda || 0) - (a.valorPerda || 0)).slice(0, 20)

  return {
    loja: { codigo: String(row.store_code).padStart(3, '0'), nome: row.store_name || `LOJA ${row.store_code}` },
    periodoAtual: { inicio: row.current_start, fim: row.current_end },
    periodoComparativo: { inicio: row.previous_start, fim: row.previous_end },
    resumo: {
      vendaTotal: number(row.current_sales_value),
      perdaTotal: number(row.current_total_value),
      percentualPerda: number(row.current_loss_sales_percent),
      metaGlobal: null,
    },
    resumoAnterior: {
      vendaTotal: number(row.previous_sales_value),
      perdaTotal: number(row.previous_total_value),
      percentualPerda: number(row.previous_loss_sales_percent),
    },
    setores: sectors,
    topPerdas,
  }
}
