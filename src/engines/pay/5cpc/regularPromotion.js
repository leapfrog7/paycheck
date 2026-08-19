import { getFifthCpcScale } from '../../../data/pay/5cpcPayScales'
import { parseCalendarDate } from '../../../domain/dates/calendarDate'
import { EVENT_TYPES } from '../../../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../../../domain/events/fixationOptions'
import { readDniDecision } from '../../../domain/pay/dni/dniDecision'
import { validate5CpcPayState } from '../../../domain/pay/payStateValidation'
import { resolveDateOfNextIncrement } from '../dni/resolveDni'
import { calculateFifthCpcStageBasedFixation } from './stageBasedFixation'

export { selectFifthCpcTargetStage } from './stageBasedFixation'

export const FIFTH_CPC_REGULAR_PROMOTION_RULE_ID = '5CPC_REGULAR_PROMOTION_FR22'

function unresolved(reason, errors, before, extra = {}) {
  return { success: false, status: 'UNRESOLVED', ruleId: FIFTH_CPC_REGULAR_PROMOTION_RULE_ID, reason, errors, before: { ...before }, ...extra }
}

function getFixationOption(event) {
  return event.fixationOption?.selected ?? event.fixationOption
}

function unresolvedDeferredFixation(before, event, context) {
  const lowerDni = readDniDecision(before)
  if (!lowerDni || lowerDni.status !== 'RESOLVED') {
    return unresolved('LOWER_POST_DNI_NOT_RESOLVED', ['A resolved lower-post DNI is required.'], before, { recognizedOption: FIXATION_OPTIONS.FROM_LOWER_POST_DNI })
  }
  const eventDate = event.effectiveDate ?? event.eventDate ?? ''
  if (eventDate >= lowerDni.date) {
    return unresolved('EVENT_DATE_NOT_BEFORE_LOWER_POST_DNI', ['The promotion date must be strictly before lower-post DNI.'], before, { lowerPostDni: lowerDni.date, recognizedOption: FIXATION_OPTIONS.FROM_LOWER_POST_DNI })
  }
  const adverse = [...(context.serviceStatusHistory ?? []), ...(context.history ?? []).map(({ event: item }) => item)].some(({ type }) => ['EOL', 'NON_QUALIFYING_SERVICE', 'WITHHELD_INCREMENT', 'PENALTY_REDUCTION', 'BREAK_IN_SERVICE', 'SUSPENSION'].includes(type))
  if (adverse) {
    return unresolved('NON_QUALIFYING_SERVICE_RULE_NOT_IMPLEMENTED', ['An unsupported service condition prevents deferred fixation from being resolved.'], before, { lowerPostDni: lowerDni.date, recognizedOption: FIXATION_OPTIONS.FROM_LOWER_POST_DNI })
  }
  return unresolved(
    '5CPC_PROMOTION_FROM_DNI_INTERIM_RULE_NOT_IMPLEMENTED',
    ['The exact 5th CPC interim and final fixation treatment from lower-post DNI is not verified in project rules.'],
    before,
    {
      lowerPostDni: lowerDni.date,
      recognizedOption: FIXATION_OPTIONS.FROM_LOWER_POST_DNI,
      transformationModel: {
        type: 'MULTI_STAGE_PAY_TRANSFORMATION',
        states: ['BEFORE', 'INTERIM_PAY_STATE', 'FINAL_FIXATION_STATE'],
        originatingEventId: event.id ?? event.eventId ?? null,
      },
    },
  )
}

