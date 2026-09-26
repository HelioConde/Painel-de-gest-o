import { ChevronRight } from 'lucide-react'
import LossProductTable from './LossProductTable'
import { SectorIcon } from './dashboard/DashboardPrimitives'
import { money } from '../utils/formatters'

export default function LossRankingCard({ id, title, subtitle = null, contextLabel = null, products, productCount = products.length, totalValue = null, ranking = 'value', onTitleClick = null, showValue = false }) {
  return (
    <article className={`loss-top-card loss-ranking-card ${subtitle ? 'has-subtitle' : ''}`} id={id}>
      <header>
        <div className="loss-ranking-card-copy">
          {onTitleClick ? (
            <button type="button" className="loss-top-sector-button" onClick={onTitleClick}>
              <SectorIcon name={title} size={17} />
              <span>{title}</span>{contextLabel ? <span className="loss-ranking-context"> - {contextLabel}</span> : null}<ChevronRight size={15} />
            </button>
          ) : <span className="loss-ranking-title"><SectorIcon name={title} size={17} />{title}{contextLabel ? <span className="loss-ranking-context"> - {contextLabel}</span> : null}</span>}
          {subtitle ? <span className="loss-ranking-subtitle">{subtitle}</span> : null}
        </div>
        <span className="loss-ranking-print-center" aria-hidden="true">TOP PERDAS</span>
        <div className="loss-ranking-card-stats" title="Resumo das perdas válidas do setor">
          <span>{productCount} {productCount === 1 ? 'produto' : 'produtos'}</span>
          {totalValue !== null ? <strong>{money(totalValue)}</strong> : null}
        </div>
      </header>
      <LossProductTable products={products} label={`Ranking de ${title}`} ranking={ranking} showValue={showValue} />
    </article>
  )
}
