import { getPosterTemplate } from '../config/posterTemplates'

const KEY_PREFIX = 'poster-template:'
const BOX_KEYS = ['x', 'y', 'width', 'height']
const ALIGN_X = ['left', 'center', 'right']
const ALIGN_Y = ['top', 'center', 'bottom']

function number(value, fallback, min, max) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function sanitizeBox(saved, fallback, withGap) {
  const box = { ...fallback }
  BOX_KEYS.forEach((key) => { box[key] = number(saved?.[key], fallback[key], 0, 100) })
  box.width = Math.min(box.width, 100 - box.x)
  box.height = Math.min(box.height, 100 - box.y)
  box.alignX = ALIGN_X.includes(saved?.alignX) ? saved.alignX : fallback.alignX
  box.alignY = ALIGN_Y.includes(saved?.alignY) ? saved.alignY : fallback.alignY
  if (withGap) box.gap = number(saved?.gap, fallback.gap, 0, 12)
  return box
}

function sanitizeTextStyles(saved, fallback) {
  return Object.fromEntries(Object.entries(fallback).map(([field, defaults]) => {
    const candidate = saved?.[field] || {}
    return [field, {
      fontMin: number(candidate.fontMin, defaults.fontMin, 0.5, 100),
      fontMax: number(candidate.fontMax, defaults.fontMax, 0.75, 150),
      fontWeight: number(candidate.fontWeight, defaults.fontWeight, 300, 950),
      lineHeight: number(candidate.lineHeight, defaults.lineHeight, 0.7, 1.6),
      letterSpacing: number(candidate.letterSpacing, defaults.letterSpacing, -1, 5),
      scale: number(candidate.scale, defaults.scale, 0.25, 3),
    }]
  }))
}

export function mergePosterTemplate(defaultTemplate, saved = {}) {
  const uploadedGuide = typeof saved.guideImage === 'string' && saved.guideImage.startsWith('data:image/')
    ? saved.guideImage
    : defaultTemplate.guideImage

  return {
    ...defaultTemplate,
    guideImage: uploadedGuide,
    guideVisible: typeof saved.guideVisible === 'boolean' ? saved.guideVisible : defaultTemplate.guideVisible,
    guideOpacity: number(saved.guideOpacity, defaultTemplate.guideOpacity, 0, 1),
    guideRotation: [0, 90, 180, 270].includes(Number(saved.guideRotation)) ? Number(saved.guideRotation) : defaultTemplate.guideRotation,
    guideFit: ['fill', 'contain', 'cover'].includes(saved.guideFit) ? saved.guideFit : defaultTemplate.guideFit,
    guidePositionX: ALIGN_X.includes(saved.guidePositionX) ? saved.guidePositionX : defaultTemplate.guidePositionX,
    guidePositionY: ALIGN_Y.includes(saved.guidePositionY) ? saved.guidePositionY : defaultTemplate.guidePositionY,
    safeArea: number(saved.safeArea, defaultTemplate.safeArea, 0, 20),
    contentBox: sanitizeBox(saved.contentBox, defaultTemplate.contentBox, true),
    priceBox: sanitizeBox(saved.priceBox, defaultTemplate.priceBox, false),
    textStyles: sanitizeTextStyles(saved.textStyles, defaultTemplate.textStyles),
  }
}

export function loadPosterTemplate(templateId) {
  const defaults = getPosterTemplate(templateId)
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${templateId}`)
    return raw ? mergePosterTemplate(defaults, JSON.parse(raw)) : structuredClone(defaults)
  } catch {
    return structuredClone(defaults)
  }
}

export function savePosterTemplate(template) {
  const guideImage = template.guideImage?.startsWith('data:image/') ? template.guideImage : null
  const persistable = { ...template, guideImage }
  window.localStorage.setItem(`${KEY_PREFIX}${template.id}`, JSON.stringify(persistable))
}

export function resetPosterTemplate(templateId) {
  window.localStorage.removeItem(`${KEY_PREFIX}${templateId}`)
  return structuredClone(getPosterTemplate(templateId))
}
