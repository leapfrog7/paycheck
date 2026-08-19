import { describe, expect, it } from 'vitest'
import { SEVENTH_CPC_PAY_MATRIX } from '../data/pay/7cpcPayMatrix'
import { getCell } from '../domain/pay/payMatrix'

const expectedCellCounts = {
  1: 40, 2: 40, 3: 40, 4: 40, 5: 40, 6: 40, 7: 40, 8: 40, 9: 40, 10: 40,
  11: 39, 12: 34, 13: 20, '13A': 18, 14: 15, 15: 8, 16: 4, 17: 1, 18: 1,
}

describe('domain-owner supplied 7th CPC Pay Matrix regression', () => {
  it.each([
    ['1', 9, 22800],
    ['4', 9, 32300],
    ['6', 5, 39900],
    ['7', 6, 52000],
    ['11', 1, 67700],
    ['13', 1, 123100],
    ['13A', 1, 131100],
    ['15', 8, 224100],
    ['17', 1, 225000],
    ['18', 1, 250000],
  ])('retains Level %s Cell %i as ₹%i', (level, cellIndex, value) => {
    expect(getCell(level, cellIndex)).toEqual({ index: cellIndex, value })
  })

  it.each(Object.entries(expectedCellCounts))('retains %i stored Cells in Level %s', (level, count) => {
    expect(SEVENTH_CPC_PAY_MATRIX[level]).toHaveLength(count)
  })
})
