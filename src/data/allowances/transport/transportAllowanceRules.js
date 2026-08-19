export const TRANSPORT_ALLOWANCE_AUTHORITY = Object.freeze({
  country: 'Government of India', ministry: 'Ministry of Finance',
  issuingAuthority: 'Department of Expenditure',
  authorityStatus: 'RULE_VERIFIED_REFERENCE_PENDING',
})

export const TRANSPORT_ALLOWANCE_COMPONENTS = Object.freeze([
  'BASE_TRANSPORT_ALLOWANCE', 'DA_ON_TRANSPORT_ALLOWANCE',
])

export const SEVENTH_CPC_TRANSPORT_RULE = Object.freeze({
  id: '7CPC_TRANSPORT_ALLOWANCE', cpc: 7,
  effectiveFrom: '2017-07-01', effectiveTo: null,
  locationCategories: ['HIGHER_RATE_CITY', 'OTHER_PLACE'],
  brackets: [
    { ruleId: '7CPC_TA_LEVEL_9_PLUS', levels: ['9', '10', '11', '12', '13', '13A', '14'], rates: { HIGHER_RATE_CITY: 7200, OTHER_PLACE: 3600 } },
    { ruleId: '7CPC_TA_LEVEL_3_TO_8', levels: ['3', '4', '5', '6', '7', '8'], rates: { HIGHER_RATE_CITY: 3600, OTHER_PLACE: 1800 } },
    { ruleId: '7CPC_TA_LEVEL_1_TO_2', levels: ['1', '2'], rates: { HIGHER_RATE_CITY: 1350, OTHER_PLACE: 900 } },
  ],
  exceptions: [{
    ruleId: '7CPC_TA_LEVEL_1_TO_2_BASIC_24200_PLUS', levels: ['1', '2'],
    condition: { field: 'basicPay', operator: 'GREATER_THAN_OR_EQUAL', value: 24200 },
    rates: { HIGHER_RATE_CITY: 3600, OTHER_PLACE: 1800 },
  }],
  daComponent: { lookup: 'CENTRAL_DA_RULE', appliedTo: 'BASE_TRANSPORT_ALLOWANCE', outputComponent: 'DA_ON_TRANSPORT_ALLOWANCE' },
  authority: TRANSPORT_ALLOWANCE_AUTHORITY, status: 'VERIFIED',
})

export const SIXTH_CPC_TRANSPORT_RULE = Object.freeze({
  id: '6CPC_TRANSPORT_ALLOWANCE', cpc: 6,
  effectiveFrom: '2008-09-01', effectiveTo: '2017-06-30',
  coverageStatus: 'VERIFIED_PRE_7CPC_REVISED_TA_PERIOD',
  locationCategories: ['HIGHER_RATE_CITY', 'OTHER_PLACE'],
  brackets: [
    { ruleId: '6CPC_TA_GP_5400_PLUS', condition: { gradePay: { operator: 'GREATER_THAN_OR_EQUAL', value: 5400 } }, rates: { HIGHER_RATE_CITY: 3200, OTHER_PLACE: 1600 } },
    { ruleId: '6CPC_TA_GP_4200_TO_4800', condition: { gradePay: { operator: 'IN', values: [4200, 4600, 4800] } }, rates: { HIGHER_RATE_CITY: 1600, OTHER_PLACE: 800 } },
    { ruleId: '6CPC_TA_BELOW_4200_PIB_7440_PLUS', condition: { gradePay: { operator: 'LESS_THAN', value: 4200 }, payInBand: { operator: 'GREATER_THAN_OR_EQUAL', value: 7440 } }, rates: { HIGHER_RATE_CITY: 1600, OTHER_PLACE: 800 } },
    { ruleId: '6CPC_TA_BELOW_4200_PIB_BELOW_7440', condition: { gradePay: { operator: 'LESS_THAN', value: 4200 }, payInBand: { operator: 'LESS_THAN', value: 7440 } }, rates: { HIGHER_RATE_CITY: 600, OTHER_PLACE: 400 } },
  ],
  dependencies: ['CPC', 'PAY_BAND', 'GRADE_PAY', 'PAY_IN_BAND', 'LOCATION_CATEGORY', 'DATE', 'APPLICABLE_DA_RATE'],
  daComponent: { lookup: 'CENTRAL_DA_RULE', appliedTo: 'BASE_TRANSPORT_ALLOWANCE', outputComponent: 'DA_ON_TRANSPORT_ALLOWANCE' },
  authority: TRANSPORT_ALLOWANCE_AUTHORITY, status: 'VERIFIED',
})

export const DEFERRED_TRANSPORT_ALLOWANCE_RULES = Object.freeze([
  '5CPC_TRANSPORT_ALLOWANCE',
  'DISABLED_EMPLOYEE_DOUBLE_RATE_TRANSPORT_ALLOWANCE',
  'SENIOR_OFFICER_OFFICIAL_CAR_OPTION',
  'WHOLE_MONTH_LEAVE_TOUR_TRAINING_AND_DEPUTATION_EXCLUSIONS',
])
