import { describe, expect, it } from 'vitest'
import {
  FIFTH_CPC_PAY_SCALES,
  createFifthCpcStages,
  findFifthCpcStage,
  getFifthCpcScale,
  getFifthCpcStage,
  getFifthCpcStages,
  getNextFifthCpcStage,
} from '../data/pay/5cpcPayScales'
import { validate5CpcPayState } from '../domain/pay/payStateValidation'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { calculate5CpcAnnualIncrement } from '../engines/pay/5cpc/annualIncrement'
import { calculatePayEventTimeline } from '../engines/pay/eventTimeline'
import { buildPayHistory } from '../engines/pay/history/buildPayHistory'
import { normalizeCaseInput } from '../features/cases/models/payCase'

const fixedScaleId = 'S5_S12'
const segmentedScaleId = 'S5_S5'

function payState(overrides = {}) {
  return {
    cpc: 5,
    effectiveFrom: '2002-04-01',
    payScaleId: fixedScaleId,
    payScaleLabel: 'S-12 — ₹6500–200–10500',
    stageIndex: 1,
    basicPay: 6500,
    dni: '2003-04-01',
    ...overrides,
  }
}

function increment(date) {
  return { id: `increment-${date}`, type: EVENT_TYPES.ANNUAL_INCREMENT, eventDate: date, effectiveDate: date }
}

describe('verified 5th CPC pay-scale data helpers', () => {
  it('contains all 34 standard scales in numeric S-series order', () => {
    expect(FIFTH_CPC_PAY_SCALES).toHaveLength(34)
    expect(FIFTH_CPC_PAY_SCALES.map(({ id }) => id)).toEqual(
      Array.from({ length: 34 }, (_, index) => `S5_S${index + 1}`),
    )
    expect(getFifthCpcScale('UNSUPPORTED')).toBeNull()
  })

  it('resolves and migrates both previously persisted scale identifiers', () => {
    expect(getFifthCpcScale('S5_3050_75_3950_80_4590').id).toBe('S5_S5')
    expect(getFifthCpcScale('S5_6500_200_10500').id).toBe('S5_S12')
    const normalized = normalizeCaseInput({
      payCommission: '5th CPC',
      openingPayState: { cpc: 5, payScaleId: 'S5_6500_200_10500', stageIndex: 1, basicPay: 6500, dni: '2003-04-01' },
    })
    expect(normalized.openingPayState).toMatchObject({ payScaleId: 'S5_S12', payScaleLabel: 'S-12 — ₹6500–200–10500' })
  })

  it.each(FIFTH_CPC_PAY_SCALES)('looks up first, intermediate and final prescribed stages for $id', (scale) => {
    const stages = getFifthCpcStages(scale.id)
    expect(getFifthCpcStage(scale.id, 1)).toEqual(stages[0])
    expect(findFifthCpcStage(scale.id, stages[Math.floor(stages.length / 2)].value)).not.toBeNull()
    expect(getFifthCpcStage(scale.id, stages.length)).toEqual(stages.at(-1))
    expect(getNextFifthCpcStage(scale.id, stages.length)).toBeNull()
    expect(findFifthCpcStage(scale.id, stages[0].value + 1)).toBeNull()
  })

  it.each(FIFTH_CPC_PAY_SCALES)('preserves authoritative stage integrity for $standardScaleCode', (scale) => {
    const values = scale.stages.map(({ value }) => value)
    expect(values[0]).toBe(scale.minimum)
    expect(values.at(-1)).toBe(scale.maximum)
    expect(new Set(values).size).toBe(values.length)
    expect(scale.label.startsWith(`${scale.standardScaleCode} — ₹`)).toBe(true)
    expect(scale.authority).toMatchObject({
      sourceFamily: 'Central Civil Services (Revised Pay) Rules, 1997',
      government: 'Government of India',
      ministry: 'Ministry of Finance',
      department: 'Department of Expenditure',
    })
    values.slice(1).forEach((value, index) => {
      const previous = values[index]
      expect(value).toBeGreaterThan(previous)
      const prescribedSection = scale.incrementSections.find(({ from, to }) => previous >= from && value <= to)
      expect(prescribedSection).toBeDefined()
      expect(value - previous).toBe(prescribedSection.increment)
      expect(value).toBeLessThanOrEqual(scale.maximum)
    })
    expect(scale.fixedScale).toBe(values.length === 1)
    expect(Object.isFrozen(scale)).toBe(true)
    expect(Object.isFrozen(scale.structure)).toBe(true)
    expect(Object.isFrozen(scale.stages)).toBe(true)
    expect(Object.isFrozen(scale.incrementSections)).toBe(true)
    scale.incrementSections.forEach((item) => expect(Object.isFrozen(item)).toBe(true))
  })

  it('preserves the verified increment change at the segmented-scale boundary', () => {
    const boundary = findFifthCpcStage(segmentedScaleId, 3950)
    const before = getFifthCpcStage(segmentedScaleId, boundary.index - 1)
    const after = getNextFifthCpcStage(segmentedScaleId, boundary.index)
    expect(boundary.value - before.value).toBe(75)
    expect(after.value).toBe(4030)
    expect(after.value - boundary.value).toBe(80)
    expect(getFifthCpcStages(segmentedScaleId).at(-1).value).toBe(4590)
  })

  it('represents an Efficiency Bar crossing explicitly without granting a decision', () => {
    const stages = createFifthCpcStages({
      type: 'EXPLICIT_STAGES', values: [100, 110, 120, 130],
      efficiencyBars: [{ crossingFrom: 110, crossingTo: 120, clearanceRequired: true }],
    })
    expect(stages[2]).toMatchObject({ value: 120, stageType: 'EFFICIENCY_BAR', requiresEfficiencyBarClearance: true })
    expect(stages[3].stageType).toBe('POST_EFFICIENCY_BAR')
  })
})

