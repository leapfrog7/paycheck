import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DRAWN_PAY_COMPLETENESS,
  DRAWN_PAY_ENTRY_MODES,
  calculateDrawnComponentTotal,
  copyPreviousDrawnPayRecord,
  createDrawnPayRecord,
  upsertDrawnPayRecord,
  validateDrawnPayHistory,
  validateDrawnPayRecord,
} from '../domain/pay/drawnPay'
import { normalizeCaseInput } from '../features/cases/models/payCase'
import { createCase, getCase, updateCase } from '../storage/caseStorage'

const period = { caseStartDate: '2024-01-01', caseEndDate: '2024-12-31' }

describe('Drawn Pay records', () => {
  it('creates component-entry records and derives gross from one component source of truth', () => {
    const record = createDrawnPayRecord({
      month: '2024-01',
      components: { basicPay: 56900, da: 28450, hra: 17070, transportAllowance: 5400 },
      otherAllowances: [{ name: 'Special Allowance', amount: 2500 }],
      grossDrawn: 1,
    })
    expect(record).toMatchObject({
      entryMode: DRAWN_PAY_ENTRY_MODES.COMPONENT_ENTRY,
      completeness: DRAWN_PAY_COMPLETENESS.COMPLETE_COMPONENTS,
      grossDrawn: 110320,
      sourceType: 'USER_ENTERED',
      status: 'RECORDED',
    })
    expect(calculateDrawnComponentTotal(record)).toBe(110320)
  })

  it('stores gross-only history without inventing components', () => {
    const record = createDrawnPayRecord({ month: '2024-02', entryMode: DRAWN_PAY_ENTRY_MODES.GROSS_ONLY, grossDrawn: 95000 })
    expect(validateDrawnPayRecord(record, period).valid).toBe(true)
    expect(record).toMatchObject({ completeness: DRAWN_PAY_COMPLETENESS.GROSS_ONLY, grossDrawn: 95000 })
    expect(Object.values(record.components)).toEqual([null, null, null, null])
  })

  it('retains partial components and a separately known gross', () => {
    const record = createDrawnPayRecord({ month: '2024-03', components: { basicPay: 56800, da: 27000 }, grossDrawn: 90000 })
    expect(record).toMatchObject({ completeness: DRAWN_PAY_COMPLETENESS.PARTIAL_COMPONENTS, grossDrawn: 90000, components: { basicPay: 56800, da: 27000, hra: null } })
    expect(validateDrawnPayRecord(record, period).valid).toBe(true)
  })

  it('accepts arbitrary historical Basic, DA, HRA and TA values without Government-rule validation', () => {
    const record = createDrawnPayRecord({ month: '2024-04', components: { basicPay: 56801, da: 27123, hra: 999, transportAllowance: 17 } })
    expect(validateDrawnPayRecord(record, period)).toMatchObject({ valid: true })
  })

  it('preserves missing separately from an actual zero', () => {
    const record = createDrawnPayRecord({ month: '2024-05', components: { basicPay: 0, da: '', hra: null } })
    expect(record.components).toMatchObject({ basicPay: 0, da: null, hra: null })
  })

  it('rejects duplicate months and out-of-period months', () => {
    const one = createDrawnPayRecord({ month: '2024-06', entryMode: 'GROSS_ONLY', grossDrawn: 1 })
    expect(validateDrawnPayHistory([one, one], period).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_DRAWN_MONTH' })]))
    expect(validateDrawnPayRecord({ ...one, month: '2025-01' }, period).errors[0].code).toBe('DRAWN_MONTH_OUTSIDE_CASE')
  })

  it('edits an existing month instead of creating a duplicate', () => {
    const original = createDrawnPayRecord({ month: '2024-07', entryMode: 'GROSS_ONLY', grossDrawn: 10 })
    const result = upsertDrawnPayRecord([original], { ...original, grossDrawn: 20 }, period)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].grossDrawn).toBe(20)
  })

  it('copies the nearest previously recorded month with provenance and arbitrary allowances retained', () => {
    const original = createDrawnPayRecord({
      month: '2024-08', components: { basicPay: 56801 },
      otherAllowances: [{ name: 'Special Duty Allowance', amount: 2500 }],
      note: 'Actual office record', reference: 'From salary slip',
    })
    const result = copyPreviousDrawnPayRecord([original], '2024-09', period)
    expect(result.record).toMatchObject({
      month: '2024-09', sourceType: 'USER_ENTERED', note: 'Actual office record', reference: 'From salary slip',
      otherAllowances: [{ name: 'Special Duty Allowance', amount: 2500 }],
    })
  })
})

describe('Drawn Pay case persistence and independence', () => {
  let values

  beforeEach(() => {
    values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    })
  })

  it('gives existing cases a backward-compatible empty history', () => {
    values.set('paycheck:cases', JSON.stringify([{ id: 'legacy', caseName: 'Legacy' }]))
    expect(getCase('legacy').drawnPayHistory).toEqual([])
    expect(normalizeCaseInput({}).drawnPayHistory).toEqual([])
  })

  it('round-trips user-entered Drawn Pay through case storage', () => {
    const record = createDrawnPayRecord({ month: '2024-10', entryMode: 'GROSS_ONLY', grossDrawn: 12345, note: 'Salary register' })
    createCase({ id: 'drawn-case', drawnPayHistory: [record] })
    expect(getCase('drawn-case').drawnPayHistory).toEqual([record])
  })

  it('does not mutate Drawn Pay when Due Pay inputs change', () => {
    const record = createDrawnPayRecord({ month: '2024-11', components: { basicPay: 123, da: 45 } })
    createCase({ id: 'independent-case', drawnPayHistory: [record], startingPay: { basicPay: 56900 } })
    updateCase('independent-case', {
      startingPay: { basicPay: 70000 },
      openingPayState: { cpc: 7, level: '8', cellIndex: 1, basicPay: 70000 },
      serviceEvents: [{ id: 'changed-event', type: 'ANNUAL_INCREMENT', eventDate: '2024-07-01' }],
      applicableAllowances: { da: true, hra: true },
    })
    expect(getCase('independent-case').drawnPayHistory).toEqual([record])
  })
})
