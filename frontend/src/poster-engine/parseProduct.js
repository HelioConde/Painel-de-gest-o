import { normalizePrice } from './normalizeProduct.js'

const PRICE_PATTERN = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2}))\s*$/i
const PRICE_OR_EMPTY_PATTERN = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2})|—|-)\s*$/i
const UNIT_NAME_PATTERN = '(?:kg|g|mg|l|ml|cl|un|und|pct|pack|kit)'
const UNIT_CHUNK_PATTERN = `(?:\\d+(?:[.,]\\d+)?\\s*)?${UNIT_NAME_PATTERN}(?:\\s*\\([^)]*\\))?`
const UNIT_PATTERN = new RegExp(`^(?:${UNIT_CHUNK_PATTERN})(?:\\s*\\+\\s*(?:${UNIT_CHUNK_PATTERN}))*$`, 'i')
const TRAILING_UNIT_PATTERN = new RegExp(`(?:^|[\\s,;|\\t])((?:${UNIT_CHUNK_PATTERN})(?:\\s*\\+\\s*(?:${UNIT_CHUNK_PATTERN}))*)\\s*$`, 'i')

const COMPOUND_DESCRIPTIONS = [
  ['SUPLEMENTO', 'HIDROTONICO'],
  ['KIT', 'ELSEVE'],
  ['KIT', 'SHAMPOO', '+', 'CONDICIONADOR'],
  ['DESODORANTE', 'AEROSSOL'],
  ['WHEY', 'PROTEIN'],
  ['FARINHA', 'DE', 'ARROZ'],
  ['SUCO', 'MISTO'],
  ['CREME', 'DENTAL'],
  ['CREME', 'PARA', 'PENTEAR'],
  ['BATATA', 'PALHA'],
  ['AZEITE', 'DE', 'OLIVA'],
  ['BISCOITO', 'RECHEADO'],
  ['MILHO', 'VERDE'],
  ['LIMPADOR', 'PERFUMADO'],
  ['FARINHA', 'DE', 'MANDIOCA'],
  ['BEBIDA', 'LACTEA'],
  ['PAPEL', 'HIGIENICO'],
  ['SABAO', 'EM', 'PO'],
  ['AGUA', 'MINERAL'],
  ['LEITE', 'CONDENSADO'],
  ['ACHOCOLATADO', 'EM', 'PO'],
  ['COCA', 'COLA'],
  ['PAO', 'FRANCES'],
  ['TIXAN', 'YPE'],
]

const CONNECTOR_WORDS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'COM', 'PARA', 'POR'])

const COMPOUND_SUBDESCRIPTIONS = [
  ['JOHNNIE', 'WALKER'],
  ['JACK', "DANIEL'S"],
  ['JACK', 'DANIELS'],
  ['CHIVAS', 'REGAL'],
  ['MAX', 'TITANIUM'],
  ['TIO', 'JOAO'],
]

function upper(value) {
  return String(value || '').toLocaleUpperCase('pt-BR')
}

