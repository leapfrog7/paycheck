const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseCalendarDate(value) {
  const match = CALENDAR_DATE_PATTERN.exec(value ?? '')
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toISOString().slice(0, 10) === value ? date : null
}

export function formatCalendarDate(date) {
  return date.toISOString().slice(0, 10)
}

export function addCalendarDays(value, days) {
  const date = parseCalendarDate(value)
  if (!date) return null
  date.setUTCDate(date.getUTCDate() + days)
  return formatCalendarDate(date)
}

export function calendarDaysInclusive(from, to) {
  const start = parseCalendarDate(from)
  const end = parseCalendarDate(to)
  if (!start || !end || end < start) return null
  return Math.floor((end - start) / 86400000) + 1
}

export function calendarMonthStart(value) {
  const date = parseCalendarDate(value)
  return date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01` : null
}

export function calendarMonthEnd(value) {
  const date = parseCalendarDate(value)
  return date ? formatCalendarDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))) : null
}
