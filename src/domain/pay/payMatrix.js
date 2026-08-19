import { SEVENTH_CPC_PAY_MATRIX } from '../../data/pay/7cpcPayMatrix'

export function getPayMatrixLevel(level) {
  const levelKey = String(level)
  const levelData = SEVENTH_CPC_PAY_MATRIX[levelKey]

  if (!levelData) {
    return null
  }

  return {
    level: levelKey,
    cells: levelData.map((cell) => ({ ...cell })),
  }
}

export function getCellsForLevel(level) {
  return getPayMatrixLevel(level)?.cells ?? []
}

export function getCell(level, cellIndex) {
  const numericIndex = Number(cellIndex)
  const cells = getCellsForLevel(level)

  if (!Number.isInteger(numericIndex) || numericIndex < 1) {
    return null
  }

  return cells.find((cell) => cell.index === numericIndex) ?? null
}

export function findCellByBasicPay(level, basicPay) {
  const numericValue = Number(basicPay)
  const cells = getCellsForLevel(level)

  if (!Number.isFinite(numericValue)) {
    return null
  }

  return cells.find((cell) => cell.value === numericValue) ?? null
}

export function isValidBasicPayForLevel(level, basicPay) {
  return Boolean(findCellByBasicPay(level, basicPay))
}

export function getNextCell(level, cellIndex) {
  const currentCell = getCell(level, cellIndex)

  if (!currentCell) {
    return null
  }

  const nextCell = getCell(level, currentCell.index + 1)
  return nextCell ?? null
}

export function findEqualOrNextHigherCell(level, amount) {
  const numericAmount = Number(amount)

  if (!Number.isFinite(numericAmount)) {
    return null
  }

  return getCellsForLevel(level).find((cell) => cell.value >= numericAmount) ?? null
}

export function comparePayMatrixLevels(firstLevel, secondLevel) {
  const levels = Object.keys(SEVENTH_CPC_PAY_MATRIX)
  const firstIndex = levels.indexOf(String(firstLevel))
  const secondIndex = levels.indexOf(String(secondLevel))

  if (firstIndex === -1 || secondIndex === -1) {
    return null
  }

  return firstIndex - secondIndex
}
