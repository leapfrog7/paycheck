import { describe, expect, it } from 'vitest'
import { SEVENTH_CPC_PAY_MATRIX } from '../data/pay/7cpcPayMatrix'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { applyPayEvent } from '../engines/pay/applyPayEvent'
import {
  calculate7CpcRegularPromotion,
  selectPromotionTargetCell,
} from '../engines/pay/7cpc/regularPromotion'

function promotionEvent(overrides = {}) {
  return {
    type: EVENT_TYPES.REGULAR_PROMOTION,
    effectiveDate: '2020-06-01',
    targetLevel: '7',
    fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE,
    ...overrides,
  }
}

function level6State(overrides = {}) {
  return {
    cpc: 7,
    level: '6',
    cellIndex: 6,
    basicPay: 41100,
    dni: '2020-07-01',
    ...overrides,
  }
}

describe('7CPC_PROMOTION_RULE13', () => {
  it('fixes Level 6 ₹41,100 at Level 7 ₹44,900', () => {
    const result = calculate7CpcRegularPromotion(level6State(), promotionEvent())

    expect(result).toMatchObject({
      success: true,
      ruleId: '7CPC_PROMOTION_RULE13',
      currentLevel: '6',
      currentCell: { index: 6, value: 41100 },
      lowerLevelIncrement: {
        fromCell: { index: 6, value: 41100 },
        toCell: { index: 7, value: 42300 },
      },
      referenceAmount: 42300,
      targetLevel: '7',
      targetLookup: { method: 'NEXT_HIGHER_CELL', searchedLevel: '7' },
      selectedTargetCell: { index: 1, value: 44900 },
      after: { cpc: 7, effectiveFrom: '2020-06-01', level: '7', cellIndex: 1, basicPay: 44900 },
      dniStatus: 'RESOLVED',
      dniDecision: { status: 'RESOLVED', date: '2021-01-01', ruleId: '7CPC_RULE10_DNI' },
    })
  })

  it('uses an exact target-Level Cell match', () => {
    const result = calculate7CpcRegularPromotion(
      level6State({ cellIndex: 9, basicPay: 44900 }),
      promotionEvent(),
    )
    expect(result.referenceAmount).toBe(46200)
    expect(result.targetLookup.method).toBe('EXACT_CELL')
    expect(result.selectedTargetCell).toEqual({ index: 2, value: 46200 })
  })

  it('uses the immediate next higher target-Level Cell', () => {
    const result = calculate7CpcRegularPromotion(level6State(), promotionEvent())
    expect(result.targetLookup.method).toBe('NEXT_HIGHER_CELL')
    expect(result.selectedTargetCell.value).toBe(44900)
  })

  it('moves exactly one Cell in the current Level before target lookup', () => {
    const result = calculate7CpcRegularPromotion(level6State(), promotionEvent())
    expect(result.lowerLevelIncrement.fromCell.index).toBe(6)
    expect(result.lowerLevelIncrement.toCell.index).toBe(7)
    expect(result.referenceAmount).toBe(result.lowerLevelIncrement.toCell.value)
  })

  it('does not mutate the current Pay State and uses the target Level in the result', () => {
    const state = level6State()
    const original = structuredClone(state)
    const result = calculate7CpcRegularPromotion(state, promotionEvent())
    expect(state).toEqual(original)
    expect(result.before.level).toBe('6')
    expect(result.after.level).toBe('7')
  })

  it('rejects a missing or invalid target Level', () => {
    expect(calculate7CpcRegularPromotion(level6State(), promotionEvent({ targetLevel: '' })).reason).toBe('MISSING_TARGET_LEVEL')
    expect(calculate7CpcRegularPromotion(level6State(), promotionEvent({ targetLevel: '99' })).reason).toBe('INVALID_TARGET_LEVEL')
  })

  it('rejects same-Level and lower-Level targets', () => {
    expect(calculate7CpcRegularPromotion(level6State(), promotionEvent({ targetLevel: '6' })).reason).toBe('SAME_LEVEL_TARGET')
    expect(calculate7CpcRegularPromotion(level6State(), promotionEvent({ targetLevel: '5' })).reason).toBe('LOWER_LEVEL_TARGET')
  })

  it('returns unresolved when the current Level has no next Cell', () => {
    const result = calculate7CpcRegularPromotion(
      level6State({ cellIndex: 40, basicPay: 112400 }),
      promotionEvent(),
    )
    expect(result).toMatchObject({ success: false, status: 'UNRESOLVED', reason: 'NO_LOWER_LEVEL_INCREMENT_CELL' })
  })

  it('returns no target Cell when the reference amount exceeds the target Level', () => {
    expect(selectPromotionTargetCell('17', 225001)).toBeNull()
  })

  it('rejects non-7th-CPC and invalid current Pay States', () => {
    expect(calculate7CpcRegularPromotion(level6State({ cpc: 6 }), promotionEvent()).reason).toBe('INVALID_PAY_STATE')
    expect(calculate7CpcRegularPromotion(level6State({ basicPay: 42000 }), promotionEvent()).reason).toBe('INVALID_PAY_STATE')
  })

  it('implements FROM_LOWER_POST_DNI as a multi-stage fixation', () => {
    const result = calculate7CpcRegularPromotion(
      level6State(),
      promotionEvent({ fixationOption: FIXATION_OPTIONS.FROM_LOWER_POST_DNI }),
    )
    expect(result).toMatchObject({
      success: true,
      ruleId: '7CPC_PROMOTION_FROM_DNI',
      payFixationEffect: 'DEFERRED_TO_LOWER_POST_DNI',
      interim: { stateType: 'INTERIM_PAY_STATE' },
      finalFixation: { stateType: 'FINAL_FIXATION_STATE' },
    })
  })

  it('accepts the canonical object representation of a confirmed fixation option', () => {
    const result = calculate7CpcRegularPromotion(
      level6State(),
      promotionEvent({ fixationOption: { selected: FIXATION_OPTIONS.FROM_EVENT_DATE } }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects missing/unsupported fixation options and invalid event data', () => {
    expect(calculate7CpcRegularPromotion(level6State(), promotionEvent({ fixationOption: FIXATION_OPTIONS.UNRESOLVED })).reason).toBe('UNSUPPORTED_FIXATION_OPTION')
    expect(calculate7CpcRegularPromotion(level6State(), promotionEvent({ effectiveDate: 'not-a-date' })).reason).toBe('INVALID_EFFECTIVE_DATE')
    expect(calculate7CpcRegularPromotion(level6State(), promotionEvent({ type: EVENT_TYPES.MACP })).reason).toBe('INVALID_EVENT_TYPE')
  })

  it('is integrated into the event dispatcher for 7th CPC states', () => {
    const result = applyPayEvent(level6State(), promotionEvent())
    expect(result).toMatchObject({ success: true, ruleId: '7CPC_PROMOTION_RULE13' })
  })

  it('does not mutate the authoritative Pay Matrix', () => {
    const matrixBefore = structuredClone(SEVENTH_CPC_PAY_MATRIX)
    calculate7CpcRegularPromotion(level6State(), promotionEvent())
    calculate7CpcRegularPromotion(level6State({ cellIndex: 9, basicPay: 44900 }), promotionEvent())
    expect(SEVENTH_CPC_PAY_MATRIX).toEqual(matrixBefore)
  })
})
