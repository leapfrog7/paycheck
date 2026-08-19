export const HRA_AUTHORITY = Object.freeze({
  country: 'Government of India',
  ministry: 'Ministry of Finance',
  issuingAuthority: 'Department of Expenditure',
  authorityStatus: 'RULE_VERIFIED_REFERENCE_PENDING',
})

export const HRA_SCHEMES = Object.freeze([
  Object.freeze({
    id: '5CPC_HRA_CLASSIFICATION', cpc: 5,
    effectiveFrom: '1996-01-01', effectiveTo: '2005-12-31',
    classes: ['A-1', 'A', 'B-1', 'B-2', 'C', 'UNCLASSIFIED'],
    rateRules: [{ daThreshold: null, rates: { 'A-1': 30, A: 15, 'B-1': 15, 'B-2': 15, C: 7.5, UNCLASSIFIED: 5 } }],
    calculationBasis: 'BASIC_PAY', calculationBasisStatus: 'VERIFIED',
    minimumMonthlyByClass: null,
    ruleId: '5CPC_HRA_CLASS_RATES', authority: HRA_AUTHORITY, status: 'VERIFIED',
  }),
  Object.freeze({
    id: '6CPC_XYZ', cpc: 6,
    effectiveFrom: '2006-01-01', effectiveTo: '2015-12-31',
    classes: ['X', 'Y', 'Z'],
    rateRules: [{ daThreshold: null, rates: { X: 30, Y: 20, Z: 10 } }],
    calculationBasis: 'BASIC_PAY', calculationBasisStatus: 'VERIFIED',
    minimumMonthlyByClass: null,
    ruleId: '6CPC_HRA_XYZ_RATES', authority: HRA_AUTHORITY, status: 'VERIFIED',
  }),
  Object.freeze({
    id: '7CPC_XYZ', cpc: 7,
    effectiveFrom: '2017-07-01', effectiveTo: null,
    classes: ['X', 'Y', 'Z'],
    rateRules: [
      { daThreshold: 0, rates: { X: 24, Y: 16, Z: 8 } },
      { daThreshold: 25, rates: { X: 27, Y: 18, Z: 9 } },
      { daThreshold: 50, rates: { X: 30, Y: 20, Z: 10 } },
    ],
    calculationBasis: 'BASIC_PAY', calculationBasisStatus: 'VERIFIED',
    minimumMonthlyByClass: { X: 5400, Y: 3600, Z: 1800 },
    dependencies: ['DATE', 'HRA_CITY_CLASS', 'APPLICABLE_DA_RATE'],
    ruleId: '7CPC_HRA_DA_THRESHOLD_RATES', authority: HRA_AUTHORITY, status: 'VERIFIED',
  }),
])

export function getHraScheme(id) {
  return HRA_SCHEMES.find((scheme) => scheme.id === id) ?? null
}
