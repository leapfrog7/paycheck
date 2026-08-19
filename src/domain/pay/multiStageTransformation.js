import { addCalendarDays, parseCalendarDate } from '../dates/calendarDate'

export function createMultiStagePayTransformation({
  event, ruleId, before, lowerPostDni, interimPayState, interimSteps = [],
  finalPayState, finalSteps = [], dniDecision, semantics = {},
}) {
  const eventDate = event.effectiveDate ?? event.eventDate ?? ''
  if (!parseCalendarDate(eventDate) || !parseCalendarDate(lowerPostDni) || eventDate >= lowerPostDni) return null
  const eventId = event.id ?? event.eventId ?? null
  const commonProvenance = {
    originatingEventId: eventId,
    eventType: event.type,
    ruleId,
    fixationOption: 'FROM_LOWER_POST_DNI',
    lowerPostDni,
  }
  return {
    success: true,
    status: 'CALCULATED',
    ruleId,
    eventId,
    eventType: event.type,
    before,
    fixationOption: 'FROM_LOWER_POST_DNI',
    lowerPostDni,
    careerEffect: semantics.careerEffect ?? null,
    payFixationEffect: 'DEFERRED_TO_LOWER_POST_DNI',
    reachedBy: semantics.reachedBy ?? null,
    macpNumber: semantics.macpNumber ?? null,
    interim: {
      stateType: 'INTERIM_PAY_STATE',
      effectiveFrom: eventDate,
      effectiveTo: addCalendarDays(lowerPostDni, -1),
      payState: interimPayState,
      steps: interimSteps,
      provenance: commonProvenance,
    },
    finalFixation: {
      stateType: 'FINAL_FIXATION_STATE',
      effectiveFrom: lowerPostDni,
      after: finalPayState,
      steps: finalSteps,
      consumedAnnualIncrement: {
        date: lowerPostDni,
        status: 'CONSUMED_BY_FIXATION',
        originatingEventId: eventId,
      },
      provenance: commonProvenance,
    },
    stateTransitions: [
      { stateType: 'INTERIM_PAY_STATE', effectiveFrom: eventDate, after: interimPayState, provenance: commonProvenance },
      { stateType: 'FINAL_FIXATION_STATE', effectiveFrom: lowerPostDni, after: finalPayState, provenance: commonProvenance, consumedAnnualIncrement: true },
    ],
    after: interimPayState,
    dniDecision,
  }
}
