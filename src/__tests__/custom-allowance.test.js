import { afterEach, describe, expect, it, vi } from 'vitest'
import { ALLOWANCE_CALCULATION_TYPES, ALLOWANCE_SOURCE_TYPES } from '../domain/allowances/allowanceConstants'
import { createCustomAllowanceDefinition, validateCustomAllowanceDefinitions } from '../domain/allowances/customAllowance'
import { calculateCustomAllowance } from '../engines/allowances/custom/calculateCustomAllowance'
import { normalizeCaseInput } from '../features/cases/models/payCase'
import { createCase, getCase, updateCase } from '../storage/caseStorage'

afterEach(() => vi.unstubAllGlobals())

function definition(overrides = {}) {
  return createCustomAllowanceDefinition({
    id: 'definition-1', seriesId: 'special-allowance', name: 'Special Allowance',
    calculationType: ALLOWANCE_CALCULATION_TYPES.FIXED_MONTHLY,
    amount: 2500, effectiveFrom: '2022-07-01', ...overrides,
  })
}

function segment(basicPay, from, to = from, cpc = 7) {
  return { from, to, basicPay, payState: { cpc, basicPay }, status: 'RESOLVED' }
}

describe('Custom Allowance calculation', () => {
  it('keeps a fixed monthly amount unchanged when Basic Pay changes', () => {
    const item = definition()
    expect(calculateCustomAllowance({ definition: item, payHistorySegment: segment(50000, '2023-01-01') }).amount).toBe(2500)
    expect(calculateCustomAllowance({ definition: item, payHistorySegment: segment(56900, '2023-07-01') }).amount).toBe(2500)
  })

  it('calculates a percentage of Basic Pay', () => {
    const item = definition({ calculationType: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC, amount: null, rate: 10 })
    expect(calculateCustomAllowance({ definition: item, payHistorySegment: segment(50000, '2023-01-01') })).toMatchObject({
      status: 'RESOLVED', calculationBase: 50000, rawAmount: 5000, amount: 5000,
    })
  })

  it('calculates and rounds a fractional percentage of Basic Pay', () => {
    const item = definition({ calculationType: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC, amount: null, rate: 7.5 })
    expect(calculateCustomAllowance({ definition: item, payHistorySegment: segment(56900, '2023-01-01') })).toMatchObject({ rawAmount: 4267.5, amount: 4268 })
  })

  it.each([[10006, 750], [10007, 751]])('applies the below/above 50-paise rounding boundary for Basic ₹%i', (basicPay, amount) => {
    const item = definition({ calculationType: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC, amount: null, rate: 7.5 })
    expect(calculateCustomAllowance({ definition: item, payHistorySegment: segment(basicPay, '2023-01-01') }).amount).toBe(amount)
  })

  it('calculates percentage of Basic Pay plus centrally calculated DA', () => {
    const item = definition({ calculationType: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC_PLUS_DA, amount: null, rate: 10, effectiveFrom: '2024-01-01' })
    const result = calculateCustomAllowance({ definition: item, payHistorySegment: segment(50000, '2024-01-01') })
    expect(result).toMatchObject({
      status: 'RESOLVED', inputs: { basicPay: 50000, dearnessAllowance: 25000, daRate: 50 },
      calculationBase: 75000, rawAmount: 7500, amount: 7500,
      components: { dearnessAllowance: { amount: 25000, rate: 50, ruleId: '7CPC_DA_2024_01_01' } },
    })
  })

  it('uses the central DA interfaces and propagates unresolved DA', () => {
    const item = definition({ calculationType: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC_PLUS_DA, amount: null, rate: 10 })
    const daRuleLookup = vi.fn(() => ({ success: false, errors: ['Missing DA.'] }))
    const daCalculator = vi.fn()
    const result = calculateCustomAllowance({ definition: item, payHistorySegment: segment(50000, '2023-01-01'), daRuleLookup, daCalculator })
    expect(daRuleLookup).toHaveBeenCalledWith({ date: '2023-01-01', cpc: 7 })
    expect(daCalculator).not.toHaveBeenCalled()
    expect(result).toMatchObject({ status: 'UNRESOLVED', reason: 'CUSTOM_ALLOWANCE_DA_UNRESOLVED' })
  })

  it('represents manual monthly amounts as explicit dated definitions, including zero', () => {
    const january = definition({ id: 'jan', calculationType: ALLOWANCE_CALCULATION_TYPES.MANUAL_MONTHLY_AMOUNT, amount: 2500, effectiveFrom: '2024-01-01', effectiveTo: '2024-01-31' })
    const march = definition({ id: 'mar', calculationType: ALLOWANCE_CALCULATION_TYPES.MANUAL_MONTHLY_AMOUNT, amount: 0, effectiveFrom: '2024-03-01', effectiveTo: '2024-03-31' })
    expect(calculateCustomAllowance({ definition: january, payHistorySegment: segment(56900, '2024-01-01', '2024-01-31') }).amount).toBe(2500)
    expect(calculateCustomAllowance({ definition: march, payHistorySegment: segment(56900, '2024-03-01', '2024-03-31') }).amount).toBe(0)
  })

  it('returns explicit applicability statuses at inclusive date boundaries', () => {
    const item = definition({ effectiveFrom: '2024-01-01', effectiveTo: '2024-12-31' })
    expect(calculateCustomAllowance({ definition: item, payHistorySegment: segment(50000, '2023-12-31') })).toMatchObject({ status: 'NOT_APPLICABLE', reason: 'CUSTOM_ALLOWANCE_OUTSIDE_EFFECTIVE_RANGE' })
    expect(calculateCustomAllowance({ definition: item, payHistorySegment: segment(50000, '2024-01-01') }).status).toBe('RESOLVED')
    expect(calculateCustomAllowance({ definition: item, payHistorySegment: segment(50000, '2024-12-31') }).status).toBe('RESOLVED')
    expect(calculateCustomAllowance({ definition: item, payHistorySegment: segment(50000, '2025-01-01') }).status).toBe('NOT_APPLICABLE')
  })

  it('keeps an open-ended active definition applicable and an inactive one not applicable', () => {
    const item = definition({ effectiveTo: null })
    expect(calculateCustomAllowance({ definition: item, payHistorySegment: segment(50000, '2030-01-01') }).status).toBe('RESOLVED')
    expect(calculateCustomAllowance({ definition: { ...item, status: 'INACTIVE' }, payHistorySegment: segment(50000, '2023-01-01') })).toMatchObject({ status: 'NOT_APPLICABLE', reason: 'CUSTOM_ALLOWANCE_INACTIVE' })
  })

  it('always returns user-defined provenance and retains user metadata without authority', () => {
    const item = definition({ metadata: { description: 'Locally approved', reference: 'Office Order dated 14.07.2023' } })
    const result = calculateCustomAllowance({ definition: item, payHistorySegment: segment(50000, '2023-01-01') })
    expect(result.provenance).toMatchObject({ sourceType: ALLOWANCE_SOURCE_TYPES.USER_DEFINED, authority: null, definitionId: 'definition-1' })
    expect(result.userMetadata.reference).toBe('Office Order dated 14.07.2023')
  })

  it('rejects negative, non-numeric, and unsupported definitions', () => {
    for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(calculateCustomAllowance({ definition: definition({ amount }), payHistorySegment: segment(50000, '2023-01-01') }).reason).toBe('INVALID_CUSTOM_ALLOWANCE_DEFINITION')
    }
    expect(calculateCustomAllowance({ definition: definition({ calculationType: 'SLAB_BASED' }), payHistorySegment: segment(50000, '2023-01-01') }).reason).toBe('INVALID_CUSTOM_ALLOWANCE_DEFINITION')
  })
})

