import { createResolvedDniDecision, createUnresolvedDniDecision, readDniDecision } from '../../../domain/pay/dni/dniDecision'
import { parseCalendarDate } from '../../../domain/dates/calendarDate'
import { evaluateIncrementQualifyingService } from './evaluateIncrementQualifyingService'
import { dniTrigger, getDniEventDate, hasAnnualIncrementInYear, hasPriorUnresolvedDniAffectingEvent } from './dniResolverUtils'

export const SIXTH_CPC_DNI_RULE_ID = '6CPC_RULE10_DNI'

function nextJulyAfter(value) {
  const date = parseCalendarDate(value)
  if (!date) return null
  const year = date.getUTCFullYear()
  const thisJuly = `${year}-07-01`
  return value < thisJuly ? thisJuly : `${year + 1}-07-01`
}

export function resolve6CpcDni({ payState, triggeringEvent = {}, eventHistory = [], serviceStatusHistory = [], context = {} }) {
  const trigger = dniTrigger(triggeringEvent)
  const eventDate = getDniEventDate(triggeringEvent)
  if (hasPriorUnresolvedDniAffectingEvent(eventHistory)) {
    return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, reason: 'PRIOR_UNRESOLVED_EVENT_MAY_AFFECT_DNI', explanation: 'A prior unresolved event may have changed DNI.' })
  }
  if (triggeringEvent.type === 'ANNUAL_INCREMENT') {
    const current = readDniDecision(payState)
    if (!current || current.status !== 'RESOLVED') return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, reason: current?.reason ?? 'DNI_NOT_RESOLVED', explanation: 'A resolved 6th CPC DNI is required.' })
    if (eventDate !== current.date) return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, candidateDni: current.date, reason: 'INCREMENT_DATE_DOES_NOT_MATCH_DNI', explanation: 'The annual increment event date does not match resolved DNI.' })
    if (!eventDate.endsWith('-07-01')) return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, reason: 'UNSUPPORTED_6CPC_DNI_DATE', explanation: 'Ordinary 6th CPC DNI must be 1 July.' })
    if (hasAnnualIncrementInYear(eventHistory, eventDate.slice(0, 4))) return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, reason: 'ORDINARY_INCREMENT_ALREADY_GRANTED_IN_CYCLE', explanation: 'An ordinary increment has already been granted in this annual cycle.' })
    const candidateDni = `${Number(eventDate.slice(0, 4)) + 1}-07-01`
    const qualifyingService = evaluateIncrementQualifyingService({ fromDate: eventDate, candidateDni, eventHistory, serviceStatusHistory, ordinaryContinuousService: true })
    if (qualifyingService.status !== 'SATISFIED') return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, candidateDni, qualifyingService, reason: qualifyingService.reason, explanation: 'Qualifying service cannot be established.' })
    return createResolvedDniDecision({ cpc: 6, date: candidateDni, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, qualifyingService, explanation: 'After the successful ordinary 1 July increment, the next ordinary DNI is 1 July of the following year.' })
  }

  if (triggeringEvent.type === 'FIXATION_FROM_LOWER_POST_DNI') {
    const candidateDni = eventDate.endsWith('-07-01') ? `${Number(eventDate.slice(0, 4)) + 1}-07-01` : null
    if (!candidateDni) return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, reason: 'INVALID_LOWER_POST_DNI_FIXATION_DATE', explanation: 'Ordinary 6th CPC fixation from lower-post DNI must occur on 1 July.' })
    const qualifyingService = evaluateIncrementQualifyingService({
      fromDate: eventDate, candidateDni, eventHistory, serviceStatusHistory,
      explicitlyEstablished: triggeringEvent.qualifyingServiceEstablished === true,
    })
    if (qualifyingService.status !== 'SATISFIED') return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, candidateDni, qualifyingService, reason: '6CPC_INCREMENT_QUALIFYING_SERVICE_NOT_ESTABLISHED', explanation: 'The next 1 July candidate is known, but qualifying service in the promoted structure is not established.' })
    return createResolvedDniDecision({ cpc: 6, date: candidateDni, ruleId: '6CPC_RULE10_FROM_LOWER_POST_DNI', trigger, qualifyingService, explanation: 'The next ordinary 6th CPC DNI is 1 July following the final lower-post-DNI fixation, with qualifying service explicitly established.' })
  }

  if (['REGULAR_PROMOTION', 'MACP', 'INITIAL_APPOINTMENT'].includes(triggeringEvent.type)) {
    const candidateDni = nextJulyAfter(eventDate)
    const qualifyingService = evaluateIncrementQualifyingService({
      fromDate: eventDate,
      candidateDni,
      eventHistory,
      serviceStatusHistory,
      explicitlyEstablished: triggeringEvent.qualifyingServiceEstablished === true || context.qualifyingServiceEstablished === true,
    })
    if (qualifyingService.status !== 'SATISFIED') return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, candidateDni, qualifyingService, reason: '6CPC_INCREMENT_QUALIFYING_SERVICE_NOT_ESTABLISHED', explanation: 'The candidate 1 July is known, but qualifying service is not established.' })
    return createResolvedDniDecision({ cpc: 6, date: candidateDni, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, qualifyingService, explanation: 'The ordinary 6th CPC DNI is 1 July after the triggering event, with qualifying service explicitly established.' })
  }

  if (triggeringEvent.type === 'DELAYED_CPC_SWITCH') {
    return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, reason: 'DELAYED_6CPC_SWITCH_DNI_NOT_RESOLVED', explanation: 'The delayed 5th-to-6th CPC pay fixation is resolved, but its first 6th CPC DNI is not established by the implemented rules.' })
  }

  if (triggeringEvent.type === 'CPC_TRANSITION') {
    return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, reason: 'POST_6CPC_TRANSITION_DNI_NOT_IMPLEMENTED', explanation: 'The 5th-to-6th CPC monetary transition is supported, but a post-transition DNI cannot be inferred from the documented rules.' })
  }

  return createUnresolvedDniDecision({ cpc: 6, ruleId: SIXTH_CPC_DNI_RULE_ID, trigger, reason: '6CPC_DNI_TRIGGER_NOT_IMPLEMENTED', explanation: 'DNI resolution for this 6th CPC trigger is not implemented.' })
}
