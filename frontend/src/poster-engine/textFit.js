const EPSILON = 0.01

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function effectiveMax(style) {
  return Math.max(style.fontMin, style.fontMax * (style.scale ?? 1))
}

export function lineHeightMm(style, fontSizeMm) {
  return fontSizeMm * (style.lineHeight || 1)
}

export function fitSingleLine({ text, style, maxWidthMm, maxHeightMm, measure }) {
  const maximum = effectiveMax(style)
  const minimum = Math.max(0.6, style.fontMin)
  if (!text) return { fontSizeMm: 0, widthMm: 0, heightMm: 0, fits: true }

  let low = minimum
  let high = maximum
  let best = minimum
  for (let step = 0; step < 24; step += 1) {
    const candidate = (low + high) / 2
    const measured = measure(text, { ...style, fontSizeMm: candidate })
    const height = Math.max(measured.heightMm, lineHeightMm(style, candidate))
    if (measured.widthMm <= maxWidthMm + EPSILON && height <= maxHeightMm + EPSILON) {
      best = candidate
      low = candidate
    } else {
      high = candidate
    }
  }

  const measured = measure(text, { ...style, fontSizeMm: best })
  return {
    fontSizeMm: Number(best.toFixed(3)),
    widthMm: measured.widthMm,
    heightMm: Math.max(measured.heightMm, lineHeightMm(style, best)),
    fits: measured.widthMm <= maxWidthMm + EPSILON,
  }
}

export function shrinkLine(line, factor, measure) {
  const fontSizeMm = Math.max(line.style.fontMin, line.fontSizeMm * factor)
  const measured = measure(line.text, { ...line.style, fontSizeMm })
  return {
    ...line,
    fontSizeMm: Number(fontSizeMm.toFixed(3)),
    widthMm: measured.widthMm,
    heightMm: Math.max(measured.heightMm, lineHeightMm(line.style, fontSizeMm)),
  }
}
