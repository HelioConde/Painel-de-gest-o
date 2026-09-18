const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUMBER = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
})

export function money(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—'
  return BRL.format(Number(value))
}

export function quantity(value, unit = 'QTD') {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—'
  return `${NUMBER.format(Number(value))} ${unit || 'QTD'}`
}

export function metricValue(value, metric = 'monetary', unit = null) {
  return metric === 'quantity' ? quantity(value, unit) : money(value)
}

export function percent(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—'
  const sign = Number(value) > 0 ? '+' : ''
  return `${sign}${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

export function isoDate(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(value)
}

export function shortIsoDate(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${String(year).slice(-2)}` : String(value)
}

export function periodLabel(start, end, { short = false } = {}) {
  const format = short ? shortIsoDate : isoDate
  if (!start && !end) return '—'
  if (start === end) return format(start)
  return `${format(start)} a ${format(end)}`
}
