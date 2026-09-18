import test from 'node:test'
import assert from 'node:assert/strict'
import {
  groupLossProductsByStore,
  isExcludedLossProduct,
  sanitizeLossRow,
} from './lossProducts.js'

function product(code, name, loss, sector = 'PADARIA') {
  return {
    product_code: code,
    product_name: name,
    unit: 'QTD',
    loss_quantity: loss,
    quantity_sold: 100,
    loss_quantity_sales_percent: loss,
    gross_cost_total: loss,
    sale_price_total: loss * 2,
    total_value: loss * 3,
  }
}

function row(storeCode, products) {
  const side = {
    sectors: [{
      name: products[0]?.sector || 'PADARIA',
      mips: [{ name: 'MIP', products }],
      top_losses: products,
    }],
    grand_totals: {},
  }
  return {
    store_code: storeCode,
    store_name: `LOJA ${storeCode}`,
    current_sales_value: 1000,
    previous_sales_value: 900,
    details: { current: side, previous: side },
  }
}

test('excludes MUCHIBA/OSSO by code and normalized name', () => {
  assert.equal(isExcludedLossProduct(product('410364', 'OUTRO', 1)), true)
  assert.equal(isExcludedLossProduct(product('', 'Múchiba/Osso', 1)), true)
  assert.equal(isExcludedLossProduct(product('99', 'COXINHA', 1)), false)
})

test('sanitizes totals before the dashboard aggregates stores', () => {
  const sanitized = sanitizeLossRow(row('307', [
    product('410364', 'MUCHIBA/OSSO', 1210),
    product('20', 'COXINHA', 24.98),
  ]))
  assert.equal(sanitized.current_record_count, 1)
  assert.equal(sanitized.current_loss_quantity, 24.98)
  assert.equal(sanitized.current_total_value, 74.94)
})

test('global search ignores accents and case and groups results by store', () => {
  const rows = [
    row('307', [product('10', 'BÔLO DE MILHO', 3), product('11', 'COCA COLA', 2)]),
    row('212', [product('12', 'BOLO CHOCOLATE', 4)]),
  ]
  const result = groupLossProductsByStore(rows, { query: 'bolo' })
  assert.equal(result.productCount, 2)
  assert.equal(result.storeCount, 2)
  assert.deepEqual(result.groups.map((group) => group.store_code), ['307', '212'])
})

test('excluded product code never appears in search', () => {
  const result = groupLossProductsByStore([
    row('307', [product('410364', 'MUCHIBA/OSSO', 1210)]),
  ], { query: '410364' })
  assert.equal(result.productCount, 0)
  assert.equal(result.storeCount, 0)
})

test('search supports coca and frango partial terms', () => {
  const rows = [row('307', [
    product('1', 'REFR COCA COLA 2L', 5),
    product('2', 'COXINHA DE FRANGO', 4),
  ])]
  assert.equal(groupLossProductsByStore(rows, { query: 'coca' }).productCount, 1)
  assert.equal(groupLossProductsByStore(rows, { query: 'FRANGO' }).productCount, 1)
})

test('sector view groups stores and keeps the top-loss ordering', () => {
  const hortifruti = [
    { ...product('41', 'BATATA INGLESA', 10), sector: 'HORTIFRUTI' },
    { ...product('46', 'CENOURA', 25), sector: 'HORTIFRUTI' },
  ]
  const acougue = [{ ...product('1180', 'COXINHA ASA', 8), sector: 'ACOUGUE' }]
  const rows = [row('307', hortifruti), row('212', acougue)]
  rows[0].details.current.sectors[0].name = 'HORTIFRUTI'
  rows[1].details.current.sectors[0].name = 'ACOUGUE'

  const green = groupLossProductsByStore(rows, { sector: 'HORTIFRUTI', limitPerStore: 10 })
  const meat = groupLossProductsByStore(rows, { sector: 'Açougue', limitPerStore: 10 })

  assert.deepEqual(green.groups.map((group) => group.store_code), ['307'])
  assert.deepEqual(green.groups[0].products.map((item) => item.product_code), ['46', '41'])
  assert.deepEqual(meat.groups.map((group) => group.store_code), ['212'])
})
