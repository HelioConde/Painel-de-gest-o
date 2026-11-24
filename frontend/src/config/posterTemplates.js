import backgroundA3 from '../../Fundo/a3.png'
import backgroundA4 from '../../Fundo/a4.png'
import backgroundA4X2 from '../../Fundo/a4x2.png'
import backgroundA4X2Inverted from '../../Fundo/a4x2 invertido.png'
import backgroundA5 from '../../Fundo/a5.png'
import backgroundApp from '../../Fundo/app-duplo.jpg'
import backgroundAppVertical from '../../Fundo/app-vertical.jpg'

export const LAYOUT_CONFIG_VERSION = 9

const baseTextStyles = {
  description: { fontMin: 3.4, fontMax: 36, fontWeight: 900, lineHeight: 0.92, letterSpacing: 0, scale: 1 },
  subdescription: { fontMin: 3.4, fontMax: 36, fontWeight: 900, lineHeight: 0.92, letterSpacing: 0, scale: 1 },
  complement: { fontMin: 3.2, fontMax: 32, fontWeight: 900, lineHeight: 0.92, letterSpacing: 0, scale: 1 },
  unit: { fontMin: 3, fontMax: 15, fontWeight: 900, lineHeight: 0.94, letterSpacing: 0, scale: 0.76 },
  price: { fontMin: 8, fontMax: 40, fontWeight: 900, lineHeight: 0.84, letterSpacing: 0, scale: 1, fontFamily: '"Futura Price"' },
}

function textStyles(textScale = 1, scales = {}) {
  return Object.fromEntries(Object.entries(baseTextStyles).map(([field, style]) => [field, {
    ...style,
    fontMin: Number((style.fontMin * textScale).toFixed(2)),
    fontMax: Number((style.fontMax * textScale).toFixed(2)),
    scale: scales[field] ?? style.scale,
  }]))
}

const centered = { alignX: 'center', alignY: 'center' }
const content = (x, y, width, height, gap = 2) => ({ x, y, width, height, gap, ...centered })
const price = (x, y, width, height) => ({ x, y, width, height, ...centered })

// Official physical calibrations. Coordinates are relative to one logical plate, even in multi-plate formats.
export const DEFAULT_POSTER_LAYOUTS = {
  // Recalibrado a partir das placas físicas do Primor:
  // descrição ocupa mais largura/altura e o preço domina o terço inferior.
  A4X4: { contentBox: content(7, 18, 86, 46), priceBox: price(11, 64, 82, 31), textScale: 0.78 },
  A5: { contentBox: content(9, 21, 82, 44), priceBox: price(10, 68, 84, 28), textScale: 1.02 },
  A4X2_CIMA_BAIXO: { contentBox: content(6, 26, 43, 65), priceBox: price(50, 13, 46, 78), textScale: 1 },
  A4X2_INVERTIDO: { contentBox: content(7, 4, 86, 54), priceBox: price(8, 59, 84, 36), textScale: 1.08, textScales: { description: 1.88, subdescription: 1.9, complement: 1.12 } },
  A4X2_APP: { contentBox: content(6, 44, 84, 36, 1.5), priceBox: price(10, 82, 76, 10), textScale: 1 },
  A4_APP: { contentBox: content(6, 39, 88, 28, 1.5), priceBox: price(10, 82, 76, 9), textScale: 1.414 },
  A3_APP: { contentBox: content(6, 44, 84, 36, 1.5), priceBox: price(10, 82, 76, 10), textScale: 2 },
  A4: { contentBox: content(8, 18, 84, 46), priceBox: price(9, 64, 86, 31), textScale: 1.38 },
  A3: { contentBox: content(6, 16, 88, 49), priceBox: price(9, 64, 86, 31), textScale: 2.02 },
  // A3 mantém a calibração original; SRA3 expande a área útil e deixa texto/preço maiores,
  // respeitando a moldura e o cabeçalho do mesmo fundo "a3.png".
  SRA3: { contentBox: content(4, 16, 92, 49, 0.7), priceBox: price(4, 63, 92, 34), textScale: 2.5 },
}

const appBox = (x, y, width, height) => ({ x, y, width, height, ...centered })
const APP_LAYOUT = {
  // Tuned for readability in preview, print and mobile inspection.
  // Product copy gets more breathing room; validity is intentionally quieter;
  // the outside-app comparison is larger so the price difference is obvious.
  // O título começa dentro da faixa amarela, sem tocar a imagem superior.
  appTitleBox: appBox(7, 36.5, 86, 16.5),
  appPriceBox: appBox(8, 53.5, 84, 24.5),
  appValidityBox: appBox(19, 78, 62, 1.8),
  appRegularLabelBox: appBox(14, 81, 40, 9),
  appRegularPriceBox: appBox(55, 81, 31, 9),
}

