import { createResolvedDniDecision, createUnresolvedDniDecision, readDniDecision } from '../../../domain/pay/dni/dniDecision'
import { evaluateIncrementQualifyingService } from './evaluateIncrementQualifyingService'
import { addCalendarYearsPreservingDate, dniTrigger, getDniEventDate, hasAnnualIncrementInYear, hasPriorUnresolvedDniAffectingEvent } from './dniResolverUtils'

export const FIFTH_CPC_DNI_RULE_ID = '5CPC_INDIVIDUAL_ANNUAL_DNI'

export function resolve5CpcDni({ payState, triggeringEvent = {}, eventHistory = [], serviceStatusHistory = [] }) {
  const trigger = dniTrigger(triggeringEvent)
  if (triggeringEvent.type === 'REGULAR_PROMOTION') {
    return createUnresolvedDniDecision({ cpc: 5, ruleId: '5CPC_PROMOTION_DNI', trigger, reason: '5CPC_POST_PROMOTION_DNI_NOT_IMPLEMENTED', explanation: 'No verified post-promotion individual DNI rule is implemented for 5th CPC.' })
  }
  if (triggeringEvent.type === 'ACP') {
    return createUnresolvedDniDecision({ cpc: 5, ruleId: '5CPC_ACP_DNI', trigger, reason: '5CPC_POST_ACP_DNI_NOT_IMPLEMENTED', explanation: 'No verified post-ACP individual DNI rule is implemented for 5th CPC.' })
  }
  if (triggeringEvent.type !== 'ANNUAL_INCREMENT') {
    return createUnresolvedDniDecision({ cpc: 5, ruleId: FIFTH_CPC_DNI_RULE_ID, trigger, reason: '5CPC_DNI_TRIGGER_NOT_IMPLEMENTED', explanation: 'Only ordinary 5th CPC annual DNI continuation is implemented.' })
  }
  const current = readDniDecision(payState)
  const eventDate = getDniEventDate(triggeringEvent)
  if (!current || current.status !== 'RESOLVED') {
    return createUnresolvedDniDecision({ cpc: 5, ruleId: FIFTH_CPC_DNI_RULE_ID, trigger, reason: current?.reason ?? 'DNI_NOT_RESOLVED', explanation: 'A resolved individual 5th CPC DNI is required.' })
  }
  if (eventDate !== current.date) {
    return createUnresolvedDniDecision({ cpc: 5, ruleId: FIFTH_CPC_DNI_RULE_ID, trigger, candidateDni: current.date, reason: 'INCREMENT_DATE_DOES_NOT_MATCH_DNI', explanation: 'The annual increment event date does not match the resolved DNI.' })
  }
  if (hasPriorUnresolvedDniAffectingEvent(eventHistory)) {
    return createUnresolvedDniDecision({ cpc: 5, ruleId: FIFTH_CPC_DNI_RULE_ID, trigger, reason: 'PRIOR_UNRESOLVED_EVENT_MAY_AFFECT_DNI', explanation: 'A prior unresolved event may have changed DNI.' })
  }
  if (hasAnnualIncrementInYear(eventHistory, eventDate.slice(0, 4))) {
    return createUnresolvedDniDecision({ cpc: 5, ruleId: FIFTH_CPC_DNI_RULE_ID, trigger, reason: 'ORDINARY_INCREMENT_ALREADY_GRANTED_IN_CYCLE', explanation: 'An ordinary increment has already been granted in this annual cycle.' })
  }
  const candidateDni = addCalendarYearsPreservingDate(eventDate)
  if (!candidateDni) {
    return createUnresolvedDniDecision({ cpc: 5, ruleId: FIFTH_CPC_DNI_RULE_ID, trigger, reason: 'NEXT_DNI_DATE_NOT_DEFINED', explanation: 'The individual month/day cannot be preserved in the next calendar year.' })
  }
  const qualifyingService = evaluateIncrementQualifyingService({ fromDate: eventDate, candidateDni, eventHistory, serviceStatusHistory, ordinaryContinuousService: true })
  if (qualifyingService.status !== 'SATISFIED') {
    return createUnresolvedDniDecision({ cpc: 5, ruleId: FIFTH_CPC_DNI_RULE_ID, trigger, candidateDni, qualifyingService, reason: qualifyingService.reason, explanation: 'Qualifying service cannot be established.' })
  }
  return createResolvedDniDecision({ cpc: 5, date: candidateDni, ruleId: FIFTH_CPC_DNI_RULE_ID, trigger, qualifyingService, explanation: 'The individual 5th CPC DNI continues one calendar year after the successful ordinary increment.' })
}
