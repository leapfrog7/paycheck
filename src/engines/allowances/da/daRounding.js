export function roundAllowanceFractionToRupee(numerator, denominator = 100) {
  if (!Number.isSafeInteger(numerator) || numerator < 0 || !Number.isSafeInteger(denominator) || denominator <= 0) {
    return { success: false, reason: 'INVALID_ROUNDING_INPUT', errors: ['Rounding requires non-negative safe-integer monetary operands.'] }
  }
  const wholeRupees = Math.floor(numerator / denominator)
  const remainder = numerator % denominator
  return {
    success: true,
    amount: wholeRupees + (remainder * 2 >= denominator ? 1 : 0),
    wholeRupees,
    remainder,
    denominator,
    operation: remainder * 2 >= denominator ? 'ROUND_UP_50_PAISE_OR_MORE' : 'IGNORE_FRACTION_BELOW_50_PAISE',
  }
}

export function roundDaAmountToRupee(basicPay, rate) {
  if (!Number.isSafeInteger(basicPay) || basicPay < 0 || !Number.isSafeInteger(rate) || rate < 0) {
    return { success: false, reason: 'INVALID_DA_ROUNDING_INPUT', errors: ['Basic Pay and DA rate must be non-negative safe integers.'] }
  }
  return roundAllowanceFractionToRupee(basicPay * rate, 100)
}
