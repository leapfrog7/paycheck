import { getFifthCpcScale } from '../../../data/pay/5cpcPayScales'
import { parseCalendarDate } from '../../../domain/dates/calendarDate'
import { ACP_SCHEME_ID, ACP_SCHEME_METADATA, ACP_SCHEME_PERIOD_STATUS, isExternallyConfirmedAcpDecision } from '../../../domain/events/acpEligibility'
import { ACP_NORMAL_EFFECTIVE_TO } from '../../../domain/events/careerProgressionSchemes'
import { EVENT_TYPES } from '../../../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../../../domain/events/fixationOptions'
import { validate5CpcPayState } from '../../../domain/pay/payStateValidation'
import { resolveDateOfNextIncrement } from '../dni/resolveDni'
import { calculateFifthCpcStageBasedFixation } from './stageBasedFixation'

export const FIFTH_CPC_ACP_RULE_ID = '5CPC_ACP_SCHEME_1999_FIXATION'

function unresolved(reason, errors, before, extra = {}) {
  return { success: false, status: 'UNRESOLVED', ruleId: FIFTH_CPC_ACP_RULE_ID, eventType: EVENT_TYPES.ACP, reason, errors, before: { ...before }, ...extra }
}

function getFixationOption(event) {
  return event.fixationOption?.selected ?? event.fixationOption
}

function successfulPriorAcp(history, acpNumber) {
  return history.find((entry) => (entry.event ?? entry)?.type === EVENT_TYPES.ACP
    && Number((entry.event ?? entry).acpNumber) === acpNumber
    && (entry.result ?? entry.transformation)?.success)
}

