export const POSTER_FORMATS = {
  A4X4: { id: 'A4X4', label: 'A4 4x1', description: '4 placas por folha A4', pickerBadge: '4 por folha', paper: 'A4', widthMm: 210, heightMm: 297, postersPerSheet: 4, columns: 2, rows: 2, orientation: 'portrait', backgroundScope: 'card', invertedSlots: [] },
  A4X2_CIMA_BAIXO: { id: 'A4X2_CIMA_BAIXO', label: 'A4 2x1', description: '2 placas, cima e baixo', pickerBadge: '2 vertical', paper: 'A4', widthMm: 210, heightMm: 297, postersPerSheet: 2, columns: 1, rows: 2, orientation: 'portrait', backgroundScope: 'sheet', invertedSlots: [] },
  A4X2_INVERTIDO: { id: 'A4X2_INVERTIDO', label: 'A4 2x1 Invertido', description: '2 placas, superior invertida', pickerBadge: '2 + invertido', paper: 'A4', widthMm: 210, heightMm: 297, postersPerSheet: 2, columns: 1, rows: 2, orientation: 'portrait', backgroundScope: 'sheet', invertedSlots: [0] },
  A4X2_APP: { id: 'A4X2_APP', label: 'A4 2x1 App', description: '2 placas, esquerda e direita', pickerBadge: '2 horizontal', paper: 'A4', widthMm: 297, heightMm: 210, postersPerSheet: 2, columns: 2, rows: 1, orientation: 'landscape', backgroundScope: 'sheet', invertedSlots: [] },
  A4: { id: 'A4', label: 'A4', description: '1 placa por folha', pickerBadge: '1 por folha', paper: 'A4', widthMm: 210, heightMm: 297, postersPerSheet: 1, columns: 1, rows: 1, orientation: 'portrait', backgroundScope: 'card', invertedSlots: [] },
  A5: { id: 'A5', label: 'A5', description: '1 placa A5', pickerBadge: 'A5', paper: 'A5', widthMm: 148, heightMm: 210, postersPerSheet: 1, columns: 1, rows: 1, orientation: 'portrait', backgroundScope: 'card', invertedSlots: [] },
  A3: { id: 'A3', label: 'A3', description: '1 placa A3', pickerBadge: 'A3', paper: 'A3', widthMm: 297, heightMm: 420, postersPerSheet: 1, columns: 1, rows: 1, orientation: 'portrait', backgroundScope: 'card', invertedSlots: [] },
}

export const POSTER_FORMAT_OPTIONS = Object.values(POSTER_FORMATS)
export function getPosterFormat(formatId) { return POSTER_FORMATS[formatId] || POSTER_FORMATS.A4X4 }
export function getPageCount(productCount, format) { return productCount ? Math.ceil(productCount / format.postersPerSheet) : 1 }
