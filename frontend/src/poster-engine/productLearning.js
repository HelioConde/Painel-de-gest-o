import { productSignature } from './normalizeProduct.js'

export function createProductLearning(product, { confirmations = 1, source = 'manual' } = {}) {
  return {
    signature: productSignature(product),
    description: product.description || '',
    subdescription: product.subdescription || '',
    complement: product.complement || '',
    unit: product.unit || '',
    confirmations,
    source,
  }
}
