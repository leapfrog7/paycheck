import { getCell, getPayMatrixLevel } from './payMatrix'
import { getSixthCpcPayBand } from '../../data/pay/6cpcPayBands'
import { normalize6CpcPayBand } from './6cpcTo7cpcMapping'
import { parseCalendarDate } from '../dates/calendarDate'
import { getFifthCpcScale, getFifthCpcStage } from '../../data/pay/5cpcPayScales'

function validationError(code, field, message) {
  return { code, field, message }
}

export function validate5CpcPayState(payState = {}) {
  const errors = []
  if (Number(payState.cpc) !== 5) errors.push(validationError('INVALID_CPC', 'cpc', 'A valid 5th CPC Pay State is required.'))
  const payScaleId = payState.payScaleId ?? payState.payScaleCode ?? payState.payScale
  const scale = getFifthCpcScale(payScaleId)
  if (!scale) errors.push(validationError('UNSUPPORTED_PAY_SCALE', 'payScaleId', 'A supported, verified 5th CPC Pay Scale is required.'))
  const stageIndex = Number(payState.stageIndex)
  const stage = scale ? getFifthCpcStage(scale.id, stageIndex) : null
  if (!Number.isInteger(stageIndex) || stageIndex < 1 || scale && !stage) {
    errors.push(validationError('INVALID_STAGE_INDEX', 'stageIndex', 'Select a valid stage in the chosen 5th CPC Pay Scale.'))
  }
  const basicPay = Number(payState.basicPay)
  if (!Number.isFinite(basicPay)) errors.push(validationError('INVALID_BASIC_PAY', 'basicPay', 'Basic Pay must be a valid prescribed stage amount.'))
  else if (stage && basicPay !== stage.value) errors.push(validationError('BASIC_PAY_STAGE_MISMATCH', 'basicPay', `Basic Pay must equal selected stage ${stage.index} (${stage.value}).`))
  if (!payState.dni) errors.push(validationError('MISSING_DNI', 'dni', 'A confirmed Date of Next Increment is required.'))
  else if (payState.dni?.status === 'UNRESOLVED') {
    // A structurally valid Pay State may carry explicit DNI uncertainty after an event.
  } else if (!parseCalendarDate(payState.dni)) errors.push(validationError('INVALID_DNI', 'dni', 'DNI must be a valid calendar date.'))
  return {
    valid: errors.length === 0,
    errors,
    normalizedState: errors.length === 0 ? {
      ...payState,
      cpc: 5,
      payScaleId: scale.id,
      payScaleLabel: scale.label,
      stageIndex,
      basicPay,
      dni: payState.dni,
    } : null,
  }
}

export function validate6CpcPayState(payState = {}) {
  const errors = []

  if (Number(payState.cpc) !== 6) {
    errors.push(validationError('INVALID_CPC', 'cpc', 'A valid 6th CPC pay state is required.'))
  }

  const payBand = normalize6CpcPayBand(payState.payBand ?? payState.payBandCode)
  const payBandDefinition = getSixthCpcPayBand(payBand)

  if (!payBandDefinition) {
    errors.push(validationError('UNSUPPORTED_PAY_BAND', 'payBand', 'A supported 6th CPC Pay Band is required.'))
  }

  const payInBand = Number(payState.payInBand ?? payState.payInPayBand)
  if (!Number.isFinite(payInBand) || payInBand <= 0) {
    errors.push(validationError('INVALID_PAY_IN_BAND', 'payInBand', 'Pay in Pay Band must be a positive number.'))
  }

  const gradePayMissing = payState.gradePay === '' || payState.gradePay === null || payState.gradePay === undefined
  const gradePay = Number(payState.gradePay)
  if (gradePayMissing || !Number.isFinite(gradePay)) {
    errors.push(validationError('INVALID_GRADE_PAY', 'gradePay', 'A valid Grade Pay is required.'))
  } else if (payBandDefinition && !payBandDefinition.gradePays.includes(gradePay)) {
    errors.push(validationError('GRADE_PAY_NOT_VALID_FOR_BAND', 'gradePay', `Grade Pay ₹${gradePay.toLocaleString('en-IN')} is not valid for ${payBand}.`))
  }

  const basicPay = Number(payState.basicPay)
  if (!Number.isFinite(basicPay)) {
    errors.push(validationError('INVALID_BASIC_PAY', 'basicPay', 'Basic Pay must be a valid number.'))
  } else if (Number.isFinite(payInBand) && Number.isFinite(gradePay) && basicPay !== payInBand + gradePay) {
    errors.push(validationError('INCONSISTENT_BASIC_PAY', 'basicPay', `Basic Pay must equal Pay in Pay Band plus Grade Pay (₹${(payInBand + gradePay).toLocaleString('en-IN')}).`))
  }

  if (!payState.dni) {
    errors.push(validationError('MISSING_DNI', 'dni', 'A confirmed DNI is required.'))
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedState: errors.length === 0
      ? { ...payState, cpc: 6, payBand, payInBand, gradePay, basicPay }
      : null,
  }
}

export function validate7CpcPayState(payState = {}) {
  const errors = []
  const cpcValue = Number(payState.cpc)
  const levelValue = payState.level ?? payState.payLevel
  const cellIndex = Number(payState.cellIndex)
  const basicPayValue = Number(payState.basicPay)

  if (!Number.isInteger(cpcValue) || cpcValue !== 7) {
    errors.push('A valid 7th CPC pay state is required.')
  }

  const level = getPayMatrixLevel(levelValue)

  if (!level) {
    errors.push(`Level ${levelValue ?? 'unknown'} does not exist in the 7th CPC Pay Matrix.`)
    return { valid: false, errors }
  }

  if (!Number.isInteger(cellIndex) || cellIndex < 1) {
    errors.push('Cell index must be a positive integer.')
    return { valid: false, errors }
  }

  const cell = getCell(level.level, cellIndex)

  if (!cell) {
    errors.push(`Cell ${cellIndex} does not exist in Level ${level.level}.`)
    return { valid: false, errors }
  }

  if (!Number.isFinite(basicPayValue)) {
    errors.push('Basic pay must be a valid number.')
    return { valid: false, errors }
  }

  if (basicPayValue !== cell.value) {
    errors.push(`₹${basicPayValue.toLocaleString('en-IN')} is not Cell ${cellIndex} of Level ${level.level}.`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
