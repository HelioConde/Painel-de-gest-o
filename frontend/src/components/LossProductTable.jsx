import { money, quantity } from '../utils/formatters'

const NUMBER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

function sold(value) {
  if (value === null || value === undefined) return '—'
  return NUMBER.format(Number(value || 0))
}

function percent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function comparison(value) {
  if (!value || value.kind === 'new') return <span className="loss-comparison new">Novo</span>
  if (value.kind === 'no-base') return <span className="loss-comparison neutral" title="Não há base comparável no período anterior">Sem base</span>
  if (value.kind === 'equal') return <span className="loss-comparison neutral">= 0%</span>
  const magnitude = Math.abs(Number(value.value || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
  return <span className={`loss-comparison ${value.kind}`}>{value.kind === 'up' ? '↑' : '↓'} {magnitude}%</span>
}

export default function LossProductTable({ products, label, ranking = 'value', showValue = false }) {
  const hasRankingMetrics = products.some((product) => product.sector_share_percent !== undefined || product.comparison)
  const hasValue = showValue || hasRankingMetrics
  return (
    <div className="loss-top-table-wrap">
      <table className={`loss-top-table loss-grouped-table ${hasValue ? 'has-value' : ''} ${hasRankingMetrics ? 'has-ranking-metrics' : ''}`} aria-label={label}>
        <colgroup>
          <col className="loss-col-pos" />
          <col className="loss-col-code" />
          <col className="loss-col-name" />
          <col className="loss-col-loss" />
          <col className="loss-col-sold" />
          <col className="loss-col-percent" />
          {hasValue ? <col className="loss-col-value" /> : null}
          {hasRankingMetrics ? <><col className="loss-col-share" /><col className="loss-col-comparison" /></> : null}
        </colgroup>
        <thead>
          <tr>
            <th>Pos</th><th>Código</th><th>Produto</th><th>Qtd perda</th>
            <th>Qtd vendida</th><th title="% Perda = quantidade perdida ÷ quantidade vendida × 100. O valor pode ultrapassar 100%.">% perda</th>
            {hasValue ? <th>Valor perda</th> : null}
            {hasRankingMetrics ? <><th title="Participação do valor de perda do produto no total válido do setor">% setor</th><th>Vs. ano anterior</th></> : null}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const lossPercent = Number(product.loss_quantity_sales_percent || 0)
            const soldQuantity = Number(product.quantity_sold || 0)
            const lostQuantity = Number(product.loss_quantity || 0)
            const anomalyClass = soldQuantity <= 0 && lostQuantity > 0
              ? 'loss-row-no-sales'
              : lossPercent >= 100
                ? 'loss-row-critical'
                : lossPercent >= 50
                  ? 'loss-row-warning'
                  : ''
            return (
            <tr className={anomalyClass} key={`${product.store_code}-${product.product_code || product.product_name}-${product.rank}`}>
              <td className="loss-top-rank">{product.rank}</td>
              <td className="loss-top-code">{product.product_code || '—'}</td>
              <td className="loss-top-product-name"><div className="loss-top-product-scroll" title={product.product_name || 'Produto'}>{product.product_name || 'Produto'}</div></td>
              <td className="loss-top-quantity">{quantity(product.loss_quantity, product.unit || 'QTD')}</td>
              <td>{sold(product.quantity_sold)}</td>
              <td>{percent(product.loss_quantity_sales_percent)}</td>
              {hasValue ? <td>{money(product.total_value)}</td> : null}
              {hasRankingMetrics ? <><td>{percent(product.sector_share_percent)}</td><td>{comparison(product.comparison)}</td></> : null}
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
