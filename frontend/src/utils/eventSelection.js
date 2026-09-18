const EVENTS_BY_WEEKDAY = {
  Mon: 'fim_semana',
  Tue: 'segunda_pizza',
  Wed: 'terca_carne',
  Thu: 'quarta_quinta_verde',
  Fri: 'quarta_quinta_verde',
  Sat: 'sexta_pao',
}

export function selectDefaultEvent(tabs, now = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(now)
  const available = tabs.filter((tab) => tab.row)
  const scheduled = available.find((tab) => tab.slug === EVENTS_BY_WEEKDAY[weekday])
  if (scheduled) return scheduled.slug

  // Sem coleta para o dia (inclusive domingo), abre o evento mais recente.
  return [...available].sort((a, b) =>
    String(b.row.reference_date || b.row.current_end || '').localeCompare(
      String(a.row.reference_date || a.row.current_end || ''),
    ),
  )[0]?.slug ?? null
}
