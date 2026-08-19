import { describe, expect, it } from 'vitest'
import { FIFTH_TO_SIXTH_CPC_MAPPINGS, get5CpcTo6CpcMapping } from '../data/pay/5cpcTo6cpcMapping'
import { findFifthCpcStage, getFifthCpcScale } from '../data/pay/5cpcPayScales'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { applyPayEvent } from '../engines/pay/applyPayEvent'
import { roundUpRule7FitmentToNext10 } from '../engines/pay/5cpcTo6cpcFitmentRounding'
import { calculate5CpcTo6CpcTransition } from '../engines/pay/5cpcTo6cpcTransition'
import { calculatePayEventTimeline } from '../engines/pay/eventTimeline'
import { buildPayHistory } from '../engines/pay/history/buildPayHistory'

const supportedMappings = [
  [4, 'PB-1', 1800], [5, 'PB-1', 1900], [6, 'PB-1', 2000], [7, 'PB-1', 2400], [8, 'PB-1', 2800],
  [9, 'PB-2', 4200], [10, 'PB-2', 4200], [11, 'PB-2', 4200], [12, 'PB-2', 4200],
  [13, 'PB-2', 4600], [14, 'PB-2', 4800], [15, 'PB-2', 5400],
  [16, 'PB-3', 5400], [17, 'PB-3', 5400], [18, 'PB-3', 6600], [19, 'PB-3', 6600], [20, 'PB-3', 6600],
  [21, 'PB-3', 7600], [22, 'PB-3', 7600], [23, 'PB-3', 7600],
  [24, 'PB-4', 8700], [25, 'PB-4', 8700], [26, 'PB-4', 8900], [27, 'PB-4', 8900], [28, 'PB-4', 10000], [29, 'PB-4', 10000],
]

function stateFor(number, basicPay) {
  const scale = getFifthCpcScale(`S5_S${number}`)
  const stage = findFifthCpcStage(scale.id, basicPay ?? scale.minimum)
  return {
    cpc: 5,
    effectiveFrom: '2005-01-01',
    payScaleId: scale.id,
    payScaleLabel: scale.label,
    stageIndex: stage.index,
    basicPay: stage.value,
    dni: '2006-04-01',
  }
}

function event(overrides = {}) {
  return {
    id: 'transition-2006',
    type: EVENT_TYPES.CPC_TRANSITION,
    fromCpc: 5,
    toCpc: 6,
    eventDate: '2006-01-01',
    effectiveDate: '2006-01-01',
    employeeSwitchDate: '2006-01-01',
    ...overrides,
  }
}

describe('controlled generic replacement mapping', () => {
  it('contains one explicit outcome for every standard S-series scale', () => {
    expect(FIFTH_TO_SIXTH_CPC_MAPPINGS).toHaveLength(34)
    expect(FIFTH_TO_SIXTH_CPC_MAPPINGS.map(({ sourceScaleId }) => sourceScaleId)).toEqual(
      Array.from({ length: 34 }, (_, index) => `S5_S${index + 1}`),
    )
  })

  it.each(supportedMappings)('maps S-%i to %s with Grade Pay ₹%i', (number, payBand, gradePay) => {
    expect(get5CpcTo6CpcMapping(`S5_S${number}`)).toMatchObject({
      sourceScaleCode: `S-${number}`, status: 'SUPPORTED', payBand, gradePay,
    })
  })

  it('keeps generic S-12 distinct from post-specific GP ₹4600 cases', () => {
    expect(get5CpcTo6CpcMapping('S5_S12')).toMatchObject({ payBand: 'PB-2', gradePay: 4200 })
    expect(get5CpcTo6CpcMapping('S5_S13')).toMatchObject({ payBand: 'PB-2', gradePay: 4600 })
  })

  it.each([
    [1, '5CPC_TO_6CPC_MINUS_1S_NOT_IMPLEMENTED'],
    [2, '5CPC_TO_6CPC_MINUS_1S_NOT_IMPLEMENTED'],
    [3, '5CPC_TO_6CPC_MINUS_1S_NOT_IMPLEMENTED'],
    [30, '6CPC_GP_12000_NOT_IMPLEMENTED'],
    [31, '6CPC_HAG_PLUS_STRUCTURE_NOT_IMPLEMENTED'],
    [32, '6CPC_HAG_PLUS_STRUCTURE_NOT_IMPLEMENTED'],
    [33, '6CPC_APEX_STRUCTURE_NOT_IMPLEMENTED'],
    [34, '6CPC_CABINET_SECRETARY_STRUCTURE_NOT_IMPLEMENTED'],
  ])('records S-%i as unsupported without fallback', (number, reason) => {
    expect(get5CpcTo6CpcMapping(`S5_S${number}`)).toMatchObject({ status: 'UNSUPPORTED', reason })
  })
})

describe('dedicated Rule-7 fitment rounding', () => {
  it.each([[10416, 10420], [5282, 5290], [5282.4, 5290], [12090, 12090]])('rounds %s upward to %i', (input, expected) => {
    expect(roundUpRule7FitmentToNext10(input)).toBe(expected)
  })

  it('reproduces the base arithmetic of the official-type ₹2,840 example without bunching', () => {
    const raw = Number((2840 * 1.86).toFixed(2))
    expect(raw).toBe(5282.4)
    expect(roundUpRule7FitmentToNext10(raw)).toBe(5290)
  })
})

