import { describe, expect, it } from 'vitest'
import { HISTORICAL_DA_RATES, DA_BASE_TYPES, DEARNESS_COMPONENT_TYPES } from '../data/allowances/da/historicalDaRates'
import { HRA_SCHEMES, getHraScheme } from '../data/allowances/hra/hraRuleSchemes'
import { SIXTH_CPC_TRANSPORT_RULE, SEVENTH_CPC_TRANSPORT_RULE, TRANSPORT_ALLOWANCE_COMPONENTS } from '../data/allowances/transport/transportAllowanceRules'
import { ALLOWANCE_CALCULATION_TYPES, ALLOWANCE_SOURCE_TYPES } from '../domain/allowances/allowanceConstants'
import { createAllowanceResult, validateAllowanceResult } from '../domain/allowances/allowanceResult'
import { createCustomAllowanceDefinition, validateCustomAllowanceDefinition } from '../domain/allowances/customAllowance'
import { createLocationState, validateLocationState } from '../domain/allowances/locationState'
import { createAllowanceEligibilityState, validateAllowanceEligibilityState } from '../domain/allowances/eligibilityState'
import { getApplicableDaRule, getDaRate } from '../engines/allowances/da/daRuleLookup'
import { ALLOWANCE_REGISTRY } from '../engines/allowances/allowanceRegistry'

const verifiedDaRules = [
  { cpc: 6, effectiveFrom: '2014-01-01', effectiveTo: '2014-06-30', rate: 100, basis: 'BASIC_PAY', ruleId: 'test-6-a', status: 'VERIFIED' },
  { cpc: 6, effectiveFrom: '2014-07-01', effectiveTo: '2014-12-31', rate: 107, basis: 'BASIC_PAY', ruleId: 'test-6-b', status: 'VERIFIED' },
  { cpc: 7, effectiveFrom: '2016-01-01', effectiveTo: '2016-06-30', rate: 0, basis: 'BASIC_PAY', ruleId: 'test-7-a', status: 'VERIFIED' },
]

