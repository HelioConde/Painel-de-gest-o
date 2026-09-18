const PRICE_PATTERN = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2}))\s*$/i
const UNIT_PATTERN = /^(?:\d+(?:[.,]\d+)?\s*)?(?:kg|g|mg|l|ml|cl|un|und|pct|pack)$/i

function stableProductId(line, index) {
  let hash = 2166136261
  for (const character of `${index}:${line}`) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `poster-${index + 1}-${(hash >>> 0).toString(36)}`
}

function splitProductName(rawName) {
  const tokens = rawName.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return { description: '', subdescription: '', complement: '' }

  const startsWithPowderSoap = tokens.length >= 3
    && tokens[0].toLocaleUpperCase('pt-BR') === 'SABÃO'
    && tokens[1].toLocaleUpperCase('pt-BR') === 'EM'
    && tokens[2].toLocaleUpperCase('pt-BR') === 'PÓ'

  if (startsWithPowderSoap) {
    return {
      description: tokens.slice(0, 3).join(' '),
      subdescription: tokens[3] || '',
      complement: tokens.slice(4).join(' '),
    }
  }

  return {
    description: tokens[0] || '',
    subdescription: tokens[1] || '',
    complement: tokens.slice(2).join(' '),
  }
}

function parseStructuredProduct(normalizedLine) {
  const priceMatch = normalizedLine.match(PRICE_PATTERN)
  if (!priceMatch) return null

  const beforePrice = normalizedLine.slice(0, priceMatch.index).replace(/,\s*$/, '').trim()
  if (!beforePrice.includes(',')) return null

  const parts = beforePrice.split(',').map((part) => part.trim())
  if (parts.some((part) => !part)) return null

  const unit = parts.at(-1) || ''
  const textParts = parts.slice(0, -1)
  if (!UNIT_PATTERN.test(unit) || textParts.length < 2 || textParts.length > 3) return null

  return {
    description: textParts[0],
    subdescription: textParts[1],
    complement: textParts[2] || '',
    unit,
    price: priceMatch[1].replace('.', ','),
  }
}

export function parseProductLine(line, index = 0) {
  const normalizedLine = String(line || '').trim()
  const structured = parseStructuredProduct(normalizedLine)
  const upper = (value) => value.toLocaleUpperCase('pt-BR')

  if (structured) {
    return {
      id: stableProductId(normalizedLine, index),
      description: upper(structured.description),
      subdescription: upper(structured.subdescription),
      complement: upper(structured.complement),
      unit: upper(structured.unit),
      price: structured.price,
    }
  }

  const priceMatch = normalizedLine.match(PRICE_PATTERN)
  const price = priceMatch ? priceMatch[1].replace('.', ',') : ''
  let productName = priceMatch
    ? normalizedLine.slice(0, priceMatch.index).trim()
    : normalizedLine

  const nameTokens = productName.split(/\s+/).filter(Boolean)
  const possibleUnit = nameTokens.at(-1) || ''
  const unit = UNIT_PATTERN.test(possibleUnit) ? possibleUnit : ''
  if (unit) productName = nameTokens.slice(0, -1).join(' ')

  const fields = splitProductName(productName)
  return {
    id: stableProductId(normalizedLine, index),
    description: upper(fields.description),
    subdescription: upper(fields.subdescription),
    complement: upper(fields.complement),
    unit: upper(unit),
    price,
  }
}

export function parseProducts(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseProductLine)
}

export function countProductLines(text) {
  return String(text || '').split(/\r?\n/).filter((line) => line.trim()).length
}
