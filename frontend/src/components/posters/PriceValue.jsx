function splitPrice(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^(.*?)(\d+)([,\.])(\d{1,2})$/)
  if (!match) return { raw, prefix: '', major: '', separator: '', cents: '' }
  return {
    raw,
    prefix: match[1].trim(),
    major: match[2],
    separator: match[3],
    cents: match[4],
  }
}

export default function PriceValue({ value, className = '' }) {
  const price = splitPrice(value)
  if (!price.major) return <span className={`poster-price-value ${className}`.trim()}>{price.raw || '\u00a0'}</span>

  return (
    <span className={`poster-price-value ${className}`.trim()}>
      {price.prefix ? <span className="poster-price-currency">{price.prefix}</span> : null}
      <span className="poster-price-major">{price.major}{price.separator}</span>
      <span className="poster-price-decimal">{price.cents}</span>
    </span>
  )
}
