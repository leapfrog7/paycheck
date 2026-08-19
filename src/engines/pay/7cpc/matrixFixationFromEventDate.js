import {
  comparePayMatrixLevels,
  findEqualOrNextHigherCell,
  getNextCell,
  getPayMatrixLevel,
} from '../../../domain/pay/payMatrix'

export function selectSeventhCpcTargetCell(targetLevel, referenceAmount) {
  const selectedCell = findEqualOrNextHigherCell(targetLevel, referenceAmount)

  if (!selectedCell) return null

  return {
    method: selectedCell.value === Number(referenceAmount) ? 'EXACT_CELL' : 'NEXT_HIGHER_CELL',
    cell: selectedCell,
  }
}

export function calculateSeventhCpcMatrixPlacement(payState, targetLevelValue) {
  if (targetLevelValue === '' || targetLevelValue === null || targetLevelValue === undefined) {
    return { success: false, reason: 'MISSING_TARGET_LEVEL' }
  }

  const targetLevel = getPayMatrixLevel(targetLevelValue)
  if (!targetLevel) return { success: false, reason: 'INVALID_TARGET_LEVEL' }

  const levelComparison = comparePayMatrixLevels(targetLevel.level, payState.level)
  if (levelComparison === 0) return { success: false, reason: 'SAME_LEVEL_TARGET' }
  if (levelComparison < 0) return { success: false, reason: 'LOWER_LEVEL_TARGET' }

  const currentLevelIncrementCell = getNextCell(payState.level, payState.cellIndex)
  if (!currentLevelIncrementCell) {
    return { success: false, reason: 'NO_CURRENT_LEVEL_INCREMENT_CELL' }
  }

  const referenceAmount = currentLevelIncrementCell.value
  const targetLookup = selectSeventhCpcTargetCell(targetLevel.level, referenceAmount)
  if (!targetLookup) return { success: false, reason: 'NO_SUITABLE_TARGET_CELL', referenceAmount, targetLevel: targetLevel.level }

  return {
    success: true,
    targetLevel: targetLevel.level,
    currentLevelIncrementCell,
    referenceAmount,
    targetLookup,
  }
}
