import { validate7CpcPayState } from '../../../domain/pay/payStateValidation'
import { getNextCell } from '../../../domain/pay/payMatrix'
import { resolveDateOfNextIncrement } from '../dni/resolveDni'

export function calculate7CpcAnnualIncrement(payState = {}, event = {}, context = {}) {
  if (payState.structuralStatus === 'NON_STANDARD_CONFIRMED') {
    return {
      success: false, status: 'UNRESOLVED', ruleId: '7CPC_ANNUAL_INCREMENT',
      reason: 'NON_STANDARD_PAY_STATE_REQUIRES_REFIXATION',
      errors: ['A valid Pay Matrix Cell is required before a vertical 7th CPC increment can be calculated.'],
      before: { ...payState },
    }
  }
  const validation = validate7CpcPayState(payState)
  const errors = [...(validation.errors ?? [])]

  if (!event || !event.eventDate && !event.effectiveDate) {
    errors.push('Annual increment event date is required.')
  }

  const effectiveDate = event?.effectiveDate ?? event?.eventDate ?? ''
  if (errors.length > 0) {
    return {
      success: false,
      ruleId: '7CPC_ANNUAL_INCREMENT',
      errors,
      reason: errors.some((message) => message.includes('DNI mismatch')) ? 'DNI_MISMATCH' : 'INVALID_PAY_STATE',
    }
  }

  const currentCellIndex = Number(payState.cellIndex)
  const nextCell = getNextCell(payState.level, currentCellIndex)

  if (!nextCell) {
    return {
      success: false,
      ruleId: '7CPC_ANNUAL_INCREMENT',
      reason: 'NO_NEXT_CELL_AVAILABLE',
      errors: [`No next cell is available for Level ${payState.level}.`],
    }
  }

  const dniDecision = resolveDateOfNextIncrement({ payState, triggeringEvent: { ...event, type: 'ANNUAL_INCREMENT' }, eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context })
  if (dniDecision.status !== 'RESOLVED') {
    return {
      success: false,
      status: 'UNRESOLVED',
      ruleId: '7CPC_ANNUAL_INCREMENT',
      reason: dniDecision.reason === 'INCREMENT_DATE_DOES_NOT_MATCH_DNI' ? 'DNI_MISMATCH' : dniDecision.reason,
      errors: [dniDecision.explanation],
      dniDecision,
    }
  }

  const after = {
    cpc: 7,
    level: String(payState.level),
    cellIndex: nextCell.index,
    basicPay: nextCell.value,
    dni: dniDecision.date,
    dniDecision,
  }

  return {
    success: true,
    eventId: event.eventId ?? crypto.randomUUID(),
    ruleId: '7CPC_ANNUAL_INCREMENT',
    before: {
      cpc: 7,
      level: String(payState.level),
      cellIndex: currentCellIndex,
      basicPay: Number(payState.basicPay),
      dni: payState.dni ?? effectiveDate,
    },
    steps: [
      {
        operation: 'MOVE_TO_NEXT_CELL',
        fromCellIndex: currentCellIndex,
        toCellIndex: nextCell.index,
        fromBasicPay: Number(payState.basicPay),
        toBasicPay: nextCell.value,
      },
    ],
    after,
    dniDecision,
    explanation: `Annual increment moved pay from Cell ${currentCellIndex} to Cell ${nextCell.index} within Level ${payState.level}.`,
  }
}
