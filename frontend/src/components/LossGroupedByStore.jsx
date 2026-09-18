import PrintReportHeader from './PrintReportHeader'
import LossRankingCard from './LossRankingCard'
import LossRankingGrid from './LossRankingGrid'

export default function LossGroupedByStore({ groups, snapshot, title, printDetail = null, emptyMessage }) {
  return (
    <section className="loss-grouped-panel">
      <PrintReportHeader title={title} snapshot={snapshot} storeLabel={printDetail} />
      {groups.length === 0 ? <div className="loss-no-top">{emptyMessage}</div> : (
        <LossRankingGrid
          items={groups}
          label="Perdas agrupadas por loja"
          renderItem={(group) => (
            <LossRankingCard
              id={`loss-store-${group.store_code}`}
              title={`LOJA ${group.store_code}`}
              subtitle={group.store_name}
              products={group.products}
              showValue
              key={group.store_code}
            />
          )}
        />
      )}
    </section>
  )
}
