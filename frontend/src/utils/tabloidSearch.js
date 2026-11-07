export function normalizeTabloidSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

// Compatível com famílias e variantes do tabloide atual.
// Palavras em qualquer ordem; código e descrição permanecem pesquisáveis.
export function filterTabloidFamilies(groups = [], query = '') {
  const words = normalizeTabloidSearch(query).split(' ').filter(Boolean)
  if (!words.length) return groups
  return groups.filter((group) => {
    const terms = [
      group?.name,
      ...(group?.rows || []).flatMap((row) => [
        row?.product_code,
        row?.product_name,
        row?.variant_name,
        row?.family_name,
      ]),
    ]
    const text = normalizeTabloidSearch(terms.join(' '))
    return words.every((word) => text.includes(word))
  })
}
