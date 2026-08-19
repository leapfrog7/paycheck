import {
  compareSixthCpcFinancialStructures,
  getSixthCpcPayBand,
} from '../../../data/pay/6cpcPayBands'
import { roundSixthCpcIncrement } from './incrementRounding'

export function resolveHigherSixthCpcTarget(before, targetPayBandValue, targetGradePayValue) {
  const targetPayBand = getSixthCpcPayBand(targetPayBandValue)
  const targetGradePay = Number(targetGradePayValue)

  if (!targetPayBand || !targetPayBand.gradePays.includes(targetGradePay)) {
    return { valid: false, reason: 'INVALID_TARGET_STRUCTURE' }
  }

  const comparison = compareSixthCpcFinancialStructures(
    { payBand: targetPayBand.code, gradePay: targetGradePay },
    { payBand: before.payBand, gradePay: before.gradePay },
  )

  if (comparison === 0) return { valid: false, reason: 'SAME_FINANCIAL_STRUCTURE' }
  if (comparison < 0) return { valid: false, reason: 'LOWER_FINANCIAL_STRUCTURE' }

  return { valid: true, targetPayBand, targetGradePay }
}

export function calculateSixthCpcFixationIncrement(before) {
  const incrementBase = before.basicPay
  const rawIncrement = Number((incrementBase * 0.03).toFixed(2))
  const roundedIncrement = roundSixthCpcIncrement(rawIncrement)

  return {
    incrementBase,
    rawIncrement,
    roundedIncrement,
    postIncrementPayInBand: before.payInBand + roundedIncrement,
  }
}

export function targetBandRequiresUndefinedAdjustment(before, targetPayBand, postIncrementPayInBand) {
  return targetPayBand.code !== before.payBand
    && (postIncrementPayInBand < targetPayBand.minimum || postIncrementPayInBand > targetPayBand.maximum)
}
