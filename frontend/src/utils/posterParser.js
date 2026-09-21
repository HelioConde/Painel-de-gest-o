export { parseProductLine } from '../poster-engine/parseProduct.js'
import { parseProductList } from '../poster-engine/parseProduct.js'

export function parseProducts(text) {
  return parseProductList(text)
}

export function countProductLines(text) {
  return String(text || '').split(/\r?\n/).filter((line) => line.trim()).length
}
