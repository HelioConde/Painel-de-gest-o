import { getPosterGeometry } from './formatGeometry.js'
import { effectiveMax, fitSingleLine, lineHeightMm } from './textFit.js'
import { estimateTextMeasure } from './textMeasure.js'

const CONTENT_FIELDS = ['description', 'subdescription', 'complement', 'unit']
const GROWTH_FIELDS = ['description', 'subdescription']
const EPSILON = 0.01

const ACCENT_PATTERN = /[À-ÖØ-öø-ÿ]/
const GENERIC_DESCRIPTION_PATTERN = /^(?:CREME DENTAL|CREME PARA PENTEAR|AZEITE DE OLIVA|BISCOITO RECHEADO|LIMPADOR PERFUMADO|DESODORANTE AEROSSOL|SUPLEMENTO HIDROTÔNICO|WHEY PROTEIN|FARINHA DE ARROZ|SUCO MISTO|BATATA PALHA|MILHO VERDE)$/i
const LIGHT_COMPLEMENT_PATTERN = /^(?:POTE|SACHÊ|SACHE|PERFUMES?|JUNTINHOS|TRADICIONAL(?:\s*\/\s*ORIGINAL)?|ORIGINAL|CLÁSSICO|CLASSICO|TIPO \d+|RECHEADO|MINI BOLO)$/i

function hasAccent(text) {
  return ACCENT_PATTERN.test(String(text || ''))
}

function styleForContentField(field, text, product, baseStyle) {
  let scale = baseStyle.scale ?? 1

  // Marca/subdescrição continua como referência visual. Descrições genéricas e
  // complementos cedem espaço para criar hierarquia semântica mais clara.
  if (field === 'description' && product.subdescription && GENERIC_DESCRIPTION_PATTERN.test(text)) {
    scale *= 0.82
  }
  if (field === 'complement') {
    scale *= LIGHT_COMPLEMENT_PATTERN.test(text) ? 0.68 : 0.82
  }

  // Fontes condensadas com line-height menor que 1 podem cortar acentos no topo.
  // A reserva é feita no próprio planejamento para preview e impressão coincidirem.
  const lineHeight = hasAccent(text) ? Math.max(baseStyle.lineHeight || 1, 1.06) : baseStyle.lineHeight

  return { ...baseStyle, scale, lineHeight }
}

function percent(value, total) {
  return total ? (value / total) * 100 : 0
}

function toMmBox(box, geometry) {
  return {
    x: (box.x / 100) * geometry.poster.widthMm,
    y: (box.y / 100) * geometry.poster.heightMm,
    width: (box.width / 100) * geometry.poster.widthMm,
    height: (box.height / 100) * geometry.poster.heightMm,
    alignX: box.alignX || 'center',
    alignY: box.alignY || 'center',
  }
}

function alignedX(box, itemWidth) {
  if (box.alignX === 'left') return box.x
  if (box.alignX === 'right') return box.x + box.width - itemWidth
  return box.x + ((box.width - itemWidth) / 2)
}

function alignedY(box, itemHeight) {
  if (box.alignY === 'top') return box.y
  if (box.alignY === 'bottom') return box.y + box.height - itemHeight
  return box.y + ((box.height - itemHeight) / 2)
}

function measureLine(text, style, fontSizeMm, measure) {
  const measured = measure(text, { ...style, fontSizeMm })
  return {
    fontSizeMm: Number(fontSizeMm.toFixed(3)),
    widthMm: measured.widthMm,
    heightMm: Math.max(measured.heightMm, lineHeightMm(style, fontSizeMm)),
  }
}

function stackHeight(lines, gapMm) {
  if (!lines.length) return 0
  return lines.reduce((total, line) => total + line.heightMm, 0) + Math.max(0, lines.length - 1) * gapMm
}

function fitConfiguredLine(line, maxHeightMm, measure) {
  return {
    ...line,
    ...fitSingleLine({
      text: line.text,
      style: line.style,
      maxWidthMm: line.maxWidthMm,
      maxHeightMm,
      measure,
    }),
  }
}

function fitFixedLine(line, measure) {
  const fontSizeMm = effectiveMax(line.style)
  return {
    ...line,
    ...measureLine(line.text, line.style, fontSizeMm, measure),
    fixedSize: true,
  }
}

