import { useLayoutEffect, useRef, useState } from 'react'
import PosterCard from './PosterCard'

const PX_PER_MM = 96 / 25.4

function snap(value, enabled, step) {
  return enabled ? Math.round(value / step) * step : value
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export default function PosterAdminCanvas({
  format,
  template,
  product,
  viewMode,
  selectedBox,
  onSelectBox,
  onBoxChange,
  snapEnabled,
  snapStep,
}) {
  const frameRef = useRef(null)
  const [scale, setScale] = useState(0.55)
  const posterWidthMm = format.widthMm / format.columns
  const posterHeightMm = format.heightMm / format.rows
  const naturalWidth = posterWidthMm * PX_PER_MM
  const naturalHeight = posterHeightMm * PX_PER_MM

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return undefined
    const resize = () => {
      const width = Math.max(260, frame.clientWidth - 44)
      const height = Math.max(380, Math.min(760, window.innerHeight - 190))
      setScale(Math.min(width / naturalWidth, height / naturalHeight, 1))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [naturalHeight, naturalWidth])

  const startInteraction = (boxName, action, event) => {
    event.preventDefault()
    event.stopPropagation()
    onSelectBox(boxName)
    const card = event.currentTarget.closest('.poster-card')
    const rect = card?.getBoundingClientRect()
    if (!rect) return
    const origin = { x: event.clientX, y: event.clientY }
    const initial = { ...template[boxName] }

    const move = (moveEvent) => {
      const deltaX = ((moveEvent.clientX - origin.x) / rect.width) * 100
      const deltaY = ((moveEvent.clientY - origin.y) / rect.height) * 100
      if (action === 'move') {
        onBoxChange(boxName, {
          ...initial,
          x: clamp(snap(initial.x + deltaX, snapEnabled, snapStep), 0, 100 - initial.width),
          y: clamp(snap(initial.y + deltaY, snapEnabled, snapStep), 0, 100 - initial.height),
        })
      } else {
        onBoxChange(boxName, {
          ...initial,
          width: clamp(snap(initial.width + deltaX, snapEnabled, snapStep), 5, 100 - initial.x),
          height: clamp(snap(initial.height + deltaY, snapEnabled, snapStep), 5, 100 - initial.y),
        })
      }
    }

    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <div className="poster-admin-canvas" ref={frameRef}>
      <div className="poster-admin-stage" style={{ width: naturalWidth * scale, height: naturalHeight * scale }}>
        <div
          className={`poster-admin-card-scale selected-${selectedBox}`}
          style={{ width: naturalWidth, height: naturalHeight, transform: `scale(${scale})` }}
        >
          <div className="poster-admin-center-guide poster-admin-center-guide-x" />
          <div className="poster-admin-center-guide poster-admin-center-guide-y" />
          <PosterCard
            product={product}
            format={format}
            template={template}
            showGuide={viewMode === 'guide'}
            showLayoutDebug
            editable
            onBoxPointerDown={startInteraction}
          />
        </div>
      </div>
    </div>
  )
}
