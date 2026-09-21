import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const grouped = readFileSync(new URL('./LossGroupedByStore.jsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('../pages/LossesPage.jsx', import.meta.url), 'utf8')
const printCss = readFileSync(new URL('../styles/report-print.css', import.meta.url), 'utf8')

test('grouped search and sector reports share the printable component', () => {
  assert.match(page, /<LossGroupedByStore[\s\S]*TOP PERDAS/)
  assert.match(page, /<LossGroupedByStore[\s\S]*PESQUISA DE PERDAS/)
  assert.match(grouped, /<PrintReportHeader/)
  assert.match(grouped, /<LossRankingGrid/)
  assert.match(grouped, /<LossRankingCard/)
})

test('print stylesheet hides controls and formats store groups', () => {
  assert.match(printCss, /\.no-print\s*\{\s*display:\s*none\s*!important/)
  assert.match(printCss, /\.loss-top-card\s*\{[^}]*break-inside:\s*avoid\s*!important/s)
  assert.match(printCss, /\.loss-grouped-table\s*\{[^}]*table-layout:\s*fixed\s*!important/s)
  assert.match(printCss, /\.loss-top-table\.has-ranking-metrics th,[\s\S]*display:\s*table-cell\s*!important/)
})
