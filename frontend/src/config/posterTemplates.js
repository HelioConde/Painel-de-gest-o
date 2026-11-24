import backgroundA3 from '../../Fundo/a3.png'
import backgroundA4 from '../../Fundo/a4.png'
import backgroundA4X2 from '../../Fundo/a4x2.png'
import backgroundA4X2Inverted from '../../Fundo/a4x2 invertido.png'
import backgroundA5 from '../../Fundo/a5.png'
import backgroundApp from '../../Fundo/app.png'
import backgroundBlackFriday from '../../Fundo/a3-black-friday.svg'

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
  A3_APP: { contentBox: content(6, 44, 84, 36, 1.5), priceBox: price(10, 82, 76, 10), textScale: 2 },
  A4: { contentBox: content(8, 18, 84, 46), priceBox: price(9, 64, 86, 31), textScale: 1.38 },
  A3: { contentBox: content(6, 16, 88, 49), priceBox: price(9, 64, 86, 31), textScale: 2.02 },
  A3_BLACK_FRIDAY: { contentBox: content(7, 27, 86, 38, 2), priceBox: price(13, 68, 74, 22), textScale: 2.3, textScales: { description: 1.3, subdescription: 1, complement: 1 } },
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
  appTitleBox: appBox(7, 46, 86, 21),
  appPriceBox: appBox(8, 67.5, 84, 9.5),
  appValidityBox: appBox(19, 76.5, 58, 3.8),
  appRegularLabelBox: appBox(10, 81, 45, 11),
  appRegularPriceBox: appBox(54, 81, 35, 11),
}

function createTemplate({ id, name, format, backgroundImage, backgroundFile, backgroundScope, backgroundRotation = 0, specialLayout, backgroundVisible }) {
  const layout = DEFAULT_POSTER_LAYOUTS[format]
  const currencyFromBackground = specialLayout !== 'app-offer' && backgroundScope !== 'none'
  const template = { id, name, format, backgroundImage, backgroundFile, backgroundScope, backgroundVisible: backgroundVisible ?? Boolean(backgroundImage), backgroundOpacity: 1, backgroundRotation, backgroundFit: 'fill', backgroundPositionX: 'center', backgroundPositionY: 'center', safeArea: 3, showCurrency: !currencyFromBackground, currencyFromBackground, priceDisplayMode: 'raised', contentBox: layout.contentBox, priceBox: layout.priceBox, textStyles: textStyles(layout.textScale, layout.textScales), configVersion: LAYOUT_CONFIG_VERSION }
  if (specialLayout === 'app-offer') {
    template.specialLayout = specialLayout
    Object.assign(template, structuredClone(APP_LAYOUT))
    template.appValidityText = 'OFERTA VÁLIDA ATÉ 22/09/26'
    template.appRegularLabel = 'Preço fora do aplicativo'
    template.textStyles = {
      ...template.textStyles,
      appTitle: { ...baseTextStyles.description, fontMin: 3.4, fontMax: 26, scale: 1 },
      appPrice: { ...baseTextStyles.price, fontMin: 6.5, fontMax: 21, scale: 1.04 },
      appValidity: { ...baseTextStyles.unit, fontMin: 1.8, fontMax: 3.8, scale: 0.82 },
      appRegularLabel: { ...baseTextStyles.unit, fontMin: 2.8, fontMax: 6.2, scale: 1.14 },
      appRegularPrice: { ...baseTextStyles.price, fontMin: 5.2, fontMax: 13.5, scale: 1.18 },
    }
    if (format === 'A3_APP') {
      // Reutiliza exclusivamente a metade esquerda da arte original.
      template.backgroundCrop = 'left-half'
      template.appRegularLabelBox = appBox(12, 82.5, 42, 9)
      template.appRegularPriceBox = appBox(54, 82.5, 30, 9)
      for (const field of ['appTitle', 'appPrice', 'appValidity', 'appRegularLabel', 'appRegularPrice']) {
        template.textStyles[field].fontMin *= 2
        template.textStyles[field].fontMax *= 2
      }
    }
  }
  return template
}

export const POSTER_TEMPLATES = [
  createTemplate({ id: 'fundo-a4x4', name: 'A4 4x1', format: 'A4X4', backgroundImage: backgroundA4, backgroundFile: 'a4.png', backgroundScope: 'card' }),
  createTemplate({ id: 'fundo-a4x2-cima-baixo', name: 'A4 2x1', format: 'A4X2_CIMA_BAIXO', backgroundImage: backgroundA4X2, backgroundFile: 'a4x2.png', backgroundScope: 'sheet' }),
  createTemplate({ id: 'fundo-a4x2-invertido', name: 'A4 2x1 Invertido', format: 'A4X2_INVERTIDO', backgroundImage: backgroundA4X2Inverted, backgroundFile: 'a4x2 invertido.png', backgroundScope: 'sheet' }),
  createTemplate({ id: 'fundo-a4x2-app', name: 'A4 2x1 App', format: 'A4X2_APP', backgroundImage: backgroundApp, backgroundFile: 'app.png', backgroundScope: 'sheet', specialLayout: 'app-offer', backgroundVisible: true }),
  createTemplate({ id: 'fundo-a4', name: 'A4', format: 'A4', backgroundImage: backgroundA4, backgroundFile: 'a4.png', backgroundScope: 'card' }),
  createTemplate({ id: 'fundo-a5', name: 'A5', format: 'A5', backgroundImage: backgroundA5, backgroundFile: 'a5.png', backgroundScope: 'card' }),
  createTemplate({ id: 'fundo-a3', name: 'A3', format: 'A3', backgroundImage: backgroundA3, backgroundFile: 'a3.png', backgroundScope: 'card' }),
  createTemplate({ id: 'fundo-a3-app', name: 'A3 App', format: 'A3_APP', backgroundImage: backgroundApp, backgroundFile: 'app.png', backgroundScope: 'sheet', specialLayout: 'app-offer', backgroundVisible: true }),
  createTemplate({ id: 'fundo-a3-black-friday', name: 'A3 Black Friday', format: 'A3_BLACK_FRIDAY', backgroundImage: backgroundBlackFriday, backgroundFile: 'a3-black-friday.svg', backgroundScope: 'card' }),
  // SRA3 utiliza a própria arte A3, dimensionada para a folha maior; não duplicar a imagem.
  createTemplate({ id: 'fundo-sra3', name: 'SRA3', format: 'SRA3', backgroundImage: backgroundA3, backgroundFile: 'a3.png', backgroundScope: 'card' }),
]

export const DEFAULT_TEMPLATE_BY_FORMAT = Object.fromEntries(POSTER_TEMPLATES.map((template) => [template.format, template.id]))
export function getPosterTemplate(templateId) { return POSTER_TEMPLATES.find((template) => template.id === templateId) || POSTER_TEMPLATES[0] }
export function getPosterTemplatesForFormat(formatId) { return POSTER_TEMPLATES.filter((template) => template.format === formatId) }
export function getDefaultTemplateForFormat(formatId) { return getPosterTemplate(DEFAULT_TEMPLATE_BY_FORMAT[formatId]) }
