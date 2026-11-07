
import test from 'node:test'
import assert from 'node:assert/strict'
import { actionPlanLink, buildOpportunityRadar, diagnoseSales, lossPareto, safeNumber } from '../src/utils/operationalInsights.js'
import { canAccessRoute } from '../src/auth/permissions.js'

const node = (name, current_value, previous_value, extra = {}) => ({ name, current_value, previous_value, ...extra })
const sales = (stores) => ({
  current_start: '2026-11-01', current_end: '2026-11-06',
  previous_start: '2025-11-01', previous_end: '2025-11-06',
  quality: { status: 'PASS' }, details: { stores },
})
const losses = (rows, complete = true) => ({
  current_start: '2026-11-01', current_end: '2026-11-06', complete, rows,
})
const lossProduct = (product_code, total_value, product_name = 'Produto') =>
  ({ product_code, total_value, product_name, loss_quantity: 1 })

test('distingue zeros reais de dados ausentes', () => {
  assert.equal(safeNumber(null), null)
  assert.equal(safeNumber('  '), null)
  assert.equal(safeNumber(undefined), null)
  assert.equal(safeNumber('0'), 0)
  assert.equal(safeNumber('105.5'), 105.5)
})

test('diagnóstico comercial mede queda em dinheiro, ganho e contribuição sobre quedas brutas', () => {
  const data = sales([
    { store_code: '307', sectors: [node('PADARIA', 100, 200), node('ACOUGUE', 220, 200)] },
    { store_code: '212', sectors: [node('PADARIA', 40, 60), node('ACOUGUE', 70, 80)] },
  ])
  const result = diagnoseSales(data)
  assert.equal(result.storeCount, 2)
  assert.equal(result.declines[0].name, 'PADARIA')
  assert.equal(result.declines[0].difference, -120)
  assert.equal(result.totalDecline, 120)
  assert.equal(result.totalGrowth, 10)
  assert.equal(result.netDifference, -110)
  assert.equal(result.declines[0].declineContribution, 100)
})

test('detalhamento não soma setor e grupos duas vezes e diferencia grupos de setores distintos', () => {
  const data = sales([{
    store_code: '307',
    sectors: [
      node('PADARIA', 100, 200, { groups: [
        node('BOLOS', 60, 110, { subgroups: [node('CONFEITADO', 20, 50)] }),
        node('PAES', 40, 90),
      ] }),
      node('ROTISSERIA', 90, 100, { groups: [node('BOLOS', 90, 100)] }),
    ],
  }])
  const sectors = diagnoseSales(data)
  assert.equal(sectors.rows.length, 2)
  assert.equal(sectors.netDifference, -110)
  const groups = diagnoseSales(data, { level: 'group' })
  assert.equal(groups.rows.length, 3)
  assert.equal(groups.netDifference, -110)
  const subgroup = diagnoseSales(data, { level: 'subgroup', sector: 'PADARIA', group: 'BOLOS' })
  assert.equal(subgroup.rows.length, 1)
  assert.equal(subgroup.rows[0].difference, -30)
})

test('campos nulos não são interpretados como queda de 100%', () => {
  const result = diagnoseSales(sales([
    { store_code: '307', sectors: [node('PADARIA', null, 100), node('ACOUGUE', 0, 100)] },
  ]))
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].difference, -100)
})

test('Pareto agrupa código entre lojas, deduplica a hierarquia e distribui classes 80/95%', () => {
  const run = losses([
    { store_code: '307', details: { current: { sectors: [{ name: 'PADARIA', mips: [{
      products: [lossProduct('001', 50, 'Bolo'), lossProduct('002', 20), lossProduct('003', 5)],
    }] }] } } },
    { store_code: '212', details: { current: { sectors: [{ name: 'PADARIA', mips: [{
      products: [lossProduct('001', 50, 'Bolo'), lossProduct('410364', 50000, 'Excluído')],
    }] }] } } },
  ])
  const pareto = lossPareto(run)
  assert.equal(pareto.total, 125)
  assert.equal(pareto.count, 3)
  assert.deepEqual(pareto.products.map((x) => x.classification), ['A', 'B', 'C'])
  assert.equal(pareto.products[0].storeCount, 2)
  assert.equal(pareto.classes.A.share, 80)
  assert.equal(pareto.classes.B.share, 16)
  assert.equal(pareto.classes.C.share, 4)
  assert.equal(lossPareto(run, {store: '212'}).total, 50)
  assert.equal(lossPareto(run, {sector: 'HORTIFRUTI'}).total, 0)
})

test('Radar cria alertas por setor e loja com fonte aprovada, sem misturar valores', () => {
  const sale = sales([{ store_code: '212', current_value: 75000, previous_value: 100000,
    sectors: [node('PADARIA', 1000, 2000)] }])
  const loss = losses([{ store_code: '307', quality: {status:'PASS'}, details: {
    current: { sectors: [{ name: 'PADARIA', reported_totals: { total_value: 1200 },
      sales_context: { sales_value: 10000 } }] },
  } }])
  const result = buildOpportunityRadar({ salesSnapshot: sale, lossRun: loss })
  assert.equal(result.sales.length, 1)
  assert.equal(result.sales[0].impact, 25000)
  assert.equal(result.sales[0].kind, 'VENDAS')
  assert.equal(result.losses.length, 1)
  assert.equal(result.losses[0].sector, 'PADARIA')
  assert.equal(result.losses[0].impact, 800)
  assert.equal(result.losses[0].kind, 'PERDAS')
  assert.equal(buildOpportunityRadar({salesSnapshot: {...sale, quality: {status:'FAIL'}}, lossRun: losses(loss.rows,false)}).sales.length, 0)
  assert.equal(buildOpportunityRadar({lossRun: losses(loss.rows,false)}).losses.length, 0)
})

test('links de plano preservam setor, loja e departamento sem credenciais', () => {
  const link = actionPlanLink({
    kind: 'PERDAS', storeCode: '307', sector: 'PADARIA',
    title: 'Revisar bolos & pães', description: 'Meta excedida', current: 800, targetValue: 400,
  })
  const params = new URLSearchParams(link.split('?')[1])
  assert.equal(params.get('department'), 'PERDAS')
  assert.equal(params.get('store_code'), '307')
  assert.equal(params.get('sector'), 'PADARIA')
  assert.equal(params.get('title'), 'Revisar bolos & pães')
  assert.equal(params.get('target_value'), '400')
})

test('perfis não acessam diagnósticos de departamentos diferentes', () => {
  for (const path of ['/radar','/diagnostico-vendas']) assert.equal(canAccessRoute('gerencia', path), true)
  assert.equal(canAccessRoute('gerencia', '/pareto-perdas'), false)
  assert.equal(canAccessRoute('prevencao', '/radar'), true)
  assert.equal(canAccessRoute('prevencao', '/pareto-perdas'), true)
  assert.equal(canAccessRoute('prevencao', '/diagnostico-vendas'), false)
  assert.equal(canAccessRoute('admin', '/pareto-perdas'), true)
  assert.equal(canAccessRoute('atendimento', '/radar'), false)
})
