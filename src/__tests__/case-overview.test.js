import { describe, expect, it } from 'vitest'
import { DRAWN_PAY_ENTRY_MODES, createDrawnPayRecord } from '../domain/pay/drawnPay'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { ANNUAL_INCREMENT_TREATMENTS, OTHER_CHANGE_TYPES } from '../features/cases/models/buildGuidedExpectedPay'
import { buildCaseOverview } from '../features/cases/models/buildCaseOverview'

function baseCase(overrides = {}) {
  return {
    calculationGoal: 'ARREARS_RECOVERY',
    calculationStartDate: '2025-01-01',
    calculationEndDate: '2025-01-31',
    payCommission: '7th CPC',
    openingPayState: { cpc: 7, effectiveFrom: '2025-01-01', level: '6', cellIndex: 9, basicPay: 44900, dni: '2025-07-01' },
    startingPay: { payLevel: '6', cellIndex: 9, basicPay: 44900, dni: '2025-07-01' },
    applicableAllowances: { basicPay: true, da: false, hra: false, transportAllowance: false },
    careerChangeReview: {
      annualIncrementTreatment: ANNUAL_INCREMENT_TREATMENTS.EXCLUDE,
      otherChanges: [OTHER_CHANGE_TYPES.NONE],
    },
    serviceEvents: [],
    drawnPayHistory: [],
    locationHistory: [],
    allowanceEligibilityHistory: [],
    customAllowances: [],
    ...overrides,
  }
}

describe('result-first case overview', () => {
  it('shows Expected Pay and directs an arrears case to Drawn Pay next', () => {
    const overview = buildCaseOverview(baseCase())

    expect(overview.confidence).toBe('Expected Pay calculated')
    expect(overview.result).toMatchObject({ outcome: 'EXPECTED PAY', amount: 44900 })
    expect(overview.primaryAction).toMatchObject({ actionStep: 'drawn', actionLabel: 'Enter Drawn Pay' })
    expect(overview.coverage).toBe('1 of 1 months have calculated Expected Pay')
  })

  it('prioritizes confirmed career-change details before salary comparison', () => {
    const overview = buildCaseOverview(baseCase({
      careerChangeReview: {
        annualIncrementTreatment: ANNUAL_INCREMENT_TREATMENTS.INCLUDE,
        otherChanges: [OTHER_CHANGE_TYPES.PROMOTION],
      },
    }))

    expect(overview.pendingCareerChanges).toEqual([OTHER_CHANGE_TYPES.PROMOTION])
    expect(overview.primaryAction.actionStep).toBe('events')
    expect(overview.dueComplete).toBe(false)
  })

  it('surfaces missing selected allowance context as the next improvement', () => {
    const overview = buildCaseOverview(baseCase({
      applicableAllowances: { basicPay: true, da: true, hra: true, transportAllowance: false },
    }))

    expect(overview.unresolvedComponents).toContain('HRA')
    expect(overview.primaryAction.actionStep).toBe('allowances')
    expect(overview.result).toMatchObject({ label: 'Latest Basic Pay available', amount: 44900, outcome: 'BASIC PAY ONLY' })
  })

  it('presents a fully reconciled arrear only after Due and Drawn are comparable', () => {
    const drawnPayHistory = [createDrawnPayRecord({
      month: '2025-01', entryMode: DRAWN_PAY_ENTRY_MODES.GROSS_ONLY, grossDrawn: 44000,
    })]
    const overview = buildCaseOverview(baseCase({ drawnPayHistory }))

    expect(overview.allCompared).toBe(true)
    expect(overview.confidence).toBe('Fully reconciled')
    expect(overview.result).toMatchObject({ label: 'Net arrear', amount: 900, outcome: 'ARREAR' })
    expect(overview.primaryAction.actionStep).toBe('result')
  })

  it('routes an unresolved recorded pay event back to Career Changes', () => {
    const overview = buildCaseOverview(baseCase({
      serviceEvents: [{
        id: 'bad-promotion', type: EVENT_TYPES.REGULAR_PROMOTION,
        eventDate: '2025-01-15', effectiveDate: '2025-01-15', targetLevel: '6',
      }],
    }))

    expect(overview.unresolvedEventIds).toContain('bad-promotion')
    expect(overview.primaryAction.actionStep).toBe('events')
  })

  it('uses latest projected Basic Pay for a correct-pay goal', () => {
    const overview = buildCaseOverview(baseCase({ calculationGoal: 'CHECK_CURRENT_PAY' }))

    expect(overview.result).toMatchObject({ label: 'Latest projected Basic Pay', amount: 44900, outcome: 'CURRENT BASIC' })
    expect(overview.primaryAction.actionStep).toBe('history')
    expect(overview.attentionItems.some((item) => item.id === 'drawn-pay')).toBe(false)
  })
})
