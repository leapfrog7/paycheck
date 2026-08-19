import { describe, expect, it } from 'vitest'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { CPC_SWITCH_BASES } from '../domain/events/cpcSwitchOption'
import { getFifthCpcScale, findFifthCpcStage } from '../data/pay/5cpcPayScales'
import { calculatePayEventTimeline } from '../engines/pay/eventTimeline'
import { calculate5CpcTo6CpcTransition } from '../engines/pay/5cpcTo6cpcTransition'
import { calculate6CpcTo7CpcTransition } from '../engines/pay/6cpcTo7cpcTransition'
import { buildPayHistory } from '../engines/pay/history/buildPayHistory'
import { buildMonthlyDueLedger } from '../engines/pay/ledger/buildMonthlyDueLedger'
import { buildDueDrawnComparison } from '../engines/pay/comparison/buildDueDrawnComparison'
import { createDrawnPayRecord } from '../domain/pay/drawnPay'

function fifthState() {
  const scale = getFifthCpcScale('S5_S12')
  const stage = findFifthCpcStage(scale.id, 6500)
  return { cpc: 5, effectiveFrom: '2006-01-01', payScaleId: scale.id, payScaleLabel: scale.label, stageIndex: stage.index, basicPay: 6500, dni: '2006-04-01' }
}

function sixthState(overrides = {}) {
  return { cpc: 6, effectiveFrom: '2016-01-01', payBand: 'PB-1', payInBand: 10160, gradePay: 2400, basicPay: 12560, dni: '2016-07-01', ...overrides }
}

function increment(id, date) {
  return { id, type: EVENT_TYPES.ANNUAL_INCREMENT, effectiveDate: date, eventDate: date }
}

function transition(id, fromCpc, toCpc, date, basis, triggerEventId) {
  return {
    id, type: EVENT_TYPES.CPC_TRANSITION, fromCpc, toCpc,
    statutoryEffectiveDate: fromCpc === 5 ? '2006-01-01' : '2016-01-01',
    employeeSwitchDate: date, effectiveDate: date,
    option: { status: 'CONFIRMED', basis, triggerEventId, optionExerciseDate: date, optionReference: 'TEST-OPTION' },
  }
}

