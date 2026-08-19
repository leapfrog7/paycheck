import { describe, expect, it } from 'vitest'
import { HISTORICAL_DA_RATES } from '../data/allowances/da/historicalDaRates'
import { calculateDearnessAllowance } from '../engines/allowances/da/calculateDa'
import { getApplicableDaRule, getDaRate } from '../engines/allowances/da/daRuleLookup'
import { roundAllowanceFractionToRupee } from '../engines/allowances/da/daRounding'

function segment(cpc, basicPay, from, to = from) {
  return { from, to, payState: { cpc, basicPay }, basicPay, status: 'RESOLVED' }
}

function calculate(cpc, basicPay, date) {
  const rule = getApplicableDaRule({ date, cpc })
  return calculateDearnessAllowance({ payHistorySegment: segment(cpc, basicPay, date), applicableDaRule: rule })
}

describe('verified historical DA dataset', () => {
  it('contains the supplied record counts for each CPC series', () => {
    expect(HISTORICAL_DA_RATES.filter(({ cpc }) => cpc === 5)).toHaveLength(21)
    expect(HISTORICAL_DA_RATES.filter(({ cpc }) => cpc === 6)).toHaveLength(21)
    expect(HISTORICAL_DA_RATES.filter(({ cpc }) => cpc === 7)).toHaveLength(18)
  })

  it('derives an end date from the next supplied record', () => {
    expect(getApplicableDaRule({ date: '2014-06-30', cpc: 6 }).rule).toMatchObject({ effectiveFrom: '2014-01-01', effectiveTo: '2014-06-30', rate: 100 })
    expect(getApplicableDaRule({ date: '2014-07-01', cpc: 6 }).rule).toMatchObject({ effectiveFrom: '2014-07-01', rate: 107 })
  })

  it('keeps lookup date-specific and CPC-specific at reset boundaries', () => {
    expect(getDaRate({ date: '2005-12-31', cpc: 5 }).rate).toBe(21)
    expect(getDaRate({ date: '2006-01-01', cpc: 6 }).rate).toBe(0)
    expect(getDaRate({ date: '2015-12-31', cpc: 6 }).rate).toBe(119)
    expect(getDaRate({ date: '2016-01-01', cpc: 7 }).rate).toBe(0)
    expect(getDaRate({ date: '2016-01-01', cpc: 6 }).rate).toBe(125)
  })

  it('does not leak or fall back between CPC series', () => {
    expect(getDaRate({ date: '2005-12-31', cpc: 6 })).toMatchObject({ success: false, reason: 'NO_VERIFIED_DA_RATE' })
    expect(getDaRate({ date: '1999-01-01', cpc: 7 })).toMatchObject({ success: false, reason: 'NO_VERIFIED_DA_RATE' })
  })

  it('returns unresolved outside populated history and rejects malformed dates', () => {
    expect(getDaRate({ date: '1995-12-31', cpc: 5 })).toMatchObject({ success: false, reason: 'NO_VERIFIED_DA_RATE' })
    expect(getDaRate({ date: '2006-01-01', cpc: 5 })).toMatchObject({ success: false, reason: 'NO_VERIFIED_DA_RATE' })
    expect(getDaRate({ date: '2016-01-02', cpc: 6 })).toMatchObject({ success: false, reason: 'NO_VERIFIED_DA_RATE' })
    expect(getDaRate({ date: '2020-02-30', cpc: 7 })).toMatchObject({ success: false, reason: 'INVALID_DATE' })
  })

  it('does not interpolate missing periods', () => {
    const sparse = HISTORICAL_DA_RATES.filter(({ ruleId }) => ruleId === '6CPC_DA_2014_01_01')
    expect(getDaRate({ date: '2014-07-01', cpc: 6, rules: sparse })).toMatchObject({ success: false, reason: 'NO_VERIFIED_DA_RATE' })
  })

  it.each([
    ['2019-07-01', 17], ['2020-01-01', 17], ['2020-07-01', 17],
    ['2021-01-01', 17], ['2021-06-30', 17], ['2021-07-01', 31],
  ])('represents payable COVID-period DA on %s as %i%%', (date, expectedRate) => {
    expect(getDaRate({ date, cpc: 7 }).rate).toBe(expectedRate)
  })

  it('contains no theoretical payable COVID freeze entries', () => {
    const freezeStarts = new Set(['2020-01-01', '2020-07-01', '2021-01-01'])
    expect(HISTORICAL_DA_RATES.filter((rule) => rule.cpc === 7 && freezeStarts.has(rule.effectiveFrom))).toEqual([])
  })
})

describe('deterministic DA calculator', () => {
  it('calculates 6th CPC DA at 100%', () => {
    expect(calculate(6, 17700, '2014-01-01')).toMatchObject({ status: 'RESOLVED', calculationBase: 17700, rawAmount: 17700, amount: 17700, rate: 100 })
  })

  it('calculates and rounds 6th CPC DA at 107%', () => {
    expect(calculate(6, 17700, '2014-07-01')).toMatchObject({ status: 'RESOLVED', rawAmount: 18939, amount: 18939, rate: 107 })
  })

  it('calculates 7th CPC DA at 50% and 53%', () => {
    expect(calculate(7, 56900, '2024-01-01')).toMatchObject({ amount: 28450, rate: 50 })
    expect(calculate(7, 56900, '2024-07-01')).toMatchObject({ rawAmount: 30157, amount: 30157, rate: 53 })
  })

  it.each([
    [10049, 100, 100],
    [10050, 100, 101],
    [10051, 100, 101],
  ])('rounds fractional paise numerator %i over %i to ₹%i', (numerator, denominator, expected) => {
    expect(roundAllowanceFractionToRupee(numerator, denominator).amount).toBe(expected)
  })

  it('calculates pre-merger 5th CPC DA on verified Basic Pay basis', () => {
    expect(calculate(5, 10000, '2004-01-01')).toMatchObject({ status: 'RESOLVED', rate: 61, amount: 6100 })
  })

  it('returns the post-merger 5th CPC rate but refuses unverified Dearness Pay arithmetic', () => {
    const rule = getApplicableDaRule({ date: '2004-04-01', cpc: 5 })
    expect(rule.rule).toMatchObject({ rate: 11, structuralMarker: 'DEARNESS_PAY_MERGER_RESIDUAL_DA_11_PERCENT', calculationBasisStatus: 'PROVISIONAL' })
    expect(calculateDearnessAllowance({ payHistorySegment: segment(5, 10000, '2004-04-01'), applicableDaRule: rule })).toMatchObject({
      status: 'UNRESOLVED', unresolvedReasons: expect.arrayContaining(['5CPC_DEARNESS_PAY_CALCULATION_BASE_NOT_IMPLEMENTED']),
    })
  })

  it('rejects a DA rule from another CPC series', () => {
    const sixthRule = getApplicableDaRule({ date: '2014-01-01', cpc: 6 })
    expect(calculateDearnessAllowance({ payHistorySegment: segment(7, 56900, '2014-01-01'), applicableDaRule: sixthRule })).toMatchObject({
      status: 'UNRESOLVED', unresolvedReasons: expect.arrayContaining(['INVALID_APPLICABLE_DA_RULE']),
    })
  })
})
