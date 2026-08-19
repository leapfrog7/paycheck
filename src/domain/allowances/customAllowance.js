import {
  ALLOWANCE_CALCULATION_TYPES,
  ALLOWANCE_DEFINITION_STATUSES,
  ALLOWANCE_SOURCE_TYPES,
} from './allowanceConstants'
import { isValidCalendarDate } from './allowanceResult'

export const CUSTOM_ALLOWANCE_CALCULATION_TYPES = Object.freeze([
  ALLOWANCE_CALCULATION_TYPES.FIXED_MONTHLY,
  ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC,
  ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC_PLUS_DA,
  ALLOWANCE_CALCULATION_TYPES.MANUAL_MONTHLY_AMOUNT,
])

export function createCustomAllowanceDefinition(overrides = {}) {
  return {
    id: overrides.id ?? '',
    seriesId: overrides.seriesId ?? overrides.allowanceSeriesId ?? '',
    name: overrides.name ?? '',
    sourceType: ALLOWANCE_SOURCE_TYPES.USER_DEFINED,
    calculationType: overrides.calculationType ?? '',
    amount: overrides.amount ?? null,
    rate: overrides.rate ?? null,
    effectiveFrom: overrides.effectiveFrom ?? '',
    effectiveTo: overrides.effectiveTo ?? null,
    status: overrides.status ?? ALLOWANCE_DEFINITION_STATUSES.ACTIVE,
    prorationPolicy: overrides.prorationPolicy ?? null,
    metadata: {
      description: overrides.metadata?.description ?? overrides.description ?? '',
      note: overrides.metadata?.note ?? overrides.note ?? '',
      reference: overrides.metadata?.reference ?? overrides.reference ?? '',
      ...(overrides.metadata ?? {}),
    },
  }
}

export function validateCustomAllowanceDefinition(definition = {}) {
  const errors = []
  if (!definition.id) errors.push({ code: 'MISSING_ID', field: 'id' })
  if (!definition.seriesId) errors.push({ code: 'MISSING_SERIES_ID', field: 'seriesId' })
  if (!definition.name?.trim()) errors.push({ code: 'MISSING_NAME', field: 'name' })
  if (definition.sourceType !== ALLOWANCE_SOURCE_TYPES.USER_DEFINED) errors.push({ code: 'INVALID_SOURCE_TYPE', field: 'sourceType' })
  if (!CUSTOM_ALLOWANCE_CALCULATION_TYPES.includes(definition.calculationType)) errors.push({ code: 'UNSUPPORTED_CALCULATION_TYPE', field: 'calculationType' })
  if (!isValidCalendarDate(definition.effectiveFrom)) errors.push({ code: 'INVALID_EFFECTIVE_FROM', field: 'effectiveFrom' })
  if (definition.effectiveTo !== null && !isValidCalendarDate(definition.effectiveTo)) errors.push({ code: 'INVALID_EFFECTIVE_TO', field: 'effectiveTo' })
  if (isValidCalendarDate(definition.effectiveFrom) && isValidCalendarDate(definition.effectiveTo) && definition.effectiveTo < definition.effectiveFrom) {
    errors.push({ code: 'INVALID_EFFECTIVE_RANGE', field: 'effectiveTo' })
  }

  const amountModes = [ALLOWANCE_CALCULATION_TYPES.FIXED_MONTHLY, ALLOWANCE_CALCULATION_TYPES.MANUAL_MONTHLY_AMOUNT]
  if (amountModes.includes(definition.calculationType) && (definition.amount === null || definition.amount === '' || !Number.isFinite(Number(definition.amount)) || Number(definition.amount) < 0)) {
    errors.push({ code: 'INVALID_AMOUNT', field: 'amount' })
  }
  const rateModes = [ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC, ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC_PLUS_DA]
  if (rateModes.includes(definition.calculationType) && (definition.rate === null || definition.rate === '' || !Number.isFinite(Number(definition.rate)) || Number(definition.rate) < 0)) {
    errors.push({ code: 'INVALID_RATE', field: 'rate' })
  }
  return { valid: errors.length === 0, errors }
}

function rangesOverlap(first, second) {
  const firstEnd = first.effectiveTo ?? '9999-12-31'
  const secondEnd = second.effectiveTo ?? '9999-12-31'
  return first.effectiveFrom <= secondEnd && second.effectiveFrom <= firstEnd
}

export function validateCustomAllowanceDefinitions(definitions = []) {
  const errors = []
  definitions.forEach((definition, index) => {
    const validation = validateCustomAllowanceDefinition(definition)
    validation.errors.forEach((error) => errors.push({ ...error, definitionId: definition.id, index }))
  })
  for (let firstIndex = 0; firstIndex < definitions.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < definitions.length; secondIndex += 1) {
      const first = definitions[firstIndex]
      const second = definitions[secondIndex]
      if (first.seriesId && first.seriesId === second.seriesId && rangesOverlap(first, second)) {
        errors.push({
          code: 'CUSTOM_ALLOWANCE_DATE_RANGE_OVERLAP', field: 'effectiveFrom',
          seriesId: first.seriesId, definitionIds: [first.id, second.id],
          message: `Custom Allowance versions ${first.id} and ${second.id} overlap within series ${first.seriesId}.`,
        })
      }
    }
  }
  return { valid: errors.length === 0, errors }
}
