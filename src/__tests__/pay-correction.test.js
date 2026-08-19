import { describe, expect, it } from 'vitest'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { PAY_CORRECTION_MODES } from '../domain/events/payCorrection'
import { applyPayEvent } from '../engines/pay/applyPayEvent'
import { calculatePayEventTimeline } from '../engines/pay/eventTimeline'
import { buildPayHistory } from '../engines/pay/history/buildPayHistory'
import { buildMonthlyDueLedger } from '../engines/pay/ledger/buildMonthlyDueLedger'
import { buildDueDrawnComparison } from '../engines/pay/comparison/buildDueDrawnComparison'
import { createDrawnPayRecord } from '../domain/pay/drawnPay'

const opening7 = { cpc: 7, level: '6', cellIndex: 9, basicPay: 44900, dni: '2020-07-01' }

function refix(date, correctedPayState, overrides = {}) {
  return {
    id: `refix-${date}`, type: EVENT_TYPES.PAY_REFIXATION, effectiveDate: date,
    correctionMode: PAY_CORRECTION_MODES.STRUCTURED, correctedPayState,
    reasonCategory: 'SERVICE_BOOK_CORRECTION', reference: 'SB-TEST', note: 'User supplied note',
    ...overrides,
  }
}

function manualRefix(date, correctedPayState, overrides = {}) {
  return refix(date, correctedPayState, { correctionMode: PAY_CORRECTION_MODES.MANUAL, ...overrides })
}

function increment(id, date) {
  return { id, type: EVENT_TYPES.ANNUAL_INCREMENT, effectiveDate: date, eventDate: date }
}

describe('pay refixation domain', () => {
  it('replaces a structured 7th CPC state with user-confirmed provenance and a field diff', () => {
    const result = applyPayEvent(opening7, refix('2018-07-01', { cpc: 7, level: '6', cellIndex: 10, basicPay: 46200, dni: '2019-07-01' }))
    expect(result).toMatchObject({
      success: true, stateReplacement: true, certaintyReset: true, correctionMode: 'STRUCTURED_CORRECTION',
      structuralStatus: 'STANDARD', provenance: { sourceType: 'USER_CONFIRMED' },
      after: { cpc: 7, level: '6', cellIndex: 10, basicPay: 46200, sourceType: 'USER_CONFIRMED' },
      changedFields: { basicPay: { before: 44900, after: 46200 }, cellIndex: { before: 9, after: 10 } },
    })
    expect(result.warnings.map(({ code }) => code)).toContain('MANUAL_PAY_STATE_OVERRIDE')
    expect(opening7).toEqual({ cpc: 7, level: '6', cellIndex: 9, basicPay: 44900, dni: '2020-07-01' })
  })

  it('accepts off-matrix and off-stage manual states without snapping authoritative structures', () => {
    const seventh = applyPayEvent(opening7, manualRefix('2020-01-01', { cpc: 7, level: '6', cellIndex: 9, basicPay: 45000, dni: '2020-07-01', unusualGradePay: 123 }))
    expect(seventh).toMatchObject({ success: true, structuralStatus: 'NON_STANDARD_CONFIRMED', after: { basicPay: 45000, structuralStatus: 'NON_STANDARD_CONFIRMED' } })
    expect(seventh.warnings.map(({ code }) => code)).toEqual(expect.arrayContaining(['NON_STANDARD_PAY_STATE', 'MANUAL_PAY_STATE_OVERRIDE']))
    expect(applyPayEvent(seventh.after, increment('increment', '2020-07-01'))).toMatchObject({ success: false, reason: 'NON_STANDARD_PAY_STATE_REQUIRES_REFIXATION' })

    const fifth = applyPayEvent(
      { cpc: 5, payScaleId: 'S5_S12', stageIndex: 1, basicPay: 6500, dni: '2006-04-01' },
      manualRefix('2006-02-01', { cpc: 5, payScaleId: 'S5_S12', stageIndex: 1, basicPay: 6550, dni: '2006-04-01' }),
    )
    expect(fifth).toMatchObject({ success: true, after: { basicPay: 6550, structuralStatus: 'NON_STANDARD_CONFIRMED' } })
  })

  it('treats unusual/manual values and a missing reference as warnings, not blockers', () => {
    const result = applyPayEvent(opening7, manualRefix('2020-01-01', { cpc: 7, level: '6', basicPay: 45000, dni: '2020-07-01' }, { reference: null }))
    expect(result.success).toBe(true)
    expect(result.warnings.map(({ code }) => code)).toEqual(expect.arrayContaining(['CORRECTION_WITHOUT_REFERENCE', 'NON_STANDARD_PAY_STATE']))
  })

  it('rejects only malformed correction fundamentals', () => {
    expect(applyPayEvent(opening7, refix('bad-date', { cpc: 7, level: '6', cellIndex: 10, basicPay: 46200, dni: '2019-07-01' }))).toMatchObject({ success: false, reason: 'INVALID_EFFECTIVE_DATE' })
    expect(applyPayEvent(opening7, manualRefix('2020-01-01', { cpc: 7, level: '6', basicPay: -1 }))).toMatchObject({ success: false, reason: 'INVALID_CORRECTED_PAY_STATE' })
  })
})

