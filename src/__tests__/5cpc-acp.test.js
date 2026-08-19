import { describe, expect, it } from 'vitest'
import { createAcpEligibilityDecision } from '../domain/events/acpEligibility'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { findFifthCpcStage, getFifthCpcScale, getFifthCpcStages } from '../data/pay/5cpcPayScales'
import { calculate5CpcAcp } from '../engines/pay/5cpc/acp'
import { applyPayEvent } from '../engines/pay/applyPayEvent'
import { calculatePayEventTimeline } from '../engines/pay/eventTimeline'
import { buildPayHistory } from '../engines/pay/history/buildPayHistory'
import { buildMonthlyDueLedger } from '../engines/pay/ledger/buildMonthlyDueLedger'

function confirmed(acpNumber) {
  return createAcpEligibilityDecision({ acpNumber, status: 'CONFIRMED_EXTERNALLY', schemeApplicabilityStatus: 'CONFIRMED_EXTERNALLY', source: 'SERVICE_RECORD' })
}

function state(overrides = {}) {
  return {
    cpc: 5, effectiveFrom: '2004-01-01', payScaleId: 'S5_S12',
    payScaleLabel: getFifthCpcScale('S5_S12').label,
    stageIndex: 3, basicPay: 6900, dni: '2005-07-01', ...overrides,
  }
}

function acp(acpNumber = 1, overrides = {}) {
  return {
    id: `acp-${acpNumber}`, type: EVENT_TYPES.ACP, acpNumber,
    effectiveDate: acpNumber === 1 ? '2005-06-01' : '2005-10-01',
    targetPayScaleId: acpNumber === 1 ? 'S5_S13' : 'S5_S15',
    targetHierarchySource: 'SERVICE_RECORD',
    eligibilityDecision: confirmed(acpNumber),
    fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE,
    ...overrides,
  }
}

describe('5th CPC ACP fixation', () => {
  it('fixes confirmed ACP 1 without representing a career promotion', () => {
    const result = calculate5CpcAcp(state(), acp())
    expect(result).toMatchObject({
      success: true, ruleId: '5CPC_ACP_SCHEME_1999_FIXATION', schemeId: 'ACP_1999',
      eventId: 'acp-1', eventType: 'ACP', acpNumber: 1, effectiveDate: '2005-06-01',
      careerEffect: 'NONE', financialProgressionEffect: 'ACP', payFixationEffect: 'FRESH_FIXATION', reachedBy: 'ACP',
      targetHierarchySource: 'SERVICE_RECORD',
      sourceScale: { id: 'S5_S12' }, sourceStage: { index: 3, value: 6900 },
      financialUpgradationIncrement: 200, lowerScaleReferenceStage: { value: 7100 }, referenceAmount: 7100,
      targetScale: { id: 'S5_S13' }, lookupMethod: 'NEXT_HIGHER_STAGE', selectedTargetStage: { index: 1, value: 7450 }, resultingBasicPay: 7450,
      dniDecision: { status: 'UNRESOLVED', reason: '5CPC_POST_ACP_DNI_NOT_IMPLEMENTED' },
      after: { cpc: 5, payScaleId: 'S5_S13', stageIndex: 1, basicPay: 7450, reachedBy: 'ACP', acpNumber: 1, dni: { status: 'UNRESOLVED' } },
    })
    expect(result.careerEffect).not.toBe('PROMOTED')
    expect(result.explanation).not.toContain('promot')
  })

  it('uses an exact prescribed target stage when present', () => {
    const sourceStage = findFifthCpcStage('S5_S1', 2720)
    const result = calculate5CpcAcp(
      state({ payScaleId: 'S5_S1', payScaleLabel: getFifthCpcScale('S5_S1').label, stageIndex: sourceStage.index, basicPay: 2720 }),
      acp(1, { targetPayScaleId: 'S5_S3' }),
    )
    expect(result).toMatchObject({ success: true, referenceAmount: 2780, lookupMethod: 'EXACT_STAGE', selectedTargetStage: { value: 2780 } })
  })

  it('uses the actual multi-section source stage movement', () => {
    const boundary = findFifthCpcStage('S5_S5', 3950)
    const result = calculate5CpcAcp(
      state({ payScaleId: 'S5_S5', payScaleLabel: getFifthCpcScale('S5_S5').label, stageIndex: boundary.index, basicPay: 3950 }),
      acp(1, { targetPayScaleId: 'S5_S7' }),
    )
    expect(result).toMatchObject({ success: true, financialUpgradationIncrement: 80, referenceAmount: 4030, lookupMethod: 'NEXT_HIGHER_STAGE', selectedTargetStage: { value: 4100 } })
  })

  it.each(['S5_S16', 'S5_S33', 'S5_S34'])('does not invent an increment for fixed source scale %s', (payScaleId) => {
    const scale = getFifthCpcScale(payScaleId)
    const result = calculate5CpcAcp(state({ payScaleId, payScaleLabel: scale.label, stageIndex: 1, basicPay: scale.minimum }), acp(1, { targetPayScaleId: payScaleId === 'S5_S16' ? 'S5_S17' : 'S5_S32' }))
    expect(result).toMatchObject({ success: false, reason: 'LOWER_SCALE_FINANCIAL_UPGRADATION_INCREMENT_NOT_AVAILABLE' })
  })

  it('does not invent an increment at the final ordinary stage', () => {
    const stages = getFifthCpcStages('S5_S12')
    expect(calculate5CpcAcp(state({ stageIndex: stages.length, basicPay: stages.at(-1).value }), acp()).reason).toBe('LOWER_SCALE_FINANCIAL_UPGRADATION_INCREMENT_NOT_AVAILABLE')
  })

  it('returns controlled target and option failures', () => {
    expect(calculate5CpcAcp(state(), acp(1, { targetPayScaleId: '' })).reason).toBe('MISSING_TARGET_PAY_SCALE')
    expect(calculate5CpcAcp(state(), acp(1, { targetPayScaleId: 'UNKNOWN' })).reason).toBe('INVALID_TARGET_PAY_SCALE')
    expect(calculate5CpcAcp(state(), acp(1, { targetPayScaleId: 'S5_S12' })).reason).toBe('ACP_SAME_SCALE_UPGRADATION_NOT_IMPLEMENTED')
    const high = findFifthCpcStage('S5_S12', 10300)
    expect(calculate5CpcAcp(state({ stageIndex: high.index, basicPay: high.value }), acp(1, { targetPayScaleId: 'S5_S11' })).reason).toBe('NO_SUITABLE_STAGE_IN_TARGET_SCALE')
    expect(calculate5CpcAcp(state(), acp(1, { fixationOption: FIXATION_OPTIONS.FROM_LOWER_POST_DNI })).reason).toBe('5CPC_ACP_FROM_DNI_NOT_IMPLEMENTED')
  })

  it('requires ACP 1/2 and an externally confirmed eligibility/period decision', () => {
    expect(calculate5CpcAcp(state(), acp(3)).reason).toBe('INVALID_ACP_NUMBER')
    expect(calculate5CpcAcp(state(), acp(1, { eligibilityDecision: null }))).toMatchObject({ reason: 'ACP_ELIGIBILITY_OR_SCHEME_PERIOD_NOT_CONFIRMED', schemePeriodStatus: 'VERIFIED_THROUGH_2008_08_31' })
  })

  it('is dispatched distinctly from regular promotion and MACP', () => {
    const result = applyPayEvent(state(), acp())
    expect(result).toMatchObject({ success: true, eventType: 'ACP', ruleId: '5CPC_ACP_SCHEME_1999_FIXATION' })
    expect(result.ruleId).not.toContain('PROMOTION')
    expect(result.ruleId).not.toContain('MACP')
  })
})