function createTemplate({ id, name, format, backgroundImage, backgroundFile, backgroundScope, backgroundRotation = 0, specialLayout, backgroundVisible }) {
  const layout = DEFAULT_POSTER_LAYOUTS[format]
  const currencyFromBackground = specialLayout !== 'app-offer' && backgroundScope !== 'none'
  const template = { id, name, format, backgroundImage, backgroundFile, backgroundScope, backgroundVisible: backgroundVisible ?? Boolean(backgroundImage), backgroundOpacity: 1, backgroundRotation, backgroundFit: 'fill', backgroundPositionX: 'center', backgroundPositionY: 'center', safeArea: 3, showCurrency: !currencyFromBackground, currencyFromBackground, priceDisplayMode: 'raised', contentBox: layout.contentBox, priceBox: layout.priceBox, textStyles: textStyles(layout.textScale, layout.textScales), configVersion: LAYOUT_CONFIG_VERSION }
  if (specialLayout === 'app-offer') {
    template.specialLayout = specialLayout
    template.configVersion = LAYOUT_CONFIG_VERSION + 2
    template.priceDisplayMode = 'inline'
    Object.assign(template, structuredClone(APP_LAYOUT))
    template.appValidityText = 'OFERTA VÁLIDA ATÉ 22/09/26'
    template.appRegularLabel = 'PREÇO FORA DO APLICATIVO'
    template.textStyles = {
      ...template.textStyles,
      appTitle: { ...baseTextStyles.description, fontMin: 3.4, fontMax: 26, scale: 1 },
      appPrice: { ...baseTextStyles.price, fontFamily: '"Burbank Big Cd Bk"', fontMin: 3, fontMax: 72, lineHeight: 0.88, scale: 1 },
      appValidity: { ...baseTextStyles.unit, fontMin: 1.8, fontMax: 3.8, scale: 0.82 },
      appRegularLabel: { ...baseTextStyles.unit, fontMin: 2.8, fontMax: 7.5, scale: 1 },
      appRegularPrice: { ...baseTextStyles.price, fontFamily: '"Burbank Big Cd Bk"', fontMin: 2.5, fontMax: 20, lineHeight: 0.88, scale: 1 },
    }
    const appScale = format === 'A3_APP' ? 2 : format === 'A4_APP' ? Math.SQRT2 : 1
    for (const field of ['appTitle', 'appPrice', 'appValidity', 'appRegularLabel', 'appRegularPrice']) {
      template.textStyles[field].fontMin *= appScale
      template.textStyles[field].fontMax *= appScale
    }
  }
  return template
}

export const POSTER_TEMPLATES = [
  createTemplate({ id: 'fundo-a4x4', name: 'A4 4x1', format: 'A4X4', backgroundImage: backgroundA4, backgroundFile: 'a4.png', backgroundScope: 'card' }),
  createTemplate({ id: 'fundo-a4x2-cima-baixo', name: 'A4 2x1', format: 'A4X2_CIMA_BAIXO', backgroundImage: backgroundA4X2, backgroundFile: 'a4x2.png', backgroundScope: 'sheet' }),
  createTemplate({ id: 'fundo-a4x2-invertido', name: 'A4 2x1 Invertido', format: 'A4X2_INVERTIDO', backgroundImage: backgroundA4X2Inverted, backgroundFile: 'a4x2 invertido.png', backgroundScope: 'sheet' }),
  createTemplate({ id: 'fundo-a4x2-app', name: 'A4 2x1 App', format: 'A4X2_APP', backgroundImage: backgroundApp, backgroundFile: 'app-duplo.jpg', backgroundScope: 'sheet', specialLayout: 'app-offer', backgroundVisible: true }),
  createTemplate({ id: 'fundo-a4-app', name: 'A4 App', format: 'A4_APP', backgroundImage: backgroundAppVertical, backgroundFile: 'app-vertical.jpg', backgroundScope: 'sheet', specialLayout: 'app-offer', backgroundVisible: true }),
  createTemplate({ id: 'fundo-a4', name: 'A4', format: 'A4', backgroundImage: backgroundA4, backgroundFile: 'a4.png', backgroundScope: 'card' }),
  createTemplate({ id: 'fundo-a5', name: 'A5', format: 'A5', backgroundImage: backgroundA5, backgroundFile: 'a5.png', backgroundScope: 'card' }),
  createTemplate({ id: 'fundo-a3', name: 'A3', format: 'A3', backgroundImage: backgroundA3, backgroundFile: 'a3.png', backgroundScope: 'card' }),
  createTemplate({ id: 'fundo-a3-app', name: 'A3 App', format: 'A3_APP', backgroundImage: backgroundAppVertical, backgroundFile: 'app-vertical.jpg', backgroundScope: 'sheet', specialLayout: 'app-offer', backgroundVisible: true }),
  // SRA3 utiliza a própria arte A3, dimensionada para a folha maior; não duplicar a imagem.
  createTemplate({ id: 'fundo-sra3', name: 'SRA3', format: 'SRA3', backgroundImage: backgroundA3, backgroundFile: 'a3.png', backgroundScope: 'card' }),
]

export const DEFAULT_TEMPLATE_BY_FORMAT = Object.fromEntries(POSTER_TEMPLATES.map((template) => [template.format, template.id]))
export function getPosterTemplate(templateId) { return POSTER_TEMPLATES.find((template) => template.id === templateId) || POSTER_TEMPLATES[0] }
export function getPosterTemplatesForFormat(formatId) { return POSTER_TEMPLATES.filter((template) => template.format === formatId) }
export function getDefaultTemplateForFormat(formatId) { return getPosterTemplate(DEFAULT_TEMPLATE_BY_FORMAT[formatId]) }
