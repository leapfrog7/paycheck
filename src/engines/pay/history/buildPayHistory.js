import { calculatePayEventTimeline } from '../eventTimeline'
import { validate5CpcPayState } from '../../../domain/pay/payStateValidation'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parseCalendarDate(value) {
  const match = DATE_PATTERN.exec(value ?? '')
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { year, month, day, date }
}

function formatCalendarDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function addDays(value, days) {
  const parsed = parseCalendarDate(value)
  const date = new Date(parsed.date)
  date.setUTCDate(date.getUTCDate() + days)
  return formatCalendarDate(date)
}

function monthEnd(year, month) {
  return formatCalendarDate(new Date(Date.UTC(year, month, 0)))
}

function eventId(entry, index) {
  return entry.event?.id ?? entry.event?.eventId ?? `event-${index + 1}`
}

function eventEffectiveDate(entry) {
  return entry.result?.after?.effectiveFrom
    ?? entry.result?.effectiveDate
    ?? entry.event?.employeeSwitchDate
    ?? entry.event?.fixationDate
    ?? entry.event?.effectiveFrom
    ?? entry.event?.effectiveDate
    ?? entry.event?.eventDate
    ?? ''
}

function financialState(state = {}) {
  const common = {
    cpc: Number(state.cpc), basicPay: Number(state.basicPay),
    structuralStatus: state.structuralStatus ?? 'STANDARD',
    sourceType: state.sourceType ?? 'SYSTEM_DERIVED',
    correctionProvenance: structuredClone(state.correctionProvenance ?? null),
  }
  if (Number(state.cpc) === 5) {
    return {
      ...common,
      payScaleId: state.payScaleId ?? state.payScaleCode ?? state.payScale,
      payScaleLabel: state.payScaleLabel,
      stageIndex: Number(state.stageIndex),
    }
  }
  if (Number(state.cpc) === 6) {
    return {
      ...common,
      payBand: state.payBand ?? state.payBandCode,
      payInBand: Number(state.payInBand ?? state.payInPayBand),
      gradePay: Number(state.gradePay),
    }
  }
  return {
    ...common,
    level: String(state.level ?? state.payLevel),
    cellIndex: Number(state.cellIndex),
  }
}

function sameFinancialState(first, second) {
  return JSON.stringify(financialState(first)) === JSON.stringify(financialState(second))
}

function provenance(entry, index, date) {
  return {
    eventId: eventId(entry, index),
    eventType: entry.event?.type ?? null,
    effectiveDate: date,
    success: Boolean(entry.result?.success),
    ruleId: entry.result?.ruleId ?? entry.event?.ruleId ?? null,
    transformationId: entry.result?.transformationId ?? entry.event?.id ?? entry.result?.eventId ?? eventId(entry, index),
    payFixationEffect: entry.result?.payFixationEffect ?? null,
    reason: entry.result?.reason ?? null,
    sourceType: entry.result?.provenance?.sourceType ?? 'SYSTEM_DERIVED',
    monetaryBenefitFrom: entry.result?.monetaryBenefitFrom ?? null,
    monetaryEffect: entry.result?.monetaryEffect ?? null,
  }
}

function validationFailure(reason, message) {
  return { success: false, status: 'UNRESOLVED', reason, errors: [message], months: [] }
}

function createTransitionGroups(entries) {
  const groups = []
  entries.forEach((entry, index) => {
    const effectiveDate = eventEffectiveDate(entry)
    const item = { entry, index, effectiveDate, provenance: provenance(entry, index, effectiveDate) }
    const lastGroup = groups.at(-1)
    if (lastGroup?.effectiveDate === effectiveDate) lastGroup.items.push(item)
    else groups.push({ effectiveDate, items: [item] })
  })
  return groups
}

function splitSegments(openingState, groups, startDate, endDate) {
  let activeState = structuredClone(openingState)
  let activeSource = {
    openingStateId: openingState.id ?? null,
    latestAppliedEventId: null,
    transformationId: null,
    ruleId: null,
  }
  const unresolvedIds = new Set()
  const segments = []
  const events = []
  let cursor = startDate

  for (const group of groups) {
    const { effectiveDate } = group
    if (!parseCalendarDate(effectiveDate)) continue
    if (effectiveDate > endDate) break

    const priorState = structuredClone(activeState)
    const priorSource = { ...activeSource }
    const priorUnresolvedIds = [...unresolvedIds]
    let finalSuccessfulItem = null
    for (const item of group.items) {
      events.push(item.provenance)
      if (!item.entry.result?.success) unresolvedIds.add(item.provenance.eventId)
      if (item.entry.result?.success && item.entry.result.after) {
        activeState = structuredClone(item.entry.result.after)
        finalSuccessfulItem = item
      }
      if (item.entry.result?.success && item.entry.result.certaintyReset) unresolvedIds.clear()
    }

    const financialChange = !sameFinancialState(priorState, activeState)
    const unresolvedChange = unresolvedIds.size !== priorUnresolvedIds.length
    if (finalSuccessfulItem && financialChange) {
      activeSource = {
        openingStateId: openingState.id ?? null,
        latestAppliedEventId: finalSuccessfulItem.provenance.eventId,
        transformationId: finalSuccessfulItem.provenance.transformationId,
        ruleId: finalSuccessfulItem.provenance.ruleId,
      }
    }

    if (effectiveDate < startDate) continue

    const previousEnd = addDays(effectiveDate, -1)
    if (cursor <= previousEnd && (financialChange || unresolvedChange)) {
      segments.push({
        from: cursor,
        to: previousEnd,
        payState: financialState(priorState),
        basicPay: Number(priorState.basicPay),
        derivedFrom: priorSource,
        status: priorUnresolvedIds.length ? 'PARTIALLY_RESOLVED' : 'RESOLVED',
        unresolvedEventIds: priorUnresolvedIds,
      })
      cursor = effectiveDate
    }
  }

  if (cursor <= endDate) {
    segments.push({
      from: cursor,
      to: endDate,
      payState: financialState(activeState),
      basicPay: Number(activeState.basicPay),
      derivedFrom: activeSource,
      status: unresolvedIds.size ? 'PARTIALLY_RESOLVED' : 'RESOLVED',
      unresolvedEventIds: [...unresolvedIds],
    })
  }

  return { segments, events }
}

