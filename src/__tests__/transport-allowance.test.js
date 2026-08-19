import { describe, expect, it } from 'vitest'
import { createAllowanceEligibilityState } from '../domain/allowances/eligibilityState'
import { createLocationState } from '../domain/allowances/locationState'
import { calculateTransportAllowance } from '../engines/allowances/transport/calculateTransportAllowance'
import { resolveTransportAllowanceRule } from '../engines/allowances/transport/transportAllowanceRuleResolver'

function segment(payState, date) {
  return { from: date, to: date, payState, basicPay: payState.basicPay, status: 'RESOLVED' }
}

function location(category, date, hraClass = 'X') {
  return createLocationState({
    city: 'Explicitly classified posting', effectiveFrom: date,
    hra: { scheme: '7CPC_XYZ', class: hraClass }, transport: { category },
  })
}

function eligibility(date, overrides = {}) {
  return createAllowanceEligibilityState({
    effectiveFrom: date,
    allowances: { transportAllowance: { eligible: true, conditions: { governmentTransportProvided: false }, ...overrides } },
  })
}

function calculate(payState, date, category = 'HIGHER_RATE_CITY', options = {}) {
  return calculateTransportAllowance({
    payHistorySegment: segment(payState, date),
    applicableLocationState: options.missingLocation ? undefined : location(category, date, options.hraClass),
    applicableEligibilityState: options.missingEligibility ? undefined : eligibility(date, options.eligibilityOverrides),
    daRuleLookup: options.daRuleLookup,
  })
}

function sixthState({ payBand = 'PB-2', payInBand = 13500, gradePay = 4200 } = {}) {
  return { cpc: 6, payBand, payInBand, gradePay, basicPay: payInBand + gradePay }
}

describe('6th CPC Transport Allowance rule resolution', () => {
  it('does not apply the verified 6th CPC table before its rule period', () => {
    expect(resolveTransportAllowanceRule({ date: '2008-08-31', payState: sixthState(), transportCityCategory: 'HIGHER_RATE_CITY' })).toMatchObject({ success: false, reason: 'NO_VERIFIED_TRANSPORT_ALLOWANCE_RULE' })
  })

  it.each([
    [sixthState({ payBand: 'PB-2', payInBand: 15000, gradePay: 5400 }), '6CPC_TA_GP_5400_PLUS', 3200, 1600],
    [sixthState({ payBand: 'PB-3', payInBand: 15600, gradePay: 5400 }), '6CPC_TA_GP_5400_PLUS', 3200, 1600],
    [sixthState({ gradePay: 4200 }), '6CPC_TA_GP_4200_TO_4800', 1600, 800],
    [sixthState({ gradePay: 4600 }), '6CPC_TA_GP_4200_TO_4800', 1600, 800],
    [sixthState({ gradePay: 4800 }), '6CPC_TA_GP_4200_TO_4800', 1600, 800],
    [sixthState({ payBand: 'PB-1', payInBand: 7440, gradePay: 2800 }), '6CPC_TA_BELOW_4200_PIB_7440_PLUS', 1600, 800],
    [sixthState({ payBand: 'PB-1', payInBand: 7439, gradePay: 2800 }), '6CPC_TA_BELOW_4200_PIB_BELOW_7440', 600, 400],
  ])('selects %s from actual Pay Band/GP/Pay-in-Band state', (payState, ruleId, higherRate, otherRate) => {
    expect(resolveTransportAllowanceRule({ date: '2014-01-01', payState, transportCityCategory: 'HIGHER_RATE_CITY' })).toMatchObject({ success: true, ruleId, baseTransportAllowance: higherRate })
    expect(resolveTransportAllowanceRule({ date: '2014-01-01', payState, transportCityCategory: 'OTHER_PLACE' })).toMatchObject({ success: true, ruleId, baseTransportAllowance: otherRate })
  })

  it('uses Pay in Pay Band, not Basic Pay, for the ₹7,440 boundary', () => {
    const below = sixthState({ payBand: 'PB-1', payInBand: 7439, gradePay: 2800 })
    expect(below.basicPay).toBeGreaterThan(7440)
    expect(resolveTransportAllowanceRule({ date: '2014-01-01', payState: below, transportCityCategory: 'OTHER_PLACE' }).ruleId).toBe('6CPC_TA_BELOW_4200_PIB_BELOW_7440')
  })
})

