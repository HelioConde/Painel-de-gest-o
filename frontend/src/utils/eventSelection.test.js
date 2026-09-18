import test from 'node:test'
import assert from 'node:assert/strict'
import { selectDefaultEvent } from './eventSelection.js'

const tabs = ['segunda_pizza', 'terca_carne', 'quarta_quinta_verde', 'sexta_pao', 'fim_semana']
  .map((slug) => ({ slug, row: { reference_date: '2026-09-01' } }))

test('uses the reporting calendar for every weekday in Sao Paulo', () => {
  const expected = ['fim_semana', 'segunda_pizza', 'terca_carne', 'quarta_quinta_verde', 'quarta_quinta_verde', 'sexta_pao']
  expected.forEach((slug, index) => {
    assert.equal(selectDefaultEvent(tabs, new Date(`2026-09-${String(7 + index).padStart(2, '0')}T12:00:00Z`)), slug)
  })
  assert.equal(selectDefaultEvent(tabs, new Date('2026-09-11T02:59:00Z')), 'quarta_quinta_verde')
  assert.equal(selectDefaultEvent(tabs, new Date('2026-09-12T02:59:00Z')), 'quarta_quinta_verde')
})

test('falls back to latest available data when scheduled event is missing or on Sunday', () => {
  const available = [tabs[0], { slug: 'quarta_quinta_verde', row: null }, {
    slug: 'sexta_pao', row: { reference_date: '2026-09-05' },
  }]
  assert.equal(selectDefaultEvent(available, new Date('2026-09-11T12:00:00Z')), 'sexta_pao')
  assert.equal(selectDefaultEvent(available, new Date('2026-09-13T12:00:00Z')), 'sexta_pao')
  assert.equal(selectDefaultEvent([], new Date('2026-09-11T12:00:00Z')), null)
})
