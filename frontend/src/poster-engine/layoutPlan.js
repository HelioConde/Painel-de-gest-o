import { getPosterGeometry } from './formatGeometry.js'
import { effectiveMax, fitSingleLine, lineHeightMm } from './textFit.js'
import { estimateTextMeasure } from './textMeasure.js'

const CONTENT_FIELDS = ['description', 'subdescription', 'complement', 'unit']
const COPY_FIELDS = ['description', 'subdescription', 'complement']

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

function fitCopyStack(copyLines, maxWidthMm, maxHeightMm, gapMm, measure) {
  if (!copyLines.length) return []
  let low = 0
  let high = 1
  let best = 0
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const scale = (low + high) / 2
    const candidate = copyLines.map((line) => ({
      ...line,
      ...measureLine(line.text, line.style, Math.max(line.style.fontMin, effectiveMax(line.style) * scale), measure),
    }))
    const widest = Math.max(...candidate.map((line) => line.widthMm))
    const height = candidate.reduce((total, line) => total + line.heightMm, 0) + (candidate.length - 1) * gapMm
    if (widest <= maxWidthMm && height <= maxHeightMm) {
      best = scale
      low = scale
    } else {
      high = scale
    }
  }
  return copyLines.map((line) => ({
    ...line,
    ...measureLine(line.text, line.style, Math.max(line.style.fontMin, effectiveMax(line.style) * best), measure),
  }))
}

function createContentLines(product, template, contentBox, measure) {
  const copyWidth = Math.min(contentBox.width, contentBox.width * Math.min(1, 79 / template.contentBox.width))
  const copyHeight = Math.min(contentBox.height, contentBox.height * Math.min(1, 39 / template.contentBox.height))
  const gapMm = (template.contentBox.gap || 0) / 100 * contentBox.height
  const copySource = COPY_FIELDS.filter((field) => product[field]).map((field) => ({ field, text: product[field], style: template.textStyles[field] }))
  const copyLines = fitCopyStack(copySource, copyWidth, copyHeight, gapMm, measure)
  const copyBlockHeight = copyLines.reduce((total, line) => total + line.heightMm, 0) + Math.max(0, copyLines.length - 1) * gapMm
  const unitStyle = template.textStyles.unit
  const unitLine = product.unit
    ? {
      field: 'unit',
      text: product.unit,
      style: unitStyle,
      ...fitSingleLine({
        text: product.unit,
        style: unitStyle,
        maxWidthMm: contentBox.width,
        maxHeightMm: Math.max(unitStyle.fontMin, contentBox.height - copyBlockHeight - (copyLines.length ? gapMm : 0)),
        measure,
      }),
    }
    : null

  const totalHeight = copyBlockHeight + (copyLines.length && unitLine ? gapMm : 0) + (unitLine?.heightMm || 0)
  let cursorY = alignedY(contentBox, totalHeight)
  const planned = []
  for (const line of copyLines) {
    planned.push({ ...line, x: alignedX({ ...contentBox, width: copyWidth }, line.widthMm), y: cursorY })
    cursorY += line.heightMm + gapMm
  }
  if (unitLine) {
    planned.push({ ...unitLine, x: alignedX(contentBox, unitLine.widthMm), y: cursorY })
  }
  return { lines: planned, copyWidthMm: copyWidth, copyHeightMm: copyHeight, gapMm }
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
