import { describe, expect, it } from 'vitest'
import { createAcpEligibilityDecision } from '../domain/events/acpEligibility'
import { getCareerProgressionSchemeForDate } from '../domain/events/careerProgressionSchemes'
import { deriveFinancialProgressions } from '../domain/events/financialProgressionHistory'
import { EVENT_TYPES } from '../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../domain/events/fixationOptions'
import { getFifthCpcScale } from '../data/pay/5cpcPayScales'
import { getNextSixthCpcMacpStructure, getNextSeventhCpcMacpLevel } from '../data/pay/macpFinancialHierarchy'
import { calculate5CpcAcp } from '../engines/pay/5cpc/acp'
import { calculate6CpcMacpFixation } from '../engines/pay/6cpc/macpFixation'
import { calculate7CpcMacpFixation } from '../engines/pay/7cpc/macpFixation'
import { calculatePayEventTimeline } from '../engines/pay/eventTimeline'

const confirmedAcp1 = createAcpEligibilityDecision({ acpNumber: 1, status: 'CONFIRMED_EXTERNALLY', schemeApplicabilityStatus: 'CONFIRMED_EXTERNALLY', source: 'OFFICE_ORDER' })

function fifthState() {
  return { cpc: 5, payScaleId: 'S5_S12', payScaleLabel: getFifthCpcScale('S5_S12').label, stageIndex: 3, basicPay: 6900, dni: '2008-07-01' }
}

function sixthState(overrides = {}) {
  return { cpc: 6, payBand: 'PB-2', payInBand: 13500, gradePay: 4200, basicPay: 17700, dni: '2009-07-01', ...overrides }
}

function seventhState(overrides = {}) {
  return { cpc: 7, level: '4', cellIndex: 6, basicPay: 29600, dni: '2020-07-01', ...overrides }
}

describe('ACP to MACPS scheme lifecycle', () => {
  it('classifies the verified boundary by benefit effective date', () => {
    expect(getCareerProgressionSchemeForDate('2008-08-31')).toMatchObject({ status: 'RESOLVED', scheme: 'ACP_1999', basis: 'BENEFIT_EFFECTIVE_DATE' })
    expect(getCareerProgressionSchemeForDate('2008-09-01')).toMatchObject({ status: 'RESOLVED', scheme: 'MACPS', basis: 'BENEFIT_EFFECTIVE_DATE' })
  })

  it('keeps a late ACP order classified by its pre-cutoff effective date', () => {
    const result = calculate5CpcAcp(fifthState(), {
      id: 'late-order-acp', type: EVENT_TYPES.ACP, acpNumber: 1,
      effectiveDate: '2008-08-31', orderDate: '2010-01-15',
      targetPayScaleId: 'S5_S15', targetHierarchySource: 'OFFICE_ORDER',
      eligibilityDecision: confirmedAcp1, fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE,
    })
    expect(result).toMatchObject({ success: true, scheme: 'ACP_1999', effectiveDate: '2008-08-31', targetScale: { id: 'S5_S15' }, after: { payScaleId: 'S5_S15' } })
  })

  it('rejects normal ACP after cessation regardless of a late-order marker', () => {
    const result = calculate5CpcAcp(fifthState(), {
      type: EVENT_TYPES.ACP, acpNumber: 1, effectiveDate: '2008-09-01', orderDate: '2010-01-15',
      targetPayScaleId: 'S5_S15', eligibilityDecision: confirmedAcp1, fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE,
    })
    expect(result).toMatchObject({ success: false, reason: 'ACP_NOT_APPLICABLE_ON_EFFECTIVE_DATE', effectiveDate: '2008-09-01', orderDate: '2010-01-15' })
  })

  it('uses an explicitly confirmed non-adjacent promotional hierarchy for ACP', () => {
    const result = calculate5CpcAcp(fifthState(), {
      type: EVENT_TYPES.ACP, acpNumber: 1, effectiveDate: '2008-08-01',
      targetPayScaleId: 'S5_S15', targetHierarchySource: 'CADRE_HIERARCHY_RECORD',
      eligibilityDecision: confirmedAcp1, fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE,
    })
    expect(result).toMatchObject({ success: true, targetScale: { id: 'S5_S15' }, selectedTargetStage: { value: 8000 }, targetHierarchySource: 'CADRE_HIERARCHY_RECORD', careerEffect: 'NONE' })
    expect(result.after.payScaleId).not.toBe('S5_S13')
  })
})

