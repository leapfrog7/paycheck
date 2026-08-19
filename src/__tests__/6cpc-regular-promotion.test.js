import { describe, expect, it } from 'vitest'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { applyPayEvent } from '../engines/pay/applyPayEvent'
import { calculate6CpcRegularPromotion } from '../engines/pay/6cpc/regularPromotion'

function sourceState(overrides = {}) {
  return {
    cpc: 6,
    payBand: 'PB-2',
    payInBand: 13500,
    gradePay: 4200,
    basicPay: 17700,
    dni: '2014-07-01',
    ...overrides,
  }
}

function promotionEvent(overrides = {}) {
  return {
    type: EVENT_TYPES.REGULAR_PROMOTION,
    effectiveDate: '2014-06-01',
    targetPayBand: 'PB-2',
    targetGradePay: 4600,
    fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE,
    ...overrides,
  }
}

describe('6CPC_PROMOTION_FROM_EVENT_DATE', () => {
  it('fixes PB-2 GP ₹4200 at PB-2 GP ₹4600 and reproduces ₹18,640', () => {
    const result = calculate6CpcRegularPromotion(sourceState(), promotionEvent())

    expect(result).toMatchObject({
      success: true,
      ruleId: '6CPC_PROMOTION_FROM_EVENT_DATE',
      promotionEffectiveDate: '2014-06-01',
      incrementBase: 17700,
      rawIncrement: 531,
      roundedPromotionalIncrement: 540,
      previousPayInBand: 13500,
      postIncrementPayInBand: 14040,
      previousGradePay: 4200,
      targetGradePay: 4600,
      previousPayBand: 'PB-2',
      targetPayBand: 'PB-2',
      finalBasicPay: 18640,
      after: {
        cpc: 6,
        effectiveFrom: '2014-06-01',
        payBand: 'PB-2',
        payInBand: 14040,
        gradePay: 4600,
        basicPay: 18640,
        dni: {
          status: 'UNRESOLVED',
          reason: 'POST_PROMOTION_DNI_NOT_IMPLEMENTED',
        },
      },
    })
  })

  it('calculates the promotional increment from existing Basic Pay', () => {
    const result = calculate6CpcRegularPromotion(sourceState(), promotionEvent())
    expect(result.incrementBase).toBe(result.before.basicPay)
    expect(result.rawIncrement).toBe(result.before.basicPay * 0.03)
  })

  it('adds the increment only to Pay in Pay Band and substitutes target Grade Pay', () => {
    const result = calculate6CpcRegularPromotion(sourceState(), promotionEvent())
    expect(result.after.payInBand - result.before.payInBand).toBe(result.roundedPromotionalIncrement)
    expect(result.after.gradePay).toBe(4600)
    expect(result.after.basicPay).toBe(result.after.payInBand + 4600)
  })

  it('supports a verified cross-Pay-Band combination when carried pay lies in the target band', () => {
    const result = calculate6CpcRegularPromotion(
      sourceState({ payInBand: 16000, gradePay: 5400, basicPay: 21400 }),
      promotionEvent({ targetPayBand: 'PB-3', targetGradePay: 6600 }),
    )
    expect(result).toMatchObject({
      success: true,
      postIncrementPayInBand: 16650,
      targetPayBand: 'PB-3',
      targetGradePay: 6600,
      finalBasicPay: 23250,
    })
  })

  it('returns unresolved when a cross-band case needs an undefined band adjustment', () => {
    const result = calculate6CpcRegularPromotion(
      sourceState(),
      promotionEvent({ targetPayBand: 'PB-3', targetGradePay: 5400 }),
    )
    expect(result).toMatchObject({
      success: false,
      status: 'UNRESOLVED',
      reason: 'TARGET_PAY_BAND_ADJUSTMENT_RULE_NOT_IMPLEMENTED',
      postIncrementPayInBand: 14040,
    })
  })

  it('rejects invalid target Pay Band and Grade Pay combinations', () => {
    const result = calculate6CpcRegularPromotion(
      sourceState(),
      promotionEvent({ targetPayBand: 'PB-1', targetGradePay: 4200 }),
    )
    expect(result).toMatchObject({ success: false, reason: 'INVALID_TARGET_STRUCTURE' })
  })

  it('rejects the same or a lower financial structure', () => {
    expect(calculate6CpcRegularPromotion(
      sourceState(),
      promotionEvent({ targetGradePay: 4200 }),
    ).reason).toBe('SAME_FINANCIAL_STRUCTURE')

    expect(calculate6CpcRegularPromotion(
      sourceState(),
      promotionEvent({ targetPayBand: 'PB-1', targetGradePay: 2800 }),
    ).reason).toBe('LOWER_FINANCIAL_STRUCTURE')
  })

  it('implements FROM_LOWER_POST_DNI as a multi-stage fixation', () => {
    const result = calculate6CpcRegularPromotion(
      sourceState(),
      promotionEvent({ fixationOption: FIXATION_OPTIONS.FROM_LOWER_POST_DNI }),
    )
    expect(result).toMatchObject({
      success: true,
      ruleId: '6CPC_PROMOTION_FROM_DNI',
      payFixationEffect: 'DEFERRED_TO_LOWER_POST_DNI',
      interim: { payState: { payInBand: 13500, gradePay: 4600, basicPay: 18100 } },
      finalFixation: { after: { payInBand: 14590, gradePay: 4600, basicPay: 19190 } },
    })
  })

  it('rejects invalid source/event data and unsupported fixation options', () => {
    expect(calculate6CpcRegularPromotion(sourceState({ cpc: 7 }), promotionEvent()).reason).toBe('INVALID_PAY_STATE')
    expect(calculate6CpcRegularPromotion(sourceState(), promotionEvent({ effectiveDate: '' })).reason).toBe('INVALID_EFFECTIVE_DATE')
    expect(calculate6CpcRegularPromotion(sourceState(), promotionEvent({ fixationOption: FIXATION_OPTIONS.UNRESOLVED })).reason).toBe('UNSUPPORTED_FIXATION_OPTION')
  })

  it('is selected by the dispatcher for 6th CPC regular promotion', () => {
    const result = applyPayEvent(sourceState(), promotionEvent())
    expect(result).toMatchObject({ success: true, ruleId: '6CPC_PROMOTION_FROM_EVENT_DATE' })
  })
})
