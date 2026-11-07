import test from 'node:test'
import assert from 'node:assert/strict'
import { groupForPath, groupVisibleNavigation } from '../src/utils/navigationSections.js'

const items = [
  { to: '/eventos', label: 'Eventos' },
  { to: '/diaria', label: 'Venda Diária' },
  { to: '/mensal', label: 'Venda Mensal' },
  { to: '/fechamento-mensal', label: 'Fechamento Mensal' },
  { to: '/tabloide', label: 'Tabloide' },
  { to: '/perdas', label: 'Perdas' },
  { to: '/comparativo', label: 'Comparativo de Lojas', isNew: true },
  { to: '/radar', label: 'Radar das Lojas', isNew: true },
  { to: '/diagnostico-vendas', label: 'Diagnóstico de Vendas', isNew: true },
  { to: '/pareto-perdas', label: 'Curva ABC / Pareto', isNew: true },
  { to: '/saude-dados', label: 'Saúde dos Dados', isNew: true },
  { to: '/planos-acao', label: 'Planos de Ação', isNew: true },
  { to: '/historico-produtos', label: 'Histórico de Produtos', isNew: true },
  { to: '/analise-ia', label: 'Análise com IA' },
  { to: '/cartazes', label: 'Cartazes' },
  { to: '/configuracoes', label: 'Configurações' },
]

test('reagrupa todas as rotas sem perder ou duplicar módulos', () => {
  const sections = groupVisibleNavigation(items)
  assert.deepEqual(sections.reports.map((item) => item.to),
    ['/eventos','/diaria','/mensal','/fechamento-mensal','/tabloide','/perdas','/cartazes'])
  assert.deepEqual(sections.intelligence.map((item) => item.to),
    ['/comparativo','/radar','/diagnostico-vendas','/pareto-perdas','/historico-produtos','/analise-ia'])
  assert.deepEqual(sections.management.map((item) => item.to),
    ['/saude-dados','/planos-acao','/configuracoes'])
  assert.equal(Object.values(sections).flat().length, items.length)
  assert.equal(new Set(Object.values(sections).flat().map((item) => item.to)).size, items.length)
})

test('respeita módulos autorizados por perfil sem criar links escondidos indevidamente', () => {
  const allowed = items.filter((item) => ['/perdas','/comparativo','/pareto-perdas','/historico-produtos'].includes(item.to))
  const sections = groupVisibleNavigation(allowed)
  assert.deepEqual(sections.reports.map((item) => item.to), ['/perdas'])
  assert.equal(sections.intelligence.length, 3)
  assert.equal(sections.management.length, 0)
})

test('identifica grupo ativo por rota, inclusive subrotas, para expandir automaticamente', () => {
  assert.equal(groupForPath('/radar'), 'intelligence')
  assert.equal(groupForPath('/pareto-perdas/detalhes'), 'intelligence')
  assert.equal(groupForPath('/planos-acao'), 'management')
  assert.equal(groupForPath('/configuracoes'), 'management')
  assert.equal(groupForPath('/mensal'), 'reports')
  assert.equal(groupForPath('/planos-acoes-falsa'), 'reports')
})

test('mantém relatórios futuros visíveis como rota principal', () => {
  const sections = groupVisibleNavigation([{to:'/nova-rota',label:'Nova tela'}])
  assert.equal(sections.reports[0].to, '/nova-rota')
  assert.equal(sections.intelligence.length, 0)
})
