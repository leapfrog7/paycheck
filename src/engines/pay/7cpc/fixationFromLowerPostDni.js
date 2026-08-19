import { readDniDecision } from '../../../domain/pay/dni/dniDecision'
import { createMultiStagePayTransformation } from '../../../domain/pay/multiStageTransformation'
import { comparePayMatrixLevels, getNextCell, getPayMatrixLevel } from '../../../domain/pay/payMatrix'
import { resolveDateOfNextIncrement } from '../dni/resolveDni'
import { selectSeventhCpcTargetCell } from './matrixFixationFromEventDate'

function unresolved(reason, message, before, extra = {}) {
  return { success: false, status: 'UNRESOLVED', reason, errors: [message], before: { ...before }, ...extra }
}

export function calculate7CpcFixationFromLowerPostDni({ payState, event, context = {}, ruleId, semantics }) {
  const lowerDniDecision = readDniDecision(payState)
  if (!lowerDniDecision || lowerDniDecision.status !== 'RESOLVED') return unresolved('LOWER_POST_DNI_NOT_RESOLVED', 'A resolved lower-post DNI is required.', payState)
  const lowerPostDni = lowerDniDecision.date
  const eventDate = event.effectiveDate ?? event.eventDate ?? ''
  if (eventDate >= lowerPostDni) return unresolved('EVENT_DATE_NOT_BEFORE_LOWER_POST_DNI', 'The promotion or MACP date must be strictly before the resolved lower-post DNI.', payState, { lowerPostDni })

  const targetLevel = getPayMatrixLevel(event.targetLevel)
  const comparison = targetLevel ? comparePayMatrixLevels(targetLevel.level, payState.level) : null
  if (!targetLevel) return unresolved('INVALID_TARGET_LEVEL', 'A valid target Level is required.', payState)
  if (comparison === 0) return unresolved('SAME_LEVEL_TARGET', 'The target Level must be higher than the lower Level.', payState)
  if (comparison < 0) return unresolved('LOWER_LEVEL_TARGET', 'The target Level cannot be lower than the lower Level.', payState)

  const interimLookup = selectSeventhCpcTargetCell(targetLevel.level, payState.basicPay)
  if (!interimLookup) return unresolved('NO_SUITABLE_TARGET_CELL', 'No equal or higher interim Cell exists in the target Level.', payState)
  const firstLowerCell = getNextCell(payState.level, payState.cellIndex)
  const secondLowerCell = firstLowerCell && getNextCell(payState.level, firstLowerCell.index)
  if (!firstLowerCell || !secondLowerCell) return unresolved('INSUFFICIENT_LOWER_LEVEL_CELLS_FOR_DNI_FIXATION', 'Two lower-Level Cell movements are required for fixation from lower-post DNI.', payState)
  const finalLookup = selectSeventhCpcTargetCell(targetLevel.level, secondLowerCell.value)
  if (!finalLookup) return unresolved('NO_SUITABLE_TARGET_CELL', 'No equal or higher final Cell exists in the target Level.', payState)

  const interimPayState = {
    cpc: 7, effectiveFrom: eventDate, level: targetLevel.level,
    cellIndex: interimLookup.cell.index, basicPay: interimLookup.cell.value,
    dni: lowerPostDni, dniDecision: lowerDniDecision,
    ...(semantics.reachedBy ? { reachedBy: semantics.reachedBy } : {}),
    ...(semantics.macpNumber != null ? { macpNumber: semantics.macpNumber } : {}),
  }
  const dniDecision = resolveDateOfNextIncrement({
    payState: { ...payState, effectiveFrom: lowerPostDni },
    triggeringEvent: { ...event, type: 'FIXATION_FROM_LOWER_POST_DNI', fixationDate: lowerPostDni },
    eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context,
  })
  const finalPayState = {
    cpc: 7, effectiveFrom: lowerPostDni, level: targetLevel.level,
    cellIndex: finalLookup.cell.index, basicPay: finalLookup.cell.value,
    dni: dniDecision.status === 'RESOLVED' ? dniDecision.date : { status: 'UNRESOLVED', reason: dniDecision.reason },
    dniDecision,
    ...(semantics.reachedBy ? { reachedBy: semantics.reachedBy } : {}),
    ...(semantics.macpNumber != null ? { macpNumber: semantics.macpNumber } : {}),
  }
  const result = createMultiStagePayTransformation({
    event, ruleId, before: payState, lowerPostDni, interimPayState,
    interimSteps: [{ operation: interimLookup.method === 'EXACT_CELL' ? 'SELECT_EXACT_INTERIM_TARGET_CELL' : 'SELECT_NEXT_HIGHER_INTERIM_TARGET_CELL', referenceAmount: payState.basicPay, result: interimLookup.cell }],
    finalPayState,
    finalSteps: [
      { operation: 'GRANT_LOWER_POST_ANNUAL_INCREMENT', fromCell: payState.cellIndex, toCell: firstLowerCell.index, result: firstLowerCell.value },
      { operation: 'GRANT_PROMOTION_OR_MACP_INCREMENT', fromCell: firstLowerCell.index, toCell: secondLowerCell.index, result: secondLowerCell.value },
      { operation: finalLookup.method === 'EXACT_CELL' ? 'SELECT_EXACT_FINAL_TARGET_CELL' : 'SELECT_NEXT_HIGHER_FINAL_TARGET_CELL', referenceAmount: secondLowerCell.value, result: finalLookup.cell },
    ],
    dniDecision, semantics,
  })
  return { ...result, interimLookup, firstLowerCell, secondLowerCell, finalLookup, finalBasicPay: finalLookup.cell.value }
}