describe('correction replay and certainty', () => {
  it('uses a corrected 6th CPC structure for the unchanged annual-increment formula', () => {
    const opening = { cpc: 6, payBand: 'PB-2', payInBand: 13000, gradePay: 4200, basicPay: 17200, dni: '2017-07-01' }
    const correction = refix('2017-01-01', { cpc: 6, payBand: 'PB-2', payInBand: 13500, gradePay: 4200, basicPay: 17700, dni: '2017-07-01' })
    const replay = calculatePayEventTimeline(opening, [increment('increment', '2017-07-01'), correction])
    expect(replay.entries.map(({ event }) => event.id)).toEqual([correction.id, 'increment'])
    expect(replay.entries[1].result).toMatchObject({ success: true, incrementBase: 17700, newBasicPay: 18240 })
  })

  it('recalculates a later promotion from the retrospectively corrected state', () => {
    const correction = refix('2020-01-01', { cpc: 7, level: '6', cellIndex: 10, basicPay: 46200, dni: '2020-07-01' })
    const promotion = { id: 'promotion', type: EVENT_TYPES.REGULAR_PROMOTION, effectiveDate: '2020-06-01', targetLevel: '7', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE }
    const replay = calculatePayEventTimeline(opening7, [promotion, correction])
    expect(replay.entries.map(({ event }) => event.id)).toEqual([correction.id, 'promotion'])
    expect(replay.entries[1].before.basicPay).toBe(46200)
    expect(replay.entries[1].result).toMatchObject({ success: true, before: { basicPay: 46200 } })
  })

  it('clears prior uncertainty from the correction date and permits later rules to resolve', () => {
    const opening = { cpc: 7, level: '6', cellIndex: 6, basicPay: 41100, dni: '2020-07-01' }
    const badPromotion = { id: 'bad', type: EVENT_TYPES.REGULAR_PROMOTION, effectiveDate: '2020-06-01', targetLevel: '6', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE }
    const correction = refix('2020-07-01', { cpc: 7, level: '6', cellIndex: 7, basicPay: 42300, dni: '2021-01-01' })
    const replay = calculatePayEventTimeline(opening, [badPromotion, correction, increment('increment', '2021-01-01')])
    expect(replay.entries[0].result.success).toBe(false)
    expect(replay.entries[2].result).toMatchObject({ success: true, after: { basicPay: 43600 } })
    const history = buildPayHistory({ openingState: opening, events: [badPromotion, correction, increment('increment', '2021-01-01')], startDate: '2020-06-01', endDate: '2021-01-31' })
    expect(history.months[0].status).toBe('PARTIALLY_RESOLVED')
    expect(history.months.at(-1)).toMatchObject({ status: 'RESOLVED', basicPay: 43600, unresolvedEventIds: [] })
  })

  it('allows a later structured refixation to normalize a manual state and resume matrix rules', () => {
    const manual = manualRefix('2020-01-01', { cpc: 7, level: '6', basicPay: 45000, dni: '2020-07-01' })
    const normalized = refix('2020-07-01', { cpc: 7, level: '6', cellIndex: 10, basicPay: 46200, dni: '2021-01-01' })
    const replay = calculatePayEventTimeline(opening7, [manual, normalized, increment('increment', '2021-01-01')])
    expect(replay.entries[0].result.structuralStatus).toBe('NON_STANDARD_CONFIRMED')
    expect(replay.entries[1].result.structuralStatus).toBe('STANDARD')
    expect(replay.entries[2].result).toMatchObject({ success: true, after: { basicPay: 47600 } })
  })

  it('retains multiple corrections and applies each from its own date', () => {
    const a = refix('2018-01-01', { cpc: 7, level: '6', cellIndex: 9, basicPay: 44900, dni: '2018-07-01' })
    const b = refix('2019-07-01', { cpc: 7, level: '6', cellIndex: 10, basicPay: 46200, dni: '2020-01-01' })
    const history = buildPayHistory({ openingState: { ...opening7, cellIndex: 8, basicPay: 43600 }, events: [b, a], startDate: '2017-12-01', endDate: '2019-07-31' })
    expect(history.months.find(({ periodStart }) => periodStart === '2018-01-01').basicPay).toBe(44900)
    expect(history.months.at(-1).basicPay).toBe(46200)
    expect(history.replay.entries.filter(({ result }) => result.ruleId === 'PAY_REFIXATION')).toHaveLength(2)
  })

  it('requires an explicit same-date relation and honors BEFORE_EVENT independent of insertion order', () => {
    const promotion = { id: 'promotion', type: EVENT_TYPES.REGULAR_PROMOTION, effectiveDate: '2020-06-01', targetLevel: '7', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE }
    const ambiguous = calculatePayEventTimeline(opening7, [promotion, refix('2020-06-01', { cpc: 7, level: '6', cellIndex: 10, basicPay: 46200, dni: '2020-07-01' })])
    expect(ambiguous.entries.every(({ result }) => result.reason === 'SAME_DATE_CORRECTION_ORDER_UNRESOLVED')).toBe(true)
    const related = refix('2020-06-01', { cpc: 7, level: '6', cellIndex: 10, basicPay: 46200, dni: '2020-07-01' }, { correctionBasis: 'BEFORE_EVENT', relatedEventId: 'promotion' })
    const resolved = calculatePayEventTimeline(opening7, [promotion, related])
    expect(resolved.entries.map(({ event }) => event.id)).toEqual([related.id, 'promotion'])
    expect(resolved.entries[1].result.success).toBe(true)
  })
})

