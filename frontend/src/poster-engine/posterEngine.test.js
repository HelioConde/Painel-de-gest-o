import assert from 'node:assert/strict'
import test from 'node:test'
import { POSTER_FORMATS } from '../config/posterFormats.js'
import { createPosterLayout } from './layoutPlan.js'
import { parseProductLine } from './parseProduct.js'
import { estimateTextMeasure } from './textMeasure.js'

const PARSER_FIXTURES = [
  ['Pão Francês kg 10,90', 'PÃO FRANCÊS', '', '', 'KG', '10,90'],
  ['Cerveja Heineken Long Neck 300ml 5,99', 'CERVEJA', 'HEINEKEN', 'LONG NECK', '300ML', '5,99'],
  ['Coca Cola Zero 2L 9,99', 'COCA COLA', 'ZERO', '', '2L', '9,99'],
  ['Leite Condensado Moça 395g 7,49', 'LEITE CONDENSADO', 'MOÇA', '', '395G', '7,49'],
  ['Sabão em Pó Tixan Ypê Maciez Rosa 1,6kg 24,90', 'SABÃO EM PÓ', 'TIXAN', 'YPÊ MACIEZ ROSA', '1,6KG', '24,90'],
  ['Tixan Ypê 1,6kg 24,90', 'TIXAN YPÊ', '', '', '1,6KG', '24,90'],
  ['Amstel 350ml 4,99', 'AMSTEL', '', '', '350ML', '4,99'],
  ['Limpol Limão 500ml 3,99', 'LIMPOL', 'LIMÃO', '', '500ML', '3,99'],
  ['Arroz Tipo 1 5kg 19,90', 'ARROZ', 'TIPO', '1', '5KG', '19,90'],
  ['Biscoito Recheado Chocolate 140g 4,99', 'BISCOITO RECHEADO', 'CHOCOLATE', '', '140G', '4,99'],
  ['Café Torrado Moído 500g 18,90', 'CAFÉ', 'TORRADO', 'MOÍDO', '500G', '18,90'],
  ['Açúcar Cristal 5kg 17,99', 'AÇÚCAR', 'CRISTAL', '', '5KG', '17,99'],
  ['Óleo Soja 900ml 8,49', 'ÓLEO', 'SOJA', '', '900ML', '8,49'],
  ['Iogurte Natural 170g 3,99', 'IOGURTE', 'NATURAL', '', '170G', '3,99'],
  ['Margarina com Sal 500g 7,99', 'MARGARINA COM', 'SAL', '', '500G', '7,99'],
  ['Batata Lavada kg 6,99', 'BATATA', 'LAVADA', '', 'KG', '6,99'],
  ['Filé Peito Frango kg 19,90', 'FILÉ', 'PEITO', 'FRANGO', 'KG', '19,90'],
  ['Pizza Primor Grande und 29,99', 'PIZZA', 'PRIMOR', 'GRANDE', 'UND', '29,99'],
  ['Água Sanitária 2L 4,99', 'ÁGUA', 'SANITÁRIA', '', '2L', '4,99'],
  ['Sabonete Dove 90g 4,49', 'SABONETE', 'DOVE', '', '90G', '4,49'],
]

function createTestTemplate() {
  const text = (fontMin, fontMax, scale = 1) => ({ fontMin, fontMax, fontWeight: 900, lineHeight: 0.94, letterSpacing: 0, scale })
  return {
    contentBox: { x: 10, y: 8, width: 80, height: 52, alignX: 'center', alignY: 'center', gap: 2 },
    priceBox: { x: 12, y: 68, width: 76, height: 20, alignX: 'center', alignY: 'center' },
    textStyles: {
      description: text(3.2, 15), subdescription: text(3.2, 15), complement: text(3.2, 15),
      unit: text(2.8, 10, 0.72), price: text(7, 34),
    },
  }
}

test('mantém 20 fixtures de entrada de produto com campos determinísticos', () => {
  PARSER_FIXTURES.forEach(([line, description, subdescription, complement, unit, price], index) => {
    const product = parseProductLine(line, index)
    assert.deepEqual(
      [product.description, product.subdescription, product.complement, product.unit, product.price],
      [description, subdescription, complement, unit, price],
      line,
    )
  })
})



test('mantém conectores no fim da linha anterior em vez de iniciar uma nova linha', () => {
  const pao = parseProductLine('Pão de queijo kg 20,90')
  assert.deepEqual(
    [pao.description, pao.subdescription, pao.complement],
    ['PÃO DE', 'QUEIJO', ''],
  )

  const creme = parseProductLine('Creme para pentear 300ml 8,99')
  assert.equal(creme.description, 'CREME PARA PENTEAR')

  const margarina = parseProductLine('Margarina com Sal 500g 7,99')
  assert.deepEqual(
    [margarina.description, margarina.subdescription, margarina.complement],
    ['MARGARINA COM', 'SAL', ''],
  )
})