function fitPhysicalLine(line, maxHeightMm, measure) {
  const scale = Math.max(line.style.scale ?? 1, 0.01)
  const lineHeight = Math.max(line.style.lineHeight || 1, 0.01)
  const physicalFontMax = maxHeightMm / lineHeight
  const compactLength = String(line.text || '').replace(/\s/g, '').length
  const growthFactor = compactLength <= 5 ? 1.12 : compactLength <= 8 ? 1.28 : 1.42
  const configuredMax = effectiveMax(line.style)
  const growthCeilingMm = configuredMax * growthFactor

  const expandedStyle = {
    ...line.style,
    fontMax: Math.max(
      line.style.fontMax,
      Math.min(physicalFontMax, growthCeilingMm) / scale,
    ),
  }

  const fitted = fitSingleLine({
    text: line.text,
    style: expandedStyle,
    maxWidthMm: line.maxWidthMm,
    maxHeightMm,
    measure,
  })

  return {
    ...line,
    fontSizeMm: fitted.fontSizeMm,
    widthMm: fitted.widthMm,
    heightMm: fitted.heightMm,
    fits: fitted.fits,
  }
}

function shrinkStackToHeight(lines, maxHeightMm, gapMm, measure) {
  if (!lines.length || stackHeight(lines, gapMm) <= maxHeightMm + EPSILON) return lines

  const fixedLines = lines.filter((line) => line.fixedSize)
  const scalableLines = lines.filter((line) => !line.fixedSize)
  const gapsHeightMm = Math.max(0, lines.length - 1) * gapMm
  const fixedHeightMm = fixedLines.reduce((total, line) => total + line.heightMm, 0)
  const scalableHeightLimitMm = Math.max(
    0,
    maxHeightMm - fixedHeightMm - gapsHeightMm,
  )

  let low = 0
  let high = 1
  let best = 0

  for (let iteration = 0; iteration < 28; iteration += 1) {
    const factor = (low + high) / 2
    const candidate = scalableLines.map((line) => {
      const minimum = Math.max(0.6, line.style.fontMin)
      const fontSizeMm = minimum + ((line.fontSizeMm - minimum) * factor)
      return {
        ...line,
        ...measureLine(line.text, line.style, fontSizeMm, measure),
      }
    })

    const candidateHeightMm = candidate.reduce((total, line) => total + line.heightMm, 0)

    if (candidateHeightMm <= scalableHeightLimitMm + EPSILON) {
      best = factor
      low = factor
    } else {
      high = factor
    }
  }

  return lines.map((line) => {
    if (line.fixedSize) return line

    const minimum = Math.max(0.6, line.style.fontMin)
    const fontSizeMm = minimum + ((line.fontSizeMm - minimum) * best)
    return {
      ...line,
      ...measureLine(line.text, line.style, fontSizeMm, measure),
    }
  })
}

function growStackByPriority(lines, maxHeightMm, gapMm, measure) {
  if (!lines.length) return lines

  const result = lines.map((line) => ({ ...line }))
  let freeHeightMm = Math.max(0, maxHeightMm - stackHeight(result, gapMm))

  // Prioridade de crescimento:
  // descrição -> subdescrição -> complemento -> gramatura.
  // Cada campo cresce até atingir a largura/altura física disponível.
  for (const field of GROWTH_FIELDS) {
    if (freeHeightMm <= EPSILON) break

    const index = result.findIndex((line) => line.field === field)
    if (index < 0) continue

    const current = result[index]
    const grown = fitPhysicalLine(current, current.heightMm + freeHeightMm, measure)
    const usedHeightMm = Math.max(0, grown.heightMm - current.heightMm)

    result[index] = grown
    freeHeightMm = Math.max(0, freeHeightMm - usedHeightMm)
  }

  return result
}

function createContentLines(product, template, contentBox, measure) {
  const copyWidth = Math.min(contentBox.width, contentBox.width * Math.min(1, 79 / template.contentBox.width))
  const gapMm = (template.contentBox.gap || 0) / 100 * contentBox.height
  const copyBox = {
    ...contentBox,
    x: contentBox.x + ((contentBox.width - copyWidth) / 2),
    width: copyWidth,
  }

  const sourceLines = CONTENT_FIELDS
    .filter((field) => product[field])
    .map((field) => ({
      field,
      text: product[field],
      style: styleForContentField(field, product[field], product, template.textStyles[field]),
      maxWidthMm: field === 'unit' ? contentBox.width : copyWidth,
    }))

  // Primeiro encontra o maior tamanho configurado que cabe por largura.
  let fittedLines = sourceLines.map((line) => (
    line.field === 'unit'
      ? fitFixedLine(line, measure)
      : fitConfiguredLine(line, contentBox.height, measure)
  ))

  // Se o conjunto ultrapassar a altura, reduz proporcionalmente.
  fittedLines = shrinkStackToHeight(fittedLines, contentBox.height, gapMm, measure)

  // Se houver altura sobrando, distribui por prioridade apenas entre descrição e subdescrição.
  // Complemento mantém o tamanho configurado (mas pode diminuir se precisar).
  // A gramatura permanece sempre no tamanho configurado.
  fittedLines = growStackByPriority(fittedLines, contentBox.height, gapMm, measure)

  const totalHeight = stackHeight(fittedLines, gapMm)
  let cursorY = alignedY(contentBox, totalHeight)
  const planned = []

  for (const line of fittedLines) {
    const horizontalBox = line.field === 'unit' ? contentBox : copyBox
    planned.push({
      ...line,
      x: alignedX(horizontalBox, line.widthMm),
      y: cursorY,
    })
    cursorY += line.heightMm + gapMm
  }

  return {
    lines: planned,
    copyWidthMm: copyWidth,
    copyHeightMm: contentBox.height,
    gapMm,
  }
}

