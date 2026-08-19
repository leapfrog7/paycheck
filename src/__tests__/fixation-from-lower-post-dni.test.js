import { describe, expect, it } from 'vitest'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { calculate6CpcRegularPromotion } from '../engines/pay/6cpc/regularPromotion'
import { calculate6CpcMacpFixation } from '../engines/pay/6cpc/macpFixation'
import { calculate7CpcRegularPromotion } from '../engines/pay/7cpc/regularPromotion'
import { calculate7CpcMacpFixation } from '../engines/pay/7cpc/macpFixation'
import { calculate7CpcAnnualIncrement } from '../engines/pay/7cpc/annualIncrement'
import { calculatePayEventTimeline } from '../engines/pay/eventTimeline'
import { buildPayHistory } from '../engines/pay/history/buildPayHistory'
import { buildMonthlyDueLedger } from '../engines/pay/ledger/buildMonthlyDueLedger'

const option = FIXATION_OPTIONS.FROM_LOWER_POST_DNI

function sixthState(overrides = {}) {
  return { cpc: 6, payBand: 'PB-2', payInBand: 13500, gradePay: 4200, basicPay: 17700, dni: '2014-07-01', ...overrides }
}

function sixthEvent(type = EVENT_TYPES.REGULAR_PROMOTION, overrides = {}) {
  return { id: type === EVENT_TYPES.MACP ? 'macp-6' : 'promotion-6', type, effectiveDate: '2014-06-01', targetPayBand: 'PB-2', targetGradePay: 4600, macpNumber: type === EVENT_TYPES.MACP ? 2 : undefined, fixationOption: option, ...overrides }
}

function seventhState(overrides = {}) {
  return { cpc: 7, level: '4', cellIndex: 6, basicPay: 29600, dni: '2020-07-01', ...overrides }
}

function seventhEvent(type = EVENT_TYPES.REGULAR_PROMOTION, overrides = {}) {
  return { id: type === EVENT_TYPES.MACP ? 'macp-7' : 'promotion-7', type, effectiveDate: '2020-06-15', targetLevel: '5', macpNumber: type === EVENT_TYPES.MACP ? 1 : undefined, fixationOption: option, ...overrides }
}

describe('6th CPC fixation from lower-post DNI', () => {
  it('keeps Pay in Pay Band unchanged during interim and applies sequential increments on DNI', () => {
    const result = calculate6CpcRegularPromotion(sixthState(), sixthEvent())
    expect(result).toMatchObject({
      success: true, ruleId: '6CPC_PROMOTION_FROM_DNI', lowerPostDni: '2014-07-01',
      careerEffect: 'PROMOTED', payFixationEffect: 'DEFERRED_TO_LOWER_POST_DNI',
      interim: {
        effectiveFrom: '2014-06-01', effectiveTo: '2014-06-30',
        payState: { payInBand: 13500, gradePay: 4600, basicPay: 18100 },
      },
      annualIncrement: 540, lowerPayInBandAfterAnnual: 14040, basicAfterAnnual: 18240,
      promotionIncrement: 550, finalPayInBand: 14590, finalBasicPay: 19190,
      finalFixation: { effectiveFrom: '2014-07-01', after: { payInBand: 14590, gradePay: 4600, basicPay: 19190 } },
      dniDecision: { status: 'UNRESOLVED', candidateDni: '2015-07-01', reason: '6CPC_INCREMENT_QUALIFYING_SERVICE_NOT_ESTABLISHED' },
    })
    expect(result.interim.steps.some(({ operation }) => operation.includes('INCREMENT'))).toBe(false)
    expect(result.finalFixation.after.basicPay).toBe(result.finalFixation.after.payInBand + result.finalFixation.after.gradePay)
  })

  it('uses the same arithmetic for MACP and preserves its identity', () => {
    const result = calculate6CpcMacpFixation(sixthState(), sixthEvent(EVENT_TYPES.MACP))
    expect(result).toMatchObject({ success: true, ruleId: '6CPC_MACP_FROM_DNI', reachedBy: 'MACP', macpNumber: 2, finalBasicPay: 19190 })
    expect(result.interim.payState).toMatchObject({ reachedBy: 'MACP', macpNumber: 2 })
    expect(result.finalFixation.after).toMatchObject({ reachedBy: 'MACP', macpNumber: 2 })
  })

  it('resolves the next 1 July only with explicit qualifying-service evidence', () => {
    const result = calculate6CpcRegularPromotion(sixthState(), sixthEvent(EVENT_TYPES.REGULAR_PROMOTION, { qualifyingServiceEstablished: true }))
    expect(result.dniDecision).toMatchObject({ status: 'RESOLVED', date: '2015-07-01', ruleId: '6CPC_RULE10_FROM_LOWER_POST_DNI' })
  })

  it('rejects missing DNI, non-prior event date, and interim cross-band cases', () => {
    expect(calculate6CpcRegularPromotion(sixthState({ dni: null }), sixthEvent()).reason).toBe('LOWER_POST_DNI_NOT_RESOLVED')
    expect(calculate6CpcRegularPromotion(sixthState(), sixthEvent(EVENT_TYPES.REGULAR_PROMOTION, { effectiveDate: '2014-07-01' })).reason).toBe('EVENT_DATE_NOT_BEFORE_LOWER_POST_DNI')
    expect(calculate6CpcRegularPromotion(sixthState(), sixthEvent(EVENT_TYPES.REGULAR_PROMOTION, { effectiveDate: '2014-07-02' })).reason).toBe('EVENT_DATE_NOT_BEFORE_LOWER_POST_DNI')
    expect(calculate6CpcRegularPromotion(sixthState(), sixthEvent(EVENT_TYPES.REGULAR_PROMOTION, { targetPayBand: 'PB-3', targetGradePay: 5400 })).reason).toBe('6CPC_INTERIM_CROSS_PAY_BAND_RULE_NOT_IMPLEMENTED')
  })
})