describe('allowance domain foundation', () => {
  describe('DA lookup', () => {
    it('selects a verified rate by date', () => {
      expect(getDaRate({ date: '2014-08-01', cpc: 6, rules: verifiedDaRules })).toMatchObject({ success: true, rate: 107 })
    })

    it('uses a CPC-specific series and never carries a 6th CPC rate into 7th CPC', () => {
      expect(getDaRate({ date: '2016-01-01', cpc: 7, rules: verifiedDaRules }).rate).toBe(0)
      expect(getDaRate({ date: '2016-01-01', cpc: 6, rules: verifiedDaRules })).toMatchObject({ success: false, reason: 'NO_VERIFIED_DA_RATE' })
    })

    it('returns unresolved when no verified historical rate exists', () => {
      expect(HISTORICAL_DA_RATES.length).toBeGreaterThan(0)
      expect(getApplicableDaRule({ date: '1995-12-31', cpc: 5 })).toMatchObject({ success: false, status: 'UNRESOLVED', reason: 'NO_VERIFIED_DA_RATE' })
    })

    it('does not derive or interpolate rates between records', () => {
      expect(getDaRate({ date: '2015-01-01', cpc: 6, rules: verifiedDaRules }).success).toBe(false)
    })

    it('can represent Dearness Pay and changes to the calculation base', () => {
      expect(DEARNESS_COMPONENT_TYPES).toMatchObject({ DA: 'DA', DEARNESS_PAY: 'DEARNESS_PAY' })
      expect(DA_BASE_TYPES.BASIC_PAY_PLUS_DEARNESS_PAY).toBeDefined()
    })
  })

  describe('HRA schemes', () => {
    it('allows historical classification vocabularies to coexist', () => {
      expect(HRA_SCHEMES.map(({ id }) => id)).toEqual(['5CPC_HRA_CLASSIFICATION', '6CPC_XYZ', '7CPC_XYZ'])
      expect(getHraScheme('5CPC_HRA_CLASSIFICATION').classes).toEqual(['A-1', 'A', 'B-1', 'B-2', 'C', 'UNCLASSIFIED'])
      expect(getHraScheme('6CPC_XYZ').classes).toEqual(['X', 'Y', 'Z'])
    })

    it('represents 7th CPC DA-dependent rates and minimum-value slots', () => {
      const scheme = getHraScheme('7CPC_XYZ')
      expect(scheme.rateRules.map(({ daThreshold }) => daThreshold)).toEqual([0, 25, 50])
      expect(scheme.rateRules[2].rates).toEqual({ X: 30, Y: 20, Z: 10 })
      expect(scheme.minimumMonthlyByClass).toEqual({ X: 5400, Y: 3600, Z: 1800 })
    })
  })

  describe('Transport Allowance structures', () => {
    it('represents 6th CPC Grade Pay and Pay-in-Band criteria', () => {
      expect(SIXTH_CPC_TRANSPORT_RULE.brackets).toHaveLength(4)
      expect(SIXTH_CPC_TRANSPORT_RULE.brackets[2].condition).toMatchObject({
        gradePay: { operator: 'LESS_THAN', value: 4200 },
        payInBand: { operator: 'GREATER_THAN_OR_EQUAL', value: 7440 },
      })
    })

    it('represents 7th CPC Level brackets and the Level 1/2 ₹24,200 exception', () => {
      expect(SEVENTH_CPC_TRANSPORT_RULE.brackets).toHaveLength(3)
      expect(SEVENTH_CPC_TRANSPORT_RULE.exceptions[0]).toMatchObject({
        levels: ['1', '2'], condition: { field: 'basicPay', value: 24200 },
      })
    })

    it('keeps base TA and DA-on-TA as separate output components', () => {
      expect(TRANSPORT_ALLOWANCE_COMPONENTS).toEqual(['BASE_TRANSPORT_ALLOWANCE', 'DA_ON_TRANSPORT_ALLOWANCE'])
      expect(SEVENTH_CPC_TRANSPORT_RULE.daComponent.lookup).toBe('CENTRAL_DA_RULE')
    })
  })

  describe('custom allowances and common result', () => {
    it('validates a fixed monthly user-defined allowance', () => {
      const definition = createCustomAllowanceDefinition({ id: 'custom-1', seriesId: 'special', name: 'Special Allowance', calculationType: ALLOWANCE_CALCULATION_TYPES.FIXED_MONTHLY, amount: 2500, effectiveFrom: '2022-07-01' })
      expect(validateCustomAllowanceDefinition(definition).valid).toBe(true)
      expect(definition.sourceType).toBe(ALLOWANCE_SOURCE_TYPES.USER_DEFINED)
    })

    it('validates percentage-of-basic input and rejects a missing rate', () => {
      const valid = createCustomAllowanceDefinition({ id: 'custom-2', seriesId: 'special-duty', name: 'Special Duty Allowance', calculationType: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC, rate: 10, effectiveFrom: '2022-07-01' })
      const invalid = { ...valid, rate: null }
      expect(validateCustomAllowanceDefinition(valid).valid).toBe(true)
      expect(validateCustomAllowanceDefinition(invalid).errors).toContainEqual({ code: 'INVALID_RATE', field: 'rate' })
    })

    it('rejects invalid custom allowance date ranges', () => {
      const definition = createCustomAllowanceDefinition({ id: 'custom-3', seriesId: 'manual', name: 'Manual', calculationType: ALLOWANCE_CALCULATION_TYPES.MANUAL_MONTHLY_AMOUNT, amount: 100, effectiveFrom: '2024-12-01', effectiveTo: '2024-01-01' })
      expect(validateCustomAllowanceDefinition(definition).errors).toContainEqual({ code: 'INVALID_EFFECTIVE_RANGE', field: 'effectiveTo' })
    })

    it('supports resolved system-rule and user-defined result provenance', () => {
      const system = createAllowanceResult({ allowanceCode: 'HRA', name: 'House Rent Allowance', effectiveFrom: '2024-01-01', effectiveTo: '2024-01-31', calculationType: 'PERCENTAGE_OF_BASIC', amount: 17070, status: 'RESOLVED', provenance: { sourceType: 'SYSTEM_RULE', authority: 'Department of Expenditure' } })
      const custom = createAllowanceResult({ allowanceCode: 'CUSTOM', name: 'Special Allowance', effectiveFrom: '2024-01-01', effectiveTo: '2024-01-31', calculationType: 'FIXED_MONTHLY', amount: 2500, status: 'RESOLVED', provenance: { sourceType: 'USER_DEFINED', definitionId: 'custom-1' } })
      expect(validateAllowanceResult(system).valid).toBe(true)
      expect(validateAllowanceResult(custom).valid).toBe(true)
      expect(custom.provenance.sourceType).toBe('USER_DEFINED')
    })
  })

  describe('dated location and eligibility state', () => {
    it('keeps HRA class and Transport category separate', () => {
      const state = createLocationState({ city: 'Delhi', effectiveFrom: '2018-05-14', hra: { scheme: '7CPC_XYZ', class: 'X' }, transport: { category: 'HIGHER_RATE_CITY' } })
      expect(validateLocationState(state, HRA_SCHEMES).valid).toBe(true)
      expect(state.hra.class).toBe('X')
      expect(state.transport.category).toBe('HIGHER_RATE_CITY')
    })

    it('supports dated, extensible allowance eligibility conditions', () => {
      const state = createAllowanceEligibilityState({ effectiveFrom: '2020-01-01', allowances: { hra: { eligible: false, conditions: { governmentAccommodation: true } }, transportAllowance: { eligible: true, conditions: { governmentTransportProvided: false } } } })
      expect(validateAllowanceEligibilityState(state).valid).toBe(true)
      expect(state.allowances.hra.conditions.governmentAccommodation).toBe(true)
    })
  })

  it('uses an extensible allowance registry instead of a calculation switch', () => {
    expect(ALLOWANCE_REGISTRY.entries().map(({ allowanceCode }) => allowanceCode)).toEqual(['DA', 'HRA', 'TRANSPORT_ALLOWANCE', 'CUSTOM'])
    expect(ALLOWANCE_REGISTRY.get('DA')).toMatchObject({ status: 'IMPLEMENTED', calculator: expect.any(Function) })
    expect(ALLOWANCE_REGISTRY.get('HRA')).toMatchObject({ status: 'IMPLEMENTED', calculator: expect.any(Function) })
    expect(ALLOWANCE_REGISTRY.get('TRANSPORT_ALLOWANCE')).toMatchObject({ status: 'IMPLEMENTED', calculator: expect.any(Function) })
    expect(ALLOWANCE_REGISTRY.get('CUSTOM')).toMatchObject({ status: 'IMPLEMENTED', calculator: expect.any(Function) })
  })
})
