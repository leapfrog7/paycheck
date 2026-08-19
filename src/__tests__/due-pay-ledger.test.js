import { describe, expect, it } from 'vitest'
import { ALLOWANCE_CALCULATION_TYPES } from '../domain/allowances/allowanceConstants'
import { createAllowanceEligibilityState } from '../domain/allowances/eligibilityState'
import { createCustomAllowanceDefinition } from '../domain/allowances/customAllowance'
import { createLocationState } from '../domain/allowances/locationState'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { buildMonthlyDueLedger } from '../engines/pay/ledger/buildMonthlyDueLedger'

const opening2024 = { id: 'opening', cpc: 7, level: '1', cellIndex: 40, basicPay: 56900, dni: '2024-07-01' }

function location(id, from, to = null, hraClass = 'X', transportCategory = 'HIGHER_RATE_CITY', scheme = '7CPC_XYZ') {
  return createLocationState({ id, effectiveFrom: from, effectiveTo: to, city: id, hra: { scheme, class: hraClass }, transport: { category: transportCategory } })
}

function eligibility(id, from, to = null, hra = {}, transportAllowance = {}) {
  return { id, ...createAllowanceEligibilityState({
    effectiveFrom: from, effectiveTo: to,
    allowances: {
      hra: { eligible: true, conditions: { governmentAccommodation: false }, ...hra },
      transportAllowance: { eligible: true, conditions: { governmentTransportProvided: false }, ...transportAllowance },
    },
  }) }
}

function custom(overrides = {}) {
  return createCustomAllowanceDefinition({
    id: 'special-v1', seriesId: 'special', name: 'Special Allowance',
    calculationType: ALLOWANCE_CALCULATION_TYPES.FIXED_MONTHLY,
    amount: 2500, effectiveFrom: '2024-01-01', ...overrides,
  })
}

function ledger(overrides = {}) {
  return buildMonthlyDueLedger({
    openingState: opening2024, events: [], startDate: '2024-01-01', endDate: '2024-01-31',
    locationHistory: [location('delhi', '2024-01-01')],
    eligibilityHistory: [eligibility('eligible', '2024-01-01')],
    customAllowanceDefinitions: [],
    enabledAllowances: { da: true, hra: true, transportAllowance: true },
    ...overrides,
  })
}

function event(type, date, overrides = {}) {
  return { id: `${type}-${date}`, type, eventDate: date, effectiveDate: date, fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE, ...overrides }
}

describe('full-month Due Pay', () => {
  it('adds Basic Pay exactly once and resolves all supported components', () => {
    const month = ledger().months[0]
    expect(month).toMatchObject({
      status: 'RESOLVED', prorationStatus: 'FULL_MONTH',
      components: { basicPay: 56900, da: 28450, hra: 17070, transportAllowance: 5400 },
      allowanceTotal: 50920, grossDue: 107820,
    })
  })

  it('adds separate user-defined allowances with provenance', () => {
    const month = ledger({ customAllowanceDefinitions: [custom()] }).months[0]
    expect(month).toMatchObject({ customAllowanceTotal: 2500, allowanceTotal: 53420, grossDue: 110320 })
    expect(month.components.customAllowances[0]).toMatchObject({ name: 'Special Allowance', amount: 2500, sourceType: 'USER_DEFINED' })
  })

  it('consumes the existing Basic-plus-DA custom engine', () => {
    const item = custom({ calculationType: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC_PLUS_DA, amount: null, rate: 10 })
    const month = ledger({ customAllowanceDefinitions: [item] }).months[0]
    expect(month.components.customAllowances[0].amount).toBe(8535)
    expect(month.grossDue).toBe(116355)
    expect(month.segments[0].allowances.custom[0].components.dearnessAllowance.ruleId).toBe('7CPC_DA_2024_01_01')
  })
})

