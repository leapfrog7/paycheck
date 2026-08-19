import { EVENT_TYPES } from '../../../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../../../domain/events/fixationOptions'
import { validate6CpcPayState } from '../../../domain/pay/payStateValidation'
import { SIXTH_CPC_INCREMENT_ROUNDING_STATUS } from './incrementRounding'
import { resolveDateOfNextIncrement } from '../dni/resolveDni'
import {
  calculateSixthCpcFixationIncrement,
  resolveHigherSixthCpcTarget,
  targetBandRequiresUndefinedAdjustment,
} from './fixationFromEventDate'
import { calculate6CpcFixationFromLowerPostDni } from './fixationFromLowerPostDni'

export const SIXTH_CPC_PROMOTION_RULE_ID = '6CPC_PROMOTION_FROM_EVENT_DATE'

function unresolved(reason, errors, before, extra = {}) {
  return {
    success: false,
    status: 'UNRESOLVED',
    ruleId: SIXTH_CPC_PROMOTION_RULE_ID,
    reason,
    errors,
    before: { ...before },
    ...extra,
  }
}

function isValidDate(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue ?? '')) return false
  const date = new Date(`${dateValue}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateValue
}

function getFixationOption(event) {
  return event.fixationOption?.selected ?? event.fixationOption
}

export function calculate6CpcRegularPromotion(payState = {}, event = {}, context = {}) {
  if (event.type !== EVENT_TYPES.REGULAR_PROMOTION) {
    return unresolved('INVALID_EVENT_TYPE', ['A REGULAR_PROMOTION event is required.'], payState)
  }

  const validation = validate6CpcPayState(payState)
  if (!validation.valid) {
    if (getFixationOption(event) === FIXATION_OPTIONS.FROM_LOWER_POST_DNI && validation.errors.some(({ code }) => code === 'MISSING_DNI')) {
      return unresolved('LOWER_POST_DNI_NOT_RESOLVED', ['A resolved lower-post DNI is required.'], payState)
    }
    return unresolved('INVALID_PAY_STATE', validation.errors, payState)
  }

  const effectiveDate = event.effectiveDate ?? event.eventDate ?? ''
  if (!isValidDate(effectiveDate)) {
    return unresolved('INVALID_EFFECTIVE_DATE', ['A valid promotion effective date is required.'], payState)
  }

  const fixationOption = getFixationOption(event)
  if (fixationOption === FIXATION_OPTIONS.FROM_LOWER_POST_DNI) {
    return calculate6CpcFixationFromLowerPostDni({
      payState: validation.normalizedState, event, context,
      ruleId: '6CPC_PROMOTION_FROM_DNI',
      semantics: { careerEffect: 'PROMOTED' },
    })
  }
  if (fixationOption !== FIXATION_OPTIONS.FROM_EVENT_DATE) {
    return unresolved('UNSUPPORTED_FIXATION_OPTION', ['Fixation option FROM_EVENT_DATE is required.'], payState)
  }

  const before = validation.normalizedState
  const target = resolveHigherSixthCpcTarget(before, event.targetPayBand, event.targetGradePay)
  if (!target.valid && target.reason === 'INVALID_TARGET_STRUCTURE') {
    return unresolved(
      'INVALID_TARGET_STRUCTURE',
      ['A valid target Pay Band and Grade Pay combination is required.'],
      payState,
    )
  }
  if (!target.valid && target.reason === 'SAME_FINANCIAL_STRUCTURE') {
    return unresolved('SAME_FINANCIAL_STRUCTURE', ['The target financial structure must be higher than the current structure.'], payState)
  }
  if (!target.valid && target.reason === 'LOWER_FINANCIAL_STRUCTURE') {
    return unresolved('LOWER_FINANCIAL_STRUCTURE', ['The target financial structure cannot be lower than the current structure.'], payState)
  }

  const { targetPayBand, targetGradePay } = target
  const {
    incrementBase,
    rawIncrement,
    roundedIncrement: roundedPromotionalIncrement,
    postIncrementPayInBand,
  } = calculateSixthCpcFixationIncrement(before)

  if (
    targetBandRequiresUndefinedAdjustment(before, targetPayBand, postIncrementPayInBand)
  ) {
    return unresolved(
      'TARGET_PAY_BAND_ADJUSTMENT_RULE_NOT_IMPLEMENTED',
      [`Post-increment Pay in Pay Band ₹${postIncrementPayInBand.toLocaleString('en-IN')} falls outside ${targetPayBand.label}; no verified minimum/maximum adjustment rule is implemented.`],
      payState,
      {
        targetPayBand: targetPayBand.code,
        targetGradePay,
        postIncrementPayInBand,
      },
    )
  }

  const finalBasicPay = postIncrementPayInBand + targetGradePay
  const dniDecision = resolveDateOfNextIncrement({ payState: before, triggeringEvent: event, eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context })
  const after = {
    cpc: 6,
    effectiveFrom: effectiveDate,
    payBand: targetPayBand.code,
    payInBand: postIncrementPayInBand,
    gradePay: targetGradePay,
    basicPay: finalBasicPay,
    dni: dniDecision.status === 'RESOLVED' ? dniDecision.date : { status: 'UNRESOLVED', reason: 'POST_PROMOTION_DNI_NOT_IMPLEMENTED' },
    dniDecision,
  }

  return {
    success: true,
    status: 'CALCULATED',
    ruleId: SIXTH_CPC_PROMOTION_RULE_ID,
    roundingRuleStatus: SIXTH_CPC_INCREMENT_ROUNDING_STATUS,
    before,
    promotionEffectiveDate: effectiveDate,
    incrementBase,
    rawIncrement,
    roundedPromotionalIncrement,
    previousPayInBand: before.payInBand,
    postIncrementPayInBand,
    previousGradePay: before.gradePay,
    targetGradePay,
    previousPayBand: before.payBand,
    targetPayBand: targetPayBand.code,
    finalBasicPay,
    after,
    dniStatus: dniDecision.status,
    dniDecision,
    steps: [
      { operation: 'CALCULATE_PROMOTIONAL_INCREMENT_BASE', result: incrementBase },
      { operation: 'CALCULATE_THREE_PERCENT', rate: 0.03, result: rawIncrement },
      { operation: 'APPLY_6CPC_INCREMENT_ROUNDING', from: rawIncrement, result: roundedPromotionalIncrement },
      { operation: 'ADD_INCREMENT_TO_PAY_IN_BAND', from: before.payInBand, increment: roundedPromotionalIncrement, result: postIncrementPayInBand },
      { operation: 'APPLY_TARGET_PAY_STRUCTURE', fromPayBand: before.payBand, toPayBand: targetPayBand.code, fromGradePay: before.gradePay, toGradePay: targetGradePay },
      { operation: 'CALCULATE_NEW_BASIC_PAY', operands: [postIncrementPayInBand, targetGradePay], result: finalBasicPay },
      { operation: 'RESOLVE_POST_PROMOTION_DNI', result: dniDecision },
    ],
    explanation: `A promotional increment of ₹${roundedPromotionalIncrement.toLocaleString('en-IN')} was added to Pay in Pay Band, then ${targetPayBand.code} Grade Pay ₹${targetGradePay.toLocaleString('en-IN')} was applied, producing Basic Pay ₹${finalBasicPay.toLocaleString('en-IN')}.`,
  }
}