describe('5th CPC Pay State validation', () => {
  it('normalizes a valid scale-and-stage state', () => {
    expect(validate5CpcPayState(payState())).toMatchObject({ valid: true, normalizedState: { payScaleId: fixedScaleId, stageIndex: 1, basicPay: 6500 } })
  })

  it.each([
    [payState({ payScaleId: 'UNKNOWN' }), 'UNSUPPORTED_PAY_SCALE'],
    [payState({ stageIndex: 99 }), 'INVALID_STAGE_INDEX'],
    [payState({ basicPay: 6700 }), 'BASIC_PAY_STAGE_MISMATCH'],
    [payState({ dni: '' }), 'MISSING_DNI'],
    [payState({ dni: '2003-02-30' }), 'INVALID_DNI'],
    [payState({ cpc: 6 }), 'INVALID_CPC'],
  ])('returns structured validation errors', (state, code) => {
    expect(validate5CpcPayState(state).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code })]))
  })
})

describe('ordinary 5th CPC annual increment', () => {
  it('moves exactly one stage, derives the stage difference, retains scale and continues individual DNI', () => {
    const result = calculate5CpcAnnualIncrement(payState(), increment('2003-04-01'))
    expect(result).toMatchObject({
      success: true, ruleId: '5CPC_ANNUAL_INCREMENT', previousStageIndex: 1, nextStageIndex: 2,
      previousBasicPay: 6500, newBasicPay: 6700, incrementAmount: 200,
      previousDni: '2003-04-01', nextDni: '2004-04-01',
      after: { payScaleId: fixedScaleId, stageIndex: 2, basicPay: 6700, dni: '2004-04-01' },
    })
  })

  it('requires the event date to match confirmed DNI', () => {
    expect(calculate5CpcAnnualIncrement(payState(), increment('2003-07-01'))).toMatchObject({ success: false, reason: 'DNI_MISMATCH' })
  })

  it('returns unresolved at the final stage without inventing stagnation pay', () => {
    const stages = getFifthCpcStages(fixedScaleId)
    const state = payState({ stageIndex: stages.length, basicPay: stages.at(-1).value })
    expect(calculate5CpcAnnualIncrement(state, increment('2003-04-01'))).toMatchObject({ success: false, reason: 'NO_NEXT_STAGE_IN_PAY_SCALE' })
  })

  it.each([
    ['S5_S5', 3950, 4030, 80],
    ['S5_S12', 6500, 6700, 200],
    ['S5_S24', 14300, 14700, 400],
  ])('uses prescribed stages for representative scale %s', (scaleId, from, to, amount) => {
    const scale = getFifthCpcScale(scaleId)
    const stage = findFifthCpcStage(scaleId, from)
    const result = calculate5CpcAnnualIncrement(payState({
      payScaleId: scaleId, payScaleLabel: scale.label, stageIndex: stage.index, basicPay: from,
    }), increment('2003-04-01'))
    expect(result).toMatchObject({ success: true, newBasicPay: to, incrementAmount: amount, after: { payScaleId: scaleId } })
  })

  it.each(['S5_S16', 'S5_S33', 'S5_S34'])('does not fabricate an increment for fixed scale %s', (scaleId) => {
    const scale = getFifthCpcScale(scaleId)
    const result = calculate5CpcAnnualIncrement(payState({
      payScaleId: scaleId, payScaleLabel: scale.label, stageIndex: 1, basicPay: scale.minimum,
    }), increment('2003-04-01'))
    expect(scale).toMatchObject({ fixedScale: true, minimum: scale.maximum })
    expect(result).toMatchObject({ success: false, reason: 'NO_NEXT_STAGE_IN_PAY_SCALE' })
  })
})

describe('5th CPC event replay and Pay History', () => {
  const events = [increment('2003-04-01'), increment('2004-04-01'), increment('2005-04-01')]

  it('dispatches and carries three chronological stage movements forward', () => {
    const timeline = calculatePayEventTimeline(payState(), events)
    expect(timeline.entries.map(({ result }) => result.ruleId)).toEqual(['5CPC_ANNUAL_INCREMENT', '5CPC_ANNUAL_INCREMENT', '5CPC_ANNUAL_INCREMENT'])
    expect(timeline.entries.map(({ result }) => result.after.basicPay)).toEqual([6700, 6900, 7100])
    expect(timeline.currentPayState).toMatchObject({ cpc: 5, payScaleId: fixedScaleId, stageIndex: 4, basicPay: 7100, dni: '2006-04-01' })
  })

  it('carries 5th CPC scale identity and Basic Pay through Pay History', () => {
    const history = buildPayHistory({ openingState: payState(), events, startDate: '2003-03-01', endDate: '2005-05-31' })
    expect(history.success).toBe(true)
    expect(history.months.find(({ periodStart }) => periodStart === '2003-05-01').payState).toMatchObject({ cpc: 5, payScaleId: fixedScaleId, stageIndex: 2, basicPay: 6700 })
    expect(history.replay.currentPayState.basicPay).toBe(7100)
  })
})
