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
    const cap = (field === 'description' ? 36 : field === 'subdescription' ? 29 : field === 'complement' ? 17 : 14) * sizeScale
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
    lines: draft.map(({ field, text, fontSizeMm, style: lineStyle }) => {
      const size = Number((fontSizeMm * factor).toFixed(3))
      const measuredWidth = measure(text, { ...lineStyle, fontSizeMm: size }).widthMm
      const scaleX = Math.max(1, Math.min(field === 'description' ? 1.35 : field === 'subdescription' ? 1.22 : 1, widthMm / Math.max(1, measuredWidth)))
      return { field, text, fontSizeMm: size, scaleX: Math.floor(scaleX * 1000) / 1000 }
    }),
    combinedUnit: inline,
    appPriceBox: getAppPriceBox(product, template),
    appPriceFontSizeMm: fitAppMainPrice({ product, template, format, measure }),
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
    fontMax: Number(config.fontMax || 10.8),
    scale: 1,
  }
  const text = raw.replace(/^R\$\s*/i, '')
  const widthMm = (format.widthMm / format.columns) * box.width / 100 * 0.94
  const heightMm = (format.heightMm / format.rows) * box.height / 100 * 0.88
  const fitted = fitSingleLine({
    text, style, maxWidthMm: widthMm, maxHeightMm: heightMm,
    measure: (value, candidate) => measureAppPrice(value, candidate, measure, true, 0.32),
  })
  // fitSingleLine arredonda a 0,001 mm; a folga evita estourar a medida
  // por arredondamento e dá segurança extra para as variações de fonte.
  return Math.max(2.5, Number((fitted.fontSizeMm - 0.03).toFixed(3)))
}

// Sem validade informada, o preço usa a altura completa da área amarela.
export function getAppPriceBox(product, template) {
  const box = template.appPriceBox
  if (!box || !template.appValidityBox || !String(product.validity || template.appValidityText || '').trim()) return box
  const end = Math.min(box.y + box.height, template.appValidityBox.y - 0.3)
  return { ...box, height: Math.max(1, end - box.y) }
}

function measureAppPrice(text, candidate, measure, currency, currencyScale = 0.29) {
  const digits = measure(text, candidate)
  const prefix = currency ? measure('R$', { ...candidate, fontSizeMm: candidate.fontSizeMm * currencyScale }).widthMm + candidate.fontSizeMm * 0.12 : 0
  return { widthMm: digits.widthMm + prefix + candidate.fontSizeMm * 0.04, heightMm: Math.max(digits.heightMm, candidate.fontSizeMm * (candidate.lineHeight || .84)) }
}

// Preço principal: mede os algarismos no tamanho integral e R$ reduzido,
// como no cartaz físico. Usa a área real em mm em todos os formatos.
export function fitAppMainPrice({ product, template, format, measure = estimateTextMeasure }) {
  const raw = String(product.price || '').trim().replace(/^R\$\s*/i, '')
  const box = getAppPriceBox(product, template)
  const config = template.textStyles.appPrice
  if (!raw || !box || !config) return null
  const currency = template.showCurrency && !template.currencyFromBackground
  const style = { ...config, fontFamily: config.fontFamily || '"Burbank Big Cd Bk"', fontMin: 0.6, scale: config.scale || 1 }
  const widthMm = format.widthMm / format.columns * box.width / 100 * 0.94 / (template.priceDisplayMode === 'raised' ? 1 : 1.10)
  const heightMm = format.heightMm / format.rows * box.height / 100 * 0.94
  const measurePrice = (text, candidate) => measureAppPrice(text, candidate, measure, currency)
  const fitted = fitSingleLine({ text: raw, style, maxWidthMm: widthMm, maxHeightMm: heightMm, measure: measurePrice })
  return Math.max(0.6, Number((fitted.fontSizeMm - 0.03).toFixed(3)))
}
