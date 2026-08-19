import { get6CpcTo7CpcMapping, normalize6CpcPayBand } from '../../domain/pay/6cpcTo7cpcMapping'
import { findEqualOrNextHigherCell, getPayMatrixLevel } from '../../domain/pay/payMatrix'
import { resolveDateOfNextIncrement } from './dni/resolveDni'
import { validateCpcSwitchOption } from '../../domain/events/cpcSwitchOption'

export const SIXTH_TO_SEVENTH_CPC_FITMENT_FACTOR = 2.57
export const SIXTH_TO_SEVENTH_CPC_RULE_ID = '6CPC_TO_7CPC'

function errorResult(reason, errors, before) {
  return {
    success: false,
    status: 'UNRESOLVED',
    ruleId: SIXTH_TO_SEVENTH_CPC_RULE_ID,
    reason,
    errors,
    before: { ...before },
  }
}

export function calculate6CpcTo7CpcTransition(payState = {}, event = {}, context = {}) {
  if (Number(payState.cpc) !== 6) {
    return errorResult('INVALID_SOURCE_CPC', ['A valid 6th CPC source Pay State is required.'], payState)
  }

  const effectiveEvent = event.employeeSwitchDate || event.fixationDate || event.effectiveFrom || event.effectiveDate
    ? event
    : { ...event, employeeSwitchDate: '2016-01-01' }
  const optionDecision = validateCpcSwitchOption({ fromCpc: 6, toCpc: 7, ...effectiveEvent }, context)
  if (!optionDecision.valid) return { ...errorResult(optionDecision.reason, optionDecision.errors, payState), optionDecision }

  if (!payState.payBand && !payState.payBandCode) {
    return errorResult('MISSING_PAY_BAND', ['6th CPC Pay Band is required.'], payState)
  }

  if (payState.gradePay === '' || payState.gradePay === null || payState.gradePay === undefined) {
    return errorResult('MISSING_GRADE_PAY', ['Grade Pay is required for the mapped Pay Band.'], payState)
  }

  const payInBand = Number(payState.payInBand ?? payState.payInPayBand)
  const gradePay = Number(payState.gradePay)
  const suppliedBasicPay = Number(payState.basicPay)

  if (!Number.isFinite(payInBand) || payInBand <= 0) {
    return errorResult('INVALID_PAY_IN_BAND', ['Pay in Pay Band must be a positive number.'], payState)
  }

  if (!Number.isFinite(gradePay)) {
    return errorResult('INVALID_GRADE_PAY', ['Grade Pay must be a valid number.'], payState)
  }

  const calculatedBasicPay = payInBand + gradePay

  if (!Number.isFinite(suppliedBasicPay) || suppliedBasicPay !== calculatedBasicPay) {
    return errorResult(
      'INCONSISTENT_BASIC_PAY',
      [`6th CPC Basic Pay must equal Pay in Pay Band plus Grade Pay (₹${calculatedBasicPay.toLocaleString('en-IN')}).`],
      payState,
    )
  }

  const mapping = get6CpcTo7CpcMapping(payState)

  if (!mapping) {
    const recognizedPayBand = normalize6CpcPayBand(payState.payBand ?? payState.payBandCode)

    return errorResult(
      recognizedPayBand ? 'INVALID_PAY_BAND_GRADE_PAY_COMBINATION' : 'UNMAPPED_PAY_STRUCTURE',
      [recognizedPayBand
        ? 'The supplied Grade Pay is not valid for the selected Pay Band mapping.'
        : 'The supplied Pay Band structure has no verified 7th CPC Level mapping.'],
      payState,
    )
  }

  if (payInBand < mapping.payBandMinimum || payInBand > mapping.payBandMaximum) {
    return errorResult(
      'PAY_IN_BAND_OUT_OF_RANGE',
      [`Pay in Pay Band must be between ₹${mapping.payBandMinimum.toLocaleString('en-IN')} and ₹${mapping.payBandMaximum.toLocaleString('en-IN')} for ${mapping.payBand}.`],
      payState,
    )
  }

  if (!getPayMatrixLevel(mapping.level)) {
    return errorResult('MAPPED_LEVEL_NOT_FOUND', [`Mapped Level ${mapping.level} is absent from the Pay Matrix.`], payState)
  }

  const rawFitmentValue = Number(
    (calculatedBasicPay * SIXTH_TO_SEVENTH_CPC_FITMENT_FACTOR).toFixed(2),
  )
  const roundedFitmentValue = Math.round(rawFitmentValue)
  const selectedCell = findEqualOrNextHigherCell(mapping.level, roundedFitmentValue)

  if (!selectedCell) {
    return errorResult(
      'NO_SUITABLE_CELL',
      [`No Cell equal to or higher than ₹${roundedFitmentValue.toLocaleString('en-IN')} exists in Level ${mapping.level}.`],
      payState,
    )
  }

  const effectiveFrom = optionDecision.employeeSwitchDate
  const after = {
    cpc: 7,
    effectiveFrom,
    level: mapping.level,
    cellIndex: selectedCell.index,
    correspondingCellIndex: selectedCell.index,
    basicPay: selectedCell.value,
  }
  const dniDecision = resolveDateOfNextIncrement({ payState: after, triggeringEvent: { ...event, type: optionDecision.delayed ? 'DELAYED_CPC_SWITCH' : 'CPC_TRANSITION', effectiveDate: effectiveFrom }, eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context })
  after.dni = dniDecision.status === 'RESOLVED' ? dniDecision.date : { status: 'UNRESOLVED', reason: dniDecision.reason }
  after.dniDecision = dniDecision

  return {
    success: true,
    status: 'CALCULATED',
    ruleId: SIXTH_TO_SEVENTH_CPC_RULE_ID,
    effectiveDate: effectiveFrom,
    statutoryEffectiveDate: optionDecision.statutoryEffectiveDate,
    employeeSwitchDate: effectiveFrom,
    switchOption: optionDecision,
    before: {
      ...payState,
      payBand: mapping.payBand,
      payInBand,
      gradePay,
      basicPay: suppliedBasicPay,
    },
    calculated6CpcBasicPay: calculatedBasicPay,
    fitmentFactor: SIXTH_TO_SEVENTH_CPC_FITMENT_FACTOR,
    rawFitmentValue,
    roundedFitmentValue,
    mappedLevel: mapping.level,
    cellLookup: {
      operation: selectedCell.value === roundedFitmentValue ? 'EXACT_CELL' : 'IMMEDIATE_NEXT_HIGHER_CELL',
      searchedLevel: mapping.level,
      targetAmount: roundedFitmentValue,
    },
    selectedCell: { ...selectedCell },
    after,
    dniStatus: dniDecision.status,
    dniDecision,
    steps: [
      { operation: 'CALCULATE_6CPC_BASIC_PAY', operands: [payInBand, gradePay], result: calculatedBasicPay },
      { operation: 'APPLY_FITMENT_FACTOR', factor: SIXTH_TO_SEVENTH_CPC_FITMENT_FACTOR, result: rawFitmentValue },
      { operation: 'ROUND_TO_NEAREST_RUPEE', from: rawFitmentValue, result: roundedFitmentValue },
      { operation: 'MAP_PAY_STRUCTURE_TO_LEVEL', payBand: mapping.payBand, gradePay, result: mapping.level },
      { operation: selectedCell.value === roundedFitmentValue ? 'SELECT_EXACT_CELL' : 'SELECT_IMMEDIATE_NEXT_HIGHER_CELL', level: mapping.level, result: { ...selectedCell } },
    ],
    explanation: `${mapping.payBand} with Grade Pay ₹${gradePay.toLocaleString('en-IN')} maps to Level ${mapping.level}. Basic Pay ₹${calculatedBasicPay.toLocaleString('en-IN')} × 2.57 = ₹${rawFitmentValue.toLocaleString('en-IN')}, rounded to ₹${roundedFitmentValue.toLocaleString('en-IN')}; ${selectedCell.value === roundedFitmentValue ? 'the equal Cell' : 'the immediate next higher Cell'} is Cell ${selectedCell.index} at ₹${selectedCell.value.toLocaleString('en-IN')}.`,
  }
}
