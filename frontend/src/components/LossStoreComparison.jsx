import { Building2 } from 'lucide-react'
import { money, percent } from '../utils/formatters'
import { LOSS_STORE_SEQUENCE, lossTone, rowLossDifference, rowLossVariation } from '../utils/losses'

export default function LossStoreComparison({ run, onSelectStore }) {
  return (
    <section className="loss-store-panel">
      <div className="section-heading loss-store-heading">
        <div>
          <div className="section-kicker"><Building2 size={14} /> Comparativo por loja</div>
          <h2>Perdas das lojas 01 a 06</h2>
          <p>Clique em uma loja para abrir Setor → MIP → Produtos.</p>
        </div>
      </div>

      <div className="loss-store-table-wrap">
        <table className="loss-store-table">
          <thead>
            <tr>
              <th>Loja</th>
              <th>Perda atual</th>
              <th>Ano anterior</th>
              <th>Diferença</th>
              <th>Variação</th>
              <th>Perda/Venda</th>
            </tr>
          </thead>
          <tbody>
            {run.rows.map((row) => {
              const code = String(row.store_code).padStart(3, '0')
              const sequence = LOSS_STORE_SEQUENCE[code] || code
              const difference = rowLossDifference(row)
              const variation = rowLossVariation(row)
              return (
                <tr key={code} onClick={() => onSelectStore?.(code)} tabIndex={0} onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelectStore?.(code)
                }}>
                  <td className="loss-store-name" data-label="Loja">
                    <span className="event-store-sequence">{sequence}</span>
                    <span>
                      <strong>{row.store_name}</strong>
                      <small>Código {code}</small>
                    </span>
                  </td>
                  <td className="loss-store-current" data-label="Perda atual">{money(row.current_total_value)}</td>
                  <td data-label="Ano anterior">{money(row.previous_total_value)}</td>
                  <td className={lossTone(difference)} data-label="Diferença">{money(difference)}</td>
                  <td className={lossTone(variation)} data-label="Variação">{percent(variation)}</td>
                  <td data-label="Perda/Venda"><strong>{percent(row.current_loss_sales_percent)}</strong></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="loss-store-total-label">Total da rede</td>
              <td>{money(run.totals.current_total_value)}</td>
              <td>{money(run.totals.previous_total_value)}</td>
              <td className={lossTone(run.totals.loss_difference)}>{money(run.totals.loss_difference)}</td>
              <td className={lossTone(run.totals.loss_variation_percent)}>{percent(run.totals.loss_variation_percent)}</td>
              <td>{percent(run.totals.current_loss_sales_percent)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
