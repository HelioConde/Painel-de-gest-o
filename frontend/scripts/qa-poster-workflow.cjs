const { chromium } = require('C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:5183/#/cartazes')

  await page.getByLabel('Uma linha por produto').fill('VINHO, TORO, ROSE, 750ML, 28,99\nARROZ, PRIMOR, 5KG, 19,90\nCAFÉ ESPECIAL 500G 18,90')
  await page.getByRole('button', { name: 'Gerar cartazes' }).click()
  await page.waitForTimeout(500)

  const parsed = await page.locator('.poster-product-table tbody tr').evaluateAll((rows) => rows.map((row) => (
    [...row.querySelectorAll('input[type="text"], input:not([type])')].map((input) => input.value)
  )))
  const badges = await page.locator('.poster-preview-badge').allTextContents()

  await page.locator('.poster-product-table tbody tr').nth(1).click()
  const selectedId = await page.locator('.poster-product-table tbody tr.selected').getAttribute('data-product-id')
  const previewCards = await page.locator('.poster-preview-scale .poster-card').evaluateAll((cards) => cards.map((card) => ({ id: card.dataset.productId, selected: card.classList.contains('poster-card-selected') })))
  const selectedPreviewId = previewCards.find((card) => card.selected)?.id || null

  const checks = page.locator('.poster-product-table tbody input[type="checkbox"]')
  await checks.nth(0).check()
  await checks.nth(1).check()
  await page.getByRole('button', { name: /Excluir 2/ }).click()
  const remaining = await page.locator('.poster-product-table tbody tr').count()

  await page.getByRole('button', { name: 'Histórico' }).click()
  const historyCount = await page.locator('.poster-history-list article').count()
  await page.getByRole('button', { name: 'Configurações' }).click()
  const simplex = await page.getByText('Simplex; frente e verso desativado').isVisible()
  const fontError = await page.getByText('Fonte Burbank Big Cd Bk não encontrada.').count()

  const result = { errors, parsed, badges, selectedId, selectedPreviewId, previewCards, remaining, historyCount, simplex, fontError }
  console.log(JSON.stringify(result))
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
