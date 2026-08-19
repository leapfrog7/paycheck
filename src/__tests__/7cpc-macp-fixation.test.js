import { describe, expect, it } from 'vitest'
import { SEVENTH_CPC_PAY_MATRIX } from '../data/pay/7cpcPayMatrix'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { applyPayEvent } from '../engines/pay/applyPayEvent'
import { calculate7CpcMacpFixation } from '../engines/pay/7cpc/macpFixation'
import { selectSeventhCpcTargetCell } from '../engines/pay/7cpc/matrixFixationFromEventDate'

function sourceState(overrides = {}) {
  return {
    cpc: 7,
    level: '6',
    cellIndex: 6,
    basicPay: 41100,
    dni: '2020-07-01',
    ...overrides,
  }
}

function macpEvent(overrides = {}) {
  return {
    id: 'macp-7-event-1',
    type: EVENT_TYPES.MACP,
    effectiveDate: '2020-06-01',
    macpNumber: 1,
    targetLevel: '7',
    fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE,
    ...overrides,
  }
}

describe('7CPC_MACP_FIXATION', () => {
  it('fixes Level 6 ₹41,100 at Level 7 ₹44,900', () => {
    const result = calculate7CpcMacpFixation(sourceState(), macpEvent())

    expect(result).toMatchObject({
      success: true,
      eventId: 'macp-7-event-1',
      eventType: 'MACP',
      reachedBy: 'MACP',
      macpNumber: 1,
      ruleId: '7CPC_MACP_FIXATION',
      sourceLevel: '6',
      sourceCell: { index: 6, value: 41100 },
      currentLevelIncrement: {
        fromCell: { index: 6, value: 41100 },
        toCell: { index: 7, value: 42300 },
      },
      referenceAmount: 42300,
      targetLevel: '7',
      targetLookup: { method: 'NEXT_HIGHER_CELL', searchedLevel: '7' },
      selectedTargetCell: { index: 1, value: 44900 },
      after: {
        cpc: 7,
        effectiveFrom: '2020-06-01',
        level: '7',
        cellIndex: 1,
        basicPay: 44900,
        reachedBy: 'MACP',
        macpNumber: 1,
        dni: '2021-01-01',
      },
    })
  })

  it('moves exactly one Cell in the current Level before target lookup', () => {
    const result = calculate7CpcMacpFixation(sourceState(), macpEvent())
    expect(result.currentLevelIncrement.fromCell.index).toBe(6)
    expect(result.currentLevelIncrement.toCell.index).toBe(7)
    expect(result.referenceAmount).toBe(result.currentLevelIncrement.toCell.value)
  })

  it('uses an exact target-Level Cell match', () => {
    const result = calculate7CpcMacpFixation(
      sourceState({ cellIndex: 9, basicPay: 44900 }),
      macpEvent(),
    )
    expect(result.referenceAmount).toBe(46200)
    expect(result.targetLookup.method).toBe('EXACT_CELL')
    expect(result.selectedTargetCell).toEqual({ index: 2, value: 46200 })
  })

  it('uses the immediate next higher target-Level Cell', () => {
    const result = calculate7CpcMacpFixation(sourceState(), macpEvent())
    expect(result.targetLookup.method).toBe('NEXT_HIGHER_CELL')
    expect(result.selectedTargetCell.value).toBe(44900)
  })

  it('retains MACP identity, provenance, and number', () => {
    const result = calculate7CpcMacpFixation(sourceState(), macpEvent({ macpNumber: 3 }))
    expect(result.eventType).toBe(EVENT_TYPES.MACP)
    expect(result.reachedBy).toBe('MACP')
    expect(result.macpNumber).toBe(3)
    expect(result.after.reachedBy).toBe('MACP')
    expect(result.ruleId).not.toContain('PROMOTION')
  })

  it('derives a missing target and rejects non-immediate supplied Levels', () => {
    expect(calculate7CpcMacpFixation(sourceState(), macpEvent({ targetLevel: '' }))).toMatchObject({ success: true, targetLevel: '7', targetResolution: { provenance: 'CONTROLLED_MACPS_HIERARCHY' } })
    expect(calculate7CpcMacpFixation(sourceState(), macpEvent({ targetLevel: '99' })).reason).toBe('MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_LEVEL')
    expect(calculate7CpcMacpFixation(sourceState(), macpEvent({ targetLevel: '6' })).reason).toBe('MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_LEVEL')
    expect(calculate7CpcMacpFixation(sourceState(), macpEvent({ targetLevel: '5' })).reason).toBe('MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_LEVEL')
  })

  it('rejects invalid MACP numbers while allowing an omitted number', () => {
    expect(calculate7CpcMacpFixation(sourceState(), macpEvent({ macpNumber: 4 })).reason).toBe('INVALID_MACP_NUMBER')
    expect(calculate7CpcMacpFixation(sourceState(), macpEvent({ macpNumber: null })).macpNumber).toBeNull()
  })

  it('returns unresolved at the final Cell in the current Level', () => {
    const result = calculate7CpcMacpFixation(
      sourceState({ cellIndex: 40, basicPay: 112400 }),
      macpEvent(),
    )
    expect(result).toMatchObject({ success: false, status: 'UNRESOLVED', reason: 'NO_CURRENT_LEVEL_INCREMENT_CELL' })
  })

  it('guards target lookup when no suitable target Cell exists', () => {
    expect(selectSeventhCpcTargetCell('17', 225001)).toBeNull()
  })

  it('implements fixation from lower-post DNI while retaining MACP identity', () => {
    const result = calculate7CpcMacpFixation(
      sourceState(),
      macpEvent({ fixationOption: FIXATION_OPTIONS.FROM_LOWER_POST_DNI }),
    )
    expect(result).toMatchObject({
      success: true,
      ruleId: '7CPC_MACP_FROM_DNI',
      reachedBy: 'MACP',
      macpNumber: 1,
      interim: { stateType: 'INTERIM_PAY_STATE' },
      finalFixation: { stateType: 'FINAL_FIXATION_STATE' },
    })
  })

  it('resolves post-MACP DNI through the shared Rule 10 engine', () => {
    const result = calculate7CpcMacpFixation(sourceState(), macpEvent())
    expect(result.after.dni).toBe('2021-01-01')
    expect(result.dniDecision).toMatchObject({ status: 'RESOLVED', date: '2021-01-01', ruleId: '7CPC_RULE10_DNI' })
    expect(result.after.dni).not.toBe(result.before.dni)
  })

  it('rejects non-7th-CPC and invalid current states', () => {
    expect(calculate7CpcMacpFixation(sourceState({ cpc: 6 }), macpEvent()).reason).toBe('INVALID_PAY_STATE')
    expect(calculate7CpcMacpFixation(sourceState({ basicPay: 42000 }), macpEvent()).reason).toBe('INVALID_PAY_STATE')
    expect(calculate7CpcMacpFixation(sourceState(), macpEvent({ effectiveDate: '' })).reason).toBe('INVALID_EFFECTIVE_DATE')
  })

  it('is integrated into the dispatcher independently from promotion', () => {
    const result = applyPayEvent(sourceState(), macpEvent())
    expect(result).toMatchObject({ success: true, eventType: 'MACP', reachedBy: 'MACP', ruleId: '7CPC_MACP_FIXATION' })
  })

  it('does not mutate the authoritative Pay Matrix', () => {
    const before = structuredClone(SEVENTH_CPC_PAY_MATRIX)
    calculate7CpcMacpFixation(sourceState(), macpEvent())
    calculate7CpcMacpFixation(sourceState({ cellIndex: 9, basicPay: 44900 }), macpEvent())
    expect(SEVENTH_CPC_PAY_MATRIX).toEqual(before)
  })
})
