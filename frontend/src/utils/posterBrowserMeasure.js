import { createTextMeasurer, estimateTextMeasure } from '../poster-engine/textMeasure.js'

const PX_PER_MM = 96 / 25.4
const PRIMARY_POSTER_FONT = '"Burbank Big Cd Bk"'
const ACCENT_POSTER_FONT = 'Impact, "Arial Black", sans-serif'
const ACCENT_PATTERN = /[À-ÖØ-öø-ÿ]/

function hasAccent(text) {
  return ACCENT_PATTERN.test(String(text || ''))
}

function fontFamilyForText(text) {
  return hasAccent(text) ? ACCENT_POSTER_FONT : PRIMARY_POSTER_FONT
}

function accentPaddingMm(fontSizeMm, text) {
  if (!hasAccent(text)) return 0
  return Math.max(0.45, Number(fontSizeMm || 0) * 0.12)
}

export function createBrowserTextMeasure() {
  if (typeof document === 'undefined') return estimateTextMeasure
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return estimateTextMeasure

  return createTextMeasurer((text, style) => {
    const sizePx = Number(style.fontSizeMm || 1) * PX_PER_MM
    const fontFamily = fontFamilyForText(text)
    context.font = `${style.fontWeight || 900} ${sizePx}px ${fontFamily}`

    const metrics = context.measureText(text)
    const rawHeightPx = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) || (sizePx * 0.84)
    const extraMm = accentPaddingMm(style.fontSizeMm, text)

    return {
      widthMm: (metrics.width / PX_PER_MM) + (text.length * Number(style.letterSpacingMm ?? style.letterSpacing ?? 0)),
      heightMm: (rawHeightPx / PX_PER_MM) + extraMm,
    }
  })
}