describe('delayed CPC switch replay', () => {
  it('orders the 5th CPC next increment before transition regardless of insertion order', () => {
    const switchEvent = transition('switch', 5, 6, '2006-04-01', CPC_SWITCH_BASES.ON_NEXT_INCREMENT, 'increment')
    const replay = calculatePayEventTimeline(fifthState(), [switchEvent, increment('increment', '2006-04-01')])
    expect(replay.entries.map(({ event }) => event.id)).toEqual(['increment', 'switch'])
    expect(replay.entries[0].result.after).toMatchObject({ cpc: 5, basicPay: 6700 })
    expect(replay.entries[1].result).toMatchObject({ success: true, existing5CpcBasicPay: 6700, roundedFitment: 12470, resultingBasicPay: 16670, dniReason: 'DELAYED_6CPC_SWITCH_DNI_NOT_RESOLVED' })
    expect(replay.currentPayState).toMatchObject({ cpc: 6, basicPay: 16670, effectiveFrom: '2006-04-01' })
  })

  it('replays more than one 5th CPC increment for a subsequent-increment option', () => {
    const events = [
      increment('increment-2006', '2006-04-01'),
      transition('switch', 5, 6, '2007-04-01', CPC_SWITCH_BASES.ON_SUBSEQUENT_INCREMENT, 'increment-2007'),
      increment('increment-2007', '2007-04-01'),
    ]
    const replay = calculatePayEventTimeline(fifthState(), events)
    expect(replay.entries.map(({ event }) => event.id)).toEqual(['increment-2006', 'increment-2007', 'switch'])
    expect(replay.entries[2].result).toMatchObject({ success: true, existing5CpcBasicPay: 6900, roundedFitment: 12840, resultingBasicPay: 17040 })
  })

  it('orders the 1 July 2016 6th CPC increment before the 7th CPC transition', () => {
    const switchEvent = transition('switch', 6, 7, '2016-07-01', CPC_SWITCH_BASES.ON_NEXT_INCREMENT, 'increment')
    const replay = calculatePayEventTimeline(sixthState(), [switchEvent, increment('increment', '2016-07-01')])
    expect(replay.entries[0].result).toMatchObject({ ruleId: '6CPC_ANNUAL_INCREMENT', newBasicPay: 12940 })
    expect(replay.entries[1].result).toMatchObject({ success: true, calculated6CpcBasicPay: 12940, roundedFitmentValue: 33256, after: { cpc: 7, basicPay: 33300 }, dniDecision: { reason: 'DELAYED_7CPC_SWITCH_DNI_NOT_IMPLEMENTED' } })
  })

  it('replays a subsequent 6th CPC increment before switching in 2017', () => {
    const replay = calculatePayEventTimeline(sixthState(), [
      increment('increment-2016', '2016-07-01'),
      transition('switch', 6, 7, '2017-07-01', CPC_SWITCH_BASES.ON_SUBSEQUENT_INCREMENT, 'increment-2017'),
      increment('increment-2017', '2017-07-01'),
    ])
    expect(replay.entries[2].result).toMatchObject({ success: true, calculated6CpcBasicPay: 13330, roundedFitmentValue: 34258, after: { cpc: 7, basicPay: 34300 } })
  })

  it('uses a same-date MACP once and preserves its identity as the transition trigger', () => {
    const opening = { cpc: 6, payBand: 'PB-2', payInBand: 13500, gradePay: 4200, basicPay: 17700, dni: '2016-07-01' }
    const macp = { id: 'macp', type: EVENT_TYPES.MACP, effectiveDate: '2016-06-01', eventDate: '2016-06-01', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE, macpNumber: 1, targetPayBand: 'PB-2', targetGradePay: 4600 }
    const switchEvent = transition('switch', 6, 7, '2016-06-01', CPC_SWITCH_BASES.ON_PROMOTION_OR_UPGRADATION, 'macp')
    const replay = calculatePayEventTimeline(opening, [switchEvent, macp])
    expect(replay.entries.map(({ event }) => event.id)).toEqual(['macp', 'switch'])
    expect(replay.entries[0].result).toMatchObject({ eventType: 'MACP', finalBasicPay: 18640 })
    expect(replay.entries[1].result).toMatchObject({ success: true, calculated6CpcBasicPay: 18640, mappedLevel: '7' })
  })

  it('uses a supported same-date promotion result once as the transition source', () => {
    const promotion = { id: 'promotion', type: EVENT_TYPES.REGULAR_PROMOTION, effectiveDate: '2006-03-01', eventDate: '2006-03-01', targetPayScaleId: 'S5_S13', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE }
    const switchEvent = transition('switch', 5, 6, '2006-03-01', CPC_SWITCH_BASES.ON_PROMOTION_OR_UPGRADATION, 'promotion')
    const replay = calculatePayEventTimeline(fifthState(), [switchEvent, promotion])
    expect(replay.entries.map(({ event }) => event.id)).toEqual(['promotion', 'switch'])
    expect(replay.entries[0].result).toMatchObject({ eventType: 'REGULAR_PROMOTION', finalBasicPay: 7450 })
    expect(replay.entries[1].result).toMatchObject({ success: true, existing5CpcBasicPay: 7450, mappedGradePay: 4600, resultingBasicPay: 18460 })
  })

  it('does not mutate the active state when the referenced trigger is unresolved', () => {
    const badPromotion = { id: 'promotion', type: EVENT_TYPES.REGULAR_PROMOTION, effectiveDate: '2016-06-01', targetPayBand: 'PB-1', targetGradePay: 2400, fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE }
    const switchEvent = transition('switch', 6, 7, '2016-06-01', CPC_SWITCH_BASES.ON_PROMOTION_OR_UPGRADATION, 'promotion')
    const replay = calculatePayEventTimeline(sixthState(), [switchEvent, badPromotion])
    expect(replay.entries[0].result.success).toBe(false)
    expect(replay.entries[1].result).toMatchObject({ success: false, reason: 'DELAYED_CPC_SWITCH_TRIGGER_NOT_RESOLVED' })
    expect(replay.currentPayState).toEqual(sixthState())
  })
})

