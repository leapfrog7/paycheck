import { describe, expect, it } from 'vitest'
import { createAllowanceEligibilityState } from '../domain/allowances/eligibilityState'
import { createLocationState } from '../domain/allowances/locationState'
import { calculateHouseRentAllowance } from '../engines/allowances/hra/calculateHra'
import { getApplicableHraScheme, resolveHraRate } from '../engines/allowances/hra/hraRuleLookup'

function paySegment(cpc, basicPay, date, overrides = {}) {
  return { from: date, to: date, basicPay, payState: { cpc, basicPay, ...overrides }, status: 'RESOLVED' }
}

function location(scheme, hraClass, date) {
  return createLocationState({
    city: 'Explicitly classified posting', effectiveFrom: date,
    hra: { scheme, class: hraClass },
    transport: { category: 'OTHER_PLACE' },
  })
}

function eligibility(date, overrides = {}) {
  return createAllowanceEligibilityState({
    effectiveFrom: date,
    allowances: { hra: { eligible: true, conditions: { governmentAccommodation: false }, ...overrides } },
  })
}

function calculate({ cpc, basicPay, date, hraClass, scheme, eligibilityOverrides, segmentOverrides, daRuleLookup }) {
  return calculateHouseRentAllowance({
    payHistorySegment: paySegment(cpc, basicPay, date, segmentOverrides),
    applicableLocationState: hraClass === undefined ? undefined : location(scheme, hraClass, date),
    applicableEligibilityState: eligibility(date, eligibilityOverrides),
    daRuleLookup,
  })
}

describe('5th CPC HRA', () => {
  it.each([
    ['A-1', 30, 3000], ['A', 15, 1500], ['B-1', 15, 1500],
    ['B-2', 15, 1500], ['C', 7.5, 750], ['UNCLASSIFIED', 5, 500],
  ])('calculates class %s at %s%%', (hraClass, rate, amount) => {
    expect(calculate({ cpc: 5, basicPay: 10000, date: '2003-01-01', hraClass, scheme: '5CPC_HRA_CLASSIFICATION' })).toMatchObject({
      status: 'RESOLVED', rate, calculationBase: 10000, percentageAmount: amount, amount,
    })
  })

  it('rejects an invalid historical class', () => {
    expect(calculate({ cpc: 5, basicPay: 10000, date: '2003-01-01', hraClass: 'X', scheme: '5CPC_HRA_CLASSIFICATION' })).toMatchObject({ status: 'UNRESOLVED', reason: 'INVALID_HRA_CITY_CLASS' })
  })

  it('returns unresolved when location state is missing', () => {
    expect(calculate({ cpc: 5, basicPay: 10000, date: '2003-01-01', scheme: '5CPC_HRA_CLASSIFICATION' })).toMatchObject({ status: 'UNRESOLVED', reason: 'MISSING_HRA_LOCATION_STATE' })
  })

  it('reuses the monetary convention for a 7.5% amount ending in 50 paise', () => {
    expect(calculate({ cpc: 5, basicPay: 10020, date: '2003-01-01', hraClass: 'C', scheme: '5CPC_HRA_CLASSIFICATION' })).toMatchObject({ rawAmount: 751.5, percentageAmount: 752, amount: 752 })
  })
})

describe('6th CPC HRA', () => {
  it.each([['X', 30, 5310], ['Y', 20, 3540], ['Z', 10, 1770]])('calculates class %s', (hraClass, rate, amount) => {
    expect(calculate({ cpc: 6, basicPay: 17700, date: '2014-01-01', hraClass, scheme: '6CPC_XYZ', segmentOverrides: { payBand: 'PB-2', payInBand: 13500, gradePay: 4200 } })).toMatchObject({
      status: 'RESOLVED', rate, amount,
    })
  })

  it.each(['A-1', ''])('rejects invalid class %s', (hraClass) => {
    expect(calculate({ cpc: 6, basicPay: 17700, date: '2014-01-01', hraClass, scheme: '6CPC_XYZ' })).toMatchObject({ status: 'UNRESOLVED', reason: 'INVALID_HRA_CITY_CLASS' })
  })

  it('does not use Transport category as an HRA class when HRA location is absent', () => {
    expect(calculate({ cpc: 6, basicPay: 17700, date: '2014-01-01', scheme: '6CPC_XYZ' })).toMatchObject({ status: 'UNRESOLVED', reason: 'MISSING_HRA_LOCATION_STATE' })
  })

  it('returns a resolved zero result when explicitly ineligible', () => {
    expect(calculate({ cpc: 6, basicPay: 17700, date: '2014-01-01', hraClass: 'X', scheme: '6CPC_XYZ', eligibilityOverrides: { eligible: false } })).toMatchObject({ status: 'RESOLVED', amount: 0, components: { eligibility: { reason: 'HRA_NOT_ELIGIBLE' } } })
  })

  it('returns a resolved zero result when Government accommodation is provided', () => {
    expect(calculate({ cpc: 6, basicPay: 17700, date: '2014-01-01', hraClass: 'X', scheme: '6CPC_XYZ', eligibilityOverrides: { conditions: { governmentAccommodation: true } } })).toMatchObject({ status: 'RESOLVED', amount: 0, components: { eligibility: { reason: 'GOVERNMENT_ACCOMMODATION_PROVIDED' } } })
  })
})

