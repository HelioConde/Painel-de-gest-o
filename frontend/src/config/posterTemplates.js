import backgroundA3 from '../../Fundo/a3.png'
import backgroundA4 from '../../Fundo/a4.png'
import backgroundA4X2 from '../../Fundo/a4x2.png'
import backgroundA4X2Inverted from '../../Fundo/a4x2 invertido.png'
import backgroundA5 from '../../Fundo/a5.png'
import backgroundApp from '../../Fundo/app.png'

const baseTextStyles = {
  description: { fontMin: 3.2, fontMax: 32, fontWeight: 900, lineHeight: 0.94, letterSpacing: 0, scale: 1 },
  subdescription: { fontMin: 3.2, fontMax: 32, fontWeight: 900, lineHeight: 0.94, letterSpacing: 0, scale: 1 },
  complement: { fontMin: 3.2, fontMax: 32, fontWeight: 900, lineHeight: 0.94, letterSpacing: 0, scale: 1 },
  unit: { fontMin: 2.8, fontMax: 14, fontWeight: 900, lineHeight: 0.96, letterSpacing: 0, scale: 0.72 },
  price: { fontMin: 7, fontMax: 34, fontWeight: 900, lineHeight: 0.88, letterSpacing: 0, scale: 1 },
}

function scaledTextStyles(scale) {
  return Object.fromEntries(Object.entries(baseTextStyles).map(([field, style]) => [field, { ...style, fontMin: Number((style.fontMin * scale).toFixed(2)), fontMax: Number((style.fontMax * scale).toFixed(2)) }]))
}

function createTemplate({ id, name, format, backgroundImage, backgroundFile, backgroundScope, backgroundRotation = 270, contentBox, priceBox, textScale }) {
  return { id, name, format, backgroundImage, backgroundFile, backgroundScope, backgroundVisible: true, backgroundOpacity: 1, backgroundRotation, backgroundFit: 'fill', backgroundPositionX: 'center', backgroundPositionY: 'center', safeArea: 3, contentBox, priceBox, textStyles: scaledTextStyles(textScale), configVersion: 3 }
}

const individualContent = { x: 9, y: 10, width: 82, height: 52, alignX: 'center', alignY: 'center', gap: 2 }
const individualPrice = { x: 12, y: 66, width: 76, height: 24, alignX: 'center', alignY: 'center' }

export const POSTER_TEMPLATES = [
  createTemplate({ id: 'fundo-a5', name: 'A5', format: 'A5', backgroundImage: backgroundA5, backgroundFile: 'a5.png', backgroundScope: 'card', contentBox: { x: 10, y: 11, width: 80, height: 52, alignX: 'center', alignY: 'center', gap: 2 }, priceBox: { x: 13, y: 67, width: 74, height: 22, alignX: 'center', alignY: 'center' }, textScale: 1 }),
  // Fundo has no four-up artwork. This repeats the official A4 plate background in each A4X4 slot.
  createTemplate({ id: 'fundo-a4x4', name: 'A4 4x1', format: 'A4X4', backgroundImage: backgroundA4, backgroundFile: 'a4.png', backgroundScope: 'card', contentBox: individualContent, priceBox: individualPrice, textScale: 0.72 }),
  createTemplate({ id: 'fundo-a4x2-cima-baixo', name: 'A4 2x1', format: 'A4X2_CIMA_BAIXO', backgroundImage: backgroundA4X2, backgroundFile: 'a4x2.png', backgroundScope: 'sheet', backgroundRotation: 0, contentBox: individualContent, priceBox: individualPrice, textScale: 1 }),
  createTemplate({ id: 'fundo-a4x2-invertido', name: 'A4 2x1 Invertido', format: 'A4X2_INVERTIDO', backgroundImage: backgroundA4X2Inverted, backgroundFile: 'a4x2 invertido.png', backgroundScope: 'sheet', backgroundRotation: 0, contentBox: individualContent, priceBox: individualPrice, textScale: 1 }),
  createTemplate({ id: 'fundo-a4x2-app', name: 'A4 2x1 App', format: 'A4X2_APP', backgroundImage: backgroundApp, backgroundFile: 'app.png', backgroundScope: 'sheet', backgroundRotation: 0, contentBox: { x: 8, y: 41, width: 84, height: 36, alignX: 'center', alignY: 'center', gap: 1.5 }, priceBox: { x: 12, y: 81, width: 76, height: 10, alignX: 'center', alignY: 'center' }, textScale: 1 }),
  createTemplate({ id: 'fundo-a4', name: 'A4', format: 'A4', backgroundImage: backgroundA4, backgroundFile: 'a4.png', backgroundScope: 'card', contentBox: individualContent, priceBox: individualPrice, textScale: 1.36 }),
  createTemplate({ id: 'fundo-a3', name: 'A3', format: 'A3', backgroundImage: backgroundA3, backgroundFile: 'a3.png', backgroundScope: 'card', contentBox: { x: 10, y: 12, width: 80, height: 50, alignX: 'center', alignY: 'center', gap: 2 }, priceBox: { x: 13, y: 66, width: 74, height: 23, alignX: 'center', alignY: 'center' }, textScale: 1.9 }),
]

export const DEFAULT_TEMPLATE_BY_FORMAT = Object.fromEntries(POSTER_TEMPLATES.map((template) => [template.format, template.id]))
export function getPosterTemplate(templateId) { return POSTER_TEMPLATES.find((template) => template.id === templateId) || POSTER_TEMPLATES[0] }
export function getPosterTemplatesForFormat(formatId) { return POSTER_TEMPLATES.filter((template) => template.format === formatId) }
export function getDefaultTemplateForFormat(formatId) { return getPosterTemplate(DEFAULT_TEMPLATE_BY_FORMAT[formatId]) }
