import assert from 'node:assert/strict'
import test from 'node:test'
import { getPageCount, POSTER_FORMATS } from '../config/posterFormats.js'
import { parseProducts } from './posterParser.js'

const SAMPLE = `Pão Francês kg 10,90
Cerveja Heineken Long Neck 300ml 5,99
Coca Cola Zero 2L 9,99
Leite Condensado Moça 395g 7,49
Sabão em Pó Tixan Ypê Maciez Rosa 1,6kg 24,90`

test('interpreta uma linha por produto e separa preço e gramatura', () => {
  const products = parseProducts(SAMPLE)
  assert.equal(products.length, 5)
  assert.deepEqual(products[1], {
    id: products[1].id,
    description: 'CERVEJA',
    subdescription: 'HEINEKEN',
    complement: 'LONG NECK',
    unit: '300ML',
    price: '5,99',
  })
  assert.equal(products[4].description, 'SABÃO EM PÓ')
  assert.equal(products[4].unit, '1,6KG')
})

test('ignora linhas vazias e mantém ids estáveis', () => {
  const first = parseProducts(`${SAMPLE}\n\n`)
  const second = parseProducts(SAMPLE)
  assert.deepEqual(first.map(({ id }) => id), second.map(({ id }) => id))
})

test('interpreta entrada estruturada da direita para a esquerda sem quebrar o preço brasileiro', () => {
  const [withComplement, withoutComplement] = parseProducts(`VINHO, TORO, ROSE, 750ML, 28,99
ARROZ, PRIMOR, 5KG, 19,90`)
  assert.deepEqual(withComplement, {
    id: withComplement.id,
    description: 'VINHO',
    subdescription: 'TORO',
    complement: 'ROSE',
    unit: '750ML',
    price: '28,99',
  })
  assert.equal(withoutComplement.description, 'ARROZ')
  assert.equal(withoutComplement.subdescription, 'PRIMOR')
  assert.equal(withoutComplement.complement, '')
  assert.equal(withoutComplement.unit, '5KG')
  assert.equal(withoutComplement.price, '19,90')
})

test('entrada com vírgulas inválida volta ao parser automático', () => {
  const [product] = parseProducts('Café, especial pacote 500g 18,90')
  assert.equal(product.price, '18,90')
  assert.equal(product.unit, '500G')
})

test('calcula folhas sem confundir produtos e cartazes', () => {
  assert.equal(getPageCount(4, POSTER_FORMATS.A4X4), 1)
  assert.equal(getPageCount(5, POSTER_FORMATS.A4X4), 2)
  assert.equal(getPageCount(2, POSTER_FORMATS.A4X2_CIMA_BAIXO), 1)
  assert.equal(getPageCount(3, POSTER_FORMATS.A4X2_CIMA_BAIXO), 2)
  assert.equal(getPageCount(8, POSTER_FORMATS.A4X2_CIMA_BAIXO), 4)
  assert.equal(getPageCount(8, POSTER_FORMATS.A4X4), 2)
  assert.equal(getPageCount(2, POSTER_FORMATS.A4), 2)
  assert.equal(getPageCount(2, POSTER_FORMATS.A5), 2)
  assert.equal(getPageCount(8, POSTER_FORMATS.A3), 8)
})