function createMonths(ledgerSegments, events, startDate, endDate) {
  const months = []
  let cursor = parseCalendarDate(startDate)
  const final = parseCalendarDate(endDate)

  while (cursor.year < final.year || cursor.year === final.year && cursor.month <= final.month) {
    const calendarStart = `${cursor.year}-${String(cursor.month).padStart(2, '0')}-01`
    const calendarEnd = monthEnd(cursor.year, cursor.month)
    const periodStart = calendarStart < startDate ? startDate : calendarStart
    const periodEnd = calendarEnd > endDate ? endDate : calendarEnd
    const segments = ledgerSegments
      .filter((segment) => segment.from <= periodEnd && segment.to >= periodStart)
      .map((segment) => ({
        ...segment,
        from: segment.from < periodStart ? periodStart : segment.from,
        to: segment.to > periodEnd ? periodEnd : segment.to,
      }))
    const periodEvents = events.filter((event) => event.effectiveDate >= periodStart && event.effectiveDate <= periodEnd)
    const unresolvedEventIds = [...new Set(segments.flatMap((segment) => segment.unresolvedEventIds))]

    months.push({
      year: cursor.year,
      month: cursor.month,
      periodStart,
      periodEnd,
      payState: segments.length === 1 ? segments[0].payState : null,
      basicPay: segments.length === 1 ? segments[0].basicPay : null,
      derivedFrom: segments.length === 1 ? segments[0].derivedFrom : null,
      segments,
      events: periodEvents,
      status: unresolvedEventIds.length ? 'PARTIALLY_RESOLVED' : 'RESOLVED',
      unresolvedEventIds,
    })

    const next = new Date(Date.UTC(cursor.year, cursor.month, 1))
    cursor = { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 }
  }
  return months
}

export function buildPayHistory({ openingState = {}, events = [], startDate, endDate } = {}) {
  if (!parseCalendarDate(startDate)) return validationFailure('INVALID_START_DATE', 'A valid calculation startDate in YYYY-MM-DD format is required.')
  if (!parseCalendarDate(endDate)) return validationFailure('INVALID_END_DATE', 'A valid calculation endDate in YYYY-MM-DD format is required.')
  if (endDate < startDate) return validationFailure('END_DATE_BEFORE_START_DATE', 'The calculation endDate cannot be before startDate.')
  if (![5, 6, 7].includes(Number(openingState.cpc)) || !Number.isFinite(Number(openingState.basicPay))) {
    return validationFailure('INVALID_OPENING_PAY_STATE', 'A valid 5th, 6th or 7th CPC opening Pay State with Basic Pay is required.')
  }
  if (Number(openingState.cpc) === 5) {
    const validation = validate5CpcPayState(openingState)
    if (!validation.valid) return validationFailure('INVALID_OPENING_PAY_STATE', validation.errors[0].message)
  }

  const replay = calculatePayEventTimeline(openingState, events)
  const groups = createTransitionGroups(replay.entries)
  const unplaceableEvent = groups.find((group) => !parseCalendarDate(group.effectiveDate))
  if (unplaceableEvent) {
    return validationFailure(
      'UNPLACEABLE_EVENT_DATE',
      `Event ${eventId(unplaceableEvent.items[0].entry, unplaceableEvent.items[0].index)} has no valid financial effective date.`,
    )
  }
  const nonChronologicalGroup = groups.find((group, index) => index > 0 && group.effectiveDate < groups[index - 1].effectiveDate)
  if (nonChronologicalGroup) {
    return validationFailure(
      'NON_CHRONOLOGICAL_TRANSFORMATION_DATES',
      'Replayed transformation effective dates are not chronological, so the affected Pay State cannot be placed safely.',
    )
  }
  const { segments, events: provenanceEvents } = splitSegments(openingState, groups, startDate, endDate)
  const months = createMonths(segments, provenanceEvents, startDate, endDate)
  const unresolvedEventIds = [...new Set(months.flatMap((month) => month.unresolvedEventIds))]
  const notionalPeriods = replay.entries
    .filter(({ result }) => result?.success && result.monetaryEffect === 'NOTIONAL_THEN_MONETARY')
    .map(({ result, event }) => ({
      eventId: event.id ?? event.eventId ?? null,
      effectiveFrom: result.effectiveDate,
      effectiveTo: addDays(result.monetaryBenefitFrom, -1),
      monetaryBenefitFrom: result.monetaryBenefitFrom,
    }))

  return {
    success: true,
    status: unresolvedEventIds.length ? 'PARTIALLY_RESOLVED' : 'RESOLVED',
    startDate,
    endDate,
    months,
    unresolvedEventIds,
    notionalPeriods,
    replay,
  }
}
