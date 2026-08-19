import { EVENT_TYPES } from '../../../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../../../domain/events/fixationOptions'
import { validate7CpcPayState } from '../../../domain/pay/payStateValidation'
import { calculateSeventhCpcMatrixPlacement } from './matrixFixationFromEventDate'
import { resolveDateOfNextIncrement } from '../dni/resolveDni'
import { calculate7CpcFixationFromLowerPostDni } from './fixationFromLowerPostDni'
import { MACPS_EFFECTIVE_FROM, MACPS_METADATA } from '../../../domain/events/careerProgressionSchemes'
import { resolveSeventhCpcMacpTarget } from '../../../data/pay/macpFinancialHierarchy'

export const SEVENTH_CPC_MACP_RULE_ID = '7CPC_MACP_FIXATION'

function unresolved(reason, errors, before, extra = {}) {
  return {
    success: false,
    status: 'UNRESOLVED',
    ruleId: SEVENTH_CPC_MACP_RULE_ID,
    eventType: EVENT_TYPES.MACP,
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

function normalizeMacpNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const numericValue = Number(value)
  return [1, 2, 3].includes(numericValue) ? numericValue : undefined
}

export function calculate7CpcMacpFixation(payState = {}, event = {}, context = {}) {
  if (event.type !== EVENT_TYPES.MACP) {
    return unresolved('INVALID_EVENT_TYPE', ['A MACP event is required.'], payState)
  }

  const validation = validate7CpcPayState(payState)
  if (!validation.valid) return unresolved('INVALID_PAY_STATE', validation.errors, payState)

  const effectiveDate = event.effectiveDate ?? event.eventDate ?? ''
  if (!isValidDate(effectiveDate)) {
    return unresolved('INVALID_EFFECTIVE_DATE', ['A valid MACP effective date is required.'], payState)
  }
  if (effectiveDate < MACPS_EFFECTIVE_FROM) return unresolved('MACP_NOT_APPLICABLE_ON_EFFECTIVE_DATE', [`MACPS applies from ${MACPS_EFFECTIVE_FROM}; classification uses benefit effectiveDate, not orderDate.`], payState, { effectiveDate, orderDate: event.orderDate ?? null })

  const fixationOption = getFixationOption(event)
  if (![FIXATION_OPTIONS.FROM_EVENT_DATE, FIXATION_OPTIONS.FROM_LOWER_POST_DNI].includes(fixationOption)) {
    return unresolved('UNSUPPORTED_FIXATION_OPTION', ['Fixation option FROM_EVENT_DATE is required.'], payState)
  }

  const macpNumber = normalizeMacpNumber(event.macpNumber)
  if (macpNumber === undefined) {
    return unresolved('INVALID_MACP_NUMBER', ['MACP number must be 1, 2, or 3 when supplied.'], payState)
  }

  const before = {
    ...payState,
    cpc: 7,
    level: String(payState.level),
    cellIndex: Number(payState.cellIndex),
    basicPay: Number(payState.basicPay),
  }
  const targetResolution = resolveSeventhCpcMacpTarget(before, event)
  if (targetResolution.status !== 'RESOLVED') return unresolved(targetResolution.reason, ['Ordinary MACP must use the immediate next controlled Pay Matrix Level.'], before, { targetResolution })
  const resolvedEvent = { ...event, targetLevel: targetResolution.targetLevel }

  if (fixationOption === FIXATION_OPTIONS.FROM_LOWER_POST_DNI) {
    const result = calculate7CpcFixationFromLowerPostDni({
      payState: before, event: resolvedEvent, context,
      ruleId: '7CPC_MACP_FROM_DNI',
      semantics: { reachedBy: 'MACP', macpNumber },
    })
    return { ...result, scheme: 'MACPS', schemeMetadata: MACPS_METADATA, targetResolution, careerEffect: 'NONE', financialProgressionEffect: 'MACP' }
  }

  const placement = calculateSeventhCpcMatrixPlacement(before, resolvedEvent.targetLevel)
  if (!placement.success) {
    const messages = {
      MISSING_TARGET_LEVEL: 'A confirmed target Level is required.',
      INVALID_TARGET_LEVEL: `Target Level ${event.targetLevel} does not exist in the Pay Matrix.`,
      SAME_LEVEL_TARGET: 'The MACP target Level must be higher than the current Level.',
      LOWER_LEVEL_TARGET: 'The MACP target Level cannot be lower than the current Level.',
      NO_CURRENT_LEVEL_INCREMENT_CELL: `No next Cell is available in current Level ${payState.level}.`,
      NO_SUITABLE_TARGET_CELL: `No equal or higher Cell exists in target Level ${placement.targetLevel} for ₹${placement.referenceAmount?.toLocaleString('en-IN')}.`,
    }
    return unresolved(placement.reason, [messages[placement.reason]], payState)
  }

  const dniDecision = resolveDateOfNextIncrement({ payState: before, triggeringEvent: event, eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context })
  const after = {
    cpc: 7,
    effectiveFrom: effectiveDate,
    level: placement.targetLevel,
    cellIndex: placement.targetLookup.cell.index,
    basicPay: placement.targetLookup.cell.value,
    reachedBy: 'MACP',
    macpNumber,
    dni: dniDecision.status === 'RESOLVED' ? dniDecision.date : { status: 'UNRESOLVED', reason: dniDecision.reason },
    dniDecision,
  }

  return {
    success: true,
    status: 'CALCULATED',
    eventId: event.id ?? event.eventId ?? null,
    eventType: EVENT_TYPES.MACP,
    scheme: 'MACPS',
    schemeMetadata: MACPS_METADATA,
    targetResolution,
    careerEffect: 'NONE',
    financialProgressionEffect: 'MACP',
    reachedBy: 'MACP',
    macpNumber,
    ruleId: SEVENTH_CPC_MACP_RULE_ID,
    before,
    sourceLevel: before.level,
    sourceCell: { index: before.cellIndex, value: before.basicPay },
    currentLevelIncrement: {
      fromCell: { index: before.cellIndex, value: before.basicPay },
      toCell: { ...placement.currentLevelIncrementCell },
    },
    referenceAmount: placement.referenceAmount,
    targetLevel: placement.targetLevel,
    targetLookup: {
      method: placement.targetLookup.method,
      searchedLevel: placement.targetLevel,
      referenceAmount: placement.referenceAmount,
    },
    selectedTargetCell: { ...placement.targetLookup.cell },
    after,
    dniStatus: dniDecision.status,
    dniDecision,
    steps: [
      { operation: 'GRANT_ONE_MACP_INCREMENT_IN_CURRENT_LEVEL', level: before.level, fromCell: before.cellIndex, toCell: placement.currentLevelIncrementCell.index, result: placement.referenceAmount },
      { operation: placement.targetLookup.method === 'EXACT_CELL' ? 'SELECT_EXACT_CELL_IN_MACP_TARGET_LEVEL' : 'SELECT_NEXT_HIGHER_CELL_IN_MACP_TARGET_LEVEL', level: placement.targetLevel, referenceAmount: placement.referenceAmount, result: { ...placement.targetLookup.cell }, reachedBy: 'MACP' },
      { operation: 'RESOLVE_POST_MACP_DNI', result: dniDecision },
    ],
    explanation: `On grant of${macpNumber ? ` MACP ${macpNumber}` : ' MACP'}, one increment was granted in the existing Level and pay was placed at the ${placement.targetLookup.method === 'EXACT_CELL' ? 'equal' : 'next higher'} Cell in the upgraded Level ${placement.targetLevel}.`,
  }
}