describe('ACP history safeguards', () => {
  it('allows ACP 2 only after a successful ACP 1 and carries active state forward', () => {
    const timeline = calculatePayEventTimeline(state(), [acp(1), acp(2)])
    expect(timeline.entries.map(({ result }) => result.eventType)).toEqual(['ACP', 'ACP'])
    expect(timeline.entries[1].result).toMatchObject({ success: true, acpNumber: 2, before: { payScaleId: 'S5_S13', basicPay: 7450 }, after: { payScaleId: 'S5_S15', basicPay: 8000, reachedBy: 'ACP', acpNumber: 2 } })
    expect(timeline.currentPayState).toMatchObject({ payScaleId: 'S5_S15', basicPay: 8000, acpNumber: 2 })
  })

  it('rejects ACP 2 without prior successful ACP 1', () => {
    expect(calculate5CpcAcp(state(), acp(2), { history: [] })).toMatchObject({ success: false, reason: 'ACP_2_WITHOUT_PRIOR_ACP_1' })
  })

  it.each([1, 2])('rejects duplicate successful ACP %i', (number) => {
    const events = number === 1
      ? [acp(1), acp(1, { id: 'duplicate-acp-1', effectiveDate: '2005-08-01', targetPayScaleId: 'S5_S15' })]
      : [acp(1), acp(2), acp(2, { id: 'duplicate-acp-2', effectiveDate: '2005-11-01', targetPayScaleId: 'S5_S19' })]
    const timeline = calculatePayEventTimeline(state(), events)
    expect(timeline.entries.at(-1).result).toMatchObject({ success: false, reason: `ACP_${number}_ALREADY_GRANTED` })
  })
})

describe('ACP replay, DNI, Pay History, and transition compatibility', () => {
  it('shows ACP-derived pay in Pay History and blocks an invented later DNI increment', () => {
    const annual = { id: 'annual-after-acp', type: EVENT_TYPES.ANNUAL_INCREMENT, effectiveDate: '2005-07-01' }
    const history = buildPayHistory({ openingState: state(), events: [acp(), annual], startDate: '2005-05-01', endDate: '2005-08-31' })
    expect(history.replay.entries[0].result.after).toMatchObject({ reachedBy: 'ACP', acpNumber: 1, basicPay: 7450 })
    expect(history.replay.entries[1].result).toMatchObject({ success: false, reason: '5CPC_POST_ACP_DNI_NOT_IMPLEMENTED' })
    expect(history.replay.currentPayState.basicPay).toBe(7450)
  })

  it('feeds ACP-derived Basic Pay into Due Pay without ACP-specific allowance formulas', () => {
    const ledger = buildMonthlyDueLedger({ openingState: state(), events: [acp()], startDate: '2005-06-01', endDate: '2005-06-30', enabledAllowances: { da: false, hra: false, transportAllowance: false } })
    expect(ledger.months[0]).toMatchObject({ status: 'RESOLVED', components: { basicPay: 7450 }, grossDue: 7450 })
  })

  it('uses the ACP-derived scale and Basic Pay for the 5th-to-6th transition', () => {
    const transition = { id: 'transition', type: EVENT_TYPES.CPC_TRANSITION, fromCpc: 5, toCpc: 6, effectiveDate: '2006-01-01', employeeSwitchDate: '2006-01-01' }
    const timeline = calculatePayEventTimeline(state(), [acp(), transition])
    expect(timeline.entries[1].result).toMatchObject({ success: true, sourcePayScale: { id: 'S5_S13' }, existing5CpcBasicPay: 7450, after: { cpc: 6 } })
  })
})