describe('effective-date financial boundaries', () => {
  it('recalculates DA, HRA threshold, and DA-on-TA across December/January', () => {
    const result = ledger({
      startDate: '2023-12-01', endDate: '2024-01-31',
      locationHistory: [location('delhi', '2023-12-01')],
      eligibilityHistory: [eligibility('eligible', '2023-12-01')],
    })
    expect(result.months[0].components).toMatchObject({ da: 26174, hra: 15363, transportAllowance: 5256 })
    expect(result.months[1].components).toMatchObject({ da: 28450, hra: 17070, transportAllowance: 5400 })
  })

  it('creates two promotion segments but does not invent June proration', () => {
    const result = ledger({
      openingState: { cpc: 7, level: '6', cellIndex: 6, basicPay: 41100, dni: '2020-07-01' },
      events: [event(EVENT_TYPES.REGULAR_PROMOTION, '2020-06-15', { targetLevel: '7' })],
      startDate: '2020-06-01', endDate: '2020-06-30',
      locationHistory: [location('delhi', '2020-06-01')], eligibilityHistory: [eligibility('eligible', '2020-06-01')],
    })
    expect(result.months[0].segments.map(({ basicPay }) => basicPay)).toEqual([41100, 44900])
    expect(result.months[0]).toMatchObject({ status: 'PARTIALLY_RESOLVED', prorationStatus: 'UNRESOLVED_PRORATION', reason: 'PRORATION_BASIS_NOT_CONFIRMED', grossDue: null })
  })

  it('segments a mid-month transfer without changing Basic Pay', () => {
    const result = ledger({
      startDate: '2024-09-01', endDate: '2024-09-30',
      locationHistory: [
        location('delhi', '2024-09-01', '2024-09-14', 'X', 'HIGHER_RATE_CITY'),
        location('lucknow', '2024-09-15', null, 'Y', 'OTHER_PLACE'),
      ],
      eligibilityHistory: [eligibility('eligible', '2024-09-01')],
    })
    const segments = result.months[0].segments
    expect(segments.map(({ basicPay }) => basicPay)).toEqual([56900, 56900])
    expect(segments.map(({ allowances }) => allowances.hra.rate)).toEqual([30, 20])
    expect(segments.map(({ allowances }) => allowances.transportAllowance.baseTransportAllowance)).toEqual([3600, 1800])
    expect(result.months[0].grossDue).toBeNull()
  })

  it('segments a Government-accommodation eligibility change and preserves resolved zero', () => {
    const result = ledger({
      startDate: '2024-10-01', endDate: '2024-10-31',
      locationHistory: [location('delhi', '2024-10-01')],
      eligibilityHistory: [
        eligibility('eligible', '2024-10-01', '2024-10-09'),
        eligibility('quarters', '2024-10-10', null, { conditions: { governmentAccommodation: true } }),
      ],
    })
    expect(result.months[0].segments.map(({ allowances }) => allowances.hra.amount)).toEqual([17070, 0])
    expect(result.months[0].segments[1].allowances.hra.status).toBe('RESOLVED')
    expect(result.months[0].grossDue).toBeNull()
  })

  it('creates custom version boundaries without gaps or overlap', () => {
    const result = ledger({
      startDate: '2024-01-01', endDate: '2024-02-29',
      locationHistory: [location('delhi', '2024-01-01')], eligibilityHistory: [eligibility('eligible', '2024-01-01')],
      customAllowanceDefinitions: [
        custom({ id: 'v1', amount: 2000, effectiveFrom: '2024-01-01', effectiveTo: '2024-01-31' }),
        custom({ id: 'v2', amount: 2500, effectiveFrom: '2024-02-01' }),
      ],
    })
    expect(result.months.map(({ customAllowanceTotal }) => customAllowanceTotal)).toEqual([2000, 2500])
    expect(result.segments[1].effectiveFrom).toBe('2024-02-01')
  })
})

