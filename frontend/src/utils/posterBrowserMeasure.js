import { createTextMeasurer, estimateTextMeasure } from '../poster-engine/textMeasure.js'

const PX_PER_MM = 96 / 25.4

export function createBrowserTextMeasure() {
  if (typeof document === 'undefined') return estimateTextMeasure
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return estimateTextMeasure
  return createTextMeasurer((text, style) => {
    const sizePx = Number(style.fontSizeMm || 1) * PX_PER_MM
    context.font = `${style.fontWeight || 900} ${sizePx}px "Burbank Big Cd Bk"`
    const metrics = context.measureText(text)
    const heightPx = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) || (sizePx * 0.84)
    return {
      widthMm: (metrics.width / PX_PER_MM) + (text.length * Number(style.letterSpacingMm ?? style.letterSpacing ?? 0)),
      heightMm: heightPx / PX_PER_MM,
    }
  })
}
