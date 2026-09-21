import { useLayoutEffect, useRef, useState } from 'react'
import PosterSheet from './PosterSheet'

const PX_PER_MM = 96 / 25.4

export default function PosterPreview({ format, products, template, layoutPlans, showBackground = false, showLayoutDebug = false, startIndex = 0, selectedProductId = null, onSelectProduct }) {
  const frameRef = useRef(null)
  const [scale, setScale] = useState(0.4)

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return undefined

    const resize = () => {
      const availableWidth = Math.max(220, frame.clientWidth - 28)
      const availableHeight = Math.max(300, Math.min(620, window.innerHeight - 245))
      const naturalWidth = format.widthMm * PX_PER_MM
      const naturalHeight = format.heightMm * PX_PER_MM
      setScale(Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight, 0.72))
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(frame)
    window.addEventListener('resize', resize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [format.heightMm, format.widthMm])

  const naturalWidth = format.widthMm * PX_PER_MM
  const naturalHeight = format.heightMm * PX_PER_MM

  return (
    <div className="poster-preview-frame" ref={frameRef}>
      <div className="poster-preview-stage" style={{ width: naturalWidth * scale, height: naturalHeight * scale }}>
        <div className="poster-preview-scale" style={{ transform: `scale(${scale})` }}>
          <PosterSheet
            format={format}
            products={products}
            template={template}
            layoutPlans={layoutPlans}
            showBackground={showBackground}
            showLayoutDebug={showLayoutDebug}
            showBadges
            startIndex={startIndex}
            selectedProductId={selectedProductId}
            onSelectProduct={onSelectProduct}
          />
        </div>
      </div>
    </div>
  )
}
