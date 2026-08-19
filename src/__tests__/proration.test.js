import { describe, expect, it } from 'vitest'
import { createAllowanceEligibilityState } from '../domain/allowances/eligibilityState'
import { createLocationState } from '../domain/allowances/locationState'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { PAY_CORRECTION_MODES } from '../domain/events/payCorrection'
import {
  calculateProratedComponent, createEmptyProrationConfig, PRORATION_METHODS,
  PRORATION_ROUNDING_METHODS, resolveProrationDecision,
} from '../domain/pay/proration'
import { createDrawnPayRecord } from '../domain/pay/drawnPay'
import { buildDueDrawnComparison } from '../engines/pay/comparison/buildDueDrawnComparison'
import { buildMonthlyDueLedger } from '../engines/pay/ledger/buildMonthlyDueLedger'
import { createEmptyPayCase, normalizeCaseInput } from '../features/cases/models/payCase'

function resolved(method, overrides = {}) {
  return { status: 'RESOLVED', decision: { method, sourceType: 'USER_CONFIRMED', reference: 'CONFIRMED', ...overrides } }
}

function policy(method = PRORATION_METHODS.CALENDAR_DAYS_IN_MONTH, overrides = {}) {
  return { casePolicy: { id: 'case-policy', method, sourceType: 'USER_CONFIRMED', reference: 'CASE-POLICY', roundingMethod: PRORATION_ROUNDING_METHODS.NEAREST_RUPEE, ...overrides }, monthPolicies: [], decisions: [] }
}

const opening = { cpc: 7, level: '6', cellIndex: 6, basicPay: 41100, dni: '2020-07-01' }

function event(type, date, overrides = {}) {
  return { id: `${type}-${date}`, type, eventDate: date, effectiveDate: date, fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE, ...overrides }
}

function location(id, from, to, category = 'HIGHER_RATE_CITY') {
  return createLocationState({ id, city: id, effectiveFrom: from, effectiveTo: to ?? null, hra: { scheme: '7CPC_XYZ', class: 'X' }, transport: { category } })
}

function eligibility(from) {
  return createAllowanceEligibilityState({ effectiveFrom: from, allowances: { hra: { eligible: true, conditions: { governmentAccommodation: false } }, transportAllowance: { eligible: true, conditions: { governmentTransportProvided: false } } } })
}

