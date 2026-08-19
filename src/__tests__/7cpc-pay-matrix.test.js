import { describe, expect, it } from 'vitest'
import {
  getPayMatrixLevel,
  getCell,
  findCellByBasicPay,
  isValidBasicPayForLevel,
  getNextCell,
} from '../domain/pay/payMatrix'
import { validate7CpcPayState } from '../domain/pay/payStateValidation'
import { calculate7CpcAnnualIncrement } from '../engines/pay/7cpc/annualIncrement'

describe('7th CPC Pay Matrix', () => {
  it('returns a valid Level lookup', () => {
    const level = getPayMatrixLevel('6')

    expect(level).toBeTruthy()
    expect(level.level).toBe('6')
    expect(level.cells.length).toBeGreaterThan(0)
  })

  it('returns null for an invalid Level lookup', () => {
    expect(getPayMatrixLevel('99')).toBeNull()
  })

  it('returns a valid Cell lookup', () => {
    const cell = getCell('6', 7)

    expect(cell).toMatchObject({ index: 7, value: 42300 })
  })

  it('returns null for an invalid Cell lookup', () => {
    expect(getCell('6', 999)).toBeNull()
  })

  it('validates the basic pay of a known cell', () => {
    expect(isValidBasicPayForLevel('6', 41100)).toBe(true)
    expect(isValidBasicPayForLevel('6', 43000)).toBe(false)
  })

  it('finds the matching cell for a valid value', () => {
    expect(findCellByBasicPay('7', 44900)).toMatchObject({ index: 1, value: 44900 })
  })

  it('returns a next cell for an in-range pay state', () => {
    expect(getNextCell('6', 6)).toMatchObject({ index: 7, value: 42300 })
    expect(getNextCell('7', 1)).toMatchObject({ index: 2, value: 46200 })
    expect(getNextCell('10', 1)).toMatchObject({ index: 2, value: 57800 })
  })
})

describe('7th CPC Pay State validation', () => {
  it('accepts a valid 7th CPC pay state', () => {
    const result = validate7CpcPayState({
      cpc: 7,
      level: '6',
      cellIndex: 7,
      basicPay: 42300,
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects a mismatched basic pay for the selected cell', () => {
    const result = validate7CpcPayState({
      cpc: 7,
      level: '6',
      cellIndex: 7,
      basicPay: 43000,
    })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('not Cell 7 of Level 6')
  })
})

describe('7th CPC Annual Increment', () => {
  it('increments from Cell 6 to Cell 7 in the same Level', () => {
    const result = calculate7CpcAnnualIncrement(
      {
        cpc: 7,
        level: '6',
        cellIndex: 6,
        basicPay: 41100,
        dni: '2020-07-01',
      },
      {
        eventId: 'evt_001',
        eventDate: '2020-07-01',
        effectiveDate: '2020-07-01',
      },
    )

    expect(result.success).toBe(true)
    expect(result.after.level).toBe('6')
    expect(result.after.cellIndex).toBe(7)
    expect(result.after.basicPay).toBe(42300)
    expect(result.steps[0]).toMatchObject({
      operation: 'MOVE_TO_NEXT_CELL',
      fromCellIndex: 6,
      toCellIndex: 7,
      fromBasicPay: 41100,
      toBasicPay: 42300,
    })
    expect(result.explanation).toContain('Cell 6 to Cell 7')
  })

  it('returns a clear error at the last cell when no next cell is available', () => {
    const result = calculate7CpcAnnualIncrement(
      {
        cpc: 7,
        level: '6',
        cellIndex: 40,
        basicPay: 112400,
      },
      {
        eventId: 'evt_002',
        eventDate: '2024-07-01',
        effectiveDate: '2024-07-01',
      },
    )

    expect(result.success).toBe(false)
    expect(result.reason).toBe('NO_NEXT_CELL_AVAILABLE')
  })

  it('rejects a non-7th CPC state', () => {
    const result = calculate7CpcAnnualIncrement(
      {
        cpc: 6,
        level: '6',
        cellIndex: 7,
        basicPay: 42300,
      },
      {
        eventId: 'evt_003',
        eventDate: '2020-07-01',
        effectiveDate: '2020-07-01',
      },
    )

    expect(result.success).toBe(false)
    expect(result.errors[0]).toContain('7th CPC')
  })

  it('rejects a mismatched basic pay before incrementing', () => {
    const result = calculate7CpcAnnualIncrement(
      {
        cpc: 7,
        level: '6',
        cellIndex: 7,
        basicPay: 43000,
      },
      {
        eventId: 'evt_004',
        eventDate: '2020-07-01',
        effectiveDate: '2020-07-01',
      },
    )

    expect(result.success).toBe(false)
    expect(result.errors[0]).toContain('not Cell 7 of Level 6')
  })
})

console.log('7th CPC pay matrix test file loaded.')
