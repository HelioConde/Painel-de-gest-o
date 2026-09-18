const { chromium } = require('C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')
const out = path.join(__dirname, '../qa-output')
fs.mkdirSync(out, { recursive: true })
;(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true})
 const page = await browser.newPage()
 const errors = []
 page.on('pageerror', e => errors.push(e.message))
 const results = []
 for(const route of ['diaria','mensal','eventos','perdas','top']) {
  await page.goto('http://127.0.0.1:5183/#/' + (route === 'top' ? 'perdas' : route))
  await page.locator(route === 'diaria' || route === 'mensal' ? '.hierarchy-row' : route === 'eventos' ? '.event-store-row' : '.loss-summary-table').first().waitFor()
  if(route === 'top') await page.getByRole('tab',{name:'Top Perdas',exact:true}).click()
  for(const width of [1920,1600,1366,768,621,480,430,412,400,390,375,360]) {
   await page.setViewportSize({width,height:width===1920?1080:width===1600?900:width===1366?768:900})
   await page.screenshot({path:path.join(out,`${route}-${width}.png`)})
   const metrics = await page.evaluate(() => ({width:innerWidth, overflow:document.documentElement.scrollWidth>innerWidth,
    tables:[...document.querySelectorAll('.loss-top-table-wrap')].map(e=>({width:e.clientWidth,scrollWidth:e.scrollWidth,overflow:getComputedStyle(e).overflowX})),
    eventRows:[...document.querySelectorAll('.event-store-row')].map(e=>({display:getComputedStyle(e).display,height:e.getBoundingClientRect().height})),
    sectors:[...document.querySelectorAll('.table-carousel-slide.active .sector-row')].map(e=>e.getBoundingClientRect().height)
   }))
   results.push({route,...metrics})
  }
 await page.setViewportSize({width:1366,height:768})
  await page.addStyleTag({content:`@page { size: A4 ${route === 'diaria' || route === 'mensal' ? 'portrait' : 'landscape'}; margin: 8mm; }`})
  await page.emulateMedia({media:'print'})
  await page.screenshot({path:path.join(out,`${route}-print.png`),fullPage:true})
  await page.pdf({path:path.join(out,`${route}.pdf`),preferCSSPageSize:true,printBackground:true})
  await page.emulateMedia({media:'screen'})
 }
 fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({errors,results},null,2))
 console.log(JSON.stringify({errors,overflow:results.filter(r=>r.overflow),screenshots:results.length}))
 await browser.close()
})().catch(e=>{console.error(e);process.exit(1)})