describe('proration arithmetic and audit model', () => {
  it('calculates 15–31 July as 17 inclusive calendar days', () => {
    const result = calculateProratedComponent({ fullMonthlyAmount: 31000, componentCode: 'BASIC_PAY', segmentFrom: '2024-07-15', segmentTo: '2024-07-31', decisionResolution: resolved(PRORATION_METHODS.CALENDAR_DAYS_IN_MONTH) })
    expect(result).toMatchObject({ status: 'RESOLVED', eligibleDays: 17, divisor: 31, factor: 17 / 31, rawProratedAmount: 17000, finalAmount: 17000, roundingDecision: { method: 'NOT_REQUIRED' } })
  })

  it.each([['2023-02-01', '2023-02-14', 28, 0.5], ['2024-02-01', '2024-02-14', 29, 14 / 29]])('uses the correct February divisor for %s', (from, to, divisor, factor) => {
    expect(calculateProratedComponent({ fullMonthlyAmount: 29000, componentCode: 'BASIC_PAY', segmentFrom: from, segmentTo: to, decisionResolution: resolved(PRORATION_METHODS.CALENDAR_DAYS_IN_MONTH, { roundingMethod: 'NEAREST_RUPEE' }) })).toMatchObject({ eligibleDays: 14, divisor, factor })
  })

  it('supports fixed-30 only when selected and rejects an anomalous factor above one', () => {
    expect(calculateProratedComponent({ fullMonthlyAmount: 30000, componentCode: 'BASIC_PAY', segmentFrom: '2024-07-15', segmentTo: '2024-07-31', decisionResolution: resolved(PRORATION_METHODS.FIXED_30_DAY_DIVISOR) })).toMatchObject({ status: 'RESOLVED', divisor: 30, factor: 17 / 30, finalAmount: 17000 })
    expect(calculateProratedComponent({ fullMonthlyAmount: 30000, componentCode: 'BASIC_PAY', segmentFrom: '2024-07-01', segmentTo: '2024-07-31', decisionResolution: resolved(PRORATION_METHODS.FIXED_30_DAY_DIVISOR) })).toMatchObject({ status: 'UNRESOLVED', reason: 'PRORATION_FACTOR_EXCEEDS_ONE' })
  })

  it('supports manual factor, manual amount including zero, and explicit full amount', () => {
    expect(calculateProratedComponent({ fullMonthlyAmount: 10000, componentCode: 'DA', segmentFrom: '2024-07-01', segmentTo: '2024-07-10', decisionResolution: resolved(PRORATION_METHODS.MANUAL_FACTOR, { factor: 0.4 }) })).toMatchObject({ rawProratedAmount: 4000, finalAmount: 4000 })
    expect(calculateProratedComponent({ fullMonthlyAmount: 10000, componentCode: 'HRA', segmentFrom: '2024-07-01', segmentTo: '2024-07-10', decisionResolution: resolved(PRORATION_METHODS.MANUAL_SEGMENT_AMOUNT, { segmentAmount: 3275 }) })).toMatchObject({ factor: null, rawProratedAmount: 3275, finalAmount: 3275 })
    expect(calculateProratedComponent({ fullMonthlyAmount: 10000, componentCode: 'HRA', segmentFrom: '2024-07-01', segmentTo: '2024-07-10', decisionResolution: resolved(PRORATION_METHODS.MANUAL_SEGMENT_AMOUNT, { segmentAmount: 0 }) })).toMatchObject({ status: 'RESOLVED', finalAmount: 0 })
    expect(calculateProratedComponent({ fullMonthlyAmount: 10000, componentCode: 'TA', segmentFrom: '2024-07-01', segmentTo: '2024-07-10', decisionResolution: resolved(PRORATION_METHODS.NO_PRORATION_FULL_AMOUNT) })).toMatchObject({ factor: 1, finalAmount: 10000 })
  })

  it('keeps missing basis and missing rounding distinct and null', () => {
    expect(calculateProratedComponent({ fullMonthlyAmount: 10000, componentCode: 'BASIC_PAY', segmentFrom: '2024-07-01', segmentTo: '2024-07-10', decisionResolution: { status: 'UNRESOLVED', reason: 'PRORATION_BASIS_NOT_CONFIRMED' } })).toMatchObject({ status: 'UNRESOLVED', reason: 'PRORATION_BASIS_NOT_CONFIRMED', finalAmount: null })
    expect(calculateProratedComponent({ fullMonthlyAmount: 10000, componentCode: 'BASIC_PAY', segmentFrom: '2024-07-01', segmentTo: '2024-07-03', decisionResolution: resolved(PRORATION_METHODS.CALENDAR_DAYS_IN_MONTH) })).toMatchObject({ status: 'UNRESOLVED', reason: 'PRORATION_ROUNDING_NOT_CONFIRMED', finalAmount: null, rawProratedAmount: 30000 / 31 })
  })
})

describe('decision precedence', () => {
  it('uses component/segment over month over case policy', () => {
    const config = {
      casePolicy: { method: 'CALENDAR_DAYS_IN_MONTH', sourceType: 'USER_CONFIRMED' },
      monthPolicies: [{ id: 'july', month: '2024-07', method: 'MANUAL_FACTOR', factor: 0.5 }],
      decisions: [{ id: 'hra', month: '2024-07', componentCode: 'HRA', segmentFrom: '2024-07-15', segmentTo: '2024-07-31', method: 'MANUAL_SEGMENT_AMOUNT', segmentAmount: 2700 }],
    }
    expect(resolveProrationDecision(config, { month: '2024-07', componentCode: 'HRA', segmentFrom: '2024-07-15', segmentTo: '2024-07-31' })).toMatchObject({ scope: 'EXPLICIT_DECISION', decision: { id: 'hra' } })
    expect(resolveProrationDecision(config, { month: '2024-07', componentCode: 'DA', segmentFrom: '2024-07-15', segmentTo: '2024-07-31' })).toMatchObject({ scope: 'MONTH_POLICY', decision: { id: 'july' } })
    expect(resolveProrationDecision(config, { month: '2024-08', componentCode: 'DA', segmentFrom: '2024-08-15', segmentTo: '2024-08-31' })).toMatchObject({ scope: 'CASE_POLICY', decision: { method: 'CALENDAR_DAYS_IN_MONTH' } })
  })
})

