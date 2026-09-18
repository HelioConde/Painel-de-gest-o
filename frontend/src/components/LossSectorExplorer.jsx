import { ChevronDown, ChevronRight, Layers3, PackageSearch } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { money, percent, quantity } from '../utils/formatters'
import {
  lossTone,
  mipLossValue,
  pairByName,
  pairProducts,
  sectorLossValue,
  variation,
} from '../utils/losses'

function MetricValues({ current, previous }) {
  const diff = current - previous
  const vari = variation(current, previous)
  return (
    <div className="loss-hierarchy-values">
      <strong>{money(current)}</strong>
      <span>{money(previous)}</span>
      <em className={lossTone(diff)}>{money(diff)}</em>
      <em className={lossTone(vari)}>{percent(vari)}</em>
    </div>
  )
}

function ProductRows({ currentMip, previousMip }) {
  const products = pairProducts(currentMip?.products || [], previousMip?.products || [])
  return (
    <div className="loss-product-list">
      {products.map(({ key, current, previous }) => {
        const currentValue = Number(current?.total_value || 0)
        const previousValue = Number(previous?.total_value || 0)
        const diff = currentValue - previousValue
        return (
          <div className="loss-product-row" key={key}>
            <div className="loss-product-name">
              <span className="subgroup-dot" />
              <div>
                <strong>{current?.product_name || previous?.product_name || 'Produto'}</strong>
                <small>
                  Cód. {current?.product_code || previous?.product_code || '—'} · Perda qtd. {quantity(current?.loss_quantity || 0, current?.unit || 'QTD')}
                </small>
              </div>
            </div>
            <div className="loss-product-values">
              <strong>{money(currentValue)}</strong>
              <span>{money(previousValue)}</span>
              <em className={lossTone(diff)}>{money(diff)}</em>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MipRows({ currentSector, previousSector }) {
  const [openMip, setOpenMip] = useState(null)
  const mips = pairByName(currentSector?.mips || [], previousSector?.mips || [])

  return (
    <div className="loss-mip-list">
      {mips.map(({ key, current, previous }) => {
        const currentValue = mipLossValue(current)
        const previousValue = mipLossValue(previous)
        const open = openMip === key
        return (
          <div className="loss-mip-block" key={key}>
            <button className="loss-hierarchy-row loss-mip-row" type="button" onClick={() => setOpenMip(open ? null : key)}>
              <div className="loss-hierarchy-name">
                {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <div>
                  <strong>{current?.name || previous?.name || 'SEM MIP'}</strong>
                  <span>{(current?.products || previous?.products || []).length} produtos</span>
                </div>
              </div>
              <MetricValues current={currentValue} previous={previousValue} />
            </button>
            {open && <ProductRows currentMip={current} previousMip={previous} />}
          </div>
        )
      })}
    </div>
  )
}

export default function LossSectorExplorer({ row }) {
  const [openSector, setOpenSector] = useState(null)
  const current = row?.details?.current
  const previous = row?.details?.previous

  useEffect(() => setOpenSector(null), [row?.store_code, row?.run_id])

  const sectors = useMemo(
    () => pairByName(current?.sectors || [], previous?.sectors || []),
    [current, previous],
  )

  return (
    <section className="loss-hierarchy-panel">
      <div className="section-heading loss-detail-heading">
        <div>
          <div className="section-kicker"><Layers3 size={14} /> Análise de perdas</div>
          <h2>Setores · {row.store_name}</h2>
          <p>Abra um setor para ver os MIPs e depois os produtos que geraram a perda.</p>
        </div>
        <div className="loss-table-legend">
          <span>Atual</span><span>Anterior</span><span>Dif.</span><span>Var.</span>
        </div>
      </div>

      <div className="loss-sector-list">
        {sectors.map(({ key, current: currentSector, previous: previousSector }) => {
          const currentValue = sectorLossValue(currentSector)
          const previousValue = sectorLossValue(previousSector)
          const open = openSector === key
          const salesPercent = currentSector?.sales_context?.loss_sales_percent
          const topLoss = currentSector?.top_losses?.[0]

          return (
            <div className={`loss-sector-block ${open ? 'open' : ''}`} key={key}>
              <button className="loss-hierarchy-row loss-sector-row" type="button" onClick={() => setOpenSector(open ? null : key)}>
                <div className="loss-hierarchy-name">
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div>
                    <strong>{currentSector?.name || previousSector?.name || 'Setor'}</strong>
                    <span>
                      {(currentSector?.product_count ?? previousSector?.product_count ?? 0)} produtos · Perda/Venda {percent(salesPercent)}
                    </span>
                    {topLoss && <small className="loss-top-item"><PackageSearch size={11} /> Maior perda: {topLoss.product_name}</small>}
                  </div>
                </div>
                <MetricValues current={currentValue} previous={previousValue} />
              </button>
              {open && <MipRows currentSector={currentSector} previousSector={previousSector} />}
            </div>
          )
        })}
      </div>
    </section>
  )
}
