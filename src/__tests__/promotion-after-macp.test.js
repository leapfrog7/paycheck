import { describe, expect, it } from 'vitest'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import {
  PROMOTION_AFTER_MACP_RULE_ID,
  resolvePromotionAfterMacp,
} from '../domain/events/promotionAfterMacp'
import { applyPayEvent } from '../engines/pay/applyPayEvent'
import { calculatePayEventTimeline } from '../engines/pay/eventTimeline'

function event(type, effectiveDate, overrides = {}) {
  return {
    id: `${type}-${effectiveDate}`,
    type,
    effectiveDate,
    eventDate: effectiveDate,
    fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE,
    ...overrides,
  }
}

function historyEntry(macpEvent, after, overrides = {}) {
  return {
    event: macpEvent,
    result: {
      success: true,
      eventId: macpEvent.id,
      eventType: EVENT_TYPES.MACP,
      macpNumber: macpEvent.macpNumber ?? null,
      reachedBy: 'MACP',
      after,
      ...overrides,
    },
  }
}

describe('promotion after MACP interaction', () => {
  it('suppresses duplicate 6th CPC fixation for the same PB/GP structure', () => {
    const macp = event(EVENT_TYPES.MACP, '2012-03-15', {
      id: 'macp-6-1', macpNumber: 1, targetPayBand: 'PB-2', targetGradePay: 4600,
    })
    const history = [historyEntry(macp, {
      cpc: 6, payBand: 'PB-2', payInBand: 14040, gradePay: 4600, basicPay: 18640,
    })]
    const currentState = {
      cpc: 6,
      payBand: 'PB-2',
      payInBand: 17130,
      gradePay: 4600,
      basicPay: 21730,
      dni: '2014-07-01',
    }
    const promotion = event(EVENT_TYPES.REGULAR_PROMOTION, '2013-03-15', {
      id: 'promotion-6-1', targetPayBand: 'PB-2', targetGradePay: 4600,
    })

    const result = applyPayEvent(currentState, promotion, { history })

    expect(result).toMatchObject({
      success: true,
      eventType: 'REGULAR_PROMOTION',
      interactionRuleId: PROMOTION_AFTER_MACP_RULE_ID,
      matchedMacpEventId: 'macp-6-1',
      matchedMacpNumber: 1,
      careerEffect: 'PROMOTED',
      payFixationEffect: 'NO_FRESH_FIXATION',
      dniEffect: 'NONE',
      after: {
        payBand: 'PB-2',
        payInBand: 17130,
        gradePay: 4600,
        basicPay: 21730,
        dni: '2014-07-01',
      },
    })
    expect(result.steps.some((step) => step.operation.includes('THREE_PERCENT'))).toBe(false)
  })

  it('suppresses duplicate 7th CPC fixation after later increments in the MACP Level', () => {
    const macp = event(EVENT_TYPES.MACP, '2020-06-01', {
      id: 'macp-7-1', macpNumber: 1, targetLevel: '7',
    })
    const history = [historyEntry(macp, {
      cpc: 7, level: '7', cellIndex: 1, basicPay: 44900,
    })]
    const currentState = {
      cpc: 7,
      level: '7',
      cellIndex: 6,
      basicPay: 52000,
      dni: '2024-07-01',
    }
    const promotion = event(EVENT_TYPES.REGULAR_PROMOTION, '2024-03-15', {
      id: 'promotion-7-1', targetLevel: '7',
    })

    const result = applyPayEvent(currentState, promotion, { history })

    expect(result).toMatchObject({
      success: true,
      matchedMacpEventId: 'macp-7-1',
      matchedMacpNumber: 1,
      careerEffect: 'PROMOTED',
      payFixationEffect: 'NO_FRESH_FIXATION',
      after: { level: '7', cellIndex: 6, basicPay: 52000, dni: '2024-07-01' },
    })
    expect(result.steps.some((step) => step.operation.includes('INCREMENT'))).toBe(false)
    expect(result.targetLookup).toBeUndefined()
  })

  it('does not match same structure without prior MACP history', () => {
    const state = { cpc: 7, level: '7', cellIndex: 6, basicPay: 52000, dni: '2024-07-01' }
    const promotion = event(EVENT_TYPES.REGULAR_PROMOTION, '2024-03-15', { targetLevel: '7' })
    const result = applyPayEvent(state, promotion, { history: [] })
    expect(result).toMatchObject({ success: false, reason: 'SAME_LEVEL_TARGET' })
  })

  it('does not match a prior MACP that granted a different structure', () => {
    const macp = event(EVENT_TYPES.MACP, '2020-06-01', { id: 'macp-level-7', targetLevel: '7' })
    const history = [historyEntry(macp, { cpc: 7, level: '7', cellIndex: 1, basicPay: 44900 })]
    const state = { cpc: 7, level: '8', cellIndex: 2, basicPay: 49000, dni: '2024-07-01' }
    const promotion = event(EVENT_TYPES.REGULAR_PROMOTION, '2024-03-15', { targetLevel: '8' })
    expect(applyPayEvent(state, promotion, { history }).reason).toBe('SAME_LEVEL_TARGET')
  })

  it('does not consider a MACP effective after the promotion', () => {
    const futureMacp = event(EVENT_TYPES.MACP, '2025-01-01', { id: 'future-macp', targetLevel: '7' })
    const history = [historyEntry(futureMacp, { cpc: 7, level: '7', cellIndex: 1, basicPay: 44900 })]
    const state = { cpc: 7, level: '7', cellIndex: 6, basicPay: 52000, dni: '2024-07-01' }
    const promotion = event(EVENT_TYPES.REGULAR_PROMOTION, '2024-03-15', { targetLevel: '7' })
    expect(applyPayEvent(state, promotion, { history }).reason).toBe('SAME_LEVEL_TARGET')
  })

  it('does not treat correction-derived structure as MACP provenance', () => {
    const history = [{
      event: event(EVENT_TYPES.PAY_CORRECTION, '2023-01-01'),
      result: { success: true, eventType: EVENT_TYPES.PAY_CORRECTION, after: { cpc: 7, level: '7', cellIndex: 5, basicPay: 50500 } },
    }]
    const state = { cpc: 7, level: '7', cellIndex: 6, basicPay: 52000, dni: '2024-07-01' }
    const promotion = event(EVENT_TYPES.REGULAR_PROMOTION, '2024-03-15', { targetLevel: '7' })
    expect(resolvePromotionAfterMacp(state, promotion, history).matched).toBe(false)
  })

  it('routes a normal higher-structure promotion to the existing engine', () => {
    const macp = event(EVENT_TYPES.MACP, '2020-06-01', { id: 'macp-level-7', targetLevel: '7' })
    const history = [historyEntry(macp, { cpc: 7, level: '7', cellIndex: 1, basicPay: 44900 })]
    const state = { cpc: 7, level: '7', cellIndex: 6, basicPay: 52000, dni: '2024-07-01' }
    const promotion = event(EVENT_TYPES.REGULAR_PROMOTION, '2024-03-15', { targetLevel: '8' })
    const result = applyPayEvent(state, promotion, { history })
    expect(result).toMatchObject({ success: true, ruleId: '7CPC_PROMOTION_RULE13', after: { level: '8' } })
  })

  it('selects the matching prior MACP rather than merely the most recent MACP', () => {
    const matching = event(EVENT_TYPES.MACP, '2020-01-01', { id: 'matching-macp', macpNumber: 1 })
    const different = event(EVENT_TYPES.MACP, '2022-01-01', { id: 'different-macp', macpNumber: 2 })
    const history = [
      historyEntry(matching, { cpc: 7, level: '7', cellIndex: 1, basicPay: 44900 }),
      historyEntry(different, { cpc: 7, level: '8', cellIndex: 1, basicPay: 47600 }),
    ]
    const state = { cpc: 7, level: '7', cellIndex: 6, basicPay: 52000, dni: '2024-07-01' }
    const promotion = event(EVENT_TYPES.REGULAR_PROMOTION, '2024-03-15', { targetLevel: '7' })
    const result = applyPayEvent(state, promotion, { history })
    expect(result.matchedMacpEventId).toBe('matching-macp')
    expect(result.matchedMacpNumber).toBe(1)
  })

  it('replays same-CPC MACP then promotion chronologically', () => {
    const opening = { cpc: 7, level: '6', cellIndex: 6, basicPay: 41100, dni: '2020-07-01' }
    const promotion = event(EVENT_TYPES.REGULAR_PROMOTION, '2021-03-15', { id: 'promotion', targetLevel: '7' })
    const macp = event(EVENT_TYPES.MACP, '2020-06-01', { id: 'macp', macpNumber: 1, targetLevel: '7' })
    const timeline = calculatePayEventTimeline(opening, [promotion, macp])

    expect(timeline.entries.map((entry) => entry.event.id)).toEqual(['macp', 'promotion'])
    expect(timeline.entries[1].result).toMatchObject({
      success: true,
      payFixationEffect: 'NO_FRESH_FIXATION',
      matchedMacpEventId: 'macp',
    })
  })

  it('leaves cross-CPC equivalence unresolved without an explicit provenance link', () => {
    const oldMacp = event(EVENT_TYPES.MACP, '2015-01-01', { id: 'old-macp' })
    const history = [historyEntry(oldMacp, { cpc: 6, payBand: 'PB-2', payInBand: 15000, gradePay: 4600, basicPay: 19600 })]
    const state = { cpc: 7, level: '7', cellIndex: 6, basicPay: 52000, dni: '2024-07-01' }
    const promotion = event(EVENT_TYPES.REGULAR_PROMOTION, '2024-03-15', { targetLevel: '7' })
    expect(applyPayEvent(state, promotion, { history }).reason).toBe('CROSS_CPC_MACP_EQUIVALENCE_NOT_IMPLEMENTED')
  })
})
