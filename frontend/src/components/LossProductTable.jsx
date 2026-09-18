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

export default function LossProductTable({ products, label, showValue = false }) {
  const hasValue = showValue && products.some((product) => product.total_value !== null && product.total_value !== undefined)
  return (
    <div className="loss-top-table-wrap">
      <table className={`loss-top-table loss-grouped-table ${hasValue ? 'has-value' : ''}`} aria-label={label}>
        <colgroup>
          <col className="loss-col-pos" />
          <col className="loss-col-code" />
          <col className="loss-col-name" />
          <col className="loss-col-loss" />
          <col className="loss-col-sold" />
          <col className="loss-col-percent" />
          {hasValue ? <col className="loss-col-value" /> : null}
        </colgroup>
        <thead>
          <tr>
            <th>Pos</th><th>Código</th><th>Nome do produto</th><th>Qtd perda</th>
            <th>Qtd vendida</th><th>% perda</th>{hasValue ? <th>Valor</th> : null}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={`${product.store_code}-${product.product_code || product.product_name}-${product.rank}`}>
              <td className="loss-top-rank">{product.rank}</td>
              <td className="loss-top-code">{product.product_code || '—'}</td>
              <td className="loss-top-product-name"><div className="loss-top-product-scroll" title={product.product_name || 'Produto'}>{product.product_name || 'Produto'}</div></td>
              <td className="loss-top-quantity">{quantity(product.loss_quantity, product.unit || 'QTD')}</td>
              <td>{sold(product.quantity_sold)}</td>
              <td>{percent(product.loss_quantity_sales_percent)}</td>
              {hasValue ? <td>{money(product.total_value)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