describe('Custom Allowance versions and persistence model', () => {
  it('rejects overlapping versions in the same series', () => {
    const versions = [
      definition({ id: 'v1', effectiveFrom: '2022-01-01', effectiveTo: '2022-12-31' }),
      definition({ id: 'v2', effectiveFrom: '2022-07-01', effectiveTo: null }),
    ]
    expect(validateCustomAllowanceDefinitions(versions)).toMatchObject({ valid: false, errors: expect.arrayContaining([expect.objectContaining({ code: 'CUSTOM_ALLOWANCE_DATE_RANGE_OVERLAP' })]) })
  })

  it('allows different allowance series to overlap', () => {
    const definitions = [definition({ id: 'special', seriesId: 'special' }), definition({ id: 'risk', seriesId: 'risk', name: 'Risk Allowance' })]
    expect(validateCustomAllowanceDefinitions(definitions).valid).toBe(true)
  })

  it('normalizes and preserves definitions when a case is saved or reloaded', () => {
    const item = definition({ metadata: { note: 'User note' } })
    const normalized = normalizeCaseInput({ customAllowances: [item] })
    expect(normalized.customAllowances[0]).toEqual(item)
    expect(normalizeCaseInput(normalized).customAllowances[0]).toEqual(item)
  })

  it('persists additions and edits through frontend case storage', () => {
    const values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    })
    const original = definition()
    const created = createCase({ id: 'case-custom', customAllowances: [original] })
    expect(getCase(created.id).customAllowances[0]).toEqual(original)
    const edited = { ...original, amount: 3000 }
    updateCase(created.id, { customAllowances: [edited] })
    expect(getCase(created.id).customAllowances[0]).toEqual(edited)
  })
})
