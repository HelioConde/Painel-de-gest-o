import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const stylesheet = readFileSync(new URL('../src/styles/report-print.css', import.meta.url), 'utf8')
const previousTwoColumn = stylesheet.indexOf('PRINT V4.0 — Top Perdas lado a lado')
const fixStart = stylesheet.indexOf('PRINT V4.4 — Top Perdas: fonte legível')
const fix = stylesheet.slice(fixStart)

test('Top Perdas imprime em A4 paisagem com uma coluna e regras aplicadas após o layout antigo', () => {
  assert.ok(previousTwoColumn >= 0 && fixStart > previousTwoColumn)
  assert.match(stylesheet, /@page losses-top\s*\{\s*size:\s*A4 landscape;/)
  assert.match(fix, /\.losses-page\.losses-view-top \.loss-top-masonry\s*\{[^}]*display: block !important;[^}]*column-count: 1 !important;/s)
  assert.match(fix, /\.losses-page\.losses-view-top \.loss-top-column\s*\{\s*display: contents !important;/)
  assert.match(fix, /\.losses-page\.losses-view-top \.loss-top-card\s*\{[^}]*break-inside: avoid !important;/s)
})

test('corpo e cabeçalho ganham fontes legíveis e nomes não são truncados', () => {
  assert.match(fix, /\.losses-page\.losses-view-top \.loss-top-table th,\s*\.losses-page\.losses-view-top \.loss-top-table td\s*\{[^}]*font-size: 9pt !important;/s)
  assert.match(fix, /\.losses-page\.losses-view-top \.loss-top-table thead th\s*\{[^}]*font-size: 8\.3pt !important;/s)
  assert.match(fix, /\.losses-page\.losses-view-top \.loss-top-table \.loss-top-product-name,[\s\S]*?font-size: 9\.4pt !important;/)
  assert.match(fix, /\.losses-page\.losses-view-top \.loss-top-product-scroll\s*\{[^}]*white-space: normal !important;[^}]*overflow: visible !important;/s)
})

test('todas as 9 métricas do ranking mantêm colunas de larguras totalizando 100%', () => {
  const names = ['pos', 'code', 'name', 'loss', 'sold', 'percent', 'value', 'share', 'comparison']
  const values = names.map((name) => {
    const regex = new RegExp('\\.losses-page\\.losses-view-top \\.loss-top-table\\.has-ranking-metrics col\\.loss-col-' + name + ' \\{ width: ([0-9.]+)% !important; \\}')
    const match = fix.match(regex)
    assert.ok(match, 'Largura ausente: ' + name)
    return Number(match[1])
  })
  assert.equal(values.reduce((a, b) => a + b, 0), 100)
})
