import { parseCalendarDate } from '../../../domain/dates/calendarDate'

export function getDniEventDate(event = {}) {
  return event.employeeSwitchDate ?? event.fixationDate ?? event.effectiveFrom ?? event.effectiveDate ?? event.eventDate ?? ''
}

export function addCalendarYearsPreservingDate(value, years = 1) {
  const date = parseCalendarDate(value)
  if (!date) return null
  const candidate = `${date.getUTCFullYear() + years}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  return parseCalendarDate(candidate) ? candidate : null
}

export function dniTrigger(event = {}) {
  return {
    type: event.type ?? 'UNKNOWN',
    eventId: event.id ?? event.eventId ?? null,
    effectiveDate: getDniEventDate(event) || null,
  }
}

export function hasPriorUnresolvedDniAffectingEvent(eventHistory = []) {
  return eventHistory.some((entry) => {
    const event = entry.event ?? entry
    const result = entry.result ?? entry.transformation
    return ['REGULAR_PROMOTION', 'MACP', 'CPC_TRANSITION', 'PAY_CORRECTION'].includes(event?.type)
      && result && (!result.success || result.dniDecision?.status === 'UNRESOLVED' || result.after?.dniDecision?.status === 'UNRESOLVED')
  })
}

export function hasAnnualIncrementInYear(eventHistory = [], year) {
  return eventHistory.some((entry) => {
    const event = entry.event ?? entry
    const result = entry.result ?? entry.transformation
    return event?.type === 'ANNUAL_INCREMENT'
      && result?.success
      && getDniEventDate(event).slice(0, 4) === String(year)
  })
}
