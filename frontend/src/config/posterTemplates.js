import appPrimorA5 from '../assets/poster-guides/app-primor-a5.jpg'
import ofertaAmarelaA4 from '../assets/poster-guides/oferta-amarela-a4.jpg'
import ofertaClassicaA5 from '../assets/poster-guides/oferta-classica-a5.jpg'
import ofertaFaixaA5 from '../assets/poster-guides/oferta-faixa-a5.jpg'
import ofertaPrimorA4 from '../assets/poster-guides/oferta-primor-a4.jpg'
import guideA3 from '../../Fundo/a3.png'
import guideA4 from '../../Fundo/a4.png'
import guideA5 from '../../Fundo/a5.png'

const baseTextStyles = {
  description: { fontMin: 3.2, fontMax: 15, fontWeight: 900, lineHeight: 0.94, letterSpacing: 0, scale: 1 },
  subdescription: { fontMin: 3.2, fontMax: 15, fontWeight: 900, lineHeight: 0.94, letterSpacing: 0, scale: 1 },
  complement: { fontMin: 3.2, fontMax: 15, fontWeight: 900, lineHeight: 0.94, letterSpacing: 0, scale: 1 },
  unit: { fontMin: 2.8, fontMax: 10, fontWeight: 900, lineHeight: 0.96, letterSpacing: 0, scale: 0.72 },
  price: { fontMin: 7, fontMax: 34, fontWeight: 900, lineHeight: 0.88, letterSpacing: 0, scale: 1 },
}

function scaledTextStyles(scale) {
  return Object.fromEntries(Object.entries(baseTextStyles).map(([field, style]) => [
    field,
    {
      ...style,
      fontMin: Number((style.fontMin * scale).toFixed(2)),
      fontMax: Number((style.fontMax * scale).toFixed(2)),
    },
  ]))
}

function createTemplate({
  id,
  name,
  format,
  guideImage = null,
  guideOpacity = 0.5,
  guideRotation = 0,
  guideFit = 'fill',
  guidePositionX = 'center',
  guidePositionY = 'center',
  contentBox = { x: 8, y: 7, width: 84, height: 53, alignX: 'center', alignY: 'center', gap: 2 },
  priceBox = { x: 10, y: 66, width: 80, height: 26, alignX: 'center', alignY: 'center' },
  textScale = 1,
}) {
  return {
    id,
    name,
    format,
    guideImage,
    guideVisible: Boolean(guideImage),
    guideOpacity,
    guideRotation,
    guideFit,
    guidePositionX,
    guidePositionY,
    safeArea: 3,
    contentBox,
    priceBox,
    textStyles: scaledTextStyles(textScale),
    configVersion: 1,
  }
}

