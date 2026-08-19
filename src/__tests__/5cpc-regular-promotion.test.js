import { describe, expect, it } from 'vitest'
import { findFifthCpcStage, getFifthCpcScale, getFifthCpcStages } from '../data/pay/5cpcPayScales'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { applyPayEvent } from '../engines/pay/applyPayEvent'
import { calculatePayEventTimeline } from '../engines/pay/eventTimeline'
import { buildPayHistory } from '../engines/pay/history/buildPayHistory'
import { calculate5CpcRegularPromotion, selectFifthCpcTargetStage } from '../engines/pay/5cpc/regularPromotion'

function state(overrides = {}) {
  return {
    cpc: 5, effectiveFrom: '2005-01-01', payScaleId: 'S5_S12',
    payScaleLabel: getFifthCpcScale('S5_S12').label,
    stageIndex: 3, basicPay: 6900, dni: '2005-07-01', ...overrides,
  }
}

function promotion(overrides = {}) {
  return {
    id: 'promotion-5', type: EVENT_TYPES.REGULAR_PROMOTION,
    effectiveDate: '2005-06-01', targetPayScaleId: 'S5_S13',
    fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE, ...overrides,
  }
}

describe('5CPC_REGULAR_PROMOTION_FR22 from event date', () => {
  it('grants one lower-scale stage and fixes S-12 ₹6,900 at S-13 ₹7,450', () => {
    const result = calculate5CpcRegularPromotion(state(), promotion())
    expect(result).toMatchObject({
      success: true, ruleId: '5CPC_REGULAR_PROMOTION_FR22', eventId: 'promotion-5', eventType: 'REGULAR_PROMOTION',
      fixationOption: 'FROM_EVENT_DATE', careerEffect: 'PROMOTED', payFixationEffect: 'FRESH_FIXATION',
      sourceScale: { id: 'S5_S12' }, sourceStage: { index: 3, value: 6900 },
      promotionalLowerScaleIncrement: 200,
      lowerScaleReferenceStage: { index: 4, value: 7100 }, referenceAmount: 7100,
      targetScale: { id: 'S5_S13' }, lookupMethod: 'NEXT_HIGHER_STAGE',
      selectedTargetStage: { index: 1, value: 7450 }, finalBasicPay: 7450,
      dniDecision: { status: 'UNRESOLVED', reason: '5CPC_POST_PROMOTION_DNI_NOT_IMPLEMENTED' },
      after: { cpc: 5, effectiveFrom: '2005-06-01', payScaleId: 'S5_S13', stageIndex: 1, basicPay: 7450, dni: { status: 'UNRESOLVED' } },
    })
  })

  it('uses an exact target stage when the authoritative catalogue contains one', () => {
    const sourceStage = findFifthCpcStage('S5_S1', 2720)
    const result = calculate5CpcRegularPromotion(
      state({ payScaleId: 'S5_S1', payScaleLabel: getFifthCpcScale('S5_S1').label, stageIndex: sourceStage.index, basicPay: 2720 }),
      promotion({ targetPayScaleId: 'S5_S3' }),
    )
    expect(result).toMatchObject({ success: true, referenceAmount: 2780, lookupMethod: 'EXACT_STAGE', selectedTargetStage: { value: 2780 } })
  })

  it('exposes next-higher lookup without interpolation', () => {
    expect(selectFifthCpcTargetStage('S5_S13', 7100)).toMatchObject({ method: 'NEXT_HIGHER_STAGE', stage: { value: 7450 } })
  })

  it('uses the actual next stage across a multi-section source-scale boundary', () => {
    const boundary = findFifthCpcStage('S5_S5', 3950)
    const result = calculate5CpcRegularPromotion(
      state({ payScaleId: 'S5_S5', payScaleLabel: getFifthCpcScale('S5_S5').label, stageIndex: boundary.index, basicPay: 3950 }),
      promotion({ targetPayScaleId: 'S5_S7' }),
    )
    expect(result).toMatchObject({ success: true, promotionalLowerScaleIncrement: 80, referenceAmount: 4030, lookupMethod: 'NEXT_HIGHER_STAGE', selectedTargetStage: { value: 4100 } })
  })

  it.each(['S5_S16', 'S5_S33', 'S5_S34'])('does not invent a promotional increment for fixed scale %s', (payScaleId) => {
    const scale = getFifthCpcScale(payScaleId)
    const result = calculate5CpcRegularPromotion(
      state({ payScaleId, payScaleLabel: scale.label, stageIndex: 1, basicPay: scale.minimum }),
      promotion({ targetPayScaleId: payScaleId === 'S5_S16' ? 'S5_S17' : 'S5_S32' }),
    )
    expect(result).toMatchObject({ success: false, reason: 'LOWER_SCALE_PROMOTIONAL_INCREMENT_NOT_AVAILABLE' })
  })

  it('does not invent an increment at the final stage of an ordinary scale', () => {
    const stages = getFifthCpcStages('S5_S12')
    const result = calculate5CpcRegularPromotion(state({ stageIndex: stages.length, basicPay: stages.at(-1).value }), promotion())
    expect(result).toMatchObject({ success: false, reason: 'LOWER_SCALE_PROMOTIONAL_INCREMENT_NOT_AVAILABLE' })
  })

  it('returns structured target-scale validation failures without fallback', () => {
    expect(calculate5CpcRegularPromotion(state(), promotion({ targetPayScaleId: '' })).reason).toBe('MISSING_TARGET_PAY_SCALE')
    expect(calculate5CpcRegularPromotion(state(), promotion({ targetPayScaleId: 'UNKNOWN' })).reason).toBe('INVALID_TARGET_PAY_SCALE')
    expect(calculate5CpcRegularPromotion(state(), promotion({ targetPayScaleId: 'S5_S12' })).reason).toBe('SAME_SOURCE_AND_TARGET_PAY_SCALE')
    const high = findFifthCpcStage('S5_S12', 10300)
    expect(calculate5CpcRegularPromotion(
      state({ stageIndex: high.index, basicPay: high.value }),
      promotion({ targetPayScaleId: 'S5_S11' }),
    ).reason).toBe('NO_SUITABLE_STAGE_IN_TARGET_SCALE')
  })

  it('is routed only for 5th CPC regular promotion', () => {
    expect(applyPayEvent(state(), promotion())).toMatchObject({ success: true, ruleId: '5CPC_REGULAR_PROMOTION_FR22' })
    expect(calculate5CpcRegularPromotion(state(), { ...promotion(), type: EVENT_TYPES.AD_HOC_PROMOTION }).reason).toBe('INVALID_EVENT_TYPE')
  })
})

