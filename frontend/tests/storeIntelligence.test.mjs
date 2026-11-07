import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStoreIntelligence, rankLossProducts } from '../src/utils/storeIntelligence.js'
import { filterTabloidFamilies } from '../src/utils/tabloidSearch.js'
import { canAccessRoute, hasPermission } from '../src/auth/permissions.js'

const store = (store_code, current_value, previous_value) => ({
  store_code,
  store_name: `Supermercado ${store_code}`,
  current_value,
  previous_value,
})
const saleSnapshot = (stores) => ({
  current_start: '2026-11-01',
  current_end: '2026-11-06',
  details: { stores },
})
const lossRun = (rows, end = '2026-11-06') => ({
  current_start: '2026-11-01',
  current_end: end,
  rows,
})

test('não trata loja ausente como zero ou rede completa', () => {
  const result = buildStoreIntelligence({
    salesSnapshot: saleSnapshot([store('307', 9000, 10000)]),
    lossRun: lossRun([{ store_code: '307', current_total_value: 400, current_sales_value: 10000 }]),
  })
  assert.equal(result.stores.length, 6)
  assert.deepEqual(result.missingSales, ['212', '600', '120', '033', '018'])
  assert.deepEqual(result.missingLosses, ['212', '600', '120', '033', '018'])
  assert.equal(result.totals.sales, null)
  assert.equal(result.totals.loss, null)
  assert.equal(result.totals.lossRate, null)
  assert.equal(result.stores[1].salesValue, null)
  assert.equal(result.stores[0].salesVariation, -10)
  assert.equal(result.stores[0].lossRate, 4)
})

test('compara períodos apenas quando datas de vendas e perdas coincidem', () => {
  const sales = saleSnapshot([store('307', 100, 80)])
  assert.equal(buildStoreIntelligence({ salesSnapshot: sales, lossRun: lossRun([], '2026-11-05') }).alignedPeriods, false)
  assert.equal(buildStoreIntelligence({ salesSnapshot: sales, lossRun: lossRun([], '2026-11-06') }).alignedPeriods, true)
  assert.equal(buildStoreIntelligence({ salesSnapshot: sales }).alignedPeriods, false)
})

test('calcula excesso teórico contra a meta usando faturamento do mesmo setor', () => {
  const result = buildStoreIntelligence({
    lossRun: lossRun([{
      store_code: '307',
      current_total_value: 400,
      current_sales_value: 10000,
      details: {
        current: {
          sectors: [{
            name: 'ACOUGUE',
            reported_totals: { total_value: 400 },
            sales_context: { sales_value: 10000 },
          }],
        },
      },
    }]),
  })
  assert.equal(result.stores[0].exceededTargets, 1)
  assert.equal(result.hotspots[0].sector, 'ACOUGUE')
  assert.equal(result.hotspots[0].target, 1)
  assert.equal(result.hotspots[0].current, 4)
  assert.equal(result.hotspots[0].theoreticalExcess, 300)
})

test('evita agregação de taxa percentual por média simples', () => {
  const codes = ['307', '212', '600', '120', '033', '018']
  const rows = codes.map((code, index) => ({
    store_code: code,
    current_total_value: index ? 10 : 100,
    current_sales_value: index ? 100 : 10000,
  }))
  const result = buildStoreIntelligence({ lossRun: lossRun(rows) })
  assert.equal(result.completeLosses, true)
  assert.equal(result.totals.loss, 150)
  assert.ok(Math.abs(result.totals.lossRate - (150 / 10500) * 100) < 1e-9)
})

test('cada perfil lê apenas módulos permitidos no comparativo', () => {
  assert.equal(canAccessRoute('atendimento', '/comparativo'), false)
  assert.equal(canAccessRoute('gerencia', '/comparativo'), true)
  assert.equal(canAccessRoute('prevencao', '/comparativo'), true)
  assert.equal(canAccessRoute('admin', '/comparativo'), true)
  assert.equal(hasPermission('gerencia', 'perdas'), false)
  assert.equal(hasPermission('prevencao', 'vendaMensal'), false)
})

test('pesquisa de produtos localiza códigos, acentos e palavras em ordem livre', () => {
  const groups = [
    {
      name: 'Pão francês',
      rows: [{ product_code: '00123', product_name: 'PÃO FRANCÊS 50G', variant_name: '50g' }],
    },
    { name: 'Açúcar cristal', rows: [{ product_code: '0098', product_name: 'AÇÚCAR CRISTAL' }] },
  ]
  assert.equal(filterTabloidFamilies(groups, 'pao 00123')[0].name, 'Pão francês')
  assert.equal(filterTabloidFamilies(groups, 'cristal acucar')[0].name, 'Açúcar cristal')
  assert.equal(filterTabloidFamilies(groups, 'sem produto').length, 0)
  assert.equal(filterTabloidFamilies(groups, '').length, 2)
})

test('NOVO: agrupa perdas por código de produto sem misturar snapshots de períodos distintos', () => {
  const rows = ['307','212'].map((store_code, i) => ({
    store_code,
    details: { current: { sectors: [{
      name: 'PADARIA', mips: [{ products: [{
        product_code: '403', product_name: 'BOLO MANDIOCA KG', total_value: i === 0 ? 300 : 200,
      }] }],
    }] } },
  }))
  const ranked = rankLossProducts(rows)
  assert.equal(ranked.length, 1)
  assert.equal(ranked[0].code, '403')
  assert.equal(ranked[0].storeCount, 2)
  assert.equal(ranked[0].lossValue, 500)
})
