import { describe, expect, it } from 'vitest'
import {
  get6CpcTo7CpcMapping,
  get7CpcLevelFor6CpcState,
} from '../domain/pay/6cpcTo7cpcMapping'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { applyPayEvent } from '../engines/pay/applyPayEvent'
import { calculate6CpcTo7CpcTransition } from '../engines/pay/6cpcTo7cpcTransition'

const verifiedMappings = [
  ['PB-1', 1800, '1'],
  ['PB-1', 1900, '2'],
  ['PB-1', 2000, '3'],
  ['PB-1', 2400, '4'],
  ['PB-1', 2800, '5'],
  ['PB-2', 4200, '6'],
  ['PB-2', 4600, '7'],
  ['PB-2', 4800, '8'],
  ['PB-2', 5400, '9'],
  ['PB-3', 5400, '10'],
  ['PB-3', 6600, '11'],
  ['PB-3', 7600, '12'],
  ['PB-4', 8700, '13'],
  ['PB-4', 8900, '13A'],
  ['PB-4', 10000, '14'],
]

describe('6th CPC to 7th CPC Level mapping', () => {
  it.each(verifiedMappings)('maps %s with GP ₹%i to Level %s', (payBand, gradePay, level) => {
    expect(get6CpcTo7CpcMapping(payBand, gradePay)).toMatchObject({ payBand, gradePay, level })
    expect(get7CpcLevelFor6CpcState({ payBand, gradePay })).toBe(level)
  })

  it('distinguishes GP ₹5400 using Pay Band context', () => {
    expect(get7CpcLevelFor6CpcState({ payBand: 'PB-2', gradePay: 5400 })).toBe('9')
    expect(get7CpcLevelFor6CpcState({ payBand: 'PB-3', gradePay: 5400 })).toBe('10')
  })

  it('does not map GP ₹5400 without Pay Band context', () => {
    expect(get6CpcTo7CpcMapping(undefined, 5400)).toBeNull()
    expect(get7CpcLevelFor6CpcState({ gradePay: 5400 })).toBeNull()
  })

  it('rejects an invalid Pay Band and Grade Pay combination', () => {
    expect(get6CpcTo7CpcMapping('PB-1', 4200)).toBeNull()
  })
})

describe('6CPC_TO_7CPC normal fixation', () => {
  it('reproduces the official ₹12,560 to Level 4 ₹32,300 example', () => {
    const result = calculate6CpcTo7CpcTransition(
      { cpc: 6, payBand: 'PB-1', payInBand: 10160, gradePay: 2400, basicPay: 12560 },
      { employeeSwitchDate: '2016-01-01' },
    )

    expect(result).toMatchObject({
      success: true,
      ruleId: '6CPC_TO_7CPC',
      calculated6CpcBasicPay: 12560,
      fitmentFactor: 2.57,
      rawFitmentValue: 32279.2,
      roundedFitmentValue: 32279,
      mappedLevel: '4',
      selectedCell: { index: 9, value: 32300 },
      after: {
        cpc: 7,
        effectiveFrom: '2016-01-01',
        level: '4',
        cellIndex: 9,
        correspondingCellIndex: 9,
        basicPay: 32300,
      },
    })
    expect(result.cellLookup.operation).toBe('IMMEDIATE_NEXT_HIGHER_CELL')
    expect(result.steps).toHaveLength(5)
  })

  it('uses an exact Cell match', () => {
    const result = calculate6CpcTo7CpcTransition({
      cpc: 6,
      payBand: 'PB-1',
      payInBand: 10168,
      gradePay: 2400,
      basicPay: 12568,
    })

    expect(result.roundedFitmentValue).toBe(32300)
    expect(result.selectedCell).toEqual({ index: 9, value: 32300 })
    expect(result.cellLookup.operation).toBe('EXACT_CELL')
  })

  it('uses the immediate next higher Cell only in the mapped Level', () => {
    const result = calculate6CpcTo7CpcTransition({
      cpc: 6,
      payBand: 'PB-2',
      payInBand: 13500,
      gradePay: 4200,
      basicPay: 17700,
    })

    expect(result.roundedFitmentValue).toBe(45489)
    expect(result.after).toMatchObject({ level: '6', cellIndex: 10, basicPay: 46200 })
    expect(result.cellLookup.searchedLevel).toBe('6')
  })

  it('rejects inconsistent Basic Pay', () => {
    const result = calculate6CpcTo7CpcTransition({
      cpc: 6, payBand: 'PB-2', payInBand: 13500, gradePay: 4200, basicPay: 18000,
    })
    expect(result).toMatchObject({ success: false, status: 'UNRESOLVED', reason: 'INCONSISTENT_BASIC_PAY' })
  })

  it('rejects an invalid Pay Band and Grade Pay combination without guessing', () => {
    const result = calculate6CpcTo7CpcTransition({
      cpc: 6, payBand: 'PB-2', payInBand: 13500, gradePay: 5000, basicPay: 18500,
    })
    expect(result).toMatchObject({ success: false, reason: 'INVALID_PAY_BAND_GRADE_PAY_COMBINATION' })
  })

  it('rejects an unmapped structure without guessing', () => {
    const result = calculate6CpcTo7CpcTransition({
      cpc: 6, payBand: 'PB-5', payInBand: 70000, gradePay: 12000, basicPay: 82000,
    })
    expect(result).toMatchObject({ success: false, reason: 'UNMAPPED_PAY_STRUCTURE' })
  })

  it('rejects missing Pay Band and missing Grade Pay', () => {
    expect(calculate6CpcTo7CpcTransition({ cpc: 6 }).reason).toBe('MISSING_PAY_BAND')
    expect(calculate6CpcTo7CpcTransition({ cpc: 6, payBand: 'PB-2' }).reason).toBe('MISSING_GRADE_PAY')
  })

  it('rejects a non-6th-CPC source state', () => {
    expect(calculate6CpcTo7CpcTransition({ cpc: 7 }).reason).toBe('INVALID_SOURCE_CPC')
  })

  it('uses a suitable higher Cell present in the corrected authoritative Level data', () => {
    const result = calculate6CpcTo7CpcTransition({
      cpc: 6, payBand: 'PB-1', payInBand: 20200, gradePay: 1800, basicPay: 22000,
    })
    expect(result).toMatchObject({
      success: true,
      mappedLevel: '1',
      roundedFitmentValue: 56540,
      selectedCell: { index: 40, value: 56900 },
    })
  })

  it('applies a 6-to-7 CPC_TRANSITION using employeeSwitchDate', () => {
    const result = applyPayEvent(
      { cpc: 6, payBand: 'PB-1', payInBand: 10160, gradePay: 2400, basicPay: 12560 },
      {
        type: EVENT_TYPES.CPC_TRANSITION,
        fromCpc: 6,
        toCpc: 7,
        employeeSwitchDate: '2016-07-01',
        option: { status: 'CONFIRMED', basis: 'ON_VACATING_OR_CEASING_OLD_STRUCTURE' },
      },
    )
    expect(result.after.effectiveFrom).toBe('2016-07-01')
  })

  it('does not apply an unsupported CPC transition', () => {
    const result = applyPayEvent(
      { cpc: 5 },
      { type: EVENT_TYPES.CPC_TRANSITION, fromCpc: 5, toCpc: 7 },
    )
    expect(result).toMatchObject({ success: false, reason: 'UNSUPPORTED_CPC_TRANSITION' })
  })
})
