const { chromium } = require('C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')

const out = path.join(__dirname, '../qa-output/cartazes/guides')
fs.mkdirSync(out, { recursive: true })

const templates = ['placa-a4-2x1', 'placa-a4', 'placa-a5', 'placa-a3']

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto('http://127.0.0.1:5183/#/cartazes/admin-layout')
  await page.waitForSelector('.poster-admin-canvas')

  const results = []
  for (const templateId of templates) {
    await page.getByLabel('Template').selectOption(templateId)
    await page.waitForTimeout(300)
    const state = await page.evaluate(() => ({
      guideLayers: document.querySelectorAll('.poster-admin-canvas .poster-guide-layer').length,
      rotation: document.querySelector('.poster-admin-canvas .poster-guide-layer img')?.style.transform,
      contentOverflow: [...document.querySelectorAll('.poster-admin-canvas .poster-content-stack')]
        .some((box) => box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1),
      priceOverflow: [...document.querySelectorAll('.poster-admin-canvas .poster-price-content')]
        .some((box) => box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1),
    }))
    await page.screenshot({ path: path.join(out, `${templateId}.png`), fullPage: true })
    results.push({ templateId, ...state })
  }

  fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results))
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