test('produz um plano determinístico dentro das contentBox e priceBox independentes', () => {
  const format = POSTER_FORMATS.A4X2_CIMA_BAIXO
  const template = createTestTemplate()
  const product = parseProductLine('Cerveja Heineken Long Neck 300ml 999,90')
  const first = createPosterLayout({ product, template, format, measure: estimateTextMeasure })
  const second = createPosterLayout({ product, template, format, measure: estimateTextMeasure })
  assert.deepEqual(first, second)
  first.content.lines.forEach((line) => {
    assert.ok(line.x >= -0.01)
    assert.ok(line.x + line.width <= 100.01)
    assert.ok(line.y >= -0.01)
    assert.ok(line.y + line.height <= 100.01)
  })
  assert.ok(first.price.x >= -0.01)
  assert.ok(first.price.x + first.price.width <= 100.01)
  assert.ok(first.price.y >= -0.01)
  assert.ok(first.price.y + first.price.height <= 100.01)
  assert.ok(first.price.fontSizeMm < template.textStyles.price.fontMax)
})

test('reduz o preço longo sem alterar o plano superior', () => {
  const format = POSTER_FORMATS.A4
  const template = createTestTemplate()
  const base = parseProductLine('Cerveja Heineken Long Neck 300ml 5,99')
  const long = { ...base, price: '999,90' }
  const basePlan = createPosterLayout({ product: base, template, format, measure: estimateTextMeasure })
  const longPlan = createPosterLayout({ product: long, template, format, measure: estimateTextMeasure })
  assert.deepEqual(basePlan.content.lines, longPlan.content.lines)
  assert.ok(longPlan.price.fontSizeMm < basePlan.price.fontSizeMm)
})

test('usa o máximo válido para o stack superior e mantém a gramatura logo abaixo', () => {
  const template = createTestTemplate()
  template.contentBox = { ...template.contentBox, width: 82, height: 52 }
  const product = parseProductLine('Cerveja Heineken Long Neck 300ml 5,99')
  const plan = createPosterLayout({ product, template, format: POSTER_FORMATS.A4, measure: estimateTextMeasure })
  const copy = plan.content.lines.filter((line) => line.field !== 'unit')
  assert.ok(copy.every((line) => line.fontSizeMm >= template.textStyles[line.field].fontMin))
  assert.ok(copy.every((line) => line.fontSizeMm <= template.textStyles[line.field].fontMax * 1.42 + 0.01))
  assert.ok(plan.content.lines.at(-1).field === 'unit')
  assert.ok(plan.content.lines.at(-1).y > copy.at(-1).y + copy.at(-1).height)
  assert.ok(plan.price.width <= 100)
  assert.ok(plan.price.height <= 100)
})

test('não para no teto visual antigo quando a caixa ainda possui espaço físico', () => {
  const template = createTestTemplate()
  template.contentBox = { ...template.contentBox, width: 82, height: 52 }
  template.textStyles.description.fontMax = 48
  template.textStyles.subdescription.fontMax = 48
  template.textStyles.complement.fontMax = 48
  const plan = createPosterLayout({
    product: parseProductLine('Cerveja Heineken Long Neck 300ml 5,99'),
    template,
    format: POSTER_FORMATS.A4,
    measure: estimateTextMeasure,
  })
  assert.ok(plan.content.lines[0].fontSizeMm > 20.4)
  assert.ok(plan.content.lines[0].fontSizeMm <= 48 * 1.28 + 0.01)
})

test('escala o preço pela região física disponível em cada grid', () => {
  const template = createTestTemplate()
  const product = parseProductLine('Cerveja Heineken Long Neck 300ml 5,99')
  const compact = createPosterLayout({ product, template, format: POSTER_FORMATS.A4X4, measure: estimateTextMeasure })
  const standard = createPosterLayout({ product, template, format: POSTER_FORMATS.A4, measure: estimateTextMeasure })
  const large = createPosterLayout({ product, template, format: POSTER_FORMATS.A3, measure: estimateTextMeasure })
  assert.ok(compact.price.fontSizeMm < standard.price.fontSizeMm)
  assert.ok(standard.price.fontSizeMm < large.price.fontSizeMm)
  ;[compact, standard, large].forEach((plan) => {
    assert.ok(plan.price.width <= 100)
    assert.ok(plan.price.height <= 100)
  })
})

test('calcula geometria física para todos os sete formatos suportados', () => {
  const template = createTestTemplate()
  const product = parseProductLine('Cerveja Heineken Long Neck 300ml 5,99')
  ;['A5', 'A4', 'A3', 'A4X2_CIMA_BAIXO', 'A4X2_INVERTIDO', 'A4X2_APP', 'A4X4'].forEach((formatId) => {
    const plan = createPosterLayout({ product, template, format: POSTER_FORMATS[formatId], measure: estimateTextMeasure })
    assert.ok(plan.geometry.poster.widthMm > 0, formatId)
    assert.ok(plan.geometry.poster.heightMm > 0, formatId)
    assert.equal(plan.content.box, template.contentBox)
    assert.equal(plan.price.box, template.priceBox)
  })
})

test('mantém somente a lista oficial de formatos de placa', () => {
  assert.deepEqual(Object.keys(POSTER_FORMATS), [
    'A4X4', 'A4X2_CIMA_BAIXO', 'A4X2_INVERTIDO', 'A4X2_APP', 'A4', 'A5', 'A3',
  ])
  assert.deepEqual(POSTER_FORMATS.A4X2_INVERTIDO.invertedSlots, [0])
  assert.equal(POSTER_FORMATS.A4X2_APP.orientation, 'landscape')
})
