export const SIXTH_CPC_PAY_BANDS = Object.freeze({
  'PB-1': Object.freeze({
    code: 'PB-1',
    label: 'PB-1 ₹5200–20200',
    minimum: 5200,
    maximum: 20200,
    gradePays: Object.freeze([1800, 1900, 2000, 2400, 2800]),
  }),
  'PB-2': Object.freeze({
    code: 'PB-2',
    label: 'PB-2 ₹9300–34800',
    minimum: 9300,
    maximum: 34800,
    gradePays: Object.freeze([4200, 4600, 4800, 5400]),
  }),
  'PB-3': Object.freeze({
    code: 'PB-3',
    label: 'PB-3 ₹15600–39100',
    minimum: 15600,
    maximum: 39100,
    gradePays: Object.freeze([5400, 6600, 7600]),
  }),
  'PB-4': Object.freeze({
    code: 'PB-4',
    label: 'PB-4 ₹37400–67000',
    minimum: 37400,
    maximum: 67000,
    gradePays: Object.freeze([8700, 8900, 10000]),
  }),
})

export const SIXTH_CPC_PAY_BAND_OPTIONS = Object.values(SIXTH_CPC_PAY_BANDS)

export function getSixthCpcPayBand(payBand) {
  return SIXTH_CPC_PAY_BANDS[payBand] ?? null
}

export function getGradePaysForSixthCpcPayBand(payBand) {
  return getSixthCpcPayBand(payBand)?.gradePays ?? []
}

export function getSixthCpcFinancialStructureRank(payBand, gradePay) {
  let rank = 0

  for (const band of SIXTH_CPC_PAY_BAND_OPTIONS) {
    for (const supportedGradePay of band.gradePays) {
      if (band.code === payBand && supportedGradePay === Number(gradePay)) return rank
      rank += 1
    }
  }

  return null
}

export function compareSixthCpcFinancialStructures(first, second) {
  const firstRank = getSixthCpcFinancialStructureRank(first?.payBand, first?.gradePay)
  const secondRank = getSixthCpcFinancialStructureRank(second?.payBand, second?.gradePay)

  if (firstRank === null || secondRank === null) return null
  return firstRank - secondRank
}