describe('7th CPC fixation from lower-post DNI', () => {
  it('reproduces the governing Level 4 to Level 5 illustration', () => {
    const result = calculate7CpcRegularPromotion(seventhState(), seventhEvent())
    expect(result).toMatchObject({
      success: true, ruleId: '7CPC_PROMOTION_FROM_DNI', careerEffect: 'PROMOTED',
      interim: { effectiveFrom: '2020-06-15', effectiveTo: '2020-06-30', payState: { level: '5', cellIndex: 2, basicPay: 30100 } },
      interimLookup: { method: 'NEXT_HIGHER_CELL' },
      firstLowerCell: { value: 30500 }, secondLowerCell: { value: 31400 },
      finalLookup: { method: 'NEXT_HIGHER_CELL', cell: { value: 31900 } },
      finalFixation: { effectiveFrom: '2020-07-01', after: { level: '5', basicPay: 31900, dni: '2021-01-01' } },
      dniDecision: { status: 'RESOLVED', date: '2021-01-01', ruleId: '7CPC_RULE10_FROM_LOWER_POST_DNI' },
    })
  })

  it('exposes exact interim and final target lookups without duplicating matrix logic', () => {
    const result = calculate7CpcRegularPromotion(
      { cpc: 7, level: '6', cellIndex: 9, basicPay: 44900, dni: '2020-07-01' },
      seventhEvent(EVENT_TYPES.REGULAR_PROMOTION, { targetLevel: '7' }),
    )
    expect(result.interimLookup).toMatchObject({ method: 'EXACT_CELL', cell: { value: 44900 } })
    expect(result.finalLookup).toMatchObject({ method: 'EXACT_CELL', cell: { value: 47600 } })
  })

  it('uses the same two-movement rule for MACP and retains MACP provenance', () => {
    const result = calculate7CpcMacpFixation(seventhState(), seventhEvent(EVENT_TYPES.MACP))
    expect(result).toMatchObject({ success: true, ruleId: '7CPC_MACP_FROM_DNI', reachedBy: 'MACP', macpNumber: 1, finalBasicPay: 31900 })
    expect(result.dniDecision.trigger.type).toBe('FIXATION_FROM_LOWER_POST_DNI')
  })

  it('maps January fixation to July and continues annually thereafter', () => {
    const result = calculate7CpcRegularPromotion(
      seventhState({ dni: '2021-01-01' }),
      seventhEvent(EVENT_TYPES.REGULAR_PROMOTION, { effectiveDate: '2020-12-15' }),
    )
    expect(result.dniDecision).toMatchObject({ status: 'RESOLVED', date: '2021-07-01' })
  })

  it('continues the promoted-Level branch annually after the first six-month increment', () => {
    const fixation = calculate7CpcRegularPromotion(seventhState(), seventhEvent())
    const increment = calculate7CpcAnnualIncrement(fixation.finalFixation.after, { type: EVENT_TYPES.ANNUAL_INCREMENT, effectiveDate: '2021-01-01' })
    expect(increment).toMatchObject({ success: true, after: { level: '5', dni: '2022-01-01' }, dniDecision: { date: '2022-01-01' } })
  })

  it('returns structured edge-case results', () => {
    expect(calculate7CpcRegularPromotion(seventhState({ dni: null }), seventhEvent()).reason).toBe('LOWER_POST_DNI_NOT_RESOLVED')
    expect(calculate7CpcRegularPromotion(seventhState(), seventhEvent(EVENT_TYPES.REGULAR_PROMOTION, { effectiveDate: '2020-07-01' })).reason).toBe('EVENT_DATE_NOT_BEFORE_LOWER_POST_DNI')
    expect(calculate7CpcRegularPromotion(seventhState(), seventhEvent(EVENT_TYPES.REGULAR_PROMOTION, { targetLevel: '4' })).reason).toBe('SAME_LEVEL_TARGET')
    expect(calculate7CpcRegularPromotion({ cpc: 7, level: '4', cellIndex: 40, basicPay: 81100, dni: '2020-07-01' }, seventhEvent()).reason).toBe('INSUFFICIENT_LOWER_LEVEL_CELLS_FOR_DNI_FIXATION')
    expect(calculate7CpcRegularPromotion(seventhState(), { ...seventhEvent(), type: EVENT_TYPES.AD_HOC_PROMOTION }).reason).toBe('INVALID_EVENT_TYPE')
  })

  it('retains a candidate but leaves subsequent DNI unresolved for adverse service history', () => {
    const result = calculate7CpcRegularPromotion(seventhState(), seventhEvent(), { serviceStatusHistory: [{ type: 'EOL' }] })
    expect(result.dniDecision).toMatchObject({ status: 'UNRESOLVED', candidateDni: '2021-01-01', reason: 'NON_QUALIFYING_SERVICE_RULE_NOT_IMPLEMENTED' })
  })
})

