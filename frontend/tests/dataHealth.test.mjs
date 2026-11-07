import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProductPriceAnomalies } from '../src/utils/dataHealth.js'

test('detecta divergência financeira no mesmo produto entre lojas', () => {
  const rows = ['307','212','600','120','033','018'].map((store_code) => ({
    store_code, product_code: '89', product_name: 'LING SEARA SUINA KG',
    quantity: 100, sales_value: store_code === '212' ? 42287.5 : 1399,
  }))
  const anomalies = detectProductPriceAnomalies(rows)
  assert.equal(anomalies.length, 1)
  assert.equal(anomalies[0].store_code, '212')
  assert.equal(anomalies[0].benchmark, 13.99)
})

test('não inventa anomalia com dados incompletos ou poucas lojas', () => {
  assert.deepEqual(detectProductPriceAnomalies([
    {store_code: '307', product_code: '89', quantity: 0, sales_value: 100000},
    {store_code: '212', product_code: '89', quantity: 2, sales_value: 100000},
  ]), [])
})