export function calculate5CpcAcp(payState = {}, event = {}, context = {}) {
  if (event.type !== EVENT_TYPES.ACP) return unresolved('INVALID_EVENT_TYPE', ['An ACP event is required.'], payState)
  const validation = validate5CpcPayState(payState)
  if (!validation.valid) return unresolved('INVALID_PAY_STATE', validation.errors, payState)
  const before = validation.normalizedState
  const effectiveDate = event.effectiveDate ?? event.eventDate ?? ''
  if (!parseCalendarDate(effectiveDate)) return unresolved('INVALID_EFFECTIVE_DATE', ['A valid ACP effective date is required.'], before)
  if (effectiveDate > ACP_NORMAL_EFFECTIVE_TO) return unresolved('ACP_NOT_APPLICABLE_ON_EFFECTIVE_DATE', [`Normal ACP is not applicable after ${ACP_NORMAL_EFFECTIVE_TO}; scheme identity follows benefit effectiveDate, not orderDate.`], before, { effectiveDate, orderDate: event.orderDate ?? null })
  const acpNumber = Number(event.acpNumber)
  if (![1, 2].includes(acpNumber)) return unresolved('INVALID_ACP_NUMBER', ['ACP number must be 1 or 2.'], before)

  const eligibilityDecision = event.eligibilityDecision
  if (!isExternallyConfirmedAcpDecision(eligibilityDecision, acpNumber)) {
    return unresolved('ACP_ELIGIBILITY_OR_SCHEME_PERIOD_NOT_CONFIRMED', ['This fixation engine requires externally confirmed ACP admissibility and scheme-period applicability.'], before, { schemeId: ACP_SCHEME_ID, schemePeriodStatus: ACP_SCHEME_PERIOD_STATUS, eligibilityDecision: eligibilityDecision ?? null })
  }

  const history = context.history ?? []
  if (successfulPriorAcp(history, acpNumber)) return unresolved(`ACP_${acpNumber}_ALREADY_GRANTED`, [`ACP ${acpNumber} was already granted successfully in case history.`], before, { acpNumber })
  if (acpNumber === 2 && !successfulPriorAcp(history, 1)) return unresolved('ACP_2_WITHOUT_PRIOR_ACP_1', ['ACP 2 requires a prior successful ACP 1 record or an explicit migration exception, which is not present.'], before, { acpNumber })

  const fixationOption = getFixationOption(event)
  if (fixationOption === FIXATION_OPTIONS.FROM_LOWER_POST_DNI) {
    return unresolved('5CPC_ACP_FROM_DNI_NOT_IMPLEMENTED', ['The applicability and exact interim/final treatment of ACP fixation from lower-post DNI are not verified.'], before, { acpNumber, recognizedOption: fixationOption })
  }
  if (fixationOption !== FIXATION_OPTIONS.FROM_EVENT_DATE) return unresolved('UNSUPPORTED_FIXATION_OPTION', ['ACP fixation currently supports only FROM_EVENT_DATE.'], before, { acpNumber })

  const fixation = calculateFifthCpcStageBasedFixation(before, event.targetPayScaleId, {
    sameScaleReason: 'ACP_SAME_SCALE_UPGRADATION_NOT_IMPLEMENTED',
    unavailableIncrementReason: 'LOWER_SCALE_FINANCIAL_UPGRADATION_INCREMENT_NOT_AVAILABLE',
  })
  if (!fixation.success) {
    const messages = {
      MISSING_TARGET_PAY_SCALE: 'A confirmed ACP targetPayScaleId is required.',
      INVALID_TARGET_PAY_SCALE: 'The supplied ACP target scale does not exist in the authoritative catalogue.',
      ACP_SAME_SCALE_UPGRADATION_NOT_IMPLEMENTED: 'Same-scale ACP treatment requires separate explicit rule support.',
      LOWER_SCALE_FINANCIAL_UPGRADATION_INCREMENT_NOT_AVAILABLE: 'No next prescribed source-scale stage exists; stagnation treatment is not implemented.',
      EFFICIENCY_BAR_CLEARANCE_REQUIRED: 'The source-scale financial-upgradation increment requires a separately verified Efficiency Bar clearance.',
      NO_SUITABLE_STAGE_IN_TARGET_SCALE: 'No equal or higher prescribed target-scale stage can accept the fixation reference amount.',
    }
    return unresolved(fixation.reason, [messages[fixation.reason]], before, { acpNumber, ...(fixation.referenceAmount ? { referenceAmount: fixation.referenceAmount } : {}) })
  }

  const { targetScale, lowerIncrementStage, targetLookup } = fixation
  const dniDecision = resolveDateOfNextIncrement({ payState: before, triggeringEvent: event, eventHistory: history, serviceStatusHistory: context.serviceStatusHistory ?? [], context })
  const after = {
    cpc: 5, effectiveFrom: effectiveDate,
    payScaleId: targetScale.id, payScaleLabel: targetScale.label,
    stageIndex: targetLookup.stage.index, basicPay: targetLookup.stage.value,
    reachedBy: 'ACP', acpNumber,
    dni: { status: 'UNRESOLVED', reason: dniDecision.reason }, dniDecision,
  }
  const sourceScale = getFifthCpcScale(before.payScaleId)
  return {
    success: true, status: 'CALCULATED', ruleId: FIFTH_CPC_ACP_RULE_ID,
    scheme: ACP_SCHEME_ID, schemeId: ACP_SCHEME_ID, schemeMetadata: ACP_SCHEME_METADATA, schemePeriodStatus: ACP_SCHEME_PERIOD_STATUS,
    eligibilityDecision, eventId: event.id ?? event.eventId ?? null,
    eventType: EVENT_TYPES.ACP, acpNumber, effectiveDate,
    fixationOption, careerEffect: 'NONE', financialProgressionEffect: 'ACP', payFixationEffect: 'FRESH_FIXATION',
    reachedBy: 'ACP', targetHierarchySource: event.targetHierarchySource ?? null,
    before,
    sourceScale: { id: sourceScale.id, label: sourceScale.label },
    sourceStage: { index: before.stageIndex, value: before.basicPay },
    financialUpgradationIncrement: lowerIncrementStage.value - before.basicPay,
    lowerScaleReferenceStage: { ...lowerIncrementStage }, referenceAmount: lowerIncrementStage.value,
    targetScale: { id: targetScale.id, label: targetScale.label },
    lookupMethod: targetLookup.method, selectedTargetStage: { ...targetLookup.stage },
    resultingBasicPay: targetLookup.stage.value,
    dniDecision, dniStatus: dniDecision.status, after,
    steps: [
      { operation: 'GRANT_ONE_INCREMENT_IN_EXISTING_5CPC_SCALE_FOR_ACP', fromStage: before.stageIndex, toStage: lowerIncrementStage.index, fromBasicPay: before.basicPay, result: lowerIncrementStage.value },
      { operation: targetLookup.method === 'EXACT_STAGE' ? 'SELECT_EXACT_STAGE_IN_CONFIRMED_ACP_SCALE' : 'SELECT_NEXT_HIGHER_STAGE_IN_CONFIRMED_ACP_SCALE', targetPayScaleId: targetScale.id, referenceAmount: lowerIncrementStage.value, result: targetLookup.stage },
      { operation: 'MARK_POST_ACP_DNI_UNRESOLVED', result: dniDecision },
    ],
    explanation: 'On grant of financial upgradation under the ACP Scheme, one increment was granted in the existing 5th CPC pay scale and pay was fixed at the equal or next higher prescribed stage in the confirmed ACP scale.',
  }
}
