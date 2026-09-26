import { PackageSearch } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildTopLossesBySector, LOSS_RANKING_OPTIONS } from '../utils/lossDashboard'
import { LOSS_STORE_SEQUENCE } from '../utils/losses'
import LossRankingCard from './LossRankingCard'
import LossRankingGrid from './LossRankingGrid'
import PrintReportHeader from './PrintReportHeader'

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}


export default function LossTop10BySector({ row, onSelectSector }) {
  const [ranking, setRanking] = useState('value')
  const sectors = useMemo(() => buildTopLossesBySector(row, ranking), [row, ranking])
  const storeCode = String(row.store_code).padStart(3, '0')
  const storeSequence = LOSS_STORE_SEQUENCE[storeCode] || storeCode


  return (
    <section className="loss-top-panel">
      <PrintReportHeader
        title="Top Perdas"
        snapshot={row}
        storeLabel={`Loja ${storeSequence} - ${storeCode}`}
        storeDetail={row.store_name}
      />
      <div className="section-heading loss-top-heading">
        <div>
          <div className="section-kicker"><PackageSearch size={14} /> Top perdas</div>
          <h2>Top 10 produtos por setor</h2>
        </div>
        <div className="loss-top-heading-actions">
          <div className="loss-ranking-selector no-print" role="group" aria-label="Ordenar ranking de perdas">
            <span>Ordenar por</span>
            {Object.entries(LOSS_RANKING_OPTIONS).map(([key, option]) => (
              <button
                type="button"
                key={key}
                className={ranking === key ? 'active' : ''}
                aria-pressed={ranking === key}
                onClick={() => setRanking(key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="loss-top-sector-count">{sectors.length} setores com perda</span>
        </div>
      </div>

      {sectors.length === 0 ? (
        <div className="loss-no-top">Nenhum setor teve perda no período selecionado.</div>
      ) : (
        <LossRankingGrid
          items={sectors}
          label="Top perdas por setor"
          renderItem={(sector) => (
            <LossRankingCard
              id={`loss-sector-${normalize(sector.name).replace(/[^a-z0-9]+/g, '-')}`}
              title={sector.name}
              contextLabel={`Loja ${storeSequence} - ${storeCode}`}
              printCenterLabel={`TOP PERDAS • Loja ${storeSequence} - ${storeCode}`}
              products={sector.products}
              productCount={sector.productCount}
              totalValue={sector.totalValue}
              ranking={ranking}
              onTitleClick={() => onSelectSector(sector.name)}
              key={sector.name}
            />
          )}
        />
      )}
    </section>
  )
}
