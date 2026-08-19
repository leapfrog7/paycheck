import { applyPayEvent } from './applyPayEvent'

function getEventDate(event = {}) {
  return event.employeeSwitchDate
    ?? event.fixationDate
    ?? event.effectiveFrom
    ?? event.effectiveDate
    ?? event.eventDate
    ?? ''
}

function getEventId(event = {}) {
  return event.id ?? event.eventId ?? null
}

function compareQueueItems(first, second) {
  const dateComparison = first.effectiveDate.localeCompare(second.effectiveDate)
  if (dateComparison) return dateComparison
  const firstTriggersSecond = getEventId(first.event) === second.event?.option?.triggerEventId
  const secondTriggersFirst = getEventId(second.event) === first.event?.option?.triggerEventId
  if (firstTriggersSecond !== secondTriggersFirst) return firstTriggersSecond ? -1 : 1
  const firstRelatedToSecond = first.event?.relatedEventId === getEventId(second.event)
  const secondRelatedToFirst = second.event?.relatedEventId === getEventId(first.event)
  if (firstRelatedToSecond && first.event.correctionBasis === 'BEFORE_EVENT') return -1
  if (firstRelatedToSecond && first.event.correctionBasis === 'AFTER_EVENT') return 1
  if (secondRelatedToFirst && second.event.correctionBasis === 'BEFORE_EVENT') return 1
  if (secondRelatedToFirst && second.event.correctionBasis === 'AFTER_EVENT') return -1
  if (first.kind !== second.kind) return first.kind === 'DERIVED_FINAL_FIXATION' ? -1 : 1
  return first.originalIndex - second.originalIndex
}

export function calculatePayEventTimeline(openingPayState = {}, events = []) {
  const dniEventsByDate = new Map()
  for (const event of events) {
    const date = getEventDate(event)
    if (!date) continue
    const types = dniEventsByDate.get(date) ?? new Set()
    types.add(event.type)
    dniEventsByDate.set(date, types)
  }
  const ambiguousDates = new Set([...dniEventsByDate].filter(([, types]) => types.has('ANNUAL_INCREMENT') && (types.has('REGULAR_PROMOTION') || types.has('ACP') || types.has('MACP'))).map(([date]) => date))
  const correctionTypes = new Set(['PAY_REFIXATION', 'NOTIONAL_REFIXATION'])
  const ambiguousCorrectionEvents = new Set()
  for (const event of events) {
    if (!correctionTypes.has(event.type) || event.correctionBasis && event.relatedEventId) continue
    const sameDateOthers = events.filter((candidate) => candidate !== event && getEventDate(candidate) === getEventDate(event) && !['DNI_ADJUSTMENT', ...correctionTypes].includes(candidate.type))
    if (sameDateOthers.length) {
      ambiguousCorrectionEvents.add(event)
      sameDateOthers.forEach((candidate) => ambiguousCorrectionEvents.add(candidate))
    }
  }
  const queue = events
    .map((event, originalIndex) => ({ kind: 'USER_EVENT', event, originalIndex, effectiveDate: getEventDate(event) }))
    .sort(compareQueueItems)

  const entries = []
  const consumedAnnualIncrementDates = new Set()
  let currentPayState = structuredClone(openingPayState)
  let certaintyHistoryStart = 0

  while (queue.length) {
    const item = queue.shift()
    if (item.kind === 'DERIVED_FINAL_FIXATION') {
      const before = structuredClone(currentPayState)
      const result = {
        success: true,
        status: 'CALCULATED',
        ruleId: item.originResult.ruleId,
        eventId: item.event.id ?? item.event.eventId ?? null,
        stateType: 'FINAL_FIXATION_STATE',
        payFixationEffect: 'FINAL_FIXATION_FROM_LOWER_POST_DNI',
        fixationOption: 'FROM_LOWER_POST_DNI',
        lowerPostDni: item.transition.effectiveFrom,
        before,
        after: structuredClone(item.transition.after),
        steps: structuredClone(item.originResult.finalFixation.steps),
        dniDecision: structuredClone(item.originResult.dniDecision),
        consumedAnnualIncrement: structuredClone(item.originResult.finalFixation.consumedAnnualIncrement),
        transformationId: item.event.id ?? item.event.eventId ?? null,
        derivedFromOriginatingEvent: true,
      }
      entries.push({ event: item.event, before, result, derived: true, originatingEvent: item.originatingEvent })
      currentPayState = structuredClone(result.after)
      consumedAnnualIncrementDates.add(item.transition.effectiveFrom)
      continue
    }

    const { event } = item
    const before = structuredClone(currentPayState)
    const result = applyPayEvent(before, event, {
      history: entries.slice(certaintyHistoryStart),
      sameDateDniOrderingUnresolved: ambiguousDates.has(getEventDate(event)),
      sameDateCorrectionOrderingUnresolved: ambiguousCorrectionEvents.has(event),
      consumedAnnualIncrementDates,
    })
    const entry = { event, before, result }
    entries.push(entry)

    if (result?.success && result.after) {
      currentPayState = structuredClone(result.after)
    }
    if (result?.success && result.certaintyReset) certaintyHistoryStart = entries.length

    const finalTransition = result?.stateTransitions?.find(({ stateType }) => stateType === 'FINAL_FIXATION_STATE')
    if (finalTransition) {
      queue.push({
        kind: 'DERIVED_FINAL_FIXATION',
        effectiveDate: finalTransition.effectiveFrom,
        originalIndex: item.originalIndex,
        event: { ...event, effectiveDate: finalTransition.effectiveFrom, fixationDate: finalTransition.effectiveFrom, derivedStateType: 'FINAL_FIXATION_STATE' },
        originatingEvent: event,
        transition: finalTransition,
        originResult: result,
      })
      queue.sort(compareQueueItems)
    }
  }

  return { entries, currentPayState }
}
