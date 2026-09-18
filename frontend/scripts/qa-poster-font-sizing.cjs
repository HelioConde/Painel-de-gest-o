const { chromium } = require('C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:5183/#/cartazes')
  await page.getByLabel('Uma linha por produto').fill([
    'CERVEJA, HEINEKEN, 300ML, 5,99',
    'ARROZ TIO JOÃO, INTEGRAL, 1KG, 20,90',
    'DETERGENTE LÍQUIDO CONCENTRADO, LIMPEZA PROFUNDA, 500ML, 999,90',
  ].join('\n'))
  await page.getByRole('button', { name: 'Gerar cartazes' }).click()
  await page.waitForTimeout(400)

  const metrics = await page.locator('.poster-preview-scale .poster-card').evaluateAll((cards) => cards.map((card) => {
    const copyBlock = card.querySelector('.poster-copy-block')
    const contentBox = card.querySelector('.poster-content-box')
    const upperLines = [...copyBlock.querySelectorAll('.poster-content-line')]
    const unit = card.querySelector('.poster-field-unit')
    const price = card.querySelector('.poster-field-price')
    const rangeWidth = (element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return range.getBoundingClientRect().width
    }
    const cardBounds = card.getBoundingClientRect()
    const copyBounds = copyBlock.getBoundingClientRect()
    const contentBounds = contentBox.getBoundingClientRect()
    const top = Math.min(...upperLines.map((line) => line.getBoundingClientRect().top))
    const bottom = Math.max(...upperLines.map((line) => line.getBoundingClientRect().bottom))
    return {
      copyWidthRatio: copyBounds.width / cardBounds.width,
      copyHeightRatio: copyBounds.height / cardBounds.height,
      upperWidths: upperLines.map((line) => rangeWidth(line)),
      upperLimit: copyBlock.clientWidth,
      upperFontSizes: upperLines.map((line) => Number.parseFloat(getComputedStyle(line).fontSize)),
      upperTransforms: upperLines.map((line) => getComputedStyle(line).transform),
      whiteSpace: upperLines.map((line) => getComputedStyle(line).whiteSpace),
      verticalCenterDelta: Math.abs((top - copyBounds.top) - (copyBounds.bottom - bottom)),
      unitAfterUpper: unit ? unit.getBoundingClientRect().top >= bottom - 1 : true,
      priceAfterUnit: unit ? price.getBoundingClientRect().top >= unit.getBoundingClientRect().bottom - 1 : true,
      contentInsideBox: contentBox.scrollWidth <= contentBox.clientWidth + 1 && contentBox.scrollHeight <= contentBox.clientHeight + 1,
      contentBounds: { top: contentBounds.top, bottom: contentBounds.bottom },
      price: price.textContent,
      priceFontSize: Number.parseFloat(getComputedStyle(price).fontSize),
      priceWidth: rangeWidth(price),
      priceLimit: price.clientWidth,
      priceTransform: getComputedStyle(price).transform,
    }
  }))

  console.log(JSON.stringify({ errors, metrics }))
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
