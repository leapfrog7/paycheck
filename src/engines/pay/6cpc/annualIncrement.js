import { validate6CpcPayState } from '../../../domain/pay/payStateValidation'
import {
  roundSixthCpcIncrement,
  SIXTH_CPC_INCREMENT_ROUNDING_STATUS,
} from './incrementRounding'
import { resolveDateOfNextIncrement } from '../dni/resolveDni'

export const SIXTH_CPC_ANNUAL_INCREMENT_RULE_ID = '6CPC_ANNUAL_INCREMENT'

function unresolved(reason, errors, before, dniDecision) {
  return {
    success: false,
    status: 'UNRESOLVED',
    ruleId: SIXTH_CPC_ANNUAL_INCREMENT_RULE_ID,
    reason,
    errors,
    before: { ...before },
    ...(dniDecision ? { dniDecision } : {}),
  }
}

export function calculate6CpcAnnualIncrement(payState = {}, event = {}, context = {}) {
  const validation = validate6CpcPayState(payState)

  if (!validation.valid) {
    return unresolved('INVALID_PAY_STATE', validation.errors, payState)
  }

  const eventDate = event.effectiveDate ?? event.eventDate ?? ''
  if (!eventDate) {
    return unresolved('MISSING_EVENT_DATE', [{ code: 'MISSING_EVENT_DATE', field: 'eventDate', message: 'Annual increment event date is required.' }], payState)
  }

  const dniDecision = resolveDateOfNextIncrement({ payState, triggeringEvent: { ...event, type: 'ANNUAL_INCREMENT' }, eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context })
  if (dniDecision.status !== 'RESOLVED') {
    const reason = dniDecision.reason === 'INCREMENT_DATE_DOES_NOT_MATCH_DNI' ? 'DNI_MISMATCH' : dniDecision.reason
    return unresolved(reason, [{ code: reason, field: 'dni', message: dniDecision.explanation }], payState, dniDecision)
  }
  const nextDni = dniDecision.date

  const before = validation.normalizedState
  const incrementBase = before.payInBand + before.gradePay
  const rawIncrement = Number((incrementBase * 0.03).toFixed(2))
  const roundedIncrement = roundSixthCpcIncrement(rawIncrement)
  const newPayInBand = before.payInBand + roundedIncrement
  const newBasicPay = newPayInBand + before.gradePay
  const after = {
    ...before,
    effectiveFrom: eventDate,
    payInBand: newPayInBand,
    gradePay: before.gradePay,
    basicPay: newBasicPay,
    dni: nextDni,
    dniDecision,
  }

  return {
    success: true,
    status: 'CALCULATED',
    ruleId: SIXTH_CPC_ANNUAL_INCREMENT_RULE_ID,
    roundingRuleStatus: SIXTH_CPC_INCREMENT_ROUNDING_STATUS,
    before,
    incrementBase,
    rawIncrement,
    roundedIncrement,
    previousPayInBand: before.payInBand,
    newPayInBand,
    unchangedGradePay: before.gradePay,
    previousBasicPay: before.basicPay,
    newBasicPay,
    after,
    dniDecision,
    steps: [
      { operation: 'CALCULATE_INCREMENT_BASE', operands: [before.payInBand, before.gradePay], result: incrementBase },
      { operation: 'CALCULATE_THREE_PERCENT', rate: 0.03, result: rawIncrement },
      { operation: 'APPLY_6CPC_INCREMENT_ROUNDING', from: rawIncrement, result: roundedIncrement },
      { operation: 'ADD_INCREMENT_TO_PAY_IN_BAND', from: before.payInBand, increment: roundedIncrement, result: newPayInBand },
      { operation: 'RETAIN_GRADE_PAY', result: before.gradePay },
      { operation: 'CALCULATE_NEW_BASIC_PAY', operands: [newPayInBand, before.gradePay], result: newBasicPay },
      { operation: 'DERIVE_NEXT_NORMAL_DNI', from: eventDate, result: nextDni },
    ],
    explanation: `Basic Pay ₹${incrementBase.toLocaleString('en-IN')} × 3% = ₹${rawIncrement.toLocaleString('en-IN')}; the rounded increment of ₹${roundedIncrement.toLocaleString('en-IN')} is added only to Pay in Pay Band, producing new Basic Pay ₹${newBasicPay.toLocaleString('en-IN')} with Grade Pay unchanged at ₹${before.gradePay.toLocaleString('en-IN')}.`,
  }
}
