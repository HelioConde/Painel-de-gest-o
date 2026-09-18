export const POSTER_FORMATS = {
  A4_4X1: {
    id: 'A4_4X1',
    label: 'A4 4x1',
    paper: 'A4',
    widthMm: 210,
    heightMm: 297,
    postersPerSheet: 4,
    columns: 2,
    rows: 2,
    orientation: 'portrait',
    supportsInvertSecond: false,
  },
  A4_2X1: {
    id: 'A4_2X1',
    label: 'A4 2x1',
    paper: 'A4',
    widthMm: 210,
    heightMm: 297,
    postersPerSheet: 2,
    columns: 1,
    rows: 2,
    orientation: 'portrait',
    supportsInvertSecond: true,
  },
  A4: {
    id: 'A4',
    label: 'A4',
    paper: 'A4',
    widthMm: 210,
    heightMm: 297,
    postersPerSheet: 1,
    columns: 1,
    rows: 1,
    orientation: 'portrait',
    supportsInvertSecond: false,
  },
  A5: {
    id: 'A5',
    label: 'A5',
    paper: 'A5',
    widthMm: 148,
    heightMm: 210,
    postersPerSheet: 1,
    columns: 1,
    rows: 1,
    orientation: 'portrait',
    supportsInvertSecond: false,
  },
  A3: {
    id: 'A3',
    label: 'A3',
    paper: 'A3',
    widthMm: 297,
    heightMm: 420,
    postersPerSheet: 1,
    columns: 1,
    rows: 1,
    orientation: 'portrait',
    supportsInvertSecond: false,
  },
}

export const POSTER_FORMAT_OPTIONS = Object.values(POSTER_FORMATS)

export function getPosterFormat(formatId) {
  return POSTER_FORMATS[formatId] || POSTER_FORMATS.A4_4X1
}

export function getPageCount(productCount, format) {
  if (!productCount) return 1
  return Math.ceil(productCount / format.postersPerSheet)
}
