import test from 'node:test'
import assert from 'node:assert/strict'
import { money, quantity, percent } from './formatters.js'
import { productLossPercent } from './lossRatio.js'

test('missing and invalid metrics are not displayed as measured zeroes', () => {
  for (const value of [null, undefined, '', NaN, Infinity, 'invalid']) {
    assert.equal(money(value), '—')
    assert.equal(quantity(value), '—')
    assert.equal(percent(value), '—')
  }
  assert.match(money(0), /0,00/)
  assert.equal(quantity(0), '0 QTD')
  assert.equal(percent(0), '0,00%')
  assert.equal(percent(-12.5), '-12,50%')
})

test('product loss percentage requires sales and uses the displayed quantities', () => {
  assert.equal(productLossPercent({ loss_quantity: 805.2, quantity_sold: 0, loss_quantity_sales_percent: 0 }), null)
  assert.equal(productLossPercent({ loss_quantity: 6, quantity_sold: 2 }), 300)
  assert.equal(productLossPercent({ loss_quantity: 0, quantity_sold: 10 }), 0)
  assert.equal(productLossPercent({ quantity_sold: 10 }), null)
})
