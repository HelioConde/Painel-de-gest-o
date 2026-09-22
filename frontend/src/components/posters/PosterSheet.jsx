import PosterCard, { PosterBackground } from './PosterCard'
import AppPosterCard from './AppPosterCard'

export default function PosterSheet({ format, products, template, layoutPlans, showBackground = false, showLayoutDebug = false, editable = false, onBoxPointerDown, className = '', showBadges = false, startIndex = 0, selectedProductId = null, onSelectProduct }) {
  const slots = Array.from({ length: format.postersPerSheet }, (_, index) => products[index] || null)

  return (
    <section
      className={`poster-sheet ${format.specialLayout === 'app-offer' ? 'poster-sheet-app' : ''} ${format.backgroundScope === 'sheet' && showBackground ? 'poster-sheet-has-background' : ''} ${className}`.trim()}
      aria-label={`Folha ${format.label}`}
      style={{
        '--sheet-width': `${format.widthMm}mm`,
        '--sheet-height': `${format.heightMm}mm`,
        '--sheet-columns': format.columns,
        '--sheet-rows': format.rows,
      }}
    >
      {format.backgroundScope === 'sheet' && showBackground ? <PosterBackground template={template} widthMm={format.widthMm} heightMm={format.heightMm} className="poster-sheet-background" /> : null}
      {slots.map((product, index) => (
        <div className={`poster-slot ${product ? '' : 'poster-slot-empty'}`} key={product?.id || `empty-${index}`}>
          {product ? format.specialLayout === 'app-offer' ? (
            <AppPosterCard product={product} template={template} editable={editable} showLayoutDebug={showLayoutDebug} onBoxPointerDown={onBoxPointerDown} badgeLabel={showBadges ? startIndex + index + 1 : null} selected={product.id === selectedProductId} onSelect={onSelectProduct ? () => onSelectProduct(product.id) : undefined} />
          ) : (
            <PosterCard
              product={product}
              format={format}
              template={template}
              layoutPlan={layoutPlans?.[product.id]}
              showBackground={showBackground && format.backgroundScope === 'card'}
              showLayoutDebug={showLayoutDebug}
              editable={editable}
              onBoxPointerDown={onBoxPointerDown}
              inverted={format.invertedSlots.includes(index)}
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
