export const POSTER_FORMATS = {
  A5: { id: 'A5', label: 'A5', description: 'Uma placa A5', paper: 'A5', widthMm: 148, heightMm: 210, postersPerSheet: 1, columns: 1, rows: 1, orientation: 'portrait', backgroundScope: 'card', invertedSlots: [] },
  A4X4: { id: 'A4X4', label: 'A4 4x1', description: 'Quatro placas em uma folha A4', paper: 'A4', widthMm: 210, heightMm: 297, postersPerSheet: 4, columns: 2, rows: 2, orientation: 'portrait', backgroundScope: 'card', invertedSlots: [] },
  A4X2_CIMA_BAIXO: { id: 'A4X2_CIMA_BAIXO', label: 'A4 2x1', description: 'Duas placas, uma em cima e outra embaixo', paper: 'A4', widthMm: 210, heightMm: 297, postersPerSheet: 2, columns: 1, rows: 2, orientation: 'portrait', backgroundScope: 'sheet', invertedSlots: [] },
  A4X2_INVERTIDO: { id: 'A4X2_INVERTIDO', label: 'A4 2x1 Invertido', description: 'Duas placas verticais com a superior invertida', paper: 'A4', widthMm: 210, heightMm: 297, postersPerSheet: 2, columns: 1, rows: 2, orientation: 'portrait', backgroundScope: 'sheet', invertedSlots: [0] },
  A4X2_APP: { id: 'A4X2_APP', label: 'A4 2x1 App', description: 'Duas placas lado a lado em uma folha A4', paper: 'A4', widthMm: 297, heightMm: 210, postersPerSheet: 2, columns: 2, rows: 1, orientation: 'landscape', backgroundScope: 'sheet', invertedSlots: [] },
  A4: { id: 'A4', label: 'A4', description: 'Uma placa A4', paper: 'A4', widthMm: 210, heightMm: 297, postersPerSheet: 1, columns: 1, rows: 1, orientation: 'portrait', backgroundScope: 'card', invertedSlots: [] },
  A3: { id: 'A3', label: 'A3', description: 'Uma placa A3', paper: 'A3', widthMm: 297, heightMm: 420, postersPerSheet: 1, columns: 1, rows: 1, orientation: 'portrait', backgroundScope: 'card', invertedSlots: [] },
}

export const POSTER_FORMAT_OPTIONS = Object.values(POSTER_FORMATS)

export function getPosterFormat(formatId) {
  return POSTER_FORMATS[formatId] || POSTER_FORMATS.A4X4
}

export function getPageCount(productCount, format) {
  if (!productCount) return 1
  return Math.ceil(productCount / format.postersPerSheet)
}