describe('unresolved and audit behavior', () => {
  it('keeps HRA unresolved rather than treating it as zero', () => {
    const result = ledger({
      locationHistory: [location('unknown-hra', '2024-01-01', null, '', 'HIGHER_RATE_CITY', '')],
    })
    const month = result.months[0]
    expect(month).toMatchObject({ status: 'PARTIALLY_RESOLVED', grossDue: null, unresolvedComponents: ['HRA'] })
    expect(month.segments[0].allowances.da.status).toBe('RESOLVED')
    expect(month.segments[0].allowances.transportAllowance.status).toBe('RESOLVED')
  })

  it('shows unsupported HRA/TA after the January 2016 CPC transition', () => {
    const opening = { cpc: 6, payBand: 'PB-1', payInBand: 10160, gradePay: 2400, basicPay: 12560, dni: '2016-07-01' }
    const transition = event(EVENT_TYPES.CPC_TRANSITION, '2016-01-01', { fromCpc: 6, toCpc: 7, employeeSwitchDate: '2016-01-01' })
    const result = ledger({
      openingState: opening, events: [transition], startDate: '2015-12-01', endDate: '2016-01-31',
      locationHistory: [
        location('sixth', '2015-12-01', '2015-12-31', 'X', 'HIGHER_RATE_CITY', '6CPC_XYZ'),
        location('seventh', '2016-01-01', null, 'X', 'HIGHER_RATE_CITY', '7CPC_XYZ'),
      ], eligibilityHistory: [eligibility('eligible', '2015-12-01')],
    })
    expect(result.months[0].segments[0].payState.cpc).toBe(6)
    expect(result.months[1]).toMatchObject({ status: 'PARTIALLY_RESOLVED', unresolvedComponents: expect.arrayContaining(['HRA', 'TRANSPORT_ALLOWANCE']), grossDue: null })
  })

  it('contaminates subsequent known-state results after an unresolved pay event', () => {
    const promotion = event(EVENT_TYPES.REGULAR_PROMOTION, '2024-01-15', { id: 'bad-promotion', targetLevel: '1' })
    const result = ledger({ events: [promotion] })
    expect(result.months[0].segments.at(-1)).toMatchObject({ basicPay: 56900, confidence: 'AFFECTED_BY_PRIOR_UNRESOLVED_EVENT', unresolvedEventIds: ['bad-promotion'] })
    expect(result.months[0]).toMatchObject({ status: 'PARTIALLY_RESOLVED', grossDue: null, confidence: 'AFFECTED_BY_PRIOR_UNRESOLVED_EVENT' })
  })

  it('retains no-fresh-fixation career provenance without a redundant segment', () => {
    const opening = { cpc: 7, level: '6', cellIndex: 6, basicPay: 41100, dni: '2020-07-01' }
    const events = [
      event(EVENT_TYPES.MACP, '2020-06-01', { id: 'macp', targetLevel: '7', macpNumber: 1 }),
      event(EVENT_TYPES.REGULAR_PROMOTION, '2020-06-15', { id: 'promotion', targetLevel: '7' }),
    ]
    const result = ledger({
      openingState: opening, events, startDate: '2020-06-01', endDate: '2020-06-30',
      locationHistory: [location('delhi', '2020-06-01')], eligibilityHistory: [eligibility('eligible', '2020-06-01')],
    })
    expect(result.months[0].segments).toHaveLength(1)
    expect(result.months[0].segments[0].provenance.auditEvents.find(({ eventId }) => eventId === 'promotion')).toMatchObject({ payFixationEffect: 'NO_FRESH_FIXATION' })
  })
})

describe('ledger boundaries and invariants', () => {
  it('marks partial first/final months unresolved for proration and covers leap day', () => {
    const result = ledger({
      startDate: '2024-01-15', endDate: '2024-02-29',
      locationHistory: [location('delhi', '2024-01-15')], eligibilityHistory: [eligibility('eligible', '2024-01-15')],
    })
    expect(result.months[0]).toMatchObject({ prorationStatus: 'UNRESOLVED_PRORATION', grossDue: null })
    expect(result.months[1]).toMatchObject({ periodEnd: '2024-02-29', status: 'RESOLVED' })
  })

  it('deduplicates event and DA boundaries on the same date and covers each date once', () => {
    const result = ledger({
      openingState: { cpc: 7, level: '6', cellIndex: 6, basicPay: 41100, dni: '2024-01-01' },
      events: [event(EVENT_TYPES.ANNUAL_INCREMENT, '2024-01-01')],
      startDate: '2023-12-01', endDate: '2024-01-31',
      locationHistory: [location('delhi', '2023-12-01')], eligibilityHistory: [eligibility('eligible', '2023-12-01')],
    })
    expect(result.months[1].segments).toHaveLength(1)
    for (let index = 1; index < result.segments.length; index += 1) {
      expect(result.segments[index].effectiveFrom > result.segments[index - 1].effectiveTo).toBe(true)
    }
    expect(result.segments[0].effectiveFrom).toBe('2023-12-01')
    expect(result.segments.at(-1).effectiveTo).toBe('2024-01-31')
  })
})
