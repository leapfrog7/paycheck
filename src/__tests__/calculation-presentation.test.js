import { describe, expect, it } from 'vitest'
import {
  componentName,
  explainCalculationReason,
  explainDueMonth,
} from '../features/cases/models/calculationPresentation'

describe('calculation presentation', () => {
  it('translates allowance reasons into an action and plain-language guidance', () => {
    expect(explainCalculationReason('MISSING_HRA_ELIGIBILITY')).toEqual({
      code: 'MISSING_HRA_ELIGIBILITY',
      title: 'Confirm HRA eligibility',
      message: 'Tell PayCheck whether HRA applied during this period.',
      actionStep: 'allowances',
    })
  })

  it('translates unresolved due components without exposing the raw code as the message', () => {
    const explanation = explainCalculationReason('DUE_COMPONENT_UNRESOLVED:TRANSPORT_ALLOWANCE')

    expect(explanation.title).toBe('Complete Transport Allowance')
    expect(explanation.message).toContain('needs more information')
    expect(explanation.message).not.toContain('DUE_COMPONENT_UNRESOLVED')
  })

  it('routes unresolved events and increment-date checks to career changes', () => {
    expect(explainCalculationReason('DUE_EVENT_UNRESOLVED:event-1').actionStep).toBe('events')
    expect(explainCalculationReason('POST_PROMOTION_DNI_NOT_IMPLEMENTED')).toMatchObject({
      title: 'Confirm the next increment date',
      actionStep: 'events',
    })
  })

  it('prioritizes the most actionable monthly issue', () => {
    expect(explainDueMonth({
      reason: 'UNRESOLVED_FINANCIAL_COMPONENTS',
      unresolvedEventIds: ['event-1'],
      unresolvedComponents: ['HRA'],
    }).actionStep).toBe('events')

    expect(explainDueMonth({
      reason: 'UNRESOLVED_FINANCIAL_COMPONENTS',
      unresolvedEventIds: [],
      unresolvedComponents: ['HRA'],
    }).title).toBe('Complete House Rent Allowance')
  })

  it('keeps unknown engine codes out of the primary message', () => {
    const explanation = explainCalculationReason('NEW_ENGINE_REASON')

    expect(explanation.message).not.toContain('NEW_ENGINE_REASON')
    expect(componentName('BASIC_PAY')).toBe('Basic Pay')
  })
})