describe('segment-first monthly Due integration', () => {
  it('leaves a full month numerically unchanged without a policy', () => {
    const result = buildMonthlyDueLedger({ openingState: { ...opening, cellIndex: 40, basicPay: 56900, dni: '2024-07-01' }, events: [], startDate: '2024-01-01', endDate: '2024-01-31', locationHistory: [location('delhi', '2024-01-01')], eligibilityHistory: [eligibility('2024-01-01')] })
    expect(result.months[0]).toMatchObject({ status: 'RESOLVED', prorationStatus: 'FULL_MONTH', components: { basicPay: 56900, da: 28450, hra: 17070, transportAllowance: 5400 }, grossDue: 107820 })
  })

  it('aggregates old and promoted Basic independently rather than averaging', () => {
    const result = buildMonthlyDueLedger({ openingState: opening, events: [event(EVENT_TYPES.REGULAR_PROMOTION, '2020-06-15', { targetLevel: '7' })], startDate: '2020-06-01', endDate: '2020-06-30', enabledAllowances: { da: false, hra: false, transportAllowance: false }, prorationConfig: policy() })
    const expected = Math.round(41100 * 14 / 30) + Math.round(44900 * 16 / 30)
    expect(result.months[0]).toMatchObject({ status: 'RESOLVED', prorationStatus: 'RESOLVED', components: { basicPay: expected }, grossDue: expected })
    expect(result.months[0].segments.map(({ proration }) => proration.basicPay.eligibleDays)).toEqual([14, 16])
  })

  it('supports three continuous monetary segments in one month', () => {
    const corrections = [
      event(EVENT_TYPES.PAY_REFIXATION, '2020-06-10', { correctionMode: PAY_CORRECTION_MODES.STRUCTURED, correctedPayState: { cpc: 7, level: '6', cellIndex: 7, basicPay: 42300, dni: '2020-07-01' } }),
      event(EVENT_TYPES.PAY_REFIXATION, '2020-06-20', { correctionMode: PAY_CORRECTION_MODES.STRUCTURED, correctedPayState: { cpc: 7, level: '6', cellIndex: 8, basicPay: 43600, dni: '2020-07-01' } }),
    ]
    const result = buildMonthlyDueLedger({ openingState: opening, events: corrections, startDate: '2020-06-01', endDate: '2020-06-30', enabledAllowances: { da: false, hra: false, transportAllowance: false }, prorationConfig: policy() })
    expect(result.months[0].segments.map(({ effectiveFrom, effectiveTo }) => [effectiveFrom, effectiveTo])).toEqual([['2020-06-01', '2020-06-09'], ['2020-06-10', '2020-06-19'], ['2020-06-20', '2020-06-30']])
    expect(result.months[0].grossDue).toBe(result.months[0].segments.reduce((total, segment) => total + segment.grossDue, 0))
  })

  it('applies a component override while Basic and DA use the case policy', () => {
    const config = policy('CALENDAR_DAYS_IN_MONTH', {})
    config.decisions.push({ id: 'hra-before', month: '2024-07', componentCode: 'HRA', segmentFrom: '2024-07-01', segmentTo: '2024-07-14', method: 'MANUAL_SEGMENT_AMOUNT', segmentAmount: 2000, sourceType: 'USER_CONFIRMED' })
    config.decisions.push({ id: 'hra-after', month: '2024-07', componentCode: 'HRA', segmentFrom: '2024-07-15', segmentTo: '2024-07-31', method: 'MANUAL_SEGMENT_AMOUNT', segmentAmount: 2700, sourceType: 'USER_CONFIRMED' })
    const result = buildMonthlyDueLedger({ openingState: { ...opening, cellIndex: 40, basicPay: 56900, dni: '2025-07-01' }, events: [], startDate: '2024-07-01', endDate: '2024-07-31', locationHistory: [location('delhi', '2024-07-01', '2024-07-14'), location('other', '2024-07-15', null, 'OTHER_PLACE')], eligibilityHistory: [eligibility('2024-07-01')], prorationConfig: config })
    expect(result.months[0]).toMatchObject({ status: 'RESOLVED', components: { hra: 4700 } })
    expect(result.months[0].segments.map(({ proration }) => proration.hra.method)).toEqual(['MANUAL_SEGMENT_AMOUNT', 'MANUAL_SEGMENT_AMOUNT'])
  })

  it('prorates final TA including DA-on-TA exactly once', () => {
    const result = buildMonthlyDueLedger({ openingState: { ...opening, cellIndex: 40, basicPay: 56900, dni: '2025-07-01' }, events: [], startDate: '2024-07-01', endDate: '2024-07-31', locationHistory: [location('delhi', '2024-07-01', '2024-07-14'), location('other', '2024-07-15', null, 'OTHER_PLACE')], eligibilityHistory: [eligibility('2024-07-01')], prorationConfig: policy() })
    for (const segment of result.months[0].segments) {
      expect(segment.proration.transportAllowance.rawProratedAmount).toBe(segment.allowances.transportAllowance.amount * segment.proration.transportAllowance.factor)
    }
  })

  it('uses the same framework at a notional monetary boundary', () => {
    const notional = event(EVENT_TYPES.NOTIONAL_REFIXATION, '2020-01-01', { correctionMode: PAY_CORRECTION_MODES.STRUCTURED, correctedPayState: { cpc: 7, level: '6', cellIndex: 7, basicPay: 42300, dni: '2020-07-01' }, monetaryBenefitFrom: '2020-06-15' })
    const result = buildMonthlyDueLedger({ openingState: opening, events: [notional], startDate: '2020-06-01', endDate: '2020-06-30', enabledAllowances: { da: false, hra: false, transportAllowance: false }, prorationConfig: policy() })
    expect(result.months[0].segments.map(({ monetaryStatus }) => monetaryStatus)).toEqual(['NOTIONAL_ONLY', 'MONETARY'])
    expect(result.months[0]).toMatchObject({ status: 'RESOLVED', components: { basicPay: Math.round(42300 * 16 / 30) } })
  })

  it('keeps delayed-switch CPC identities separate while prorating', () => {
    const sixth = { cpc: 6, payBand: 'PB-1', payInBand: 10160, gradePay: 2400, basicPay: 12560, dni: '2016-07-01' }
    const transition = event(EVENT_TYPES.CPC_TRANSITION, '2016-06-15', { fromCpc: 6, toCpc: 7, employeeSwitchDate: '2016-06-15', option: { status: 'CONFIRMED', basis: 'ON_VACATING_OR_CEASING_OLD_STRUCTURE' } })
    const result = buildMonthlyDueLedger({ openingState: sixth, events: [transition], startDate: '2016-06-01', endDate: '2016-06-30', enabledAllowances: { da: false, hra: false, transportAllowance: false }, prorationConfig: policy() })
    expect(result.months[0].segments.map(({ payState }) => payState.cpc)).toEqual([6, 7])
    expect(result.months[0].status).toBe('RESOLVED')
  })
})

