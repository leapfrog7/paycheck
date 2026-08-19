import { describe, expect, it } from 'vitest'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { buildPayHistory } from '../engines/pay/history/buildPayHistory'

const opening7 = { id: 'opening-7', cpc: 7, level: '6', cellIndex: 6, basicPay: 41100, dni: '2020-07-01' }

function event(type, date, overrides = {}) {
  return {
    id: `${type}-${date}`,
    type,
    eventDate: date,
    effectiveDate: date,
    fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE,
    ...overrides,
  }
}

function history(overrides = {}) {
  return buildPayHistory({
    openingState: opening7,
    events: [],
    startDate: '2020-04-01',
    endDate: '2020-06-30',
    ...overrides,
  })
}

describe('month-wise Basic Pay history', () => {
  it('keeps the opening Basic Pay for every month when there are no events', () => {
    const result = history()
    expect(result.months).toHaveLength(3)
    expect(result.months.map((month) => month.basicPay)).toEqual([41100, 41100, 41100])
    expect(result.months.every((month) => month.status === 'RESOLVED')).toBe(true)
  })

  it('applies an annual increment from 1 July using replay output', () => {
    const result = history({
      startDate: '2020-06-01', endDate: '2020-07-31',
      events: [event(EVENT_TYPES.ANNUAL_INCREMENT, '2020-07-01')],
    })
    expect(result.months.map((month) => month.basicPay)).toEqual([41100, 42300])
    expect(result.months[1].derivedFrom.ruleId).toBe('7CPC_ANNUAL_INCREMENT')
  })

  it('uses promoted pay for the whole month when promotion is on its first day', () => {
    const result = history({
      startDate: '2020-06-01', endDate: '2020-06-30',
      events: [event(EVENT_TYPES.REGULAR_PROMOTION, '2020-06-01', { targetLevel: '7' })],
    })
    expect(result.months[0].segments).toHaveLength(1)
    expect(result.months[0].payState).toMatchObject({ level: '7', cellIndex: 1, basicPay: 44900 })
  })

  it('creates two segments for a mid-month promotion', () => {
    const result = history({
      startDate: '2020-06-01', endDate: '2020-06-30',
      events: [event(EVENT_TYPES.REGULAR_PROMOTION, '2020-06-15', { targetLevel: '7' })],
    })
    expect(result.months[0].segments).toMatchObject([
      { from: '2020-06-01', to: '2020-06-14', basicPay: 41100 },
      { from: '2020-06-15', to: '2020-06-30', basicPay: 44900 },
    ])
  })

  it('creates two segments for a mid-month MACP', () => {
    const result = history({
      startDate: '2020-06-01', endDate: '2020-06-30',
      events: [event(EVENT_TYPES.MACP, '2020-06-15', { targetLevel: '7', macpNumber: 1 })],
    })
    expect(result.months[0].segments.map((segment) => segment.basicPay)).toEqual([41100, 44900])
  })

  it('records a no-fresh-fixation promotion without creating a pay-change segment', () => {
    const events = [
      event(EVENT_TYPES.MACP, '2020-06-01', { id: 'macp-1', targetLevel: '7', macpNumber: 1 }),
      event(EVENT_TYPES.REGULAR_PROMOTION, '2020-06-15', { id: 'promotion-1', targetLevel: '7' }),
    ]
    const result = history({ startDate: '2020-06-01', endDate: '2020-06-30', events })
    expect(result.months[0].segments).toHaveLength(1)
    expect(result.months[0].basicPay).toBe(44900)
    expect(result.months[0].events.find(({ eventId }) => eventId === 'promotion-1')).toMatchObject({
      success: true, payFixationEffect: 'NO_FRESH_FIXATION',
    })
  })

  it('switches from 6th CPC in December to replayed 7th CPC pay in January', () => {
    const openingState = { cpc: 6, payBand: 'PB-1', payInBand: 10160, gradePay: 2400, basicPay: 12560, dni: '2016-07-01' }
    const transition = event(EVENT_TYPES.CPC_TRANSITION, '2016-01-01', { fromCpc: 6, toCpc: 7, employeeSwitchDate: '2016-01-01' })
    const result = history({ openingState, events: [transition], startDate: '2015-12-01', endDate: '2016-01-31' })
    expect(result.months[0].payState).toMatchObject({ cpc: 6, basicPay: 12560 })
    expect(result.months[1].payState).toMatchObject({ cpc: 7, level: '4', basicPay: 32300 })
  })

  it('uses an employee switch date as the transition effective date', () => {
    const openingState = { cpc: 6, payBand: 'PB-1', payInBand: 10160, gradePay: 2400, basicPay: 12560, dni: '2016-07-01' }
    const transition = event(EVENT_TYPES.CPC_TRANSITION, '2016-01-01', {
      id: 'delayed-switch', fromCpc: 6, toCpc: 7, employeeSwitchDate: '2016-07-01',
      option: { status: 'CONFIRMED', basis: 'ON_VACATING_OR_CEASING_OLD_STRUCTURE' },
    })
    const result = history({ openingState, events: [transition], startDate: '2016-06-01', endDate: '2016-07-31' })
    expect(result.months.map(({ payState }) => payState.cpc)).toEqual([6, 7])
    expect(result.months[1].events[0].effectiveDate).toBe('2016-07-01')
  })

  it('does not mutate pay for an unresolved event and marks the affected segment', () => {
    const unresolved = event(EVENT_TYPES.REGULAR_PROMOTION, '2020-06-15', { id: 'bad-promotion', targetLevel: '6' })
    const result = history({ startDate: '2020-06-01', endDate: '2020-06-30', events: [unresolved] })
    expect(result.months[0].segments.map((segment) => segment.basicPay)).toEqual([41100, 41100])
    expect(result.months[0].segments[0].status).toBe('RESOLVED')
    expect(result.months[0].segments[1]).toMatchObject({ status: 'PARTIALLY_RESOLVED', unresolvedEventIds: ['bad-promotion'] })
  })

  it('supports multiple events over several years', () => {
    const events = [
      event(EVENT_TYPES.REGULAR_PROMOTION, '2020-06-01', { targetLevel: '7' }),
      event(EVENT_TYPES.REGULAR_PROMOTION, '2022-01-01', { targetLevel: '8' }),
    ]
    const result = history({ startDate: '2019-12-01', endDate: '2022-02-28', events })
    expect(result.months).toHaveLength(27)
    expect(result.months.at(-1).payState.level).toBe('8')
  })

  it('uses the final replayed state for same-date events in replay order', () => {
    const events = [
      event(EVENT_TYPES.REGULAR_PROMOTION, '2020-06-15', { id: 'first', targetLevel: '7' }),
      event(EVENT_TYPES.REGULAR_PROMOTION, '2020-06-15', { id: 'second', targetLevel: '8' }),
    ]
    const result = history({ startDate: '2020-06-01', endDate: '2020-06-30', events })
    expect(result.replay.entries.map(({ event: item }) => item.id)).toEqual(['first', 'second'])
    expect(result.months[0].segments).toHaveLength(2)
    expect(result.months[0].segments[1].payState).toMatchObject({ level: '8', basicPay: 47600 })
    expect(result.months[0].segments[1].derivedFrom.latestAppliedEventId).toBe('second')
  })

  it('preserves partial first and final month boundaries', () => {
    const result = history({ startDate: '2020-04-15', endDate: '2020-08-20' })
    expect(result.months[0]).toMatchObject({ periodStart: '2020-04-15', periodEnd: '2020-04-30' })
    expect(result.months.at(-1)).toMatchObject({ periodStart: '2020-08-01', periodEnd: '2020-08-20' })
  })

  it('uses 29 February in a leap year', () => {
    const result = history({ startDate: '2020-02-01', endDate: '2020-02-29' })
    expect(result.months[0].periodEnd).toBe('2020-02-29')
  })

  it('crosses the December to January boundary without timezone drift', () => {
    const result = history({ startDate: '2020-12-31', endDate: '2021-01-01' })
    expect(result.months.map(({ periodStart, periodEnd }) => [periodStart, periodEnd])).toEqual([
      ['2020-12-31', '2020-12-31'], ['2021-01-01', '2021-01-01'],
    ])
  })

  it.each([
    [{ startDate: '2020-02-30', endDate: '2020-03-01' }, 'INVALID_START_DATE'],
    [{ startDate: '2020-02-01', endDate: 'not-a-date' }, 'INVALID_END_DATE'],
    [{ startDate: '2020-03-01', endDate: '2020-02-29' }, 'END_DATE_BEFORE_START_DATE'],
  ])('returns structured unresolved output for invalid ranges', (range, reason) => {
    expect(history(range)).toMatchObject({ success: false, status: 'UNRESOLVED', reason, months: [] })
  })
})
