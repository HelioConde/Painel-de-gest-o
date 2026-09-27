import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import LossProductTable from './LossProductTable'
import { SectorIcon } from './dashboard/DashboardPrimitives'
import { money } from '../utils/formatters'

export default function LossRankingCard({ id, title, subtitle = null, contextLabel = null, printCenterLabel = 'TOP PERDAS', products, productCount = products.length, totalValue = null, ranking = 'value', onTitleClick = null, showValue = false }) {
  const [expanded, setExpanded] = useState(
    () => typeof window === 'undefined' || !window.matchMedia('(max-width: 620px)').matches,
  )

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
        <span className="loss-ranking-print-center" aria-hidden="true">{printCenterLabel}</span>
        <div className="loss-ranking-card-stats" title="Resumo das perdas válidas do setor">
          <span>{productCount} {productCount === 1 ? 'produto' : 'produtos'}</span>
          {totalValue !== null ? <strong>{money(totalValue)}</strong> : null}
          <button
            type="button"
            className="loss-mobile-sector-toggle no-print"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Ocultar produtos' : 'Ver produtos'}
            <ChevronDown size={14} className={expanded ? 'open' : ''} />
          </button>
        </div>
      </header>
      <div className={`loss-ranking-products ${expanded ? 'expanded' : 'collapsed'}`}>
        <LossProductTable products={products} label={`Ranking de ${title}`} ranking={ranking} showValue={showValue} />
      </div>
    </article>
  )
}
