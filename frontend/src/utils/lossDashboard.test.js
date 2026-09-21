import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTopLossesBySector } from './lossDashboard.js'

function product(code, name, { loss, sold, value, unit = 'KG' }) {
  return {
    product_code: code,
    product_name: name,
    unit,
    loss_quantity: loss,
    quantity_sold: sold,
    total_value: value,
    gross_cost_total: value / 2,
    sale_price_total: value,
  }
}

function side(products) {
  return {
    sectors: [{ name: 'PADARIA', mips: [{ name: 'PERDA PADARIA', products }] }],
  }
}

function fixture() {
  return {
    details: {
      current: side([
        product('635', 'PAO HOT DOG KG', { loss: 3, sold: 100, value: 50 }),
        product('635', 'PAO HOT DOG KG', { loss: 5, sold: 100, value: 70 }),
        product('999', 'SEM VENDA', { loss: 2, sold: 0, value: 150 }),
        product('777', 'PERCENTUAL ALTO', { loss: 50, sold: 10, value: 30 }),
        product('410364', 'MUCHIBA/OSSO', { loss: 100, sold: 100, value: 500 }),
      ]),
      previous: side([
        product('635', 'PAO HOT DOG KG ANTIGO', { loss: 4, sold: 100, value: 80 }),
        product('777', 'PERCENTUAL ALTO', { loss: 10, sold: 10, value: 10 }),
      ]),
    },
  }
}

function padaria(row, ranking = 'value') {
  return buildTopLossesBySector(row, ranking).find((sector) => sector.name === 'PADARIA')
}

test('groups the same product by sector and code before the ranking', () => {
  const sector = padaria(fixture())
  const hotDog = sector.products.find((item) => item.product_code === '635')

  assert.equal(sector.productCount, 3)
  assert.equal(sector.totalValue, 300)
  assert.equal(hotDog.loss_quantity, 8)
  assert.equal(hotDog.quantity_sold, 100)
  assert.equal(hotDog.total_value, 120)
  assert.equal(hotDog.loss_quantity_sales_percent, 8)
  assert.equal(hotDog.comparison.kind, 'up')
  assert.equal(hotDog.comparison.value, 50)
})

test('keeps the configured excluded product out of ranking and sector total', () => {
  const sector = padaria(fixture())
  assert.equal(sector.products.some((item) => item.product_code === '410364'), false)
  assert.equal(sector.totalValue, 300)
})

test('ranks by value, quantity, and loss percent independently', () => {
  const row = fixture()
  assert.equal(padaria(row, 'value').products[0].product_code, '999')
  assert.equal(padaria(row, 'quantity').products[0].product_code, '777')
  assert.equal(padaria(row, 'percent').products[0].product_code, '777')
})

test('uses an undefined percent when sales are zero and permits percent above 100', () => {
  const sector = padaria(fixture())
  assert.equal(sector.products.find((item) => item.product_code === '999').loss_quantity_sales_percent, null)
  assert.equal(sector.products.find((item) => item.product_code === '777').loss_quantity_sales_percent, 500)
})

test('matches previous products by code and identifies products without history', () => {
  const sector = padaria(fixture())
  assert.equal(sector.products.find((item) => item.product_code === '635').comparison.kind, 'up')
  assert.equal(sector.products.find((item) => item.product_code === '999').comparison.kind, 'new')
})

test('limits after aggregation and keeps the whole sector total', () => {
  const products = Array.from({ length: 12 }, (_, index) => product(
    String(index + 1),
    `PRODUTO ${index + 1}`,
    { loss: index + 1, sold: 100, value: index + 1 },
  ))
  const sector = padaria({ details: { current: side(products), previous: side([]) } })
  assert.equal(sector.products.length, 10)
  assert.equal(sector.productCount, 12)
  assert.equal(sector.totalValue, 78)
})
