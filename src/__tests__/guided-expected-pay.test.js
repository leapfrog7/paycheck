import { describe, expect, it } from 'vitest'
import {
  ANNUAL_INCREMENT_TREATMENTS,
  buildGuidedExpectedPay,
  buildRoutineIncrementEvents,
  OTHER_CHANGE_TYPES,
  prepareGuidedCase,
} from '../features/cases/models/buildGuidedExpectedPay'

function guidedCase(overrides = {}) {
  return {
    calculationStartDate: '2024-01-01',
    calculationEndDate: '2025-12-31',
    payCommission: '7th CPC',
    startingPay: {
      payLevel: '6', cellIndex: 9, basicPay: 44900, dni: '2024-07-01',
    },
    applicableAllowances: { basicPay: true, da: false, hra: false, transportAllowance: false },
    careerChangeReview: {
      annualIncrementTreatment: ANNUAL_INCREMENT_TREATMENTS.INCLUDE,
      otherChanges: [OTHER_CHANGE_TYPES.NONE],
    },
    serviceEvents: [],
    locationHistory: [],
    allowanceEligibilityHistory: [],
    customAllowances: [],
    ...overrides,
  }
}

describe('guided Expected Pay setup', () => {
  it('creates deterministic annual increment events only inside the selected period', () => {
    const events = buildRoutineIncrementEvents({
      dni: '2023-07-01', startDate: '2024-01-01', endDate: '2026-06-30',
    })

    expect(events.map((event) => event.effectiveDate)).toEqual(['2024-07-01', '2025-07-01'])
    expect(events.every((event) => event.source === 'GUIDED_SETUP')).toBe(true)
  })

  it('keeps existing detailed events and replaces previously generated guided events', () => {
    const prepared = prepareGuidedCase(guidedCase({
      serviceEvents: [
        { id: 'manual', type: 'TRANSFER', effectiveDate: '2024-05-01' },
        { id: 'stale', type: 'ANNUAL_INCREMENT', effectiveDate: '2020-01-01', source: 'GUIDED_SETUP' },
      ],
    }))

    expect(prepared.serviceEvents.find((event) => event.id === 'manual')).toBeTruthy()
    expect(prepared.serviceEvents.find((event) => event.id === 'stale')).toBeFalsy()
    expect(prepared.serviceEvents.filter((event) => event.source === 'GUIDED_SETUP')).toHaveLength(2)
  })

  it('builds a resolved Basic Pay preview by replaying confirmed routine increments', () => {
    const preview = buildGuidedExpectedPay(guidedCase())

    expect(preview.ledger.success).toBe(true)
    expect(preview.ledger.status).toBe('RESOLVED')
    expect(preview.resolvedMonths).toHaveLength(24)
    expect(preview.latestResolved.components.basicPay).toBe(47600)
    expect(preview.isComplete).toBe(true)
  })

  it('marks the preview incomplete when career changes still need details', () => {
    const preview = buildGuidedExpectedPay(guidedCase({
      careerChangeReview: {
        annualIncrementTreatment: ANNUAL_INCREMENT_TREATMENTS.INCLUDE,
        otherChanges: [OTHER_CHANGE_TYPES.PROMOTION],
      },
    }))

    expect(preview.pendingChanges).toEqual([OTHER_CHANGE_TYPES.PROMOTION])
    expect(preview.isComplete).toBe(false)
  })

  it('keeps an uncertain increment decision provisional', () => {
    const preview = buildGuidedExpectedPay(guidedCase({
      careerChangeReview: {
        annualIncrementTreatment: ANNUAL_INCREMENT_TREATMENTS.UNSURE,
        otherChanges: [OTHER_CHANGE_TYPES.NONE],
      },
    }))

    expect(preview.ledger.status).toBe('RESOLVED')
    expect(preview.isComplete).toBe(false)
  })
})
