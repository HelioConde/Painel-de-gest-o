import assert from 'node:assert/strict'
import test from 'node:test'
import { createAppTitleLayout } from './appTitleLayout.js'
import { resolveActivePosterTemplate } from './resolveActivePosterTemplate.js'
import { estimateTextMeasure } from './textMeasure.js'

const appFormat = {
  id: 'A4X2_APP', specialLayout: 'app-offer',
  widthMm: 297, heightMm: 210, columns: 2, rows: 1,
}
const a4Format = { id: 'A4', widthMm: 210, heightMm: 297, columns: 1, rows: 1 }
const appTemplate = {
  format: 'A4X2_APP',
  appTitleBox: { x: 7, y: 39, width: 86, height: 29 },
  textStyles: { appTitle: { fontMin: 3.4, fontMax: 26, fontWeight: 900, lineHeight: 0.92, scale: 1 } },
}
const product = {
  id: 'panettone', description: 'PANETTONE', subdescription: 'FESTTONE',
  complement: 'CHOCOLATE', unit: '400G', price: '15,99',
}

test('modelo App usa três linhas grandes com CHOCOLATE - 400G, sem alterar dados', () => {
  const plan = createAppTitleLayout({ product, template: appTemplate, format: appFormat })
  assert.deepEqual(plan.lines.map((line) => line.text), [
    'PANETTONE', 'FESTTONE', 'CHOCOLATE - 400G',
  ])
  assert.equal(plan.combinedUnit, true)
  assert.ok(plan.lines[0].fontSizeMm > 17, 'título deve ser maior que no modelo antigo')
  assert.ok(plan.lines[1].fontSizeMm > 17)
  assert.equal(product.complement, 'CHOCOLATE')
  assert.equal(product.unit, '400G')
  const contentWidth = appFormat.widthMm / appFormat.columns * appTemplate.appTitleBox.width / 100 * 0.96
  const contentHeight = appFormat.heightMm * appTemplate.appTitleBox.height / 100 * 0.97
  const heights = plan.lines.map((line) => Math.max(
    estimateTextMeasure(line.text, { fontSizeMm: line.fontSizeMm }).heightMm,
    line.fontSizeMm * appTemplate.textStyles.appTitle.lineHeight,
  ))
  assert.ok(heights.reduce((a, b) => a + b, 0) + 1.4 <= contentHeight + 0.01)
  assert.ok(plan.lines.every((line) => estimateTextMeasure(line.text, { fontSizeMm: line.fontSizeMm }).widthMm <= contentWidth + 0.01))
})

test('se a informação for extensa ou o título estreito, preserva linhas separadas', () => {
  const long = createAppTitleLayout({
    product: { ...product, complement: 'RECHEIO EXTRA DE CHOCOLATE CREMOSO' },
    template: appTemplate, format: appFormat,
  })
  assert.equal(long.combinedUnit, false)
  assert.deepEqual(long.lines.slice(-2).map((line) => line.text), [
    'RECHEIO EXTRA DE CHOCOLATE CREMOSO', '400G',
  ])
  const narrow = createAppTitleLayout({
    product, template: { ...appTemplate, appTitleBox: { ...appTemplate.appTitleBox, width: 20 } }, format: appFormat,
  })
  assert.equal(narrow.combinedUnit, false)
  assert.deepEqual(narrow.lines.slice(-2).map((line) => line.text), ['CHOCOLATE', '400G'])
})

test('troca App → A4 → App sempre usa as caixas corretas, sem estado intermediário inválido', () => {
  const regularTemplate = { format: 'A4', contentBox: {}, textStyles: { description: {} } }
  let fallbackCalls = 0
  const fallback = (formatId) => {
    fallbackCalls += 1
    return formatId === 'A4X2_APP' ? appTemplate : regularTemplate
  }
  const backToRegular = resolveActivePosterTemplate(a4Format, appTemplate, fallback)
  assert.equal(backToRegular, regularTemplate)
  const backToApp = resolveActivePosterTemplate(appFormat, regularTemplate, fallback)
  assert.equal(backToApp, appTemplate)
  assert.equal(resolveActivePosterTemplate(appFormat, appTemplate, fallback), appTemplate)
  assert.equal(resolveActivePosterTemplate(a4Format, regularTemplate, fallback), regularTemplate)
  assert.equal(fallbackCalls, 2)
  assert.equal(resolveActivePosterTemplate(appFormat, {
    format: 'A4X2_APP', textStyles: { appTitle: {} },
  }, fallback), appTemplate, 'modelo App incompleto também deve ser recuperado')
})