describe('7th CPC Transport Allowance rule resolution', () => {
  it.each([
    ['9', 53100, '7CPC_TA_LEVEL_9_PLUS', 7200, 3600],
    ['10', 56100, '7CPC_TA_LEVEL_9_PLUS', 7200, 3600],
    ['14', 144200, '7CPC_TA_LEVEL_9_PLUS', 7200, 3600],
    ['3', 21700, '7CPC_TA_LEVEL_3_TO_8', 3600, 1800],
    ['8', 47600, '7CPC_TA_LEVEL_3_TO_8', 3600, 1800],
    ['1', 24100, '7CPC_TA_LEVEL_1_TO_2', 1350, 900],
    ['2', 24100, '7CPC_TA_LEVEL_1_TO_2', 1350, 900],
    ['1', 24200, '7CPC_TA_LEVEL_1_TO_2_BASIC_24200_PLUS', 3600, 1800],
    ['2', 24500, '7CPC_TA_LEVEL_1_TO_2_BASIC_24200_PLUS', 3600, 1800],
  ])('selects the ordinary or exception bracket for Level %s Basic ₹%i', (level, basicPay, ruleId, higherRate, otherRate) => {
    const payState = { cpc: 7, level, basicPay }
    expect(resolveTransportAllowanceRule({ date: '2017-07-01', payState, transportCityCategory: 'HIGHER_RATE_CITY' })).toMatchObject({ ruleId, baseTransportAllowance: higherRate })
    expect(resolveTransportAllowanceRule({ date: '2017-07-01', payState, transportCityCategory: 'OTHER_PLACE' })).toMatchObject({ ruleId, baseTransportAllowance: otherRate })
  })

  it('does not apply revised 7th CPC TA before 1 July 2017', () => {
    const payState = { cpc: 7, level: '7', basicPay: 56900 }
    expect(resolveTransportAllowanceRule({ date: '2017-06-30', payState, transportCityCategory: 'HIGHER_RATE_CITY' })).toMatchObject({ success: false, reason: '7CPC_PRE_JULY_2017_TRANSPORT_ALLOWANCE_RULE_NOT_IMPLEMENTED' })
    expect(resolveTransportAllowanceRule({ date: '2017-07-01', payState, transportCityCategory: 'HIGHER_RATE_CITY' }).success).toBe(true)
  })
})

describe('Transport Allowance calculation and DA thereon', () => {
  it('keeps Base TA and DA-on-TA separate at 7th CPC DA 50%', () => {
    const result = calculate({ cpc: 7, level: '7', basicPay: 56900 }, '2024-01-01')
    expect(result).toMatchObject({
      status: 'RESOLVED', ruleId: '7CPC_TA_LEVEL_3_TO_8',
      baseTransportAllowance: 3600,
      daOnTransportAllowance: { rate: 50, rawAmount: 1800, amount: 1800 },
      totalTransportAllowance: 5400, amount: 5400,
    })
  })

  it('automatically uses later central DA while Base TA remains unchanged', () => {
    const result = calculate({ cpc: 7, level: '7', basicPay: 56900 }, '2024-07-01', 'OTHER_PLACE')
    expect(result).toMatchObject({ baseTransportAllowance: 1800, daOnTransportAllowance: { rate: 53, rawAmount: 954, amount: 954 }, totalTransportAllowance: 2754 })
  })

  it('calculates 6th CPC GP ₹4,600 Base TA plus 107% DA', () => {
    const result = calculate(sixthState({ gradePay: 4600 }), '2014-07-01')
    expect(result).toMatchObject({ baseTransportAllowance: 1600, daOnTransportAllowance: { rate: 107, rawAmount: 1712, amount: 1712 }, totalTransportAllowance: 3312 })
  })

  it('records explicit 50-paise rounding for DA on TA', () => {
    const result = calculate({ cpc: 7, level: '1', basicPay: 18000 }, '2017-07-01')
    expect(result).toMatchObject({ baseTransportAllowance: 1350, daOnTransportAllowance: { rate: 5, rawAmount: 67.5, amount: 68 }, totalTransportAllowance: 1418 })
    expect(result.components.daOnTransportAllowance.roundingRule).toBe('ROUND_UP_50_PAISE_OR_MORE')
  })

  it('uses the 7th CPC DA series at the revised-rule start date', () => {
    expect(calculate({ cpc: 7, level: '7', basicPay: 56900 }, '2017-07-01')).toMatchObject({ inputs: { daRate: 5 }, baseTransportAllowance: 3600 })
  })
})

