const { chromium } = require('C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')

const out = path.join(__dirname, '../qa-output/cartazes/admin')
fs.mkdirSync(out, { recursive: true })

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('http://127.0.0.1:5183/#/cartazes/admin-layout')
  await page.waitForSelector('.poster-admin-canvas')

  const guideMode = await page.evaluate(() => ({
    guideLayers: document.querySelectorAll('.poster-admin-canvas .poster-guide-layer').length,
    contentBoxes: document.querySelectorAll('.poster-admin-canvas .poster-content-box').length,
    priceBoxes: document.querySelectorAll('.poster-admin-canvas .poster-price-box').length,
    labels: [...document.querySelectorAll('.poster-admin-canvas .poster-box-label')].map((item) => item.textContent.trim()),
    sidebarAdminLinks: [...document.querySelectorAll('.sidebar a')].filter((item) => /admin/i.test(item.textContent)).length,
    contentOverflow: [...document.querySelectorAll('.poster-admin-canvas .poster-layout-box')].flatMap((box) => {
      const bounds = box.getBoundingClientRect()
      const content = [...box.querySelectorAll('.poster-content-line, .poster-field-price')]
      return content.filter((item) => {
        const itemBounds = item.getBoundingClientRect()
        return itemBounds.left < bounds.left - 1 || itemBounds.right > bounds.right + 1 || itemBounds.top < bounds.top - 1 || itemBounds.bottom > bounds.bottom + 1
      }).map((item) => item.className)
    }),
  }))
  await page.screenshot({ path: path.join(out, 'guide-mode.png'), fullPage: true })

  await page.getByRole('tab', { name: 'Impressão' }).click()
  await page.waitForTimeout(300)
  const printModeGuideLayers = await page.locator('.poster-admin-canvas .poster-guide-layer').count()
  await page.screenshot({ path: path.join(out, 'print-mode.png'), fullPage: true })
  await page.getByRole('tab', { name: 'Guia' }).click()

  const numberFields = page.locator('.poster-admin-number-field')
  const xInput = numberFields.filter({ hasText: /^X$/ }).locator('input')
  await xInput.fill('14')
  await xInput.blur()
  const numericPosition = await page.locator('.poster-admin-canvas .poster-content-box').evaluate((box) => box.style.left)

  const testDescription = page.getByRole('textbox', { name: 'Descrição', exact: true })
  await testDescription.fill('TEXTO ADMINISTRATIVO LONGO PARA TESTAR AJUSTE CONJUNTO')
  const liveTestText = await page.locator('.poster-admin-canvas .poster-field-description').innerText()

  const box = page.locator('.poster-admin-canvas .poster-content-box')
  const beforeDrag = await box.evaluate((node) => ({ left: node.style.left, top: node.style.top, width: node.style.width, height: node.style.height }))
  const bounds = await box.boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + 31, bounds.y + bounds.height / 2 + 19, { steps: 4 })
  await page.mouse.up()
  const afterDrag = await box.evaluate((node) => ({ left: node.style.left, top: node.style.top, width: node.style.width, height: node.style.height }))

  const handle = page.getByRole('button', { name: 'Redimensionar contentBox' })
  const handleBounds = await handle.boundingBox()
  await page.mouse.move(handleBounds.x + 2, handleBounds.y + 2)
  await page.mouse.down()
  await page.mouse.move(handleBounds.x + 27, handleBounds.y + 19, { steps: 4 })
  await page.mouse.up()
  const afterResize = await box.evaluate((node) => ({ left: node.style.left, top: node.style.top, width: node.style.width, height: node.style.height }))

  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.reload()
  await page.waitForSelector('.poster-admin-canvas')
  const persisted = await page.locator('.poster-admin-canvas .poster-content-box').evaluate((node) => ({ left: node.style.left, top: node.style.top, width: node.style.width, height: node.style.height }))

  const bounded = Object.values(persisted).every((value) => {
    const numeric = Number.parseFloat(value)
    return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100
  })

  const result = {
    pageErrors,
    guideMode,
    printModeGuideLayers,
    numericPosition,
    liveTestText,
    beforeDrag,
    afterDrag,
    afterResize,
    persisted,
    bounded,
  }
  fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
