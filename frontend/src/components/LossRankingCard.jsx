import { ChevronRight } from 'lucide-react'
import LossProductTable from './LossProductTable'

export default function LossRankingCard({ id, title, subtitle = null, products, onTitleClick = null, showValue = false }) {
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
        <small>{products.length} {products.length === 1 ? 'produto' : 'produtos'}</small>
      </header>
      <LossProductTable products={products} label={`Ranking de ${title}`} showValue={showValue} />
    </article>
  )
}
