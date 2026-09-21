const cache = new Map()

export function createTextMeasurer(measure) {
  return (text, style = {}) => {
    const size = Number(style.fontSizeMm || 1)
    const letterSpacingMm = style.letterSpacingMm ?? style.letterSpacing ?? 0
    const key = `${style.fontFamily || ''}|${style.fontWeight || ''}|${size}|${letterSpacingMm}|${text}`
    if (cache.has(key)) return cache.get(key)
    const result = measure(String(text || ''), { ...style, fontSizeMm: size })
    cache.set(key, result)
    return result
  }
}

// Deterministic fallback for tests and non-browser runtimes. The browser adapter
// injects Canvas metrics in production, so no layout decision lives in React.
export const estimateTextMeasure = createTextMeasurer((text, style) => {
  const size = Number(style.fontSizeMm || 1)
  const compact = text.replace(/\s/g, '').length
  const spaces = (text.match(/\s/g) || []).length
  const width = (compact * size * 0.49) + (spaces * size * 0.18) + (text.length * Number(style.letterSpacingMm ?? style.letterSpacing ?? 0))
  return { widthMm: width, heightMm: size * 0.84 }
})
