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
import { MACPS_EFFECTIVE_FROM, MACPS_METADATA } from '../../../domain/events/careerProgressionSchemes'
import { resolveSixthCpcMacpTarget } from '../../../data/pay/macpFinancialHierarchy'

export const SIXTH_CPC_MACP_RULE_ID = '6CPC_MACP_FIXATION'

function unresolved(reason, errors, before, extra = {}) {
  return {
    success: false,
    status: 'UNRESOLVED',
    ruleId: SIXTH_CPC_MACP_RULE_ID,
    eventType: EVENT_TYPES.MACP,
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

function normalizeMacpNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const numericValue = Number(value)
  return [1, 2, 3].includes(numericValue) ? numericValue : undefined
}

export function calculate6CpcMacpFixation(payState = {}, event = {}, context = {}) {
  if (event.type !== EVENT_TYPES.MACP) {
    return unresolved('INVALID_EVENT_TYPE', ['A MACP event is required.'], payState)
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
    return unresolved('INVALID_EFFECTIVE_DATE', ['A valid MACP effective date is required.'], payState)
  }
  if (effectiveDate < MACPS_EFFECTIVE_FROM) return unresolved('MACP_NOT_APPLICABLE_ON_EFFECTIVE_DATE', [`MACPS applies from ${MACPS_EFFECTIVE_FROM}; classification uses benefit effectiveDate, not orderDate.`], payState, { effectiveDate, orderDate: event.orderDate ?? null })

  const fixationOption = getFixationOption(event)
  if (![FIXATION_OPTIONS.FROM_EVENT_DATE, FIXATION_OPTIONS.FROM_LOWER_POST_DNI].includes(fixationOption)) {
    return unresolved('UNSUPPORTED_FIXATION_OPTION', ['Fixation option FROM_EVENT_DATE is required.'], payState)
  }

  const macpNumber = normalizeMacpNumber(event.macpNumber)
  if (macpNumber === undefined) {
    return unresolved('INVALID_MACP_NUMBER', ['MACP number must be 1, 2, or 3 when supplied.'], payState)
  }

  const before = validation.normalizedState
  const targetResolution = resolveSixthCpcMacpTarget(before, event)
  if (targetResolution.status !== 'RESOLVED') return unresolved(targetResolution.reason, ['Ordinary MACP must use the immediate next controlled financial structure.'], before, { targetResolution })
  const resolvedEvent = { ...event, targetPayBand: targetResolution.target.payBand, targetGradePay: targetResolution.target.gradePay }

  if (fixationOption === FIXATION_OPTIONS.FROM_LOWER_POST_DNI) {
    const result = calculate6CpcFixationFromLowerPostDni({
      payState: before, event: resolvedEvent, context,
      ruleId: '6CPC_MACP_FROM_DNI',
      semantics: { reachedBy: 'MACP', macpNumber },
    })
    return { ...result, scheme: 'MACPS', schemeMetadata: MACPS_METADATA, targetResolution, careerEffect: 'NONE', financialProgressionEffect: 'MACP' }
  }

  const target = resolveHigherSixthCpcTarget(before, resolvedEvent.targetPayBand, resolvedEvent.targetGradePay)
  if (!target.valid) {
    const messages = {
      INVALID_TARGET_STRUCTURE: 'A valid target Pay Band and Grade Pay combination is required.',
      SAME_FINANCIAL_STRUCTURE: 'The MACP target must be higher than the current financial structure.',
      LOWER_FINANCIAL_STRUCTURE: 'The MACP target cannot be lower than the current financial structure.',
    }
    return unresolved(target.reason, [messages[target.reason]], payState)
  }

  const { targetPayBand, targetGradePay } = target
  const {
    incrementBase,
    rawIncrement,
    roundedIncrement,
    postIncrementPayInBand,
  } = calculateSixthCpcFixationIncrement(before)

  if (targetBandRequiresUndefinedAdjustment(before, targetPayBand, postIncrementPayInBand)) {
    return unresolved(
      'TARGET_PAY_BAND_ADJUSTMENT_RULE_NOT_IMPLEMENTED',
      [`Post-increment Pay in Pay Band ₹${postIncrementPayInBand.toLocaleString('en-IN')} falls outside ${targetPayBand.label}; no verified minimum/maximum adjustment rule is implemented.`],
      payState,
      { targetPayBand: targetPayBand.code, targetGradePay, postIncrementPayInBand, macpNumber },
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
    reachedBy: 'MACP',
    macpNumber,
    dni: dniDecision.status === 'RESOLVED' ? dniDecision.date : { status: 'UNRESOLVED', reason: 'POST_MACP_DNI_NOT_IMPLEMENTED' },
    dniDecision,
  }

  return {
    success: true,
    status: 'CALCULATED',
    eventId: event.id ?? event.eventId ?? null,
    eventType: EVENT_TYPES.MACP,
    scheme: 'MACPS',
    schemeMetadata: MACPS_METADATA,
    targetResolution,
    careerEffect: 'NONE',
    financialProgressionEffect: 'MACP',
    reachedBy: 'MACP',
    macpNumber,
    ruleId: SIXTH_CPC_MACP_RULE_ID,
    roundingRuleStatus: SIXTH_CPC_INCREMENT_ROUNDING_STATUS,
    before,
    incrementBase,
    rawIncrement,
    roundedIncrement,
    previousPayInBand: before.payInBand,
    postIncrementPayInBand,
    previousPayBand: before.payBand,
    previousGradePay: before.gradePay,
    targetPayBand: targetPayBand.code,
    targetGradePay,
    finalBasicPay,
    after,
    dniStatus: dniDecision.status,
    dniDecision,
    steps: [
      { operation: 'CALCULATE_MACP_FIXATION_BASE', result: incrementBase },
      { operation: 'CALCULATE_THREE_PERCENT', rate: 0.03, result: rawIncrement },
      { operation: 'APPLY_6CPC_INCREMENT_ROUNDING', from: rawIncrement, result: roundedIncrement },
      { operation: 'ADD_INCREMENT_TO_PAY_IN_BAND', from: before.payInBand, increment: roundedIncrement, result: postIncrementPayInBand },
      { operation: 'APPLY_MACP_TARGET_STRUCTURE', fromPayBand: before.payBand, toPayBand: targetPayBand.code, fromGradePay: before.gradePay, toGradePay: targetGradePay, reachedBy: 'MACP' },
      { operation: 'CALCULATE_NEW_BASIC_PAY', operands: [postIncrementPayInBand, targetGradePay], result: finalBasicPay },
      { operation: 'RESOLVE_POST_MACP_DNI', result: dniDecision },
    ],
    explanation: `On grant of${macpNumber ? ` MACP ${macpNumber}` : ' MACP'}, one fixation increment was applied to the existing Basic Pay and the employee was placed in ${targetPayBand.code} with Grade Pay ₹${targetGradePay.toLocaleString('en-IN')}.`,
  }
}
