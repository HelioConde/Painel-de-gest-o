import { ChevronRight } from 'lucide-react'
import LossProductTable from './LossProductTable'
import { money } from '../utils/formatters'

export default function LossRankingCard({ id, title, subtitle = null, products, productCount = products.length, totalValue = null, ranking = 'value', onTitleClick = null, showValue = false }) {
  return (
    <article className={`loss-top-card loss-ranking-card ${subtitle ? 'has-subtitle' : ''}`} id={id}>
      <header>
        <div className="loss-ranking-card-copy">
          {onTitleClick ? (
            <button type="button" className="loss-top-sector-button" onClick={onTitleClick}>
              <span>{title}</span><ChevronRight size={13} />
            </button>
          ) : <span className="loss-ranking-title">{title}</span>}
          {subtitle ? <span className="loss-ranking-subtitle">{subtitle}</span> : null}
        </div>
        <small title="Total de perdas válidas do setor">{productCount} {productCount === 1 ? 'produto' : 'produtos'}{totalValue !== null ? ` · ${money(totalValue)}` : null}</small>
      </header>
      <LossProductTable products={products} label={`Ranking de ${title}`} ranking={ranking} showValue={showValue} />
    </article>
  )
}
