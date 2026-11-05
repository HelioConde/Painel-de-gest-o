import test from 'node:test'
import assert from 'node:assert/strict'
import { collectPages } from '../src/utils/collectPages.js'

test('coleta mais de 1000 registros sem truncar resultados', async () => {
  const records = Array.from({ length: 1251 }, (_, id) => ({ id }))
  const bounds = []
  const received = await collectPages(async (from, to) => {
    bounds.push([from, to])
    return { data: records.slice(from, to + 1), error: null }
  }, 500)
  assert.deepEqual(received, records)
  assert.deepEqual(bounds, [[0, 499], [500, 999], [1000, 1499]])
})

test('pagina cheia realiza uma ultima consulta vazia', async () => {
  const records = [1, 2, 3, 4]
  let calls = 0
  const received = await collectPages(async (from, to) => {
    calls += 1
    return { data: records.slice(from, to + 1), error: null }
  }, 2)
  assert.deepEqual(received, records)
  assert.equal(calls, 3)
})

test('propaga erros sem retornar dados incompletos', async () => {
  const expected = new Error('falha de rede')
  await assert.rejects(
    collectPages(async (from) => from === 0
      ? { data: [1, 2], error: null }
      : { data: null, error: expected }, 2),
    expected,
  )
})