describe('comparison and persistence', () => {
  it('recalculates comparison without mutating Drawn when policy changes', () => {
    const drawn = [createDrawnPayRecord({ month: '2020-06', entryMode: 'GROSS_ONLY', grossDrawn: 42000 })]
    const bytes = JSON.stringify(drawn)
    const args = { openingState: opening, events: [event(EVENT_TYPES.REGULAR_PROMOTION, '2020-06-15', { targetLevel: '7' })], startDate: '2020-06-01', endDate: '2020-06-30', enabledAllowances: { da: false, hra: false, transportAllowance: false } }
    const unresolved = buildDueDrawnComparison({ duePayLedger: buildMonthlyDueLedger(args), drawnPayHistory: drawn })
    const resolvedDue = buildMonthlyDueLedger({ ...args, prorationConfig: policy() })
    const resolved = buildDueDrawnComparison({ duePayLedger: resolvedDue, drawnPayHistory: drawn })
    expect(unresolved.months[0].status).toBe('UNRESOLVED')
    expect(resolved.months[0].status).toBe('RESOLVED')
    expect(JSON.stringify(drawn)).toBe(bytes)
  })

  it('persists policies and safely normalizes old cases', () => {
    const config = policy()
    config.monthPolicies.push({ id: 'march', month: '2021-03', method: 'MANUAL_FACTOR', factor: 0.4, reference: 'MARCH' })
    config.decisions.push({ id: 'hra', month: '2021-03', componentCode: 'HRA', method: 'MANUAL_SEGMENT_AMOUNT', segmentAmount: 3275, note: 'Exact amount' })
    expect(normalizeCaseInput({ prorationConfig: config }).prorationConfig).toEqual(config)
    expect(normalizeCaseInput({}).prorationConfig).toEqual(createEmptyProrationConfig())
    expect(createEmptyPayCase().prorationConfig).toEqual(createEmptyProrationConfig())
  })
})