describe('Transport Allowance eligibility and location', () => {
  const payState = { cpc: 7, level: '7', basicPay: 56900 }

  it('calculates normally when eligible without Government transport', () => {
    expect(calculate(payState, '2024-01-01').status).toBe('RESOLVED')
  })

  it('returns resolved zero when explicitly ineligible', () => {
    expect(calculate(payState, '2024-01-01', 'HIGHER_RATE_CITY', { eligibilityOverrides: { eligible: false } })).toMatchObject({ status: 'RESOLVED', baseTransportAllowance: 0, daOnTransportAllowance: { amount: 0 }, totalTransportAllowance: 0, amount: 0 })
  })

  it('returns resolved zero when Government transport is provided', () => {
    expect(calculate(payState, '2024-01-01', 'HIGHER_RATE_CITY', { eligibilityOverrides: { conditions: { governmentTransportProvided: true } } })).toMatchObject({ status: 'RESOLVED', amount: 0, components: { eligibility: { reason: 'GOVERNMENT_TRANSPORT_PROVIDED' } } })
  })

  it('returns unresolved when eligibility or TA location category is missing', () => {
    expect(calculate(payState, '2024-01-01', 'HIGHER_RATE_CITY', { missingEligibility: true })).toMatchObject({ status: 'UNRESOLVED', reason: 'MISSING_TRANSPORT_ALLOWANCE_ELIGIBILITY' })
    expect(calculate(payState, '2024-01-01', '', { hraClass: 'X' })).toMatchObject({ status: 'UNRESOLVED', reason: 'MISSING_TRANSPORT_CITY_CATEGORY' })
  })

  it('uses OTHER_PLACE even when the independent HRA class is X', () => {
    expect(calculate(payState, '2024-01-01', 'OTHER_PLACE', { hraClass: 'X' })).toMatchObject({ inputs: { transportCityCategory: 'OTHER_PLACE' }, baseTransportAllowance: 1800 })
  })

  it('does not silently apply ordinary TA to deferred special conditions', () => {
    expect(calculate(payState, '2024-01-01', 'HIGHER_RATE_CITY', { eligibilityOverrides: { conditions: { disabledEmployeeDoubleRate: true } } })).toMatchObject({ status: 'UNRESOLVED', reason: 'DOUBLE_RATE_TRANSPORT_ALLOWANCE_NOT_IMPLEMENTED' })
    expect(calculate({ cpc: 7, level: '14', basicPay: 144200 }, '2024-01-01', 'HIGHER_RATE_CITY', { eligibilityOverrides: { conditions: { officialCarOption: true } } })).toMatchObject({ status: 'UNRESOLVED', reason: 'OFFICIAL_CAR_OPTION_NOT_IMPLEMENTED' })
  })

  it('keeps 5th CPC Transport Allowance unresolved', () => {
    expect(calculate({ cpc: 5, basicPay: 10000 }, '2004-01-01')).toMatchObject({ status: 'UNRESOLVED', reason: '5CPC_TRANSPORT_ALLOWANCE_RULE_NOT_IMPLEMENTED' })
  })
})
