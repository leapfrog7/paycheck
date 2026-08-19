import { HISTORICAL_DA_RATES } from '../../../data/allowances/da/historicalDaRates'
import { HRA_SCHEMES } from '../../../data/allowances/hra/hraRuleSchemes'
import { SIXTH_CPC_TRANSPORT_RULE, SEVENTH_CPC_TRANSPORT_RULE } from '../../../data/allowances/transport/transportAllowanceRules'
import { addCalendarDays, calendarDaysInclusive, parseCalendarDate } from '../../../domain/dates/calendarDate'

function failure(reason, errors) {
  return { success: false, status: 'UNRESOLVED', reason, errors, segments: [] }
}

function intersects(state, from, to) {
  return state.effectiveFrom <= to && (!state.effectiveTo || state.effectiveTo >= from)
}

function validateDatedHistory(history, label) {
  const sorted = [...history].sort((first, second) => first.effectiveFrom.localeCompare(second.effectiveFrom))
  for (let index = 0; index < sorted.length; index += 1) {
    const state = sorted[index]
    if (!parseCalendarDate(state.effectiveFrom) || state.effectiveTo && !parseCalendarDate(state.effectiveTo)) return `${label} contains an invalid effective date.`
    if (state.effectiveTo && state.effectiveTo < state.effectiveFrom) return `${label} contains an invalid effective range.`
    const previous = sorted[index - 1]
    if (previous && (!previous.effectiveTo || previous.effectiveTo >= state.effectiveFrom)) return `${label} contains overlapping dated states.`
  }
  return null
}

function stateAt(history, date) {
  return history.find((state) => state.effectiveFrom <= date && (!state.effectiveTo || state.effectiveTo >= date)) ?? null
}

function paySegmentAt(paySegments, date) {
  return paySegments.find((segment) => segment.from <= date && segment.to >= date) ?? null
}

function notionalPeriodAt(periods, date) {
  return periods.find((period) => period.effectiveFrom <= date && period.effectiveTo >= date) ?? null
}

function addStateBoundaries(boundaries, history, startDate, endDate) {
  history.filter((state) => intersects(state, startDate, endDate)).forEach((state) => {
    if (state.effectiveFrom > startDate) boundaries.add(state.effectiveFrom)
    if (state.effectiveTo) {
      const after = addCalendarDays(state.effectiveTo, 1)
      if (after <= endDate) boundaries.add(after)
    }
  })
}