describe('7th CPC revised HRA', () => {
  it('does not apply the revised scheme on 30 June 2017', () => {
    expect(calculate({ cpc: 7, basicPay: 56900, date: '2017-06-30', hraClass: 'X', scheme: '7CPC_XYZ' })).toMatchObject({ status: 'UNRESOLVED', reason: '7CPC_PRE_JULY_2017_HRA_RULE_NOT_IMPLEMENTED' })
  })

  it('starts 24/16/8 on 1 July 2017 using the central 5% DA result', () => {
    expect(calculate({ cpc: 7, basicPay: 56900, date: '2017-07-01', hraClass: 'X', scheme: '7CPC_XYZ' })).toMatchObject({ status: 'RESOLVED', rate: 24, inputs: { daRate: 5 }, amount: 13656 })
  })

  it.each([['X', 24, 13656], ['Y', 16, 9104], ['Z', 8, 4552]])('uses the below-25%% rate for class %s', (hraClass, rate, amount) => {
    expect(calculate({ cpc: 7, basicPay: 56900, date: '2019-07-01', hraClass, scheme: '7CPC_XYZ' })).toMatchObject({ rate, amount, inputs: { daRate: 17 } })
  })

  it.each([['X', 27, 15363], ['Y', 18, 10242], ['Z', 9, 5121]])('uses the at-least-25%% rate for class %s', (hraClass, rate, amount) => {
    expect(calculate({ cpc: 7, basicPay: 56900, date: '2021-07-01', hraClass, scheme: '7CPC_XYZ' })).toMatchObject({ rate, amount, inputs: { daRate: 31 } })
  })

  it.each([['X', 30, 17070], ['Y', 20, 11380], ['Z', 10, 5690]])('uses the at-least-50%% rate for class %s', (hraClass, rate, amount) => {
    expect(calculate({ cpc: 7, basicPay: 56900, date: '2024-01-01', hraClass, scheme: '7CPC_XYZ' })).toMatchObject({ rate, amount, inputs: { daRate: 50 } })
  })

  it('selects thresholds at exactly 25% and exactly 50%', () => {
    const scheme = getApplicableHraScheme({ date: '2024-01-01', cpc: 7 }).scheme
    expect(resolveHraRate({ scheme, hraCityClass: 'X', daRate: 25 })).toMatchObject({ rate: 27, threshold: 25 })
    expect(resolveHraRate({ scheme, hraCityClass: 'X', daRate: 50 })).toMatchObject({ rate: 30, threshold: 50 })
  })

  it('uses the injected central lookup interface rather than an HRA DA table', () => {
    const daRuleLookup = () => ({ success: true, rule: { cpc: 7, rate: 25, effectiveFrom: '2017-07-01', effectiveTo: null } })
    expect(calculate({ cpc: 7, basicPay: 56900, date: '2017-07-01', hraClass: 'Y', scheme: '7CPC_XYZ', daRuleLookup })).toMatchObject({ rate: 18, inputs: { daRate: 25 } })
  })

  it.each([['X', 5400], ['Y', 3600], ['Z', 1800]])('applies the verified %s-city minimum', (hraClass, minimumAmount) => {
    expect(calculate({ cpc: 7, basicPay: 18000, date: '2017-07-01', hraClass, scheme: '7CPC_XYZ' })).toMatchObject({
      minimumAmount, minimumApplied: true, amount: minimumAmount,
    })
  })

  it('records when the percentage amount exceeds the minimum', () => {
    expect(calculate({ cpc: 7, basicPay: 56900, date: '2024-01-01', hraClass: 'X', scheme: '7CPC_XYZ' })).toMatchObject({ percentageAmount: 17070, minimumAmount: 5400, minimumApplied: false, amount: 17070 })
  })

  it('returns unresolved if the central DA lookup cannot resolve', () => {
    const daRuleLookup = () => ({ success: false, errors: ['No DA rule.'] })
    expect(calculate({ cpc: 7, basicPay: 56900, date: '2017-07-01', hraClass: 'X', scheme: '7CPC_XYZ', daRuleLookup })).toMatchObject({ status: 'UNRESOLVED', reason: 'APPLICABLE_DA_RATE_UNRESOLVED' })
  })
})