describe('5th CPC lower-post-DNI option guardrail', () => {
  const deferred = (overrides = {}) => promotion({ fixationOption: FIXATION_OPTIONS.FROM_LOWER_POST_DNI, ...overrides })

  it('recognizes the option and records its future multi-stage model without inventing interim pay', () => {
    const result = calculate5CpcRegularPromotion(state(), deferred())
    expect(result).toMatchObject({
      success: false, status: 'UNRESOLVED', reason: '5CPC_PROMOTION_FROM_DNI_INTERIM_RULE_NOT_IMPLEMENTED',
      recognizedOption: 'FROM_LOWER_POST_DNI', lowerPostDni: '2005-07-01',
      transformationModel: { type: 'MULTI_STAGE_PAY_TRANSFORMATION', states: ['BEFORE', 'INTERIM_PAY_STATE', 'FINAL_FIXATION_STATE'], originatingEventId: 'promotion-5' },
    })
  })

  it('requires resolved DNI and a strictly earlier promotion date', () => {
    expect(calculate5CpcRegularPromotion(state({ dni: null }), deferred()).reason).toBe('LOWER_POST_DNI_NOT_RESOLVED')
    expect(calculate5CpcRegularPromotion(state(), deferred({ effectiveDate: '2005-07-01' })).reason).toBe('EVENT_DATE_NOT_BEFORE_LOWER_POST_DNI')
    expect(calculate5CpcRegularPromotion(state(), deferred({ effectiveDate: '2005-07-02' })).reason).toBe('EVENT_DATE_NOT_BEFORE_LOWER_POST_DNI')
  })

  it('does not proceed through explicit adverse service uncertainty', () => {
    const result = calculate5CpcRegularPromotion(state(), deferred(), { serviceStatusHistory: [{ type: 'EOL' }] })
    expect(result).toMatchObject({ success: false, reason: 'NON_QUALIFYING_SERVICE_RULE_NOT_IMPLEMENTED' })
  })
})

describe('5th CPC promotion replay and transition compatibility', () => {
  it('carries promoted scale/stage through Pay History and blocks a guessed later increment', () => {
    const annual = { id: 'later-increment', type: EVENT_TYPES.ANNUAL_INCREMENT, effectiveDate: '2005-07-01' }
    const history = buildPayHistory({ openingState: state(), events: [promotion(), annual], startDate: '2005-05-01', endDate: '2005-08-31' })
    expect(history.replay.entries[0].result).toMatchObject({ success: true, after: { payScaleId: 'S5_S13', basicPay: 7450 } })
    expect(history.replay.entries[1].result).toMatchObject({ success: false, reason: '5CPC_POST_PROMOTION_DNI_NOT_IMPLEMENTED' })
    expect(history.replay.currentPayState).toMatchObject({ payScaleId: 'S5_S13', stageIndex: 1, basicPay: 7450 })
    expect(history.months.at(-1).status).toBe('PARTIALLY_RESOLVED')
  })

  it('uses the promoted 5th CPC scale and stage as the 5th-to-6th transition source', () => {
    const transition = { id: 'transition', type: EVENT_TYPES.CPC_TRANSITION, fromCpc: 5, toCpc: 6, effectiveDate: '2006-01-01', employeeSwitchDate: '2006-01-01' }
    const timeline = calculatePayEventTimeline(state(), [promotion(), transition])
    expect(timeline.entries[0].result.after).toMatchObject({ payScaleId: 'S5_S13', stageIndex: 1, basicPay: 7450 })
    expect(timeline.entries[1].result).toMatchObject({ success: true, sourcePayScale: { id: 'S5_S13' }, sourceStageIndex: 1, existing5CpcBasicPay: 7450, after: { cpc: 6 } })
  })

  it('does not use insertion order for a same-date increment and promotion', () => {
    const sameDatePromotion = promotion({ effectiveDate: '2005-07-01' })
    const increment = { id: 'same-date-increment', type: EVENT_TYPES.ANNUAL_INCREMENT, effectiveDate: '2005-07-01' }
    const timeline = calculatePayEventTimeline(state(), [sameDatePromotion, increment])
    expect(timeline.entries.every(({ result }) => result.reason === 'SAME_DATE_DNI_EVENT_ORDERING_NOT_IMPLEMENTED')).toBe(true)
    expect(timeline.currentPayState).toEqual(state())
  })
})
