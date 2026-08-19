import { describe, expect, it } from 'vitest'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { applyPayEvent } from '../engines/pay/applyPayEvent'
import { calculate6CpcMacpFixation } from '../engines/pay/6cpc/macpFixation'

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

function macpEvent(overrides = {}) {
  return {
    id: 'macp-event-1',
    type: EVENT_TYPES.MACP,
    effectiveDate: '2014-06-01',
    macpNumber: 1,
    targetPayBand: 'PB-2',
    targetGradePay: 4600,
    fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE,
    ...overrides,
  }
}

describe('6CPC_MACP_FIXATION', () => {
  it('fixes PB-2 GP ₹4200 at PB-2 GP ₹4600 and reproduces ₹18,640', () => {
    const result = calculate6CpcMacpFixation(sourceState(), macpEvent())

    expect(result).toMatchObject({
      success: true,
      eventId: 'macp-event-1',
      eventType: 'MACP',
      reachedBy: 'MACP',
      macpNumber: 1,
      ruleId: '6CPC_MACP_FIXATION',
      incrementBase: 17700,
      rawIncrement: 531,
      roundedIncrement: 540,
      previousPayInBand: 13500,
      postIncrementPayInBand: 14040,
      previousPayBand: 'PB-2',
      previousGradePay: 4200,
      targetPayBand: 'PB-2',
      targetGradePay: 4600,
      finalBasicPay: 18640,
      after: {
        cpc: 6,
        payBand: 'PB-2',
        payInBand: 14040,
        gradePay: 4600,
        basicPay: 18640,
        reachedBy: 'MACP',
        macpNumber: 1,
        dni: { status: 'UNRESOLVED', reason: 'POST_MACP_DNI_NOT_IMPLEMENTED' },
      },
    })
  })

  it('keeps MACP identity distinct from regular promotion', () => {
    const result = calculate6CpcMacpFixation(sourceState(), macpEvent())
    expect(result.eventType).toBe(EVENT_TYPES.MACP)
    expect(result.reachedBy).toBe('MACP')
    expect(result.ruleId).not.toContain('PROMOTION')
    expect(result.steps.some((step) => step.operation.includes('MACP'))).toBe(true)
  })

  it('retains MACP number and validates supplied values', () => {
    expect(calculate6CpcMacpFixation(sourceState(), macpEvent({ macpNumber: 3 })).macpNumber).toBe(3)
    expect(calculate6CpcMacpFixation(sourceState(), macpEvent({ macpNumber: null })).macpNumber).toBeNull()
    expect(calculate6CpcMacpFixation(sourceState(), macpEvent({ macpNumber: 4 })).reason).toBe('INVALID_MACP_NUMBER')
  })

  it('bases the fixation increment on existing Basic Pay', () => {
    const result = calculate6CpcMacpFixation(sourceState(), macpEvent())
    expect(result.incrementBase).toBe(result.before.basicPay)
    expect(result.rawIncrement).toBe(result.before.basicPay * 0.03)
  })

  it('adds the increment only to Pay in Pay Band and applies target Grade Pay', () => {
    const result = calculate6CpcMacpFixation(sourceState(), macpEvent())
    expect(result.after.payInBand - result.before.payInBand).toBe(result.roundedIncrement)
    expect(result.after.gradePay).toBe(4600)
    expect(result.after.basicPay).toBe(result.after.payInBand + result.after.gradePay)
  })

  it('rejects arbitrary structures that are not the immediate MACP target', () => {
    expect(calculate6CpcMacpFixation(
      sourceState(),
      macpEvent({ targetPayBand: 'PB-1', targetGradePay: 4200 }),
    ).reason).toBe('MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_STRUCTURE')

    expect(calculate6CpcMacpFixation(
      sourceState(),
      macpEvent({ targetGradePay: 4200 }),
    ).reason).toBe('MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_STRUCTURE')

    expect(calculate6CpcMacpFixation(
      sourceState(),
      macpEvent({ targetPayBand: 'PB-1', targetGradePay: 2800 }),
    ).reason).toBe('MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_STRUCTURE')
  })

  it('rejects a cross-band promotional-hierarchy jump before fixation arithmetic', () => {
    const result = calculate6CpcMacpFixation(
      sourceState(),
      macpEvent({ targetPayBand: 'PB-3', targetGradePay: 5400 }),
    )
    expect(result).toMatchObject({
      success: false,
      status: 'UNRESOLVED',
      reason: 'MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_STRUCTURE',
    })
  })

  it('rejects a controlled-hierarchy skip even when carried pay fits the supplied band', () => {
    const result = calculate6CpcMacpFixation(
      sourceState({ payInBand: 16000, gradePay: 5400, basicPay: 21400 }),
      macpEvent({ targetPayBand: 'PB-3', targetGradePay: 6600 }),
    )
    expect(result).toMatchObject({
      success: false,
      reason: 'MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_STRUCTURE',
    })
  })

  it('implements fixation from lower-post DNI while retaining MACP identity', () => {
    const result = calculate6CpcMacpFixation(
      sourceState(),
      macpEvent({ fixationOption: FIXATION_OPTIONS.FROM_LOWER_POST_DNI }),
    )
    expect(result).toMatchObject({
      success: true,
      ruleId: '6CPC_MACP_FROM_DNI',
      reachedBy: 'MACP',
      macpNumber: 1,
      interim: { payState: { basicPay: 18100, reachedBy: 'MACP' } },
      finalFixation: { after: { basicPay: 19190, reachedBy: 'MACP' } },
    })
  })

  it('marks post-MACP DNI explicitly unresolved', () => {
    const result = calculate6CpcMacpFixation(sourceState(), macpEvent())
    expect(result.after.dni).toEqual({
      status: 'UNRESOLVED',
      reason: 'POST_MACP_DNI_NOT_IMPLEMENTED',
    })
    expect(result.after.dni).not.toBe(result.before.dni)
  })

  it('rejects invalid source and event data', () => {
    expect(calculate6CpcMacpFixation(sourceState({ cpc: 7 }), macpEvent()).reason).toBe('INVALID_PAY_STATE')
    expect(calculate6CpcMacpFixation(sourceState(), macpEvent({ effectiveDate: '' })).reason).toBe('INVALID_EFFECTIVE_DATE')
    expect(calculate6CpcMacpFixation(sourceState(), { ...macpEvent(), type: EVENT_TYPES.REGULAR_PROMOTION }).reason).toBe('INVALID_EVENT_TYPE')
  })

  it('is integrated into the dispatcher without using regular promotion', () => {
    const result = applyPayEvent(sourceState(), macpEvent())
    expect(result).toMatchObject({
      success: true,
      eventType: 'MACP',
      reachedBy: 'MACP',
      ruleId: '6CPC_MACP_FIXATION',
    })
  })
})
