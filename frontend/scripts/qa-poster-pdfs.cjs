const { chromium } = require('C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')

const out = path.join(__dirname, '../qa-output/cartazes/pdf')
fs.mkdirSync(out, { recursive: true })

const sample = [
  'Pão Francês kg 10,90',
  'Cerveja Heineken Long Neck 300ml 5,99',
  'Coca Cola Zero 2L 9,99',
  'Leite Condensado Moça 395g 7,49',
  'Sabão em Pó Tixan Ypê Maciez Rosa 1,6kg 24,90',
].join('\n')

const formats = [
  ['A4_4X1', 'A4 portrait'],
  ['A4_2X1', 'A4 portrait'],
  ['A4', 'A4 portrait'],
  ['A5', 'A5 portrait'],
  ['A3', 'A3 portrait'],
]

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto('http://127.0.0.1:5183/#/cartazes')
  await page.getByLabel('Uma linha por produto').fill(sample)
  await page.getByRole('button', { name: 'Gerar cartazes' }).click()

  const results = []
  for (const [formatId, pageRule] of formats) {
    await page.emulateMedia({ media: 'screen' })
    await page.getByLabel('Formato').selectOption(formatId)
    await page.emulateMedia({ media: 'print' })
    await page.evaluate(({ pageRule }) => {
      const style = document.createElement('style')
      style.id = 'poster-pdf-page'
      style.textContent = `@page { size: ${pageRule}; margin: 0; }`
      document.head.appendChild(style)
      document.body.classList.add('poster-printing')
    }, { pageRule })
    await page.waitForTimeout(300)

    const printState = await page.evaluate(() => ({
      overflow: [...document.querySelectorAll('.poster-print-root .poster-layout-box')]
        .filter((box) => box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1)
        .map((box) => ({ className: box.className, text: box.textContent })),
      guideLayers: document.querySelectorAll('.poster-print-root .poster-guide-layer').length,
      guideDisplay: [...document.querySelectorAll('.poster-guide-layer')].map((guide) => getComputedStyle(guide).display),
    }))
    const file = path.join(out, `${formatId}.pdf`)
    await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true })
    results.push({ formatId, file, ...printState })

    await page.evaluate(() => {
      document.getElementById('poster-pdf-page')?.remove()
      document.body.classList.remove('poster-printing')
    })
  }

  console.log(JSON.stringify(results))
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
