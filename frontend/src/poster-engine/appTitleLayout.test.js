import assert from 'node:assert/strict'
import test from 'node:test'
import { createAppTitleLayout, fitAppRegularPrice, migrateAppTitleBox, normalizeAppTitleFields } from './appTitleLayout.js'
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

test('migra as duas posições antigas do título App sem sobrescrever posições personalizadas', () => {
  const defaults = { x: 7, y: 46, width: 86, height: 21 }
  assert.deepEqual(migrateAppTitleBox({ x: 7, y: 39, width: 86, height: 29 }, defaults), defaults)
  assert.deepEqual(migrateAppTitleBox({ x: 7, y: 42, width: 86, height: 25.3 }, defaults), defaults)
  const custom = { x: 9, y: 44, width: 83, height: 20 }
  assert.equal(migrateAppTitleBox(custom, defaults), custom)
})

test('PÃO FRANCÊS aparece em duas linhas, antes de KG, sem editar produto original', () => {
  const pao = { id: 'pao', description: 'PÃO FRANCÊS', subdescription: '', complement: '', unit: 'KG', price: '10,90' }
  const newTemplate = { ...appTemplate, appTitleBox: { x: 7, y: 46, width: 86, height: 21 } }
  const normalized = normalizeAppTitleFields(pao)
  assert.equal(normalized.description, 'PÃO')
  assert.equal(normalized.subdescription, 'FRANCÊS')
  const plan = createAppTitleLayout({ product: pao, template: newTemplate, format: appFormat })
  assert.deepEqual(plan.lines.map((line) => line.text), ['PÃO', 'FRANCÊS', 'KG'])
  assert.equal(pao.description, 'PÃO FRANCÊS')
  assert.equal(pao.subdescription, '')

  const heightMm = appFormat.heightMm * 21 / 100 * 0.97
  const usedMm = plan.lines.reduce((sum, line) => sum +
    Math.max(
      estimateTextMeasure(line.text, { fontSizeMm: line.fontSizeMm }).heightMm,
      line.fontSizeMm * newTemplate.textStyles.appTitle.lineHeight,
    ), 0) + ((plan.lines.length - 1) * 0.7)
  assert.ok(usedMm <= heightMm + 0.04)
})

test('preserva descrições com marca explícita e não deixa preposição órfã', () => {
  const named = { ...product, description: 'COCA COLA', subdescription: 'ZERO' }
  assert.equal(normalizeAppTitleFields(named), named)
  const connector = { ...product, description: 'PÃO DE', subdescription: '' }
  assert.equal(normalizeAppTitleFields(connector), connector)
  const withTwoWords = { ...product, description: 'CREME DENTAL', subdescription: '' }
  assert.deepEqual(
    createAppTitleLayout({ product: withTwoWords, template: appTemplate, format: appFormat })
      .lines.slice(0, 2).map((line) => line.text),
    ['CREME', 'DENTAL'],
  )
})

test('preço fora App cabe inteiro, inclusive R$, em valores de 2 a 4 dígitos', () => {
  const template = {
    ...appTemplate,
    appRegularPriceBox: { x: 54, y: 81, width: 35, height: 11 },
    textStyles: {
      ...appTemplate.textStyles,
      appRegularPrice: {
        fontMin: 5.2, fontMax: 13.5, fontWeight: 900,
        fontFamily: '"Futura Price"', lineHeight: 0.84, scale: 1.18,
      },
    },
  }
  for (const regularPrice of ['16,99', '116,99', '1.169,99']) {
    const fontSizeMm = fitAppRegularPrice({
      product: { ...product, regularPrice },
      template, format: appFormat, measure: estimateTextMeasure,
    })
    assert.ok(fontSizeMm > 2.5 && fontSizeMm <= 10.8, regularPrice)
    const text = `R$ ${regularPrice}`
    const widthMm = appFormat.widthMm / appFormat.columns *
      template.appRegularPriceBox.width / 100 * 0.79
    assert.ok(estimateTextMeasure(text, { fontSizeMm }).widthMm <= widthMm + 0.01,
      `preço ${text} ultrapassou área segura`)
  }
  assert.equal(fitAppRegularPrice({
    product: { ...product, regularPrice: '' },
    template, format: appFormat, measure: estimateTextMeasure,
  }), null)
})

test('A3 App amplia o título e preserva a troca entre formatos App', () => {
  const a3 = { ...appFormat, id: 'A3_APP', widthMm: 297, heightMm: 420, columns: 1 }
  const template = {
    ...appTemplate, format: 'A3_APP',
    textStyles: { appTitle: { ...appTemplate.textStyles.appTitle, fontMin: 6.8, fontMax: 52 } },
  }
  const original = createAppTitleLayout({ product, template: appTemplate, format: appFormat })
  const enlarged = createAppTitleLayout({ product, template, format: a3 })
  assert.deepEqual(enlarged.lines.map(line => line.text), original.lines.map(line => line.text))
  assert.ok(enlarged.lines[0].fontSizeMm > original.lines[0].fontSizeMm * 1.8)
  assert.equal(resolveActivePosterTemplate(a3, appTemplate, () => template), template)
  assert.equal(resolveActivePosterTemplate(appFormat, template, () => appTemplate), appTemplate)
})
