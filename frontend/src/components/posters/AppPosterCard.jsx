import { createAppTitleLayout } from '../../poster-engine/appTitleLayout.js'

const APP_BOXES = [
  ['appTitleBox', 'appTitle', 'title'],
  ['appPriceBox', 'appPrice', 'appPrice'],
  ['appValidityBox', 'appValidity', 'validity'],
  ['appRegularLabelBox', 'appRegularLabel', 'regularLabel'],
  ['appRegularPriceBox', 'appRegularPrice', 'regularPrice'],
]

function styleFor(box, textStyle, fontSizeMm) {
  const alignX = { left: 'flex-start', center: 'center', right: 'flex-end' }[box.alignX] || 'center'
  const alignY = { top: 'flex-start', center: 'center', bottom: 'flex-end' }[box.alignY] || 'center'
  return {
    left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`,
    '--app-font-min': `${textStyle.fontMin}mm`, '--app-font-max': `${textStyle.fontMax}mm`,
    '--app-scale': textStyle.scale || 1, '--app-align-x': alignX, '--app-align-y': alignY,
    '--app-font-family': textStyle.fontFamily || '"Burbank Big Cd Bk"',
    ...(Number.isFinite(fontSizeMm) ? { '--app-computed-price-size': `${fontSizeMm}mm` } : {}),
  }
}

export default function AppPosterCard({ product, template, format, layoutPlan, editable, showLayoutDebug, onBoxPointerDown, badgeLabel, selected, onSelect }) {
  const titlePlan = layoutPlan || createAppTitleLayout({ product, template, format })
  const values = {
    appPrice: product.price ? `${template.showCurrency && !template.currencyFromBackground ? 'R$ ' : ''}${String(product.price).replace(/^R\$\s*/i, '')}` : '',
    validity: product.validity ? (product.validity.toLocaleUpperCase('pt-BR').startsWith('OFERTA') ? product.validity : `OFERTA VÁLIDA ATÉ ${product.validity}`) : template.appValidityText,
    regularLabel: (product.regularLabel || template.appRegularLabel || '').replace(/^pre[çc]o fora do aplicativo$/i, 'PREÇO FORA\nDO APLICATIVO'),
    regularPrice: product.regularPrice ? `R$ ${String(product.regularPrice).replace(/^R\$\s*/i, '')}` : '',
  }
  return (
    <article className={`poster-card poster-app-card ${selected ? 'poster-card-selected' : ''}`} data-product-id={product.id} onClick={onSelect}>
      {badgeLabel ? <span className="poster-preview-badge">{badgeLabel}</span> : null}
      {APP_BOXES.map(([boxName, styleName, valueName]) => {
        const box = boxName === 'appPriceBox' && !editable ? (titlePlan.appPriceBox || template[boxName]) : template[boxName]
        const textStyle = template.textStyles[styleName]
        return <div key={boxName} className={`poster-app-box poster-app-${styleName} ${showLayoutDebug ? 'poster-layout-box-debug' : ''}`} data-layout-box={boxName} style={styleFor(box, textStyle, valueName === 'regularPrice' ? titlePlan.regularPriceFontSizeMm : valueName === 'appPrice' ? titlePlan.appPriceFontSizeMm : null)} onPointerDown={editable ? (event) => onBoxPointerDown?.(boxName, 'move', event) : undefined}>
          {valueName === 'title' ? (
            <div className="poster-app-title-stack">
              {titlePlan.lines.map((line) => (
                <span key={line.field} className={`poster-app-title-line poster-app-title-${line.field}`}
                  style={{ fontSize: `${line.fontSizeMm}mm`, transform: `scaleX(${line.scaleX || 1})` }}>{line.text}</span>
              ))}
            </div>
          ) : (
            <span>{['appPrice', 'regularPrice'].includes(valueName)
              ? <PriceValue value={values[valueName]} mode={template.priceDisplayMode || 'inline'} />
              : (values[valueName] || '\u00a0')}</span>
          )}
          {showLayoutDebug ? <small>{boxName}</small> : null}
          {editable ? <button type="button" className="poster-resize-handle" aria-label={`Redimensionar ${boxName}`} onPointerDown={(event) => onBoxPointerDown?.(boxName, 'resize', event)} /> : null}
        </div>
      })}
    </article>
  )
}
import PriceValue from './PriceValue'
