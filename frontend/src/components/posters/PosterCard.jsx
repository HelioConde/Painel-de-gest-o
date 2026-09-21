
function boxStyle(box) {
  return { left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%` }
}

function plannedFieldStyle(line, box) {
  return {
    left: `${line.x}%`, top: `${line.y}%`, width: `${line.width}%`, height: `${line.height}%`,
    fontSize: `${line.fontSizeMm}mm`, fontWeight: line.style.fontWeight,
    lineHeight: line.style.lineHeight, letterSpacing: `${line.style.letterSpacing}mm`,
    textAlign: box.alignX || 'center',
  }
}

function ContentBox({ plan, box, showDebug, editable, onBoxPointerDown }) {
  return (
    <div className={`poster-layout-box poster-content-box ${showDebug ? 'poster-layout-box-debug' : ''}`} style={boxStyle(box)} data-layout-box="contentBox" onPointerDown={editable ? (event) => onBoxPointerDown?.('contentBox', 'move', event) : undefined}>
      <div className="poster-content-stack">
        {plan.content.lines.map((line) => (
          <div className={`poster-field poster-planned-field poster-field-${line.field}`} key={line.field} style={plannedFieldStyle(line, box)}>{line.text}</div>
        ))}
      </div>
      {showDebug ? <span className="poster-box-label">contentBox</span> : null}
      {editable ? <button type="button" className="poster-resize-handle" aria-label="Redimensionar contentBox" onPointerDown={(event) => onBoxPointerDown?.('contentBox', 'resize', event)} /> : null}
    </div>
  )
}

function PriceBox({ plan, box, showDebug, editable, onBoxPointerDown }) {
  return (
    <div className={`poster-layout-box poster-price-box ${showDebug ? 'poster-layout-box-debug' : ''}`} style={boxStyle(box)} data-layout-box="priceBox" onPointerDown={editable ? (event) => onBoxPointerDown?.('priceBox', 'move', event) : undefined}>
      <div className="poster-price-content">
        <div className="poster-field poster-planned-field poster-field-price" style={plannedFieldStyle(plan.price, box)}>{plan.price.text || '\u00a0'}</div>
      </div>
      {showDebug ? <span className="poster-box-label">priceBox</span> : null}
      {editable ? <button type="button" className="poster-resize-handle" aria-label="Redimensionar priceBox" onPointerDown={(event) => onBoxPointerDown?.('priceBox', 'resize', event)} /> : null}
    </div>
  )
}

export function PosterBackground({ template, widthMm, heightMm, className = 'poster-background-layer' }) {
  if (!template.backgroundImage || !template.backgroundVisible) return null
  const aspect = widthMm / heightMm
  const quarterTurn = template.backgroundRotation === 90 || template.backgroundRotation === 270
  const dimensions = quarterTurn ? { width: `${100 / aspect}%`, height: `${100 * aspect}%` } : { width: '100%', height: '100%' }
  return (
    <div className={className} aria-hidden="true">
      <img src={template.backgroundImage} alt="" style={{ ...dimensions, opacity: template.backgroundOpacity, objectFit: template.backgroundFit, objectPosition: `${template.backgroundPositionX} ${template.backgroundPositionY}`, transform: `translate(-50%, -50%) rotate(${template.backgroundRotation}deg)` }} />
    </div>
  )
}

export default function PosterCard({ product, format, template, layoutPlan, inverted = false, showBackground = false, showLayoutDebug = false, editable = false, onBoxPointerDown, badgeLabel, selected = false, onSelect }) {
  const plan = layoutPlan
  return (
    <article className={`poster-card ${inverted ? 'poster-card-inverted' : ''} ${selected ? 'poster-card-selected' : ''}`} data-product-id={product.id} onClick={onSelect}>
      <div className="poster-card-layers">
        {badgeLabel ? <span className="poster-preview-badge">{badgeLabel}</span> : null}
        {showBackground ? <PosterBackground template={template} widthMm={format.widthMm / format.columns} heightMm={format.heightMm / format.rows} /> : null}
        {showLayoutDebug ? <div className="poster-safe-area" style={{ inset: `${template.safeArea}%` }} aria-hidden="true" /> : null}
        <ContentBox plan={plan} box={template.contentBox} showDebug={showLayoutDebug} editable={editable} onBoxPointerDown={onBoxPointerDown} />
        <PriceBox plan={plan} box={template.priceBox} showDebug={showLayoutDebug} editable={editable} onBoxPointerDown={onBoxPointerDown} />
      </div>
    </article>
  )
}