describe('ordinary 5th CPC to 6th CPC Rule-7 fixation', () => {
  it('applies the PB-1 minimum after fitment and before adding Grade Pay', () => {
    const result = calculate5CpcTo6CpcTransition(stateFor(4, 2750), event())
    expect(result).toMatchObject({
      success: true, rawFitment: 5115, roundedFitment: 5120,
      mappedPayBand: 'PB-1', mappedPayBandMinimum: 5200, minimumApplied: true,
      payInBand: 5200, mappedGradePay: 1800, resultingBasicPay: 7000,
      after: { cpc: 6, payBand: 'PB-1', payInBand: 5200, gradePay: 1800, basicPay: 7000 },
    })
  })

  it('uses the PB-2 minimum when fitment equals that minimum without marking a substitution', () => {
    const result = calculate5CpcTo6CpcTransition(stateFor(9, 5000), event())
    expect(result).toMatchObject({ roundedFitment: 9300, mappedPayBandMinimum: 9300, minimumApplied: false, payInBand: 9300, resultingBasicPay: 13500 })
  })

  it('fixes generic S-12 ₹6500 at PB-2 GP ₹4200 and Basic Pay ₹16290', () => {
    const result = calculate5CpcTo6CpcTransition(stateFor(12, 6500), event())
    expect(result).toMatchObject({
      existing5CpcBasicPay: 6500, rawFitment: 12090, roundedFitment: 12090,
      mappedPayBand: 'PB-2', payInBand: 12090, mappedGradePay: 4200, resultingBasicPay: 16290,
      after: { payBand: 'PB-2', payInBand: 12090, gradePay: 4200, basicPay: 16290 },
    })
  })

  it.each([
    [13, 'PB-2', 4600], [15, 'PB-2', 5400], [19, 'PB-3', 6600], [21, 'PB-3', 7600],
    [24, 'PB-4', 8700], [26, 'PB-4', 8900], [28, 'PB-4', 10000],
  ])('fixes representative S-%i into %s with GP ₹%i', (number, payBand, gradePay) => {
    const result = calculate5CpcTo6CpcTransition(stateFor(number), event())
    expect(result).toMatchObject({ success: true, mappedPayBand: payBand, mappedGradePay: gradePay })
    expect(result.resultingBasicPay).toBe(result.payInBand + gradePay)
    expect(result.after.basicPay).toBe(result.resultingBasicPay)
  })

  it('leaves bunching and post-transition DNI explicitly unresolved', () => {
    const result = calculate5CpcTo6CpcTransition(stateFor(12), event())
    expect(result).toMatchObject({
      bunchingApplied: false, bunchingStatus: 'NOT_EVALUATED',
      dniStatus: 'UNRESOLVED', dniReason: 'POST_6CPC_TRANSITION_DNI_NOT_IMPLEMENTED',
      after: { dni: null, dniResolution: { status: 'UNRESOLVED', reason: 'POST_6CPC_TRANSITION_DNI_NOT_IMPLEMENTED' } },
    })
  })

  it('rejects unconfirmed delayed switching and structural variation requests', () => {
    expect(calculate5CpcTo6CpcTransition(stateFor(12), event({ employeeSwitchDate: '2006-07-01' }))).toMatchObject({ success: false, reason: 'CONFIRMED_DELAYED_CPC_OPTION_REQUIRED' })
    expect(calculate5CpcTo6CpcTransition(stateFor(12), event({ upgradedScale: true }))).toMatchObject({ success: false, reason: 'STRUCTURAL_UPGRADATION_RULE_NOT_IMPLEMENTED' })
  })

  it.each([1, 2, 3, 30, 31, 32, 33, 34])('returns the controlled unsupported reason for S-%i', (number) => {
    const mapping = get5CpcTo6CpcMapping(`S5_S${number}`)
    expect(calculate5CpcTo6CpcTransition(stateFor(number), event())).toMatchObject({ success: false, reason: mapping.reason })
  })
})

describe('dispatcher and Pay History integration', () => {
  it('dispatches a supported 5-to-6 event without changing 6-to-7 dispatch', () => {
    const result = applyPayEvent(stateFor(12), event())
    expect(result).toMatchObject({ success: true, ruleId: '5CPC_TO_6CPC_RULE7', after: { cpc: 6 } })
  })

  it('does not mutate active state for an unsupported transition', () => {
    const opening = stateFor(1)
    const timeline = calculatePayEventTimeline(opening, [event()])
    expect(timeline.entries[0].result.success).toBe(false)
    expect(timeline.currentPayState).toEqual(opening)
  })

  it('places 5th CPC through 31 December 2005 and 6th CPC from 1 January 2006', () => {
    const history = buildPayHistory({ openingState: stateFor(12), events: [event()], startDate: '2005-12-01', endDate: '2006-02-28' })
    expect(history.success).toBe(true)
    expect(history.months[0].payState).toMatchObject({ cpc: 5, payScaleId: 'S5_S12', basicPay: 6500 })
    expect(history.months[1].payState).toMatchObject({ cpc: 6, payBand: 'PB-2', payInBand: 12090, gradePay: 4200, basicPay: 16290 })
    expect(history.months[1].periodStart).toBe('2006-01-01')
  })
})
