export const SIXTH_CPC_INCREMENT_ROUNDING_RULE_ID = '6CPC_INCREMENT_ROUNDING'
export const SIXTH_CPC_INCREMENT_ROUNDING_STATUS = 'PROVISIONAL_IMPLEMENTATION_DETAIL'

export function roundSixthCpcIncrement(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null
  }

  const nearestRupee = Math.round(numericValue)
  return Math.ceil(nearestRupee / 10) * 10
}
