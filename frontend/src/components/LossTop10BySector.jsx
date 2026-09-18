import { PackageSearch } from 'lucide-react'
import { useMemo } from 'react'
import { buildTopLossesBySector } from '../utils/lossDashboard'
import { isoDate } from '../utils/formatters'
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

function compactStoreLabel(row) {
  const code = String(row?.store_code || '').padStart(3, '0')
  const name = String(row?.store_name || '')
  const match = name.match(/(\d{2})\s+(\d{3})$/)
  const seq = match?.[1] || code
  return `Loja ${seq} • Código ${code}`
}

export default function LossTop10BySector({ row, onSelectSector }) {
  const sectors = useMemo(() => buildTopLossesBySector(row), [row])
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
          <div className="loss-top-store-tag">
            <strong>{row.store_name}</strong>
            <span>{compactStoreLabel(row)}</span>
          </div>
          <p>
            {isoDate(row.current_start)} a {isoDate(row.current_end)}. Setores sem perda não são exibidos.
          </p>
        </div>
        <span className="loss-top-sector-count">{sectors.length} setores com perda</span>
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
              products={sector.products}
              onTitleClick={() => onSelectSector(sector.name)}
              key={sector.name}
            />
          )}
        />
      )}
    </section>
  )
}