function createPrice(product, template, priceBox, measure) {
  const style = template.textStyles.price
  const text = product.price || ''
  const strokeMm = 0.45
  const availableHeightMm = Math.max(style.fontMin, priceBox.height - (strokeMm * 2))
  // Price ceilings are physical: a larger grid has a larger priceBox and can use a larger type size.
  // The binary fit below still constrains the full text, including comma, cents and outline.
  const physicalFontCap = (availableHeightMm / Math.max(style.lineHeight, 0.7)) * (style.scale ?? 1)
  const priceStyle = {
    ...style,
    fontMax: Math.max(style.fontMax, physicalFontCap / Math.max(style.scale ?? 1, 0.01)),
  }
  const rawFit = fitSingleLine({
    text: text || ' ',
    style: priceStyle,
    maxWidthMm: Math.max(style.fontMin, priceBox.width - (strokeMm * 2)),
    maxHeightMm: availableHeightMm,
    measure,
  })
  const characters = text.replace(/\s/g, '').length
  const characterScale = characters <= 4 ? 1 : characters === 5 ? 0.9 : Math.max(0.68, 1 - ((characters - 4) * 0.1))
  let fontSizeMm = Math.max(style.fontMin, rawFit.fontSizeMm * characterScale)
  let measured = measure(text || ' ', { ...priceStyle, fontSizeMm })
  let contentHeightMm = Math.max(measured.heightMm, lineHeightMm(priceStyle, fontSizeMm))
  const widthRatio = (priceBox.width - (strokeMm * 2)) / measured.widthMm
  const heightRatio = availableHeightMm / contentHeightMm
  if (widthRatio < 1 || heightRatio < 1) {
    fontSizeMm = Math.max(style.fontMin, fontSizeMm * Math.min(widthRatio, heightRatio))
  }
  fontSizeMm = Math.floor(fontSizeMm * 1000) / 1000
  measured = measure(text || ' ', { ...priceStyle, fontSizeMm })
  contentHeightMm = Math.max(measured.heightMm, lineHeightMm(priceStyle, fontSizeMm))
  const heightMm = contentHeightMm + (strokeMm * 2)
  const widthMm = measured.widthMm + (strokeMm * 2)
  const [integer = '', decimal = ''] = text.split(',')
  return {
    text,
    integer,
    decimal,
    fontSizeMm: Number(fontSizeMm.toFixed(3)),
    widthMm,
    heightMm,
    x: alignedX(priceBox, widthMm),
    y: alignedY(priceBox, heightMm),
    style: priceStyle,
    characterScale,
  }
}

function relativeToBox(line, box, geometry) {
  const globalX = percent(line.x, geometry.poster.widthMm)
  const globalY = percent(line.y, geometry.poster.heightMm)
  return {
    ...line,
    globalX,
    globalY,
    x: percent(line.x - box.x, box.width),
    y: percent(line.y - box.y, box.height),
    width: percent(line.widthMm, box.width),
    height: percent(line.heightMm, box.height),
  }
}

export function createPosterLayout({ product, template, format, measure = estimateTextMeasure }) {
  const geometry = getPosterGeometry(format)
  const contentBox = toMmBox(template.contentBox, geometry)
  const priceBox = toMmBox(template.priceBox, geometry)
  const content = createContentLines(product, template, contentBox, measure)
  const price = createPrice(product, template, priceBox, measure)
  return {
    version: 1,
    productId: product.id,
    geometry,
    content: { ...content, box: template.contentBox, lines: content.lines.map((line) => relativeToBox(line, contentBox, geometry)) },
    price: { ...price, box: template.priceBox, ...relativeToBox(price, priceBox, geometry) },
  }
}

export function createPosterLayouts(products, template, format, measure) {
  return Object.fromEntries(products.map((product) => [product.id, createPosterLayout({ product, template, format, measure })]))
}
