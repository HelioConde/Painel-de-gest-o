export function normalizeProductText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR')
}

export function productSignature(product) {
  return normalizeProductText([
    product?.description,
    product?.subdescription,
    product?.complement,
    product?.unit,
  ].filter(Boolean).join(' '))
}

export function normalizePrice(value) {
  const raw = String(value || '').trim().replace(/^R\$\s*/i, '')
  if (!raw) return ''
  if (raw.includes(',')) return raw.replace(/\./g, '')
  return raw.replace('.', ',')
}
