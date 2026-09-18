const fs = require('node:fs')
const postcss = require('postcss')
const path = require('node:path')
const file = path.join(__dirname, '../src/styles.css')
const root = postcss.parse(fs.readFileSync(file, 'utf8'))
const affected = /\.(hierarchy-|table-legend|sector-row|group-row|subgroup-row|event-store-|loss-top-|loss-col-)/
root.walkAtRules('media', media => {
  if (media.params === 'print') { media.remove(); return }
  if (/width/.test(media.params)) {
    media.params = media.params.replace(/^screen and /, '')
    media.params = `screen and ${media.params}`
    media.walkRules(rule => {
      const keep = rule.selectors.filter(selector => !affected.test(selector))
      if (!keep.length) rule.remove()
      else rule.selectors = keep
    })
    if (!media.nodes.some(n => n.type !== 'comment')) media.remove()
  }
})
root.walkAtRules('page', rule => rule.remove())
root.walkRules(rule => {
  if (/\.loss-top-mobile/.test(rule.selector)) { rule.remove(); return }
  if (/^\.table-carousel-store\.store-tone-/.test(rule.selector)) {
    const code = rule.selector.match(/store-tone-(\d+)/)?.[1]
    if (code) {
      rule.removeAll()
      rule.append({ prop: '--store-tone', value: `var(--store-${code}-rgb)` })
    }
  }
})
fs.writeFileSync(file, root.toString())
