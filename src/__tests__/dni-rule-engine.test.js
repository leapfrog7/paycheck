import { describe, expect, it } from 'vitest'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { resolveDateOfNextIncrement } from '../engines/pay/dni/resolveDni'
import { get7CpcCandidateDni } from '../engines/pay/dni/resolve7cpcDni'
import { calculatePayEventTimeline } from '../engines/pay/eventTimeline'
import { calculate7CpcRegularPromotion } from '../engines/pay/7cpc/regularPromotion'
import { calculate7CpcMacpFixation } from '../engines/pay/7cpc/macpFixation'

describe('shared DNI rule engine', () => {
  it.each([
    ['2020-01-01', '2020-07-01'],
    ['2020-01-02', '2021-01-01'],
    ['2020-06-30', '2021-01-01'],
    ['2020-07-01', '2021-01-01'],
    ['2020-07-02', '2021-07-01'],
    ['2020-12-31', '2021-07-01'],
  ])('maps the 7th CPC boundary %s to %s', (date, expected) => {
    expect(get7CpcCandidateDni(date)).toBe(expected)
  })

  it('preserves a 5th CPC individual DNI month and day annually', () => {
    const result = resolveDateOfNextIncrement({ payState: { cpc: 5, dni: '2004-09-15' }, triggeringEvent: { type: 'ANNUAL_INCREMENT', effectiveDate: '2004-09-15' } })
    expect(result).toMatchObject({ status: 'RESOLVED', date: '2005-09-15', ruleId: '5CPC_INDIVIDUAL_ANNUAL_DNI' })
  })

  it('does not invent a leap-day DNI in a non-leap year', () => {
    const result = resolveDateOfNextIncrement({ payState: { cpc: 5, dni: '2004-02-29' }, triggeringEvent: { type: 'ANNUAL_INCREMENT', effectiveDate: '2004-02-29' } })
    expect(result).toMatchObject({ status: 'UNRESOLVED', reason: 'NEXT_DNI_DATE_NOT_DEFINED' })
  })

  it('keeps the 6th CPC candidate separate from unestablished eligibility', () => {
    const result = resolveDateOfNextIncrement({ payState: { cpc: 6, dni: '2014-07-01' }, triggeringEvent: { type: 'REGULAR_PROMOTION', effectiveDate: '2014-06-01' } })
    expect(result).toMatchObject({ status: 'UNRESOLVED', candidateDni: '2014-07-01', reason: '6CPC_INCREMENT_QUALIFYING_SERVICE_NOT_ESTABLISHED' })
  })

  it('resolves that 6th CPC candidate only when qualifying service is explicit', () => {
    const result = resolveDateOfNextIncrement({ payState: { cpc: 6, dni: '2014-07-01' }, triggeringEvent: { type: 'MACP', effectiveDate: '2014-06-01', qualifyingServiceEstablished: true } })
    expect(result).toMatchObject({ status: 'RESOLVED', date: '2014-07-01' })
  })

  it.each(['EOL', 'NON_QUALIFYING_SERVICE', 'WITHHELD_INCREMENT', 'PENALTY_REDUCTION', 'BREAK_IN_SERVICE', 'SUSPENSION'])('leaves eligibility unresolved for explicit adverse service event %s', (type) => {
    const result = resolveDateOfNextIncrement({ payState: { cpc: 7 }, triggeringEvent: { type: 'REGULAR_PROMOTION', effectiveDate: '2020-06-01' }, serviceStatusHistory: [{ type }] })
    expect(result).toMatchObject({ status: 'UNRESOLVED', reason: 'NON_QUALIFYING_SERVICE_RULE_NOT_IMPLEMENTED', candidateDni: '2021-01-01' })
  })

  it('resolves only the normal initial 7th CPC transition', () => {
    expect(resolveDateOfNextIncrement({ payState: { cpc: 7 }, triggeringEvent: { type: 'CPC_TRANSITION', effectiveDate: '2016-01-01' } })).toMatchObject({ status: 'RESOLVED', date: '2016-07-01' })
    expect(resolveDateOfNextIncrement({ payState: { cpc: 7 }, triggeringEvent: { type: 'CPC_TRANSITION', effectiveDate: '2016-02-01' } })).toMatchObject({ status: 'UNRESOLVED', reason: 'DELAYED_7CPC_SWITCH_DNI_NOT_IMPLEMENTED' })
  })

  it('continues from the first 7th CPC transition DNI to the following July', () => {
    const transition = resolveDateOfNextIncrement({ payState: { cpc: 7 }, triggeringEvent: { type: 'CPC_TRANSITION', effectiveDate: '2016-01-01' } })
    const increment = resolveDateOfNextIncrement({ payState: { cpc: 7, dniDecision: transition }, triggeringEvent: { type: 'ANNUAL_INCREMENT', effectiveDate: '2016-07-01' } })
    expect(increment).toMatchObject({ status: 'RESOLVED', date: '2017-07-01' })
  })

  it.each([
    ['2020-03-15', '2021-01-01'],
    ['2020-09-15', '2021-07-01'],
  ])('integrates the 7th CPC promotion window for %s without changing fixation', (effectiveDate, dni) => {
    const result = calculate7CpcRegularPromotion(
      { cpc: 7, level: '6', cellIndex: 6, basicPay: 41100, dni: '2020-07-01' },
      { type: 'REGULAR_PROMOTION', effectiveDate, targetLevel: '7', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE },
    )
    expect(result).toMatchObject({ success: true, after: { basicPay: 44900, dni }, dniDecision: { trigger: { type: 'REGULAR_PROMOTION' } } })
  })

  it.each([
    ['2020-03-15', '2021-01-01'],
    ['2020-09-15', '2021-07-01'],
  ])('integrates the 7th CPC MACP window for %s and retains MACP provenance', (effectiveDate, dni) => {
    const result = calculate7CpcMacpFixation(
      { cpc: 7, level: '6', cellIndex: 6, basicPay: 41100, dni: '2020-07-01' },
      { type: 'MACP', effectiveDate, targetLevel: '7', macpNumber: 1, fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE },
    )
    expect(result).toMatchObject({ success: true, eventType: 'MACP', after: { basicPay: 44900, dni }, dniDecision: { trigger: { type: 'MACP' } } })
  })

  it('rejects a second ordinary increment already consumed in the year', () => {
    const history = [{ event: { type: 'ANNUAL_INCREMENT', effectiveDate: '2020-01-01' }, result: { success: true } }]
    const result = resolveDateOfNextIncrement({ payState: { cpc: 7, dni: '2020-07-01' }, triggeringEvent: { type: 'ANNUAL_INCREMENT', effectiveDate: '2020-07-01' }, eventHistory: history })
    expect(result).toMatchObject({ status: 'UNRESOLVED', reason: 'ORDINARY_INCREMENT_ALREADY_GRANTED_IN_CYCLE' })
  })

  it('preserves the confirmed DNI when no fresh fixation occurs', () => {
    const result = resolveDateOfNextIncrement({ payState: { cpc: 7, dni: '2021-07-01' }, triggeringEvent: { type: 'REGULAR_PROMOTION', effectiveDate: '2020-09-01', payFixationEffect: 'NO_FRESH_FIXATION' } })
    expect(result).toMatchObject({ status: 'RESOLVED', date: '2021-07-01', ruleId: 'DNI_EFFECT_NONE' })
  })

  it('does not choose an ordering for same-date increment and promotion', () => {
    const opening = { cpc: 7, level: '6', cellIndex: 6, basicPay: 41100, dni: '2020-07-01' }
    const events = [
      { type: 'REGULAR_PROMOTION', effectiveDate: '2020-07-01', targetLevel: '7', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE },
      { type: 'ANNUAL_INCREMENT', effectiveDate: '2020-07-01' },
    ]
    const timeline = calculatePayEventTimeline(opening, events)
    expect(timeline.entries.every(({ result }) => result.reason === 'SAME_DATE_DNI_EVENT_ORDERING_NOT_IMPLEMENTED')).toBe(true)
    expect(timeline.currentPayState).toEqual(opening)
  })

  it('blocks a later increment after a successful event with unresolved DNI', () => {
    const prior = { event: { type: 'REGULAR_PROMOTION', effectiveDate: '2014-06-01' }, result: { success: true, dniDecision: { status: 'UNRESOLVED' } } }
    const result = resolveDateOfNextIncrement({ payState: { cpc: 6, dni: '2014-07-01' }, triggeringEvent: { type: 'ANNUAL_INCREMENT', effectiveDate: '2014-07-01' }, eventHistory: [prior] })
    expect(result).toMatchObject({ status: 'UNRESOLVED', reason: 'PRIOR_UNRESOLVED_EVENT_MAY_AFFECT_DNI' })
  })
})
