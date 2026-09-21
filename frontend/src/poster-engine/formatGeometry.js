export const PYTHON_REFERENCE_GEOMETRY = {
  A4X2_CIMA_BAIXO: { marginMm: 9, gapMm: 6 },
  A4X2_INVERTIDO: { marginMm: 9, gapMm: 6 },
  A4X2_APP: { marginMm: 9, gapMm: 6 },
  A4X4: { marginMm: 9, gapMm: 6 },
}

export function getPosterGeometry(format) {
  const widthMm = format.widthMm / format.columns
  const heightMm = format.heightMm / format.rows
  return {
    paperWidthMm: format.widthMm,
    paperHeightMm: format.heightMm,
    posterWidthMm: widthMm,
    posterHeightMm: heightMm,
    poster: { widthMm, heightMm },
    // React templates are calibrated against full slots and physical guide art.
    // Keep this geometry until individual templates opt into printable margins.
    marginMm: 0,
    gapMm: 0,
  }
}
