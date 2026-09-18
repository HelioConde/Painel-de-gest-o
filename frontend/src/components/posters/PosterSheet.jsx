import PosterCard from './PosterCard'

export default function PosterSheet({ format, products, template, invertSecondPoster = false, showGuide = false, showLayoutDebug = false, className = '', showBadges = false, startIndex = 0, selectedProductId = null, onSelectProduct }) {
  const slots = Array.from({ length: format.postersPerSheet }, (_, index) => products[index] || null)

  return (
    <section
      className={`poster-sheet ${className}`.trim()}
      aria-label={`Folha ${format.label}`}
      style={{
        '--sheet-width': `${format.widthMm}mm`,
        '--sheet-height': `${format.heightMm}mm`,
        '--sheet-columns': format.columns,
        '--sheet-rows': format.rows,
      }}
    >
      {slots.map((product, index) => (
        <div className={`poster-slot ${product ? '' : 'poster-slot-empty'}`} key={product?.id || `empty-${index}`}>
          {product ? (
            <PosterCard
              product={product}
              format={format}
              template={template}
              showGuide={showGuide}
              showLayoutDebug={showLayoutDebug}
              inverted={format.supportsInvertSecond && invertSecondPoster && index === 1}
              badgeLabel={showBadges ? startIndex + index + 1 : null}
              selected={product.id === selectedProductId}
              onSelect={onSelectProduct ? () => onSelectProduct(product.id) : undefined}
            />
          ) : null}
        </div>
      ))}
    </section>
  )
}