export function calculate5CpcRegularPromotion(payState = {}, event = {}, context = {}) {
  if (event.type !== EVENT_TYPES.REGULAR_PROMOTION) return unresolved('INVALID_EVENT_TYPE', ['A REGULAR_PROMOTION event is required.'], payState)
  const validation = validate5CpcPayState(payState)
  if (!validation.valid) {
    if (getFixationOption(event) === FIXATION_OPTIONS.FROM_LOWER_POST_DNI && validation.errors.some(({ code }) => code === 'MISSING_DNI')) {
      return unresolved('LOWER_POST_DNI_NOT_RESOLVED', ['A resolved lower-post DNI is required.'], payState, { recognizedOption: FIXATION_OPTIONS.FROM_LOWER_POST_DNI })
    }
    return unresolved('INVALID_PAY_STATE', validation.errors, payState)
  }
  const before = validation.normalizedState
  const effectiveDate = event.effectiveDate ?? event.eventDate ?? ''
  if (!parseCalendarDate(effectiveDate)) return unresolved('INVALID_EFFECTIVE_DATE', ['A valid promotion effective date is required.'], before)

  const targetPayScaleId = event.targetPayScaleId
  if (!targetPayScaleId) return unresolved('MISSING_TARGET_PAY_SCALE', ['A confirmed targetPayScaleId is required.'], before)
  const confirmedTargetScale = getFifthCpcScale(targetPayScaleId)
  if (!confirmedTargetScale) return unresolved('INVALID_TARGET_PAY_SCALE', ['The supplied target scale does not exist in the authoritative 5th CPC catalogue.'], before)
  if (confirmedTargetScale.id === before.payScaleId) return unresolved('SAME_SOURCE_AND_TARGET_PAY_SCALE', ['The promotional scale must differ from the source scale.'], before)

  const fixationOption = getFixationOption(event)
  if (fixationOption === FIXATION_OPTIONS.FROM_LOWER_POST_DNI) return unresolvedDeferredFixation(before, event, context)
  if (fixationOption !== FIXATION_OPTIONS.FROM_EVENT_DATE) return unresolved('UNSUPPORTED_FIXATION_OPTION', ['A supported fixation option is required.'], before)

  const fixation = calculateFifthCpcStageBasedFixation(before, targetPayScaleId)
  if (!fixation.success) {
    const messages = {
      MISSING_TARGET_PAY_SCALE: 'A confirmed targetPayScaleId is required.',
      INVALID_TARGET_PAY_SCALE: 'The supplied target scale does not exist in the authoritative 5th CPC catalogue.',
      SAME_SOURCE_AND_TARGET_PAY_SCALE: 'The promotional scale must differ from the source scale.',
      LOWER_SCALE_PROMOTIONAL_INCREMENT_NOT_AVAILABLE: 'No next prescribed lower-scale stage exists; stagnation increment is not implemented.',
      EFFICIENCY_BAR_CLEARANCE_REQUIRED: 'The lower-scale promotional increment requires a separately verified Efficiency Bar clearance.',
      NO_SUITABLE_STAGE_IN_TARGET_SCALE: 'No equal or higher prescribed target-scale stage can accept the fixation reference amount.',
    }
    return unresolved(fixation.reason, [messages[fixation.reason]], before, { ...(fixation.referenceAmount ? { referenceAmount: fixation.referenceAmount } : {}), ...(fixation.targetScale ? { targetPayScaleId: fixation.targetScale.id } : {}) })
  }
  const { targetScale, lowerIncrementStage, targetLookup } = fixation

  const dniDecision = resolveDateOfNextIncrement({ payState: before, triggeringEvent: event, eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context })
  const after = {
    cpc: 5, effectiveFrom: effectiveDate,
    payScaleId: targetScale.id, payScaleLabel: targetScale.label,
    stageIndex: targetLookup.stage.index, basicPay: targetLookup.stage.value,
    dni: { status: 'UNRESOLVED', reason: dniDecision.reason }, dniDecision,
  }
  const sourceScale = getFifthCpcScale(before.payScaleId)
  return {
    success: true, status: 'CALCULATED', ruleId: FIFTH_CPC_REGULAR_PROMOTION_RULE_ID,
    eventId: event.id ?? event.eventId ?? null, eventType: EVENT_TYPES.REGULAR_PROMOTION,
    fixationOption, careerEffect: 'PROMOTED', payFixationEffect: 'FRESH_FIXATION',
    before,
    sourceScale: { id: sourceScale.id, label: sourceScale.label },
    sourceStage: { index: before.stageIndex, value: before.basicPay },
    promotionalLowerScaleIncrement: lowerIncrementStage.value - before.basicPay,
    lowerScaleReferenceStage: { ...lowerIncrementStage },
    referenceAmount: lowerIncrementStage.value,
    targetScale: { id: targetScale.id, label: targetScale.label },
    lookupMethod: targetLookup.method,
    selectedTargetStage: { ...targetLookup.stage },
    finalBasicPay: targetLookup.stage.value,
    dniDecision, dniStatus: dniDecision.status,
    after,
    steps: [
      { operation: 'GRANT_ONE_INCREMENT_IN_LOWER_5CPC_SCALE', fromStage: before.stageIndex, toStage: lowerIncrementStage.index, fromBasicPay: before.basicPay, result: lowerIncrementStage.value },
      { operation: targetLookup.method === 'EXACT_STAGE' ? 'SELECT_EXACT_STAGE_IN_TARGET_SCALE' : 'SELECT_NEXT_HIGHER_STAGE_IN_TARGET_SCALE', targetPayScaleId: targetScale.id, referenceAmount: lowerIncrementStage.value, result: targetLookup.stage },
      { operation: 'MARK_POST_PROMOTION_DNI_UNRESOLVED', result: dniDecision },
    ],
    explanation: 'On regular promotion, one increment was granted in the lower 5th CPC pay scale and pay was fixed at the equal or next higher prescribed stage in the promotional scale.',
  }
}
