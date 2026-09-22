const APP_BOXES = [
  ['appTitleBox', 'appTitle', 'title'],
  ['appPriceBox', 'appPrice', 'appPrice'],
  ['appValidityBox', 'appValidity', 'validity'],
  ['appRegularLabelBox', 'appRegularLabel', 'regularLabel'],
  ['appRegularPriceBox', 'appRegularPrice', 'regularPrice'],
]

function styleFor(box, textStyle) {
  const alignX = { left: 'flex-start', center: 'center', right: 'flex-end' }[box.alignX] || 'center'
  const alignY = { top: 'flex-start', center: 'center', bottom: 'flex-end' }[box.alignY] || 'center'
  return {
    left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`,
    '--app-font-min': `${textStyle.fontMin}mm`, '--app-font-max': `${textStyle.fontMax}mm`,
    '--app-scale': textStyle.scale || 1, '--app-align-x': alignX, '--app-align-y': alignY,
  }
}

export default function AppPosterCard({ product, template, editable, showLayoutDebug, onBoxPointerDown, badgeLabel, selected, onSelect }) {
  const values = {
    title: [product.description, product.subdescription, product.complement, product.unit].filter(Boolean).join('\n'),
    appPrice: product.price ? `${template.showCurrency && !template.currencyFromBackground ? 'R$ ' : ''}${product.price}` : '',
    validity: product.validity ? (product.validity.toLocaleUpperCase('pt-BR').startsWith('OFERTA') ? product.validity : `OFERTA VÁLIDA ATÉ ${product.validity}`) : template.appValidityText,
    regularLabel: product.regularLabel || template.appRegularLabel,
    regularPrice: product.regularPrice ? `R$ ${product.regularPrice}` : '',
  }
  return (
    <article className={`poster-card poster-app-card ${selected ? 'poster-card-selected' : ''}`} data-product-id={product.id} onClick={onSelect}>
      {badgeLabel ? <span className="poster-preview-badge">{badgeLabel}</span> : null}
      {APP_BOXES.map(([boxName, styleName, valueName]) => {
        const box = template[boxName]
        const textStyle = template.textStyles[styleName]
        return <div key={boxName} className={`poster-app-box poster-app-${styleName} ${showLayoutDebug ? 'poster-layout-box-debug' : ''}`} data-layout-box={boxName} style={styleFor(box, textStyle)} onPointerDown={editable ? (event) => onBoxPointerDown?.(boxName, 'move', event) : undefined}>
          <span>{values[valueName] || '\u00a0'}</span>
          {showLayoutDebug ? <small>{boxName}</small> : null}
          {editable ? <button type="button" className="poster-resize-handle" aria-label={`Redimensionar ${boxName}`} onPointerDown={(event) => onBoxPointerDown?.(boxName, 'resize', event)} /> : null}
        </div>
      })}
    </article>
  )
}