export function buildFinancialSegments({
  payHistory,
  startDate,
  endDate,
  locationHistory = [],
  eligibilityHistory = [],
  customAllowanceDefinitions = [],
} = {}) {
  if (!payHistory?.success) return failure('INVALID_PAY_HISTORY', ['A successfully replayed Pay History is required.'])
  if (!parseCalendarDate(startDate) || !parseCalendarDate(endDate) || endDate < startDate) return failure('INVALID_CASE_PERIOD', ['A valid chronological case period is required.'])
  const locationError = validateDatedHistory(locationHistory, 'Location history')
  const eligibilityError = validateDatedHistory(eligibilityHistory, 'Eligibility history')
  if (locationError || eligibilityError) return failure('INVALID_DATED_STATE_HISTORY', [locationError, eligibilityError].filter(Boolean))

  const paySegments = payHistory.months.flatMap((month) => month.segments)
  const boundaries = new Set([startDate, addCalendarDays(endDate, 1)])
  const notionalPeriods = payHistory.notionalPeriods ?? []
  notionalPeriods.forEach((period) => {
    if (period.effectiveFrom > startDate && period.effectiveFrom <= endDate) boundaries.add(period.effectiveFrom)
    if (period.monetaryBenefitFrom > startDate && period.monetaryBenefitFrom <= endDate) boundaries.add(period.monetaryBenefitFrom)
  })
  paySegments.forEach((segment) => {
    if (segment.from > startDate) boundaries.add(segment.from)
    const after = addCalendarDays(segment.to, 1)
    if (after <= endDate) boundaries.add(after)
    HISTORICAL_DA_RATES.filter((rule) => Number(rule.cpc) === Number(segment.payState.cpc)
      && rule.effectiveFrom > segment.from && rule.effectiveFrom <= segment.to).forEach((rule) => boundaries.add(rule.effectiveFrom))
    HRA_SCHEMES.filter((rule) => Number(rule.cpc) === Number(segment.payState.cpc)
      && rule.effectiveFrom > segment.from && rule.effectiveFrom <= segment.to).forEach((rule) => boundaries.add(rule.effectiveFrom))
    const transportRule = Number(segment.payState.cpc) === 6 ? SIXTH_CPC_TRANSPORT_RULE : Number(segment.payState.cpc) === 7 ? SEVENTH_CPC_TRANSPORT_RULE : null
    if (transportRule?.effectiveFrom > segment.from && transportRule.effectiveFrom <= segment.to) boundaries.add(transportRule.effectiveFrom)
  })
  addStateBoundaries(boundaries, locationHistory, startDate, endDate)
  addStateBoundaries(boundaries, eligibilityHistory, startDate, endDate)
  addStateBoundaries(
    boundaries,
    customAllowanceDefinitions.filter((definition) => definition.status === 'ACTIVE'),
    startDate,
    endDate,
  )

  const ordered = [...boundaries].filter(Boolean).sort()
  const allEvents = payHistory.months.flatMap((month) => month.events)
  const segments = []
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const effectiveFrom = ordered[index]
    const effectiveTo = addCalendarDays(ordered[index + 1], -1)
    if (effectiveFrom > endDate || effectiveTo < startDate) continue
    const paySegment = paySegmentAt(paySegments, effectiveFrom)
    if (!paySegment) return failure('PAY_HISTORY_GAP', [`No Pay History state covers ${effectiveFrom}.`])
    const applicableCustomDefinitions = customAllowanceDefinitions.filter((definition) => definition.status === 'ACTIVE' && intersects(definition, effectiveFrom, effectiveTo))
    const notionalPeriod = notionalPeriodAt(notionalPeriods, effectiveFrom)
    segments.push({
      effectiveFrom, effectiveTo, days: calendarDaysInclusive(effectiveFrom, effectiveTo),
      payState: structuredClone(paySegment.payState), basicPay: paySegment.basicPay,
      payHistoryStatus: paySegment.status,
      monetaryStatus: notionalPeriod ? 'NOTIONAL_ONLY' : 'MONETARY',
      notionalRefixationEventId: notionalPeriod?.eventId ?? null,
      unresolvedEventIds: [...paySegment.unresolvedEventIds],
      locationState: structuredClone(stateAt(locationHistory, effectiveFrom)),
      eligibilityState: structuredClone(stateAt(eligibilityHistory, effectiveFrom)),
      customAllowanceDefinitions: structuredClone(applicableCustomDefinitions),
      provenance: {
        ...paySegment.derivedFrom,
        locationStateId: stateAt(locationHistory, effectiveFrom)?.id ?? null,
        eligibilityStateId: stateAt(eligibilityHistory, effectiveFrom)?.id ?? null,
        customAllowanceDefinitionIds: applicableCustomDefinitions.map(({ id }) => id),
        auditEvents: allEvents.filter((event) => event.effectiveDate >= effectiveFrom && event.effectiveDate <= effectiveTo),
      },
    })
  }

  for (let index = 0; index < segments.length; index += 1) {
    if (index === 0 && segments[index].effectiveFrom !== startDate) return failure('FINANCIAL_SEGMENT_GAP', ['Financial segments do not begin at the case start.'])
    if (index > 0 && addCalendarDays(segments[index - 1].effectiveTo, 1) !== segments[index].effectiveFrom) return failure('FINANCIAL_SEGMENT_GAP_OR_OVERLAP', ['Financial segments contain a gap or overlap.'])
  }
  if (!segments.length || segments.at(-1).effectiveTo !== endDate) return failure('FINANCIAL_SEGMENT_GAP', ['Financial segments do not cover the complete case period.'])
  return { success: true, status: 'RESOLVED', startDate, endDate, segments }
}
