import { parseCalendarDate } from '../../../domain/dates/calendarDate'
import { validate5CpcPayState } from '../../../domain/pay/payStateValidation'
import { getFifthCpcScale, getNextFifthCpcStage } from '../../../data/pay/5cpcPayScales'
import { resolveDateOfNextIncrement } from '../dni/resolveDni'

export const FIFTH_CPC_ANNUAL_INCREMENT_RULE_ID = '5CPC_ANNUAL_INCREMENT'

function unresolved(reason, errors, before, dniDecision) {
  return {
    success: false,
    status: 'UNRESOLVED',
    ruleId: FIFTH_CPC_ANNUAL_INCREMENT_RULE_ID,
    reason,
    errors,
    before: { ...before },
    ...(dniDecision ? { dniDecision } : {}),
  }
}

export function calculate5CpcAnnualIncrement(payState = {}, event = {}, context = {}) {
  const validation = validate5CpcPayState(payState)
  if (!validation.valid) return unresolved('INVALID_PAY_STATE', validation.errors, payState)
  const eventDate = event.effectiveDate ?? event.eventDate ?? ''
  if (!parseCalendarDate(eventDate)) {
    return unresolved('INVALID_EVENT_DATE', [{ code: 'INVALID_EVENT_DATE', field: 'eventDate', message: 'A valid annual increment event date is required.' }], payState)
  }
  const before = validation.normalizedState
  const dniDecision = resolveDateOfNextIncrement({ payState: before, triggeringEvent: { ...event, type: 'ANNUAL_INCREMENT' }, eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context })
  if (dniDecision.status !== 'RESOLVED') {
    const reason = dniDecision.reason === 'INCREMENT_DATE_DOES_NOT_MATCH_DNI' ? 'DNI_MISMATCH' : dniDecision.reason
    return unresolved(reason, [{ code: reason, field: 'dni', message: dniDecision.explanation }], before, dniDecision)
  }
  const nextStage = getNextFifthCpcStage(before.payScaleId, before.stageIndex)
  if (!nextStage) {
    return unresolved('NO_NEXT_STAGE_IN_PAY_SCALE', [{ code: 'NO_NEXT_STAGE_IN_PAY_SCALE', field: 'stageIndex', message: 'The employee is already at the final prescribed stage. Ordinary stagnation increments are not implemented.' }], before)
  }
  if (nextStage.requiresEfficiencyBarClearance) {
    return unresolved('EFFICIENCY_BAR_CLEARANCE_REQUIRED', [{ code: 'EFFICIENCY_BAR_CLEARANCE_REQUIRED', field: 'stageIndex', message: 'Movement to the next stage requires a separately verified Efficiency Bar clearance decision.' }], before)
  }
  const nextDni = dniDecision.date
  const scale = getFifthCpcScale(before.payScaleId)
  const incrementAmount = nextStage.value - before.basicPay
  const after = {
    ...before,
    effectiveFrom: eventDate,
    payScaleId: scale.id,
    payScaleLabel: scale.label,
    stageIndex: nextStage.index,
    basicPay: nextStage.value,
    dni: nextDni,
    dniDecision,
  }
  return {
    success: true,
    status: 'CALCULATED',
    ruleId: FIFTH_CPC_ANNUAL_INCREMENT_RULE_ID,
    before,
    payScale: { id: scale.id, label: scale.label },
    previousStageIndex: before.stageIndex,
    nextStageIndex: nextStage.index,
    previousBasicPay: before.basicPay,
    newBasicPay: nextStage.value,
    incrementAmount,
    previousDni: before.dni,
    nextDni,
    dniDecision,
    after,
    steps: [
      { operation: 'IDENTIFY_PRESCRIBED_SCALE', scale: scale.label },
      { operation: 'MOVE_TO_NEXT_PRESCRIBED_STAGE', fromStageIndex: before.stageIndex, toStageIndex: nextStage.index, fromBasicPay: before.basicPay, toBasicPay: nextStage.value },
      { operation: 'DERIVE_STAGE_MOVEMENT_AMOUNT', from: before.basicPay, to: nextStage.value, result: incrementAmount },
      { operation: 'CONTINUE_INDIVIDUAL_DNI_ANNUALLY', from: before.dni, result: nextDni },
    ],
    explanation: 'Annual increment granted by movement to the next prescribed stage in the 5th CPC pay scale.',
  }
}