describe('DNI adjustment', () => {
  it('changes only DNI, retains user provenance, rejects the old date and accepts the adjusted date', () => {
    const opening = { cpc: 7, level: '6', cellIndex: 6, basicPay: 41100, dni: '2024-07-01' }
    const adjustment = { id: 'dni-adjust', type: EVENT_TYPES.DNI_ADJUSTMENT, effectiveDate: '2024-06-01', newDni: '2025-01-01', reasonCategory: 'SERVICE_CORRECTION' }
    const replay = calculatePayEventTimeline(opening, [increment('old-date', '2024-07-01'), increment('new-date', '2025-01-01'), adjustment])
    expect(replay.entries[0].result).toMatchObject({ success: true, after: { basicPay: 41100, dni: '2025-01-01', dniDecision: { sourceType: 'USER_CONFIRMED', ruleId: null, derivedFromEventId: 'dni-adjust' } } })
    expect(replay.entries[1].result).toMatchObject({ success: false, reason: 'DNI_MISMATCH' })
    expect(replay.entries[2].result).toMatchObject({ success: true, after: { basicPay: 42300 } })
  })
})

describe('notional and monetary correction boundaries', () => {
  it('uses corrected Pay History notionally but produces Due only from monetaryBenefitFrom', () => {
    const notional = refix('2020-01-01', { cpc: 7, level: '6', cellIndex: 9, basicPay: 44900, dni: '2020-07-01' }, { type: EVENT_TYPES.NOTIONAL_REFIXATION, monetaryBenefitFrom: '2021-07-01' })
    const history = buildPayHistory({ openingState: { ...opening7, cellIndex: 8, basicPay: 43600 }, events: [notional], startDate: '2020-01-01', endDate: '2021-07-31' })
    expect(history.months[0].basicPay).toBe(44900)
    const due = buildMonthlyDueLedger({ openingState: { ...opening7, cellIndex: 8, basicPay: 43600 }, events: [notional], startDate: '2020-01-01', endDate: '2021-07-31', enabledAllowances: { da: false, hra: false, transportAllowance: false } })
    expect(due.months[0]).toMatchObject({ status: 'NOTIONAL_ONLY', monetaryStatus: 'NOTIONAL_ONLY', grossDue: null, reason: 'NOTIONAL_ONLY_NO_MONETARY_ENTITLEMENT' })
    expect(due.months.at(-1)).toMatchObject({ status: 'RESOLVED', monetaryStatus: 'MONETARY', grossDue: 44900 })
  })

  it('creates a monetary boundary mid-month without inventing proration', () => {
    const notional = refix('2020-01-01', { cpc: 7, level: '6', cellIndex: 9, basicPay: 44900, dni: '2020-07-01' }, { type: EVENT_TYPES.NOTIONAL_REFIXATION, monetaryBenefitFrom: '2021-07-15' })
    const due = buildMonthlyDueLedger({ openingState: { ...opening7, cellIndex: 8, basicPay: 43600 }, events: [notional], startDate: '2021-07-01', endDate: '2021-07-31', enabledAllowances: { da: false, hra: false, transportAllowance: false } })
    expect(due.months[0].segments.map(({ monetaryStatus }) => monetaryStatus)).toEqual(['NOTIONAL_ONLY', 'MONETARY'])
    expect(due.months[0]).toMatchObject({ status: 'PARTIALLY_RESOLVED', prorationStatus: 'UNRESOLVED_PRORATION', reason: 'PRORATION_BASIS_NOT_CONFIRMED', grossDue: null })
  })

  it('keeps Drawn byte-for-byte unchanged while correction changes Due and comparison', () => {
    const drawnPayHistory = [createDrawnPayRecord({ month: '2020-07', entryMode: 'GROSS_ONLY', grossDrawn: 44000 })]
    const bytes = JSON.stringify(drawnPayHistory)
    const options = { startDate: '2020-07-01', endDate: '2020-07-31', enabledAllowances: { da: false, hra: false, transportAllowance: false } }
    const ordinaryDue = buildMonthlyDueLedger({ openingState: opening7, events: [], ...options })
    const correctedDue = buildMonthlyDueLedger({ openingState: opening7, events: [refix('2020-07-01', { cpc: 7, level: '6', cellIndex: 10, basicPay: 46200, dni: '2021-01-01' })], ...options })
    const ordinary = buildDueDrawnComparison({ duePayLedger: ordinaryDue, drawnPayHistory })
    const corrected = buildDueDrawnComparison({ duePayLedger: correctedDue, drawnPayHistory })
    expect(ordinary.months[0].signedDifference).toBe(900)
    expect(corrected.months[0].signedDifference).toBe(2200)
    expect(JSON.stringify(drawnPayHistory)).toBe(bytes)
  })
})