describe('controlled immediate MACP financial hierarchy', () => {
  it('resolves the immediate 6th CPC structure and derives it when target is omitted', () => {
    expect(getNextSixthCpcMacpStructure(sixthState())).toEqual({ payBand: 'PB-2', gradePay: 4600 })
    const result = calculate6CpcMacpFixation(sixthState(), { type: EVENT_TYPES.MACP, macpNumber: 1, effectiveDate: '2009-09-01', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE })
    expect(result).toMatchObject({ success: true, scheme: 'MACPS', targetPayBand: 'PB-2', targetGradePay: 4600, targetResolution: { provenance: 'CONTROLLED_MACPS_HIERARCHY' }, careerEffect: 'NONE', financialProgressionEffect: 'MACP' })
  })

  it('rejects a 6th CPC promotional-hierarchy jump', () => {
    const result = calculate6CpcMacpFixation(sixthState(), { type: EVENT_TYPES.MACP, macpNumber: 1, effectiveDate: '2009-09-01', targetPayBand: 'PB-3', targetGradePay: 5400, fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE })
    expect(result).toMatchObject({ success: false, reason: 'MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_STRUCTURE', targetResolution: { expectedTarget: { payBand: 'PB-2', gradePay: 4600 } } })
  })

  it('advances exactly one 7th CPC Level and rejects a Level skip', () => {
    expect(getNextSeventhCpcMacpLevel('4')).toBe('5')
    expect(calculate7CpcMacpFixation(seventhState(), { type: EVENT_TYPES.MACP, macpNumber: 1, effectiveDate: '2020-06-01', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE })).toMatchObject({ success: true, scheme: 'MACPS', targetLevel: '5', targetResolution: { provenance: 'CONTROLLED_MACPS_HIERARCHY' } })
    expect(calculate7CpcMacpFixation(seventhState(), { type: EVENT_TYPES.MACP, macpNumber: 1, effectiveDate: '2020-06-01', targetLevel: '6', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE })).toMatchObject({ success: false, reason: 'MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_LEVEL', targetResolution: { expectedTargetLevel: '5' } })
  })

  it('rejects MACP before its verified commencement date', () => {
    expect(calculate6CpcMacpFixation(sixthState(), { type: EVENT_TYPES.MACP, macpNumber: 1, effectiveDate: '2008-08-31', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE })).toMatchObject({ success: false, reason: 'MACP_NOT_APPLICABLE_ON_EFFECTIVE_DATE' })
    expect(calculate6CpcMacpFixation(sixthState(), { type: EVENT_TYPES.MACP, macpNumber: 1, effectiveDate: '2008-09-01', fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE })).toMatchObject({ success: true, scheme: 'MACPS' })
  })
})

describe('financial-progression history abstraction', () => {
  it('derives separate ACP and MACP provenance without synthesizing a scheme-transition pay event', () => {
    const acpEvent = { id: 'acp-1', type: EVENT_TYPES.ACP, acpNumber: 1, effectiveDate: '2005-06-01', targetPayScaleId: 'S5_S13', eligibilityDecision: confirmedAcp1, fixationOption: FIXATION_OPTIONS.FROM_EVENT_DATE }
    const acpTimeline = calculatePayEventTimeline({ ...fifthState(), dni: '2005-07-01' }, [acpEvent])
    const macpEntry = {
      event: { id: 'macp-2', type: EVENT_TYPES.MACP, macpNumber: 2, effectiveDate: '2014-06-01' },
      result: { success: true, scheme: 'MACPS', eventType: 'MACP', macpNumber: 2, after: { cpc: 6, effectiveFrom: '2014-06-01', payBand: 'PB-2', gradePay: 4600, basicPay: 18640 } },
    }
    const progressions = deriveFinancialProgressions([...acpTimeline.entries, macpEntry])
    expect(progressions).toEqual([
      { eventId: 'acp-1', eventType: 'ACP', scheme: 'ACP_1999', number: 1, effectiveDate: '2005-06-01', reachedStructure: { cpc: 5, payScaleId: 'S5_S13' } },
      { eventId: 'macp-2', eventType: 'MACP', scheme: 'MACPS', number: 2, effectiveDate: '2014-06-01', reachedStructure: { cpc: 6, payBand: 'PB-2', gradePay: 4600 } },
    ])
    expect(progressions.some(({ eventType }) => eventType === 'ACP_TO_MACP_TRANSITION')).toBe(false)
  })
})