export const POSTER_TEMPLATES = [
  createTemplate({ id: 'limpo-a4-4x1', name: 'Limpo A4 4x1', format: 'A4_4X1', textScale: 0.72 }),
  createTemplate({
    id: 'app-primor-a4-4x1',
    name: 'App Primor A4 4x1',
    format: 'A4_4X1',
    guideImage: appPrimorA5,
    contentBox: { x: 8, y: 41, width: 84, height: 36, alignX: 'center', alignY: 'center', gap: 1.5 },
    priceBox: { x: 12, y: 81, width: 76, height: 10, alignX: 'center', alignY: 'center' },
    textScale: 0.66,
  }),
  createTemplate({
    id: 'faixa-primor-a4-4x1',
    name: 'Faixa Primor A4 4x1',
    format: 'A4_4X1',
    guideImage: ofertaFaixaA5,
    contentBox: { x: 8, y: 14, width: 84, height: 46, alignX: 'center', alignY: 'center', gap: 1.5 },
    priceBox: { x: 18, y: 62, width: 64, height: 23, alignX: 'center', alignY: 'center' },
    textScale: 0.7,
  }),
  createTemplate({ id: 'limpo-a4-2x1', name: 'Limpo A4 2x1', format: 'A4_2X1', textScale: 1 }),
  createTemplate({
    id: 'placa-a4-2x1',
    name: 'Placa A4 2x1',
    format: 'A4_2X1',
    guideImage: ofertaFaixaA5,
    guideRotation: 270,
    contentBox: { x: 18, y: 8, width: 70, height: 58, alignX: 'center', alignY: 'center', gap: 2 },
    priceBox: { x: 18, y: 69, width: 64, height: 22, alignX: 'center', alignY: 'center' },
    textScale: 1,
  }),
  createTemplate({
    id: 'oferta-classica-a4-2x1',
    name: 'Oferta Clássica A4 2x1',
    format: 'A4_2X1',
    guideImage: ofertaClassicaA5,
    contentBox: { x: 10, y: 8, width: 70, height: 52, alignX: 'center', alignY: 'center', gap: 2 },
    priceBox: { x: 12, y: 63, width: 67, height: 27, alignX: 'center', alignY: 'center' },
    textScale: 1,
  }),
  createTemplate({
    id: 'oferta-amarela-a4-2x1',
    name: 'Oferta Amarela A4 2x1',
    format: 'A4_2X1',
    guideImage: ofertaAmarelaA4,
    contentBox: { x: 9, y: 9, width: 73, height: 50, alignX: 'center', alignY: 'center', gap: 2 },
    priceBox: { x: 12, y: 62, width: 70, height: 29, alignX: 'center', alignY: 'center' },
    textScale: 1,
  }),
  createTemplate({
    id: 'oferta-primor-a4-2x1',
    name: 'Oferta Primor A4 2x1',
    format: 'A4_2X1',
    guideImage: ofertaPrimorA4,
    contentBox: { x: 8, y: 13, width: 77, height: 47, alignX: 'center', alignY: 'center', gap: 2 },
    priceBox: { x: 12, y: 63, width: 72, height: 27, alignX: 'center', alignY: 'center' },
    textScale: 1,
  }),
  createTemplate({ id: 'limpo-a4', name: 'Limpo A4', format: 'A4', textScale: 1.36 }),
  createTemplate({
    id: 'placa-a4',
    name: 'Placa A4',
    format: 'A4',
    guideImage: guideA4,
    guideRotation: 270,
    contentBox: { x: 9, y: 10, width: 82, height: 52, alignX: 'center', alignY: 'center', gap: 2 },
    priceBox: { x: 12, y: 66, width: 76, height: 24, alignX: 'center', alignY: 'center' },
    textScale: 1.36,
  }),
  createTemplate({ id: 'limpo-a5', name: 'Limpo A5', format: 'A5', textScale: 1 }),
  createTemplate({
    id: 'placa-a5',
    name: 'Placa A5',
    format: 'A5',
    guideImage: guideA5,
    guideRotation: 270,
    contentBox: { x: 10, y: 11, width: 80, height: 52, alignX: 'center', alignY: 'center', gap: 2 },
    priceBox: { x: 13, y: 67, width: 74, height: 22, alignX: 'center', alignY: 'center' },
    textScale: 1,
  }),
  createTemplate({ id: 'limpo-a3', name: 'Limpo A3', format: 'A3', textScale: 1.9 }),
  createTemplate({
    id: 'placa-a3',
    name: 'Placa A3',
    format: 'A3',
    guideImage: guideA3,
    guideRotation: 270,
    contentBox: { x: 10, y: 12, width: 80, height: 50, alignX: 'center', alignY: 'center', gap: 2 },
    priceBox: { x: 13, y: 66, width: 74, height: 23, alignX: 'center', alignY: 'center' },
    textScale: 1.9,
  }),
]

export const DEFAULT_TEMPLATE_BY_FORMAT = {
  A4_4X1: 'app-primor-a4-4x1',
  A4_2X1: 'placa-a4-2x1',
  A4: 'placa-a4',
  A5: 'placa-a5',
  A3: 'placa-a3',
}

export function getPosterTemplate(templateId) {
  return POSTER_TEMPLATES.find((template) => template.id === templateId) || POSTER_TEMPLATES[0]
}

export function getPosterTemplatesForFormat(formatId) {
  return POSTER_TEMPLATES.filter((template) => template.format === formatId)
}

export function getDefaultTemplateForFormat(formatId) {
  return getPosterTemplate(DEFAULT_TEMPLATE_BY_FORMAT[formatId])
}
