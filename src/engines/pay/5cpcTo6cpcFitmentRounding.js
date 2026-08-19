export const FIFTH_TO_SIXTH_CPC_RULE7_ROUNDING_ID = '6CPC_RULE7_ROUND_UP_TO_NEXT_10'

export function roundUpRule7FitmentToNext10(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.ceil(amount / 10) * 10
}
