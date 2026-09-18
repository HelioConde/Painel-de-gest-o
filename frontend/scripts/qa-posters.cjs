const { chromium } = require('C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')

const out = path.join(__dirname, '../qa-output/cartazes')
fs.mkdirSync(out, { recursive: true })

const sample = [
  'Pão Francês kg 10,90',
  'Cerveja Heineken Long Neck 300ml 5,99',
  'Coca Cola Zero 2L 9,99',
  'Leite Condensado Moça 395g 7,49',
  'Sabão em Pó Tixan Ypê Maciez Rosa 1,6kg 24,90',
].join('\n')

const cases = [
  ['A4_4X1', 4, 2, 'A4 portrait'],
  ['A4_2X1', 2, 3, 'A4 portrait'],
  ['A4', 1, 5, 'A4 portrait'],
  ['A5', 1, 5, 'A5 portrait'],
  ['A3', 1, 5, 'A3 portrait'],
]

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('http://127.0.0.1:5183/#/cartazes')
  await page.getByLabel('Uma linha por produto').fill(sample)
  await page.getByRole('button', { name: 'Gerar cartazes' }).click()

  await page.getByRole('button', { name: 'Imprimir', exact: true }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Aumentar cópias' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
  await page.getByRole('button', { name: 'Imprimir', exact: true }).first().click()
  const copiesAfterCancel = await page.locator('.poster-stepper strong').innerText()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()

  const formats = []
  for (const [formatId, visiblePosters, expectedPages, expectedPageRule] of cases) {
    await page.getByLabel('Formato').selectOption(formatId)
    await page.waitForTimeout(250)

    const metrics = await page.evaluate(({ visiblePosters, expectedPages }) => {
      const preview = document.querySelector('.poster-preview-scale')
      const boxes = [...preview.querySelectorAll('.poster-layout-box')]
      const cards = [...preview.querySelectorAll('.poster-card')]
      const collisions = cards.map((card) => {
        const content = card.querySelector('.poster-content-box').getBoundingClientRect()
        const price = card.querySelector('.poster-price-box').getBoundingClientRect()
        return content.bottom > price.top + 0.5
      })
      return {
        visiblePosters: cards.length,
        expectedVisiblePosters: visiblePosters,
        pageLabel: document.querySelector('.poster-preview-heading h2')?.textContent,
        expectedPages,
        boxOverflow: boxes.filter((box) => box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1).map((box) => box.className),
        guideLayers: preview.querySelectorAll('.poster-guide-layer').length,
        collisions,
        printSheets: document.querySelectorAll('.poster-print-sheet').length,
        hasPhysicalDimensions: Boolean(document.querySelector('.poster-sheet')?.style.getPropertyValue('--sheet-width')),
      }
    }, { visiblePosters, expectedPages })

    await page.screenshot({ path: path.join(out, `${formatId}.png`), fullPage: true })

    await page.evaluate(() => { window.print = () => { window.__posterPrintCalled = true } })
    await page.getByRole('button', { name: 'Imprimir', exact: true }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Imprimir', exact: true }).click()
    await page.waitForTimeout(100)
    const printState = await page.evaluate(() => ({
      rule: document.getElementById('poster-dynamic-page')?.textContent || '',
      called: window.__posterPrintCalled === true,
      printing: document.body.classList.contains('poster-printing'),
      boxOverflow: [...document.querySelectorAll('.poster-print-root .poster-layout-box')]
        .filter((box) => box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1)
        .map((box) => box.className),
      guideLayers: document.querySelectorAll('.poster-print-root .poster-guide-layer').length,
    }))
    formats.push({ formatId, expectedPageRule, ...metrics, printState })
    await page.waitForTimeout(2100)
  }

  await page.getByLabel('Formato').selectOption('A4_2X1')
  await page.getByLabel('Inverter 2ª placa').check()
  await page.waitForTimeout(100)
  const inversion = await page.evaluate(() => [...document.querySelectorAll('.poster-preview-scale .poster-card-layers')].map((card) => getComputedStyle(card).transform))
  await page.evaluate(() => { window.print = () => { window.__posterPrintCalled = true } })
  await page.getByRole('button', { name: 'Imprimir', exact: true }).first().click()
  const confirmationText = await page.getByRole('dialog').innerText()
  await page.getByRole('dialog').getByRole('button', { name: 'Aumentar cópias' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Imprimir', exact: true }).click()
  await page.waitForTimeout(100)
  const sheetsWithTwoCopies = await page.locator('.poster-print-sheet').count()
  await page.waitForTimeout(2100)

  await page.getByLabel('Formato').selectOption('A4_4X1')
  const firstDescription = page.locator('.poster-product-table tbody tr').first().getByRole('textbox').first()
  await firstDescription.fill('PÃO FRANCÊS ARTESANAL DA PADARIA PRIMOR COM FERMENTAÇÃO NATURAL')
  await page.waitForTimeout(250)
  const liveEdit = await page.locator('.poster-preview-scale .poster-field-description').first().innerText()
  const editedOverflow = await page.locator('.poster-preview-scale .poster-content-box').first().evaluate((box) => (
    box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1
  ))

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(out, 'mobile-390.png'), fullPage: true })
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    tableMode: getComputedStyle(document.querySelector('.poster-product-table')).display,
    workspaceColumns: getComputedStyle(document.querySelector('.poster-workspace')).gridTemplateColumns,
  }))

  const legacyRoutes = []
  for (const route of ['diaria', 'mensal', 'eventos', 'perdas']) {
    await page.goto(`http://127.0.0.1:5183/#/${route}`)
    await page.waitForTimeout(800)
    legacyRoutes.push({ route, title: await page.locator('h1').first().innerText(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) })
  }

  const result = { pageErrors, copiesAfterCancel, formats, inversion, confirmationText, sheetsWithTwoCopies, liveEdit, editedOverflow, mobile, legacyRoutes }
  fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
