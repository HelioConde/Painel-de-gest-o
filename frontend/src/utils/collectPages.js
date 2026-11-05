/** Busca todas as paginas sem depender do limite padrao do PostgREST. */
export async function collectPages(fetchPage, pageSize = 500) {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize deve ser um inteiro positivo')
  }

  const result = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await fetchPage(offset, offset + pageSize - 1)
    if (error) throw error
    if (!Array.isArray(data)) {
      throw new TypeError('Resposta de pagina invalida')
    }
    result.push(...data)
    if (data.length < pageSize) return result
  }
}
