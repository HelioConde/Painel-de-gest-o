import { normalizePrice } from './normalizeProduct.js'

const PRICE_PATTERN = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2}))\s*$/i
const UNIT_PATTERN = /^(?:\d+(?:[.,]\d+)?\s*)?(?:kg|g|mg|l|ml|cl|un|und|pct|pack)$/i
const COMPOUND_DESCRIPTIONS = [
  ['SABÃO', 'EM', 'PÓ'], ['SABAO', 'EM', 'PO'], ['COCA', 'COLA'], ['PAO', 'FRANCES'],
  ['TIXAN', 'YPE'], ['LEITE', 'CONDENSADO'], ['ACHOCOLATADO', 'EM', 'PO'],
]

function upper(value) {
  return String(value || '').toLocaleUpperCase('pt-BR')
}

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
  const normalized = tokens.map((token) => upper(token).normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  const head = COMPOUND_DESCRIPTIONS.find((candidate) => candidate.every((value, index) => normalized[index] === value))
  const descriptionLength = head?.length || 1
  return {
    description: tokens.slice(0, descriptionLength).join(' '),
    subdescription: tokens[descriptionLength] || '',
    complement: tokens.slice(descriptionLength + 1).join(' '),
  }
}

function parseStructuredProduct(normalizedLine) {
  const priceMatch = normalizedLine.match(PRICE_PATTERN)
  if (!priceMatch) return null
  const beforePrice = normalizedLine.slice(0, priceMatch.index).replace(/,\s*$/, '').trim()
  if (!beforePrice.includes(',')) return null
  const parts = beforePrice.split(',').map((part) => part.trim())
  const unit = parts.at(-1) || ''
  const textParts = parts.slice(0, -1)
  if (parts.some((part) => !part) || !UNIT_PATTERN.test(unit) || textParts.length < 2 || textParts.length > 3) return null
  return {
    description: textParts[0], subdescription: textParts[1], complement: textParts[2] || '', unit,
    price: normalizePrice(priceMatch[1]),
  }
}

export function parseProductLine(line, index = 0) {
  const normalizedLine = String(line || '').trim()
  const structured = parseStructuredProduct(normalizedLine)
  const parsed = structured || (() => {
    const priceMatch = normalizedLine.match(PRICE_PATTERN)
    const productNameWithUnit = priceMatch ? normalizedLine.slice(0, priceMatch.index).trim() : normalizedLine
    const tokens = productNameWithUnit.split(/\s+/).filter(Boolean)
    const last = tokens.at(-1) || ''
    const unit = UNIT_PATTERN.test(last) ? last : ''
    const fields = splitProductName(unit ? tokens.slice(0, -1).join(' ') : productNameWithUnit)
    return { ...fields, unit, price: priceMatch ? normalizePrice(priceMatch[1]) : '' }
  })()
  const product = {
    id: stableProductId(normalizedLine, index),
    description: upper(parsed.description),
    subdescription: upper(parsed.subdescription),
    complement: upper(parsed.complement),
    unit: upper(parsed.unit),
    price: parsed.price,
  }
  return product
}

export function parseProductList(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(parseProductLine)
}