describe('delayed CPC switch validation and financial dates', () => {
  it('rejects random, pre-statutory, new-appointee, transfer, and multiple-structure cases explicitly', () => {
    expect(calculate6CpcTo7CpcTransition(sixthState(), { employeeSwitchDate: '2016-02-01' })).toMatchObject({ success: false, reason: 'CONFIRMED_DELAYED_CPC_OPTION_REQUIRED' })
    expect(calculate6CpcTo7CpcTransition(sixthState(), { employeeSwitchDate: '2015-12-31' })).toMatchObject({ success: false, reason: 'CPC_SWITCH_BEFORE_STATUTORY_EFFECTIVE_DATE' })
    const delayed = transition('switch', 6, 7, '2016-06-01', CPC_SWITCH_BASES.ON_VACATING_OR_CEASING_OLD_STRUCTURE)
    const newAppointment = { event: { id: 'appointment', type: 'INITIAL_APPOINTMENT', effectiveDate: '2016-02-01' }, result: { success: true } }
    expect(calculate6CpcTo7CpcTransition(sixthState(), delayed, { history: [newAppointment] })).toMatchObject({ success: false, reason: 'DELAYED_CPC_OPTION_NOT_ADMISSIBLE_FOR_NEW_APPOINTEE' })
    const transfer = { event: { id: 'appointment', type: 'INITIAL_APPOINTMENT', effectiveDate: '2015-01-01', appointmentNature: 'TRANSFER_APPOINTMENT' }, result: { success: true } }
    expect(calculate6CpcTo7CpcTransition(sixthState(), delayed, { history: [transfer] })).toMatchObject({ success: false, reason: 'TRANSFER_APPOINTMENT_DELAYED_CPC_OPTION_NOT_IMPLEMENTED' })
    expect(calculate6CpcTo7CpcTransition(sixthState(), { ...delayed, multipleExistingPayStructures: true })).toMatchObject({ success: false, reason: 'MULTIPLE_EXISTING_PAY_STRUCTURES_OPTION_NOT_IMPLEMENTED' })
  })

  it('keeps the old CPC before employeeSwitchDate and starts the new CPC on that date', () => {
    const switchEvent = transition('switch', 6, 7, '2016-07-01', CPC_SWITCH_BASES.ON_NEXT_INCREMENT, 'increment')
    const result = buildPayHistory({ openingState: sixthState(), events: [switchEvent, increment('increment', '2016-07-01')], startDate: '2016-06-01', endDate: '2016-07-31' })
    expect(result.months[0].payState).toMatchObject({ cpc: 6, basicPay: 12560 })
    expect(result.months[1].payState).toMatchObject({ cpc: 7, basicPay: 33300 })
    expect(result.months[1].events.map(({ eventId }) => eventId)).toEqual(['increment', 'switch'])
  })

  it('uses the active old/new CPC in Due segments and preserves mid-month proration status', () => {
    const switchEvent = transition('switch', 6, 7, '2016-07-15', CPC_SWITCH_BASES.ON_VACATING_OR_CEASING_OLD_STRUCTURE)
    const ledger = buildMonthlyDueLedger({
      openingState: sixthState(), events: [switchEvent], startDate: '2016-07-01', endDate: '2016-07-31',
      enabledAllowances: { da: false, hra: false, transportAllowance: false },
    })
    expect(ledger.months[0].segments.map(({ payState }) => payState.cpc)).toEqual([6, 7])
    expect(ledger.months[0]).toMatchObject({ status: 'PARTIALLY_RESOLVED', prorationStatus: 'UNRESOLVED_PRORATION', reason: 'PRORATION_BASIS_NOT_CONFIRMED' })
  })

  it('recomputes Due and comparison for a changed switch option without mutating Drawn Pay', () => {
    const drawnPayHistory = [createDrawnPayRecord({ month: '2016-06', entryMode: 'GROSS_ONLY', grossDrawn: 20000 })]
    const snapshot = structuredClone(drawnPayHistory)
    const normalDue = buildMonthlyDueLedger({
      openingState: sixthState(), events: [{ id: 'normal', type: EVENT_TYPES.CPC_TRANSITION, fromCpc: 6, toCpc: 7, employeeSwitchDate: '2016-01-01' }],
      startDate: '2016-06-01', endDate: '2016-06-30', enabledAllowances: { da: false, hra: false, transportAllowance: false },
    })
    const delayedDue = buildMonthlyDueLedger({
      openingState: sixthState(), events: [transition('delayed', 6, 7, '2016-07-01', CPC_SWITCH_BASES.ON_NEXT_INCREMENT, 'increment'), increment('increment', '2016-07-01')],
      startDate: '2016-06-01', endDate: '2016-06-30', enabledAllowances: { da: false, hra: false, transportAllowance: false },
    })
    const normalComparison = buildDueDrawnComparison({ duePayLedger: normalDue, drawnPayHistory })
    const delayedComparison = buildDueDrawnComparison({ duePayLedger: delayedDue, drawnPayHistory })
    expect(normalDue.months[0].segments[0].payState.cpc).toBe(7)
    expect(delayedDue.months[0].segments[0].payState.cpc).toBe(6)
    expect(normalComparison.months[0].signedDifference).not.toBe(delayedComparison.months[0].signedDifference)
    expect(drawnPayHistory).toEqual(snapshot)
  })

  it('preserves ordinary statutory-date transition arithmetic and DNI', () => {
    expect(calculate5CpcTo6CpcTransition(fifthState(), { type: EVENT_TYPES.CPC_TRANSITION, fromCpc: 5, toCpc: 6, employeeSwitchDate: '2006-01-01' })).toMatchObject({ success: true, resultingBasicPay: 16290, dniReason: 'POST_6CPC_TRANSITION_DNI_NOT_IMPLEMENTED' })
    expect(calculate6CpcTo7CpcTransition(sixthState(), { employeeSwitchDate: '2016-01-01' })).toMatchObject({ success: true, after: { basicPay: 32300, dni: '2016-07-01' } })
  })
})
