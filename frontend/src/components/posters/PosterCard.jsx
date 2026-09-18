import { useLayoutEffect, useMemo, useRef } from 'react'

const CONTENT_FIELDS = ['description', 'subdescription', 'complement', 'unit']

function alignX(value) {
  return value === 'left' ? 'flex-start' : value === 'right' ? 'flex-end' : 'center'
}

function alignY(value) {
  return value === 'top' ? 'flex-start' : value === 'bottom' ? 'flex-end' : 'center'
}

function textAlign(value) {
  return value === 'left' || value === 'right' ? value : 'center'
}

function boxStyle(box) {
  return {
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
  }
}

function alignmentStyle(box) {
  return {
    alignItems: alignX(box.alignX),
    justifyContent: alignY(box.alignY),
    textAlign: textAlign(box.alignX),
  }
}

function applyTextStyle(element, style, size) {
  element.style.fontSize = `${size}mm`
  element.style.fontWeight = style.fontWeight
  element.style.lineHeight = style.lineHeight
  element.style.letterSpacing = `${style.letterSpacing}mm`
}

function measureTextWidth(element) {
  if (!element?.firstChild) return 0
  const range = document.createRange()
  range.selectNodeContents(element)
  return range.getBoundingClientRect().width
}

function ContentBox({ product, box, textStyles, showDebug, editable, onBoxPointerDown }) {
  const contentRef = useRef(null)
  const signature = useMemo(() => JSON.stringify(textStyles), [textStyles])

  useLayoutEffect(() => {
    const container = contentRef.current
    if (!container) return undefined

    const fit = () => {
      const lines = [...container.querySelectorAll('.poster-content-line')]
      if (!lines.length || !container.clientWidth || !container.clientHeight) return
      const copyBlock = container.querySelector('.poster-copy-block')
      const upperLines = [...container.querySelectorAll('.poster-copy-block .poster-content-line')]
      const sizes = new Map()

      lines.forEach((line) => {
        const style = textStyles[line.dataset.field]
        const size = Math.max(style.fontMin, style.fontMax * style.scale)
        sizes.set(line, size)
        applyTextStyle(line, style, size)
      })

      upperLines.forEach((line) => {
        const width = measureTextWidth(line)
        if (width > line.clientWidth && width > 0) {
          sizes.set(line, sizes.get(line) * (line.clientWidth / width) * 0.985)
        }
      })

      upperLines.forEach((line) => applyTextStyle(line, textStyles[line.dataset.field], sizes.get(line)))
      const widths = upperLines.map(measureTextWidth).filter(Boolean).sort((a, b) => a - b)
      const targetWidth = widths.length % 2
        ? widths[Math.floor(widths.length / 2)]
        : (widths[widths.length / 2 - 1] + widths[widths.length / 2]) / 2

      upperLines.forEach((line) => {
        const width = measureTextWidth(line)
        const style = textStyles[line.dataset.field]
        if (!width || !targetWidth) return
        const balanced = sizes.get(line) * (targetWidth / width)
        sizes.set(line, Math.max(0.6, Math.min(style.fontMax * style.scale * 1.5, balanced)))
        applyTextStyle(line, style, sizes.get(line))
      })

      lines.forEach((line) => {
        const width = measureTextWidth(line)
        if (width > line.clientWidth && width > 0) {
          const style = textStyles[line.dataset.field]
          sizes.set(line, sizes.get(line) * (line.clientWidth / width) * 0.985)
          applyTextStyle(line, style, sizes.get(line))
        }
      })

      let guard = 0
      const overflows = () => (
        container.scrollHeight > container.clientHeight + 1
        || copyBlock.scrollHeight > copyBlock.clientHeight + 1
        || lines.some((line) => measureTextWidth(line) > line.clientWidth + 1)
      )
      while (guard < 80 && overflows()) {
        lines.forEach((line) => {
          const style = textStyles[line.dataset.field]
          const nextSize = Math.max(0.6, sizes.get(line) * 0.96)
          sizes.set(line, nextSize)
          applyTextStyle(line, style, nextSize)
        })
        guard += 1
      }
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(container)
    return () => observer.disconnect()
  }, [box.gap, product.complement, product.description, product.subdescription, product.unit, signature, textStyles])

  const copyFields = CONTENT_FIELDS.slice(0, 3).filter((field) => product[field])
  const copyWidth = Math.min(100, (79 / box.width) * 100)
  const copyHeight = Math.min(100, (39 / box.height) * 100)

  return (
    <div
      className={`poster-layout-box poster-content-box ${showDebug ? 'poster-layout-box-debug' : ''}`}
      style={boxStyle(box)}
      data-layout-box="contentBox"
      onPointerDown={editable ? (event) => onBoxPointerDown?.('contentBox', 'move', event) : undefined}
    >
      <div ref={contentRef} className="poster-content-stack" style={{ ...alignmentStyle(box), gap: `${box.gap}%` }}>
        <div className="poster-copy-block" style={{ alignItems: alignX(box.alignX), justifyContent: 'center', width: `${copyWidth}%`, maxHeight: `${copyHeight}%` }}>
          {copyFields.map((field) => (
            <div className={`poster-field poster-content-line poster-field-${field}`} data-field={field} key={field}>
              {product[field]}
            </div>
          ))}
        </div>
        {product.unit ? <div className="poster-field poster-content-line poster-field-unit" data-field="unit">{product.unit}</div> : null}
      </div>
      {showDebug ? <span className="poster-box-label">contentBox</span> : null}
      {editable ? <button type="button" className="poster-resize-handle" aria-label="Redimensionar contentBox" onPointerDown={(event) => onBoxPointerDown?.('contentBox', 'resize', event)} /> : null}
    </div>
  )
}

function PriceBox({ price, box, textStyle, showDebug, editable, onBoxPointerDown }) {
  const contentRef = useRef(null)
  const textRef = useRef(null)

  useLayoutEffect(() => {
    const container = contentRef.current
    const element = textRef.current
    if (!container || !element) return undefined

    const fit = () => {
      if (!container.clientWidth || !container.clientHeight) return
      const characterCount = String(price || '').replace(/\s/g, '').length
      const characterScale = characterCount <= 4 ? 1 : characterCount === 5 ? 0.9 : Math.max(0.68, 1 - ((characterCount - 4) * 0.1))
      let size = textStyle.fontMax * textStyle.scale
      applyTextStyle(element, textStyle, size)
      while (size > 0.75 && measureTextWidth(element) > element.clientWidth + 1) {
        size = Math.max(0.75, size - 0.25)
        applyTextStyle(element, textStyle, size)
      }
      while (size > 0.75 && element.scrollHeight > element.clientHeight + 1) {
        size = Math.max(0.75, size - 0.25)
        applyTextStyle(element, textStyle, size)
      }
      size *= characterScale
      applyTextStyle(element, textStyle, size)
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(container)
    return () => observer.disconnect()
  }, [box.height, box.width, price, textStyle])

  return (
    <div
      className={`poster-layout-box poster-price-box ${showDebug ? 'poster-layout-box-debug' : ''}`}
      style={boxStyle(box)}
      data-layout-box="priceBox"
      onPointerDown={editable ? (event) => onBoxPointerDown?.('priceBox', 'move', event) : undefined}
    >
      <div ref={contentRef} className="poster-price-content" style={alignmentStyle(box)}>
        <div ref={textRef} className="poster-field poster-field-price">{price || '\u00a0'}</div>
      </div>
      {showDebug ? <span className="poster-box-label">priceBox</span> : null}
      {editable ? <button type="button" className="poster-resize-handle" aria-label="Redimensionar priceBox" onPointerDown={(event) => onBoxPointerDown?.('priceBox', 'resize', event)} /> : null}
    </div>
  )
}

function GuideLayer({ template, format }) {
  if (!template.guideImage || !template.guideVisible) return null
  const posterWidth = format.widthMm / format.columns
  const posterHeight = format.heightMm / format.rows
  const aspect = posterWidth / posterHeight
  const quarterTurn = template.guideRotation === 90 || template.guideRotation === 270
  const dimensions = quarterTurn
    ? { width: `${100 / aspect}%`, height: `${100 * aspect}%` }
    : { width: '100%', height: '100%' }

  return (
    <div className="poster-guide-layer" aria-hidden="true">
      <img
        src={template.guideImage}
        alt=""
        style={{
          ...dimensions,
          opacity: template.guideOpacity,
          objectFit: template.guideFit,
          objectPosition: `${template.guidePositionX} ${template.guidePositionY}`,
          transform: `translate(-50%, -50%) rotate(${template.guideRotation}deg)`,
        }}
      />
    </div>
  )
}

export default function PosterCard({
  product,
  format,
  template,
  inverted = false,
  showGuide = false,
  showLayoutDebug = false,
  editable = false,
  onBoxPointerDown,
  badgeLabel,
  selected = false,
  onSelect,
}) {
  return (
    <article
      className={`poster-card ${inverted ? 'poster-card-inverted' : ''} ${selected ? 'poster-card-selected' : ''}`}
      data-product-id={product.id}
      onClick={onSelect}
    >
      <div className="poster-card-layers">
        {badgeLabel ? <span className="poster-preview-badge">{badgeLabel}</span> : null}
        {showGuide ? <GuideLayer template={template} format={format} /> : null}
        {showLayoutDebug ? <div className="poster-safe-area" style={{ inset: `${template.safeArea}%` }} aria-hidden="true" /> : null}
        <ContentBox product={product} box={template.contentBox} textStyles={template.textStyles} showDebug={showLayoutDebug} editable={editable} onBoxPointerDown={onBoxPointerDown} />
        <PriceBox price={product.price} box={template.priceBox} textStyle={template.textStyles.price} showDebug={showLayoutDebug} editable={editable} onBoxPointerDown={onBoxPointerDown} />
      </div>
    </article>
  )
}
