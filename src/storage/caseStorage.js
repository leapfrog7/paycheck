import { normalizeCaseInput } from '../features/cases/models/payCase'

const CASE_STORAGE_KEY = 'paycheck:cases'

function readCasesFromStorage() {
  try {
    const rawValue = localStorage.getItem(CASE_STORAGE_KEY)
    if (!rawValue) {
      return []
    }

    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed.map((caseItem) => normalizeCaseInput(caseItem)) : []
  } catch (error) {
    console.warn('Failed to read PayCheck cases from storage:', error)
    return []
  }
}

function writeCasesToStorage(cases) {
  try {
    localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(cases))
    return true
  } catch (error) {
    console.warn('Failed to write PayCheck cases to storage:', error)
    return false
  }
}

export function createCase(caseInput) {
  const normalized = normalizeCaseInput(caseInput)
  const existingCases = readCasesFromStorage()
  const nextCase = { ...normalized, id: normalized.id || crypto.randomUUID() }

  const updatedCases = [nextCase, ...existingCases]
  writeCasesToStorage(updatedCases)
  return nextCase
}

export function getCase(caseId) {
  const cases = readCasesFromStorage()
  return cases.find((caseItem) => caseItem.id === caseId) ?? null
}

export function getCases() {
  return readCasesFromStorage()
}

export function updateCase(caseId, updates) {
  const cases = readCasesFromStorage()
  const index = cases.findIndex((caseItem) => caseItem.id === caseId)

  if (index === -1) {
    return null
  }

  const merged = normalizeCaseInput({
    ...cases[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  })

  cases[index] = merged
  writeCasesToStorage(cases)
  return merged
}

export function deleteCase(caseId) {
  const cases = readCasesFromStorage()
  const filteredCases = cases.filter((caseItem) => caseItem.id !== caseId)
  writeCasesToStorage(filteredCases)
  return filteredCases
}
