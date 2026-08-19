import { EVENT_TYPES } from '../../../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../../../domain/events/fixationOptions'
import { validate7CpcPayState } from '../../../domain/pay/payStateValidation'
import {
  calculateSeventhCpcMatrixPlacement,
  selectSeventhCpcTargetCell,
} from './matrixFixationFromEventDate'
import { resolveDateOfNextIncrement } from '../dni/resolveDni'
import { calculate7CpcFixationFromLowerPostDni } from './fixationFromLowerPostDni'

export const SEVENTH_CPC_PROMOTION_RULE_ID = '7CPC_PROMOTION_RULE13'

function unresolved(reason, errors, before, extra = {}) {
  return {
    success: false,
    status: 'UNRESOLVED',
    ruleId: SEVENTH_CPC_PROMOTION_RULE_ID,
    reason,
    errors,
    before: { ...before },
    ...extra,
  }
}

function isValidDate(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue ?? '')) return false
  const date = new Date(`${dateValue}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateValue
}

function getFixationOption(event) {
  return event.fixationOption?.selected ?? event.fixationOption
}

export function selectPromotionTargetCell(targetLevel, referenceAmount) {
  return selectSeventhCpcTargetCell(targetLevel, referenceAmount)
}

export function calculate7CpcRegularPromotion(payState = {}, event = {}, context = {}) {
  if (event.type !== EVENT_TYPES.REGULAR_PROMOTION) {
    return unresolved('INVALID_EVENT_TYPE', ['A REGULAR_PROMOTION event is required.'], payState)
  }

  const validation = validate7CpcPayState(payState)
  if (!validation.valid) {
    return unresolved('INVALID_PAY_STATE', validation.errors, payState)
  }

  const effectiveDate = event.effectiveDate ?? event.eventDate ?? ''
  if (!isValidDate(effectiveDate)) {
    return unresolved('INVALID_EFFECTIVE_DATE', ['A valid promotion effective date is required.'], payState)
  }

  const fixationOption = getFixationOption(event)
  if (fixationOption === FIXATION_OPTIONS.FROM_LOWER_POST_DNI) {
    return calculate7CpcFixationFromLowerPostDni({
      payState: { ...payState, cpc: 7, level: String(payState.level), cellIndex: Number(payState.cellIndex), basicPay: Number(payState.basicPay) }, event, context,
      ruleId: '7CPC_PROMOTION_FROM_DNI',
      semantics: { careerEffect: 'PROMOTED' },
    })
  }

  if (fixationOption !== FIXATION_OPTIONS.FROM_EVENT_DATE) {
    return unresolved('UNSUPPORTED_FIXATION_OPTION', ['Fixation option FROM_EVENT_DATE is required for this calculation.'], payState)
  }

  const placement = calculateSeventhCpcMatrixPlacement(payState, event.targetLevel)
  if (!placement.success) {
    const promotionReason = placement.reason === 'NO_CURRENT_LEVEL_INCREMENT_CELL'
      ? 'NO_LOWER_LEVEL_INCREMENT_CELL'
      : placement.reason
    const messages = {
      MISSING_TARGET_LEVEL: 'A confirmed target Level is required.',
      INVALID_TARGET_LEVEL: `Target Level ${event.targetLevel} does not exist in the Pay Matrix.`,
      SAME_LEVEL_TARGET: 'An ordinary promotion target must be higher than the current Level.',
      LOWER_LEVEL_TARGET: 'An ordinary promotion target cannot be lower than the current Level.',
      NO_LOWER_LEVEL_INCREMENT_CELL: `No next Cell is available in current Level ${payState.level}.`,
      NO_SUITABLE_TARGET_CELL: `No equal or higher Cell exists in target Level ${placement.targetLevel} for ₹${placement.referenceAmount?.toLocaleString('en-IN')}.`,
    }
    return unresolved(promotionReason, [messages[promotionReason]], payState)
  }

  const {
    targetLevel,
    currentLevelIncrementCell: lowerLevelIncrementCell,
    referenceAmount,
    targetLookup,
  } = placement

  const before = {
    ...payState,
    cpc: 7,
    level: String(payState.level),
    cellIndex: Number(payState.cellIndex),
    basicPay: Number(payState.basicPay),
  }
  const dniDecision = resolveDateOfNextIncrement({ payState: before, triggeringEvent: event, eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context })
  const after = {
    cpc: 7,
    effectiveFrom: effectiveDate,
    level: targetLevel,
    cellIndex: targetLookup.cell.index,
    basicPay: targetLookup.cell.value,
    dni: dniDecision.status === 'RESOLVED' ? dniDecision.date : { status: 'UNRESOLVED', reason: dniDecision.reason },
    dniDecision,
  }

  return {
    success: true,
    status: 'CALCULATED',
    ruleId: SEVENTH_CPC_PROMOTION_RULE_ID,
    before,
    currentLevel: before.level,
    currentCell: { index: before.cellIndex, value: before.basicPay },
    lowerLevelIncrement: {
      fromCell: { index: before.cellIndex, value: before.basicPay },
      toCell: { ...lowerLevelIncrementCell },
    },
    referenceAmount,
    targetLevel,
    targetLookup: {
      method: targetLookup.method,
      searchedLevel: targetLevel,
      referenceAmount,
    },
    selectedTargetCell: { ...targetLookup.cell },
    after,
    dniStatus: dniDecision.status,
    dniDecision,
    steps: [
      {
        operation: 'GRANT_ONE_INCREMENT_IN_CURRENT_LEVEL',
        level: before.level,
        fromCell: before.cellIndex,
        toCell: lowerLevelIncrementCell.index,
        result: referenceAmount,
      },
      {
        operation: targetLookup.method === 'EXACT_CELL' ? 'SELECT_EXACT_CELL_IN_TARGET_LEVEL' : 'SELECT_NEXT_HIGHER_CELL_IN_TARGET_LEVEL',
        level: targetLevel,
        referenceAmount,
        result: { ...targetLookup.cell },
      },
      {
        operation: 'RESOLVE_POST_PROMOTION_DNI',
        result: dniDecision,
      },
    ],
    explanation: `On promotion, one increment was granted in Level ${before.level} and pay was placed at the ${targetLookup.method === 'EXACT_CELL' ? 'equal' : 'next higher'} Cell in Level ${targetLevel}.`,
  }
}
