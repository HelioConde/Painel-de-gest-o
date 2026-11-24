import { fitSingleLine } from './textFit.js'
import { estimateTextMeasure } from './textMeasure.js'

const TEXT_FIELDS = ['description', 'subdescription', 'complement', 'unit']
const LINE_GAP_MM = 0.7
const CONNECTORS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'COM', 'PARA', 'POR'])

// Somente a apresentação no modelo App muda; os dados originais do produto
// continuam intactos para edição, histórico e demais formatos de cartaz.
export function normalizeAppTitleFields(product) {
  const description = String(product.description || '').trim()
  const subdescription = String(product.subdescription || '').trim()
  const words = description.split(/\s+/).filter(Boolean)
  if (!subdescription && words.length === 2 &&
      !CONNECTORS.has(words[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR'))) {
    return { ...product, description: words[0], subdescription: words[1] }
  }
  return product
}

// O título é planejado em milímetros, para manter a mesma tipografia na
// prévia, na edição do modelo e na impressão (sem depender de cqi/viewport).
export function createAppTitleLayout({ product, template, format, measure = estimateTextMeasure }) {
  const box = template.appTitleBox
  const displayProduct = normalizeAppTitleFields(product)
  const style = template.textStyles.appTitle
  const widthMm = (format.widthMm / format.columns) * (box.width / 100) * 0.96
  const heightMm = (format.heightMm / format.rows) * (box.height / 100) * 0.97
  const fontFamily = style.fontFamily || '"Burbank Big Cd Bk"'
  const complement = String(product.complement || '').trim()
  const unit = String(product.unit || '').trim()
  const together = `${complement} - ${unit}`
  const sizeScale = format.id === 'A3_APP' ? 2 : format.id === 'A4_APP' ? Math.SQRT2 : 1
  const inlineSizeMm = Math.min(15.5 * sizeScale, Number(style.fontMax || 26 * sizeScale))
  const inline = Boolean(
    complement && unit && complement.length <= 14 &&
    measure(together, { ...style, fontFamily, fontSizeMm: inlineSizeMm }).widthMm <= widthMm,
  )

  const fields = TEXT_FIELDS.filter((field) => displayProduct[field] && !(inline && field === 'unit'))
  const draft = fields.map((field) => {
    const text = field === 'complement' && inline ? together : String(displayProduct[field])
    const cap = (field === 'complement' ? 17 : field === 'unit' ? 14 : 26) * sizeScale
    const fontMax = Math.min(cap, Math.max(2, Number(style.fontMax || cap)))
    const measuredStyle = { ...style, fontFamily, scale: 1, fontMin: 2, fontMax }
    const fitted = fitSingleLine({
      text, style: measuredStyle, maxWidthMm: widthMm, maxHeightMm: heightMm, measure,
    })
    return { field, text, fontSizeMm: fitted.fontSizeMm, style: measuredStyle }
  })

  const gapsMm = Math.max(0, draft.length - 1) * LINE_GAP_MM
  const heights = draft.map(({ text, style: lineStyle, fontSizeMm }) =>
    Math.max(measure(text, { ...lineStyle, fontSizeMm }).heightMm, fontSizeMm * (lineStyle.lineHeight || 0.92)))
  const availableTextHeightMm = Math.max(1, heightMm - gapsMm)
  const totalTextHeightMm = heights.reduce((sum, height) => sum + height, 0)
  const factor = totalTextHeightMm > availableTextHeightMm
    ? availableTextHeightMm / totalTextHeightMm
    : 1

  return {
    lines: draft.map(({ field, text, fontSizeMm }) => ({
      field, text, fontSizeMm: Number((fontSizeMm * factor).toFixed(3)),
    })),
    combinedUnit: inline,
    regularPriceFontSizeMm: fitAppRegularPrice({ product, template, format, measure }),
  }
}

export function createAppTitleLayouts(products, template, format, measure) {
  return Object.fromEntries(products.map((product) => [
    product.id, createAppTitleLayout({ product, template, format, measure }),
  ]))
}

// Migra só a posição exata do modelo anterior. Caixas personalizadas continuam
// intactas, inclusive quando o usuário as ajustou pelo editor visual.
export function migrateAppTitleBox(savedBox, defaultBox) {
  const y = Number(savedBox?.y)
  const height = Number(savedBox?.height)
  const previousDefaults = [[39, 29], [42, 25.3]]
  if (previousDefaults.some(([oldY, oldHeight]) =>
    Math.abs(y - oldY) < 0.01 && Math.abs(height - oldHeight) < 0.01)) {
    return { ...savedBox, y: defaultBox.y, height: defaultBox.height }
  }
  return savedBox
}

// O preço fora do App tem menos largura que o preço principal. Dimensionamos
// pelo texto completo, inclusive R$, e reservamos uma margem para a fonte
// estilizada e as diferentes larguras de glyphs no navegador.
export function fitAppRegularPrice({ product, template, format, measure = estimateTextMeasure }) {
  const raw = String(product.regularPrice || '').trim()
  if (!raw) return null
  const box = template.appRegularPriceBox
  const config = template.textStyles.appRegularPrice
  const style = {
    ...config,
    fontFamily: config.fontFamily || '"Futura Price"',
    fontMin: 2.5,
    fontMax: Math.min(10.8 * (format.id === 'A3_APP' ? 2 : format.id === 'A4_APP' ? Math.SQRT2 : 1), Number(config.fontMax || 10.8)),
    scale: 1,
  }
  const text = `R$ ${raw.replace(/^R\$\s*/i, '')}`
  const widthMm = (format.widthMm / format.columns) * box.width / 100 * 0.79
  const heightMm = (format.heightMm / format.rows) * box.height / 100 * 0.8
  const fitted = fitSingleLine({
    text, style, maxWidthMm: widthMm, maxHeightMm: heightMm, measure,
  })
  // fitSingleLine arredonda a 0,001 mm; a folga evita estourar a medida
  // por arredondamento e dá segurança extra para as variações de fonte.
  return Math.max(2.5, Number((fitted.fontSizeMm - 0.03).toFixed(3)))
}
