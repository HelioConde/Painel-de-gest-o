import backgroundA3 from '../../Fundo/a3.png'
import backgroundA4 from '../../Fundo/a4.png'
import backgroundA4X2 from '../../Fundo/a4x2.png'
import backgroundA4X2Inverted from '../../Fundo/a4x2 invertido.png'
import backgroundA5 from '../../Fundo/a5.png'
import backgroundApp from '../../Fundo/app.png'

export const LAYOUT_CONFIG_VERSION = 8

const baseTextStyles = {
  description: { fontMin: 3.2, fontMax: 32, fontWeight: 900, lineHeight: 0.94, letterSpacing: 0, scale: 1 },
  subdescription: { fontMin: 3.2, fontMax: 32, fontWeight: 900, lineHeight: 0.94, letterSpacing: 0, scale: 1 },
  complement: { fontMin: 3.2, fontMax: 32, fontWeight: 900, lineHeight: 0.94, letterSpacing: 0, scale: 1 },
  unit: { fontMin: 2.8, fontMax: 14, fontWeight: 900, lineHeight: 0.96, letterSpacing: 0, scale: 0.72 },
  price: { fontMin: 7, fontMax: 34, fontWeight: 900, lineHeight: 0.88, letterSpacing: 0, scale: 1 },
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
  A4X4: { contentBox: content(9, 17, 83, 48), priceBox: price(16, 66, 75, 28), textScale: 0.72 },
  A5: { contentBox: content(9, 20, 86, 52), priceBox: price(14, 73, 80, 23), textScale: 1 },
  A4X2_CIMA_BAIXO: { contentBox: content(6, 26, 43, 65), priceBox: price(50, 13, 46, 78), textScale: 1 },
  A4X2_INVERTIDO: { contentBox: content(10, 5, 80, 53), priceBox: price(10, 62, 80, 33), textScale: 1, textScales: { description: 1.8, subdescription: 1.85, complement: 1.1 } },
  A4X2_APP: { contentBox: content(6, 44, 84, 36, 1.5), priceBox: price(10, 82, 76, 10), textScale: 1 },
  A4: { contentBox: content(10, 17, 82, 52), priceBox: price(16, 69, 76, 24), textScale: 1.36 },
  A3: { contentBox: content(9, 17, 85, 51), priceBox: price(16, 69, 77, 25), textScale: 1.9 },
}

const appBox = (x, y, width, height) => ({ x, y, width, height, ...centered })
const APP_LAYOUT = {
  // Calibrated to match the edited A4 2x1 App layout used in the admin layout tool.
  // These coordinates preserve the manually approved positioning seen in the reference.
  appTitleBox: appBox(8, 40, 84, 27),
  appPriceBox: appBox(8.5, 67, 83, 9),
  appValidityBox: appBox(17, 76, 62, 5),
  appRegularLabelBox: appBox(12, 81, 44, 11),
  appRegularPriceBox: appBox(56, 81, 28, 11),
}

function createTemplate({ id, name, format, backgroundImage, backgroundFile, backgroundScope, backgroundRotation = 0, specialLayout, backgroundVisible }) {
  const layout = DEFAULT_POSTER_LAYOUTS[format]
  const currencyFromBackground = specialLayout !== 'app-offer' && backgroundScope !== 'none'
  const template = { id, name, format, backgroundImage, backgroundFile, backgroundScope, backgroundVisible: backgroundVisible ?? Boolean(backgroundImage), backgroundOpacity: 1, backgroundRotation, backgroundFit: 'fill', backgroundPositionX: 'center', backgroundPositionY: 'center', safeArea: 3, showCurrency: !currencyFromBackground, currencyFromBackground, contentBox: layout.contentBox, priceBox: layout.priceBox, textStyles: textStyles(layout.textScale, layout.textScales), configVersion: LAYOUT_CONFIG_VERSION }
  if (specialLayout === 'app-offer') {
    template.specialLayout = specialLayout
    Object.assign(template, structuredClone(APP_LAYOUT))
    template.appValidityText = 'OFERTA VÁLIDA ATÉ 22/09/26'
    template.appRegularLabel = 'Preço fora do aplicativo'
    template.textStyles = {
      ...template.textStyles,
      appTitle: { ...baseTextStyles.description, fontMin: 3, fontMax: 12, scale: 1 },
      appPrice: { ...baseTextStyles.price, fontMin: 6, fontMax: 20, scale: 1 },
      appValidity: { ...baseTextStyles.unit, fontMin: 2.1, fontMax: 5, scale: 1 },
      appRegularLabel: { ...baseTextStyles.unit, fontMin: 2.3, fontMax: 5, scale: 1 },
      appRegularPrice: { ...baseTextStyles.price, fontMin: 4, fontMax: 10, scale: 1 },
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
]

export const DEFAULT_TEMPLATE_BY_FORMAT = Object.fromEntries(POSTER_TEMPLATES.map((template) => [template.format, template.id]))
export function getPosterTemplate(templateId) { return POSTER_TEMPLATES.find((template) => template.id === templateId) || POSTER_TEMPLATES[0] }
export function getPosterTemplatesForFormat(formatId) { return POSTER_TEMPLATES.filter((template) => template.format === formatId) }
export function getDefaultTemplateForFormat(formatId) { return getPosterTemplate(DEFAULT_TEMPLATE_BY_FORMAT[formatId]) }
