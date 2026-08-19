import { createResolvedDniDecision, createUnresolvedDniDecision, readDniDecision } from '../../../domain/pay/dni/dniDecision'
import { parseCalendarDate } from '../../../domain/dates/calendarDate'
import { evaluateIncrementQualifyingService } from './evaluateIncrementQualifyingService'
import { dniTrigger, getDniEventDate, hasAnnualIncrementInYear, hasPriorUnresolvedDniAffectingEvent } from './dniResolverUtils'

export const SEVENTH_CPC_DNI_RULE_ID = '7CPC_RULE10_DNI'
export const SEVENTH_CPC_INITIAL_TRANSITION_DNI_RULE_ID = '7CPC_RULE10_INITIAL_TRANSITION_DNI'

export function get7CpcCandidateDni(relevantDate) {
  const date = parseCalendarDate(relevantDate)
  if (!date) return null
  const year = date.getUTCFullYear()
  const januaryFirst = `${year}-01-01`
  const julyFirst = `${year}-07-01`
  if (relevantDate === januaryFirst) return julyFirst
  if (relevantDate >= `${year}-01-02` && relevantDate <= julyFirst) return `${year + 1}-01-01`
  return `${year + 1}-07-01`
}

export function resolve7CpcDni({ payState, triggeringEvent = {}, eventHistory = [], serviceStatusHistory = [] }) {
  const trigger = dniTrigger(triggeringEvent)
  const eventDate = getDniEventDate(triggeringEvent)
  if (hasPriorUnresolvedDniAffectingEvent(eventHistory)) return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, reason: 'PRIOR_UNRESOLVED_EVENT_MAY_AFFECT_DNI', explanation: 'A prior unresolved event may have changed DNI.' })

  if (triggeringEvent.type === 'DELAYED_CPC_SWITCH') {
    return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_INITIAL_TRANSITION_DNI_RULE_ID, trigger, reason: 'DELAYED_7CPC_SWITCH_DNI_NOT_IMPLEMENTED', explanation: 'The first DNI after a delayed 7th CPC switch is not established by the implemented rules.' })
  }

  if (triggeringEvent.type === 'CPC_TRANSITION') {
    if (eventDate !== '2016-01-01') return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_INITIAL_TRANSITION_DNI_RULE_ID, trigger, reason: 'DELAYED_7CPC_SWITCH_DNI_NOT_IMPLEMENTED', explanation: 'Only the normal revised-pay fixation on 1 January 2016 has a resolved first DNI.' })
    const qualifyingService = { status: 'SATISFIED', basis: 'INITIAL_7CPC_TRANSITION_RULE' }
    return createResolvedDniDecision({ cpc: 7, date: '2016-07-01', ruleId: SEVENTH_CPC_INITIAL_TRANSITION_DNI_RULE_ID, trigger, qualifyingService, explanation: 'Normal revised-pay fixation on 1 January 2016 carries the first 7th CPC increment on 1 July 2016.' })
  }

  if (triggeringEvent.type === 'ANNUAL_INCREMENT') {
    const current = readDniDecision(payState)
    if (!current || current.status !== 'RESOLVED') return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, reason: current?.reason ?? 'DNI_NOT_RESOLVED', explanation: 'A resolved 7th CPC DNI is required.' })
    if (eventDate !== current.date) return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, candidateDni: current.date, reason: 'INCREMENT_DATE_DOES_NOT_MATCH_DNI', explanation: 'The annual increment event date does not match resolved DNI.' })
    if (!eventDate.endsWith('-01-01') && !eventDate.endsWith('-07-01')) return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, reason: 'UNSUPPORTED_7CPC_DNI_DATE', explanation: 'Ordinary 7th CPC DNI must be 1 January or 1 July.' })
    if (hasAnnualIncrementInYear(eventHistory, eventDate.slice(0, 4))) return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, reason: 'ORDINARY_INCREMENT_ALREADY_GRANTED_IN_CYCLE', explanation: 'An ordinary increment has already been granted in this annual cycle.' })
    const candidateDni = `${Number(eventDate.slice(0, 4)) + 1}-${eventDate.slice(5)}`
    const qualifyingService = evaluateIncrementQualifyingService({ fromDate: eventDate, candidateDni, eventHistory, serviceStatusHistory, ordinaryContinuousService: true })
    if (qualifyingService.status !== 'SATISFIED') return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, candidateDni, qualifyingService, reason: qualifyingService.reason, explanation: 'Qualifying service cannot be established.' })
    return createResolvedDniDecision({ cpc: 7, date: candidateDni, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, qualifyingService, explanation: 'After one ordinary increment, the employee remains on the same annual DNI branch in the following year.' })
  }

  if (triggeringEvent.type === 'FIXATION_FROM_LOWER_POST_DNI') {
    const candidateDni = eventDate.endsWith('-01-01')
      ? `${eventDate.slice(0, 4)}-07-01`
      : eventDate.endsWith('-07-01')
        ? `${Number(eventDate.slice(0, 4)) + 1}-01-01`
        : null
    if (!candidateDni) return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, reason: 'INVALID_LOWER_POST_DNI_FIXATION_DATE', explanation: 'Fixation from lower-post DNI must occur on 1 January or 1 July.' })
    const qualifyingService = evaluateIncrementQualifyingService({ fromDate: eventDate, candidateDni, eventHistory, serviceStatusHistory, ordinaryContinuousService: true })
    if (qualifyingService.status !== 'SATISFIED') return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, candidateDni, qualifyingService, reason: qualifyingService.reason, explanation: 'The six-month qualifying-service condition cannot be finalized.' })
    return createResolvedDniDecision({ cpc: 7, date: candidateDni, ruleId: '7CPC_RULE10_FROM_LOWER_POST_DNI', trigger, qualifyingService, explanation: 'After final fixation from lower-post DNI, the first increment in the promoted Level follows on the opposite January/July branch after six months.' })
  }

  if (['REGULAR_PROMOTION', 'MACP', 'INITIAL_APPOINTMENT'].includes(triggeringEvent.type)) {
    const candidateDni = get7CpcCandidateDni(eventDate)
    const qualifyingService = evaluateIncrementQualifyingService({ fromDate: eventDate, candidateDni, eventHistory, serviceStatusHistory, ordinaryContinuousService: true })
    if (qualifyingService.status !== 'SATISFIED') return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, candidateDni, qualifyingService, reason: qualifyingService.reason, explanation: 'The candidate DNI is known but eligibility remains unresolved.' })
    return createResolvedDniDecision({ cpc: 7, date: candidateDni, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, qualifyingService, explanation: 'The ordinary 7th CPC DNI follows the verified 2 January–1 July and 2 July–1 January date windows.' })
  }

  return createUnresolvedDniDecision({ cpc: 7, ruleId: SEVENTH_CPC_DNI_RULE_ID, trigger, reason: '7CPC_DNI_TRIGGER_NOT_IMPLEMENTED', explanation: 'DNI resolution for this 7th CPC trigger is not implemented.' })
}