describe('multi-stage replay, Pay History, and Due Pay', () => {
  const event = seventhEvent()

  it('emits interim and final states from the same originating event', () => {
    const replay = calculatePayEventTimeline(seventhState(), [event])
    expect(replay.entries).toHaveLength(2)
    expect(replay.entries.map(({ result }) => result.after.basicPay)).toEqual([30100, 31900])
    expect(replay.entries[1]).toMatchObject({ derived: true, result: { stateType: 'FINAL_FIXATION_STATE', eventId: 'promotion-7' } })
    expect(replay.currentPayState.basicPay).toBe(31900)
  })

  it('creates lower, interim, and final Pay History segments without a fake event', () => {
    const result = buildPayHistory({ openingState: seventhState(), events: [event], startDate: '2020-05-01', endDate: '2020-07-31' })
    expect(result.months.flatMap(({ segments }) => segments).map(({ from, to, basicPay }) => [from, to, basicPay])).toEqual([
      ['2020-05-01', '2020-05-31', 29600],
      ['2020-06-01', '2020-06-14', 29600],
      ['2020-06-15', '2020-06-30', 30100],
      ['2020-07-01', '2020-07-31', 31900],
    ])
    expect(result.replay.entries.filter(({ event: item }) => item.id === 'promotion-7')).toHaveLength(2)
  })

  it('prevents a user annual-increment event from granting the consumed DNI increment twice', () => {
    const annual = { id: 'duplicate-increment', type: EVENT_TYPES.ANNUAL_INCREMENT, effectiveDate: '2020-07-01' }
    const replay = calculatePayEventTimeline(seventhState(), [event, annual])
    expect(replay.entries.at(-1).result).toMatchObject({ success: false, reason: 'ANNUAL_INCREMENT_ALREADY_CONSUMED_BY_DNI_FIXATION' })
    expect(replay.currentPayState).toMatchObject({ level: '5', basicPay: 31900 })
  })

  it('feeds both generated boundaries and Basic Pay states into the Due Pay ledger', () => {
    const ledger = buildMonthlyDueLedger({
      openingState: seventhState(), events: [event], startDate: '2020-06-01', endDate: '2020-07-31',
      enabledAllowances: { da: false, hra: false, transportAllowance: false },
    })
    expect(ledger.segments.map(({ effectiveFrom, basicPay }) => [effectiveFrom, basicPay])).toEqual([
      ['2020-06-01', 29600], ['2020-06-15', 30100], ['2020-07-01', 31900],
    ])
    expect(ledger.months[0]).toMatchObject({ status: 'PARTIALLY_RESOLVED', reason: 'PRORATION_BASIS_NOT_CONFIRMED' })
    expect(ledger.months[1]).toMatchObject({ status: 'RESOLVED', components: { basicPay: 31900 }, grossDue: 31900 })
  })
})
