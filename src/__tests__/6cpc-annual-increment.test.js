import { describe, expect, it } from 'vitest'
import { getGradePaysForSixthCpcPayBand } from '../data/pay/6cpcPayBands'
import { validate6CpcPayState } from '../domain/pay/payStateValidation'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { applyPayEvent } from '../engines/pay/applyPayEvent'
import { calculate6CpcAnnualIncrement } from '../engines/pay/6cpc/annualIncrement'
import { roundSixthCpcIncrement } from '../engines/pay/6cpc/incrementRounding'

const supportedStructures = [
  ['PB-1', 1800], ['PB-1', 1900], ['PB-1', 2000], ['PB-1', 2400], ['PB-1', 2800],
  ['PB-2', 4200], ['PB-2', 4600], ['PB-2', 4800], ['PB-2', 5400],
  ['PB-3', 5400], ['PB-3', 6600], ['PB-3', 7600],
  ['PB-4', 8700], ['PB-4', 8900], ['PB-4', 10000],
]

function validState(overrides = {}) {
  return {
    cpc: 6,
    payBand: 'PB-2',
    payInBand: 13500,
    gradePay: 4200,
    basicPay: 17700,
    dni: '2014-07-01',
    ...overrides,
  }
}

describe('6th CPC Pay Band and Pay State', () => {
  it.each(supportedStructures)('validates %s with GP ₹%i', (payBand, gradePay) => {
    const payInBand = 15000
    const result = validate6CpcPayState(validState({
      payBand,
      payInBand,
      gradePay,
      basicPay: payInBand + gradePay,
    }))
    expect(result.valid).toBe(true)
  })

  it('rejects a Grade Pay that is invalid for its Pay Band', () => {
    const result = validate6CpcPayState(validState({ payBand: 'PB-1', gradePay: 5400, basicPay: 18900 }))
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'GRADE_PAY_NOT_VALID_FOR_BAND' }))
  })

  it('keeps PB-2 GP ₹5400 and PB-3 GP ₹5400 as distinct supported structures', () => {
    expect(getGradePaysForSixthCpcPayBand('PB-2')).toContain(5400)
    expect(getGradePaysForSixthCpcPayBand('PB-3')).toContain(5400)
    expect(validate6CpcPayState(validState({ payBand: 'PB-2', gradePay: 5400, basicPay: 18900 })).valid).toBe(true)
    expect(validate6CpcPayState(validState({ payBand: 'PB-3', gradePay: 5400, basicPay: 18900 })).valid).toBe(true)
  })

  it('rejects a Basic Pay inconsistent with Pay in Pay Band plus Grade Pay', () => {
    const result = validate6CpcPayState(validState({ basicPay: 18000 }))
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INCONSISTENT_BASIC_PAY' }))
  })
})

describe('6th CPC increment rounding', () => {
  it.each([
    [400, 400],
    [400.3, 400],
    [400.49, 400],
    [400.5, 410],
    [400.99, 410],
    [401, 410],
    [409.49, 410],
    [409.5, 410],
    [410, 410],
  ])('rounds ₹%f to ₹%i using the isolated domain rule', (value, expected) => {
    expect(roundSixthCpcIncrement(value)).toBe(expected)
  })

  it('rejects invalid rounding input', () => {
    expect(roundSixthCpcIncrement(-1)).toBeNull()
    expect(roundSixthCpcIncrement('not-a-number')).toBeNull()
  })
})

describe('6CPC_ANNUAL_INCREMENT', () => {
  it('calculates the documented ₹17,700 example', () => {
    const result = calculate6CpcAnnualIncrement(validState(), {
      eventDate: '2014-07-01',
      effectiveDate: '2014-07-01',
    })

    expect(result).toMatchObject({
      success: true,
      ruleId: '6CPC_ANNUAL_INCREMENT',
      incrementBase: 17700,
      rawIncrement: 531,
      roundedIncrement: 540,
      previousPayInBand: 13500,
      newPayInBand: 14040,
      unchangedGradePay: 4200,
      previousBasicPay: 17700,
      newBasicPay: 18240,
      after: {
        cpc: 6,
        payBand: 'PB-2',
        payInBand: 14040,
        gradePay: 4200,
        basicPay: 18240,
        dni: '2015-07-01',
      },
    })
  })

  it('adds the increment only to Pay in Pay Band and leaves Grade Pay unchanged', () => {
    const result = calculate6CpcAnnualIncrement(validState(), { eventDate: '2014-07-01' })
    expect(result.after.payInBand - result.before.payInBand).toBe(result.roundedIncrement)
    expect(result.after.gradePay).toBe(result.before.gradePay)
  })

  it('returns unresolved for a DNI mismatch', () => {
    const result = calculate6CpcAnnualIncrement(validState(), { eventDate: '2014-01-01' })
    expect(result).toMatchObject({ success: false, status: 'UNRESOLVED', reason: 'DNI_MISMATCH' })
  })

  it('derives 1 July of the following year as the next normal DNI', () => {
    const result = calculate6CpcAnnualIncrement(validState(), { eventDate: '2014-07-01' })
    expect(result.after.dni).toBe('2015-07-01')
  })

  it('rejects a non-6th-CPC source state', () => {
    const result = calculate6CpcAnnualIncrement(validState({ cpc: 7 }), { eventDate: '2014-07-01' })
    expect(result.success).toBe(false)
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_CPC' }))
  })

  it('is selected by the event dispatcher for a 6th CPC state', () => {
    const result = applyPayEvent(validState(), {
      type: EVENT_TYPES.ANNUAL_INCREMENT,
      eventDate: '2014-07-01',
    })
    expect(result).toMatchObject({ success: true, ruleId: '6CPC_ANNUAL_INCREMENT' })
  })
})