function normalizedToken(value) {
  return upper(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function cleanPart(value) {
  return String(value || '')
    .trim()
    .replace(/^[,;|\s]+|[,;|\s]+$/g, '')
    .replace(/\s+/g, ' ')
}

function stableProductId(line, index) {
  let hash = 2166136261
  for (const character of `${index}:${line}`) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `poster-${index + 1}-${(hash >>> 0).toString(36)}`
}

function startsWithSequence(tokens, sequence, offset = 0) {
  return sequence.every((value, index) => tokens[offset + index] === value)
}

function longestMatchingSequence(tokens, sequences, offset = 0) {
  return sequences
    .filter((candidate) => startsWithSequence(tokens, candidate, offset))
    .sort((a, b) => b.length - a.length)[0] || null
}

function rebalanceConnectorBoundaries(fields) {
  const values = [fields.description, fields.subdescription, fields.complement]
    .map((value) => cleanPart(value))

  // A connector must visually belong to the text before it. This prevents
  // awkward starts such as "DE QUEIJO" or a connector isolated on its own.
  // Example: PÃO / DE / QUEIJO -> PÃO DE / QUEIJO.
  for (let index = 1; index < values.length; index += 1) {
    const words = values[index].split(/\s+/).filter(Boolean)
    if (!words.length || !CONNECTOR_WORDS.has(normalizedToken(words[0]))) continue

    const connector = words.shift()
    values[index - 1] = cleanPart(`${values[index - 1]} ${connector}`)
    values[index] = words.join(' ')

    // If moving the connector emptied the current field, pull the first word
    // from the next field so the hierarchy remains contiguous.
    if (!values[index] && index + 1 < values.length) {
      const nextWords = values[index + 1].split(/\s+/).filter(Boolean)
      if (nextWords.length) {
        values[index] = nextWords.shift()
        values[index + 1] = nextWords.join(' ')
      }
    }
  }

  return { description: values[0], subdescription: values[1], complement: values[2] }
}

function splitProductName(rawName) {
  const tokens = cleanPart(rawName).split(/\s+/).filter(Boolean)
  if (!tokens.length) return { description: '', subdescription: '', complement: '' }

  const normalized = tokens.map(normalizedToken)
  const descriptionMatch = longestMatchingSequence(normalized, COMPOUND_DESCRIPTIONS)
  const descriptionLength = descriptionMatch?.length || 1
  const brandMatch = longestMatchingSequence(normalized, COMPOUND_SUBDESCRIPTIONS, descriptionLength)
  const subdescriptionLength = brandMatch?.length || (tokens.length > descriptionLength ? 1 : 0)
  const complementStart = descriptionLength + subdescriptionLength

  return rebalanceConnectorBoundaries({
    description: tokens.slice(0, descriptionLength).join(' '),
    subdescription: tokens.slice(descriptionLength, complementStart).join(' '),
    complement: tokens.slice(complementStart).join(' '),
  })
}

function normalizeParsedPrice(value) {
  const raw = cleanPart(value)
  if (!raw || raw === '—' || raw === '-') return ''
  return normalizePrice(raw)
}

function splitTextFields(text) {
  const normalized = String(text || '').replace(/\t+/g, ',')
  const parts = normalized.split(/\s*,\s*/).map(cleanPart).filter(Boolean)
  if (!parts.length) return { description: '', subdescription: '', complement: '' }

  if (parts.length === 1) return splitProductName(parts[0])

  // Some copied spreadsheets split a compound description across two columns,
  // e.g. "Desodorante, Aerossol, Rexona".
  const firstTwoTokens = `${parts[0]} ${parts[1]}`.split(/\s+/).map(normalizedToken)
  const firstTwoAreDescription = COMPOUND_DESCRIPTIONS.some((candidate) => (
    candidate.length === firstTwoTokens.length && startsWithSequence(firstTwoTokens, candidate)
  ))

  if (firstTwoAreDescription) {
    return rebalanceConnectorBoundaries({
      description: `${parts[0]} ${parts[1]}`,
      subdescription: parts[2] || '',
      complement: parts.slice(3).join(' '),
    })
  }

  return rebalanceConnectorBoundaries({
    description: parts[0],
    subdescription: parts[1] || '',
    complement: parts.slice(2).join(' '),
  })
}

function extractTrailingPrice(line) {
  const cleanLine = String(line || '').trim().replace(/,\s*$/, '')
  const match = cleanLine.match(PRICE_OR_EMPTY_PATTERN)
  if (!match) return { text: cleanLine, price: '' }
  return {
    text: cleanLine.slice(0, match.index).replace(/[,;|\t\s]+$/, '').trim(),
    price: normalizeParsedPrice(match[1]),
  }
}

function extractTrailingUnit(line) {
  const match = String(line || '').match(TRAILING_UNIT_PATTERN)
  if (!match) return { text: cleanPart(line), unit: '' }
  return {
    text: String(line || '').slice(0, match.index).replace(/[,;|\t\s]+$/, '').trim(),
    unit: cleanPart(match[1]),
  }
}

function parseStructuredProduct(normalizedLine) {
  const withoutPrice = extractTrailingPrice(normalizedLine)
  const withoutUnit = extractTrailingUnit(withoutPrice.text)
  if (!withoutUnit.unit) return null

  const hasExplicitSeparators = /[,;|\t]/.test(withoutUnit.text)
  if (!hasExplicitSeparators) return null

  const fields = splitTextFields(withoutUnit.text)
  if (!fields.description) return null

  return {
    ...fields,
    unit: withoutUnit.unit,
    price: withoutPrice.price,
  }
}

export function parseProductLine(line, index = 0) {
  const normalizedLine = String(line || '').trim()
  const structured = parseStructuredProduct(normalizedLine)

  const parsed = structured || (() => {
    const withoutPrice = extractTrailingPrice(normalizedLine)
    const withoutUnit = extractTrailingUnit(withoutPrice.text)
    const fields = splitProductName(withoutUnit.text)
    return {
      ...fields,
      unit: withoutUnit.unit,
      price: withoutPrice.price,
    }
  })()

  return {
    id: stableProductId(normalizedLine, index),
    description: upper(parsed.description),
    subdescription: upper(parsed.subdescription),
    complement: upper(parsed.complement),
    unit: upper(parsed.unit),
    price: parsed.price,
  }
}

export function parseProductList(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseProductLine)
}
