import { ALLOWANCE_SOURCE_TYPES, ALLOWANCE_STATUSES } from './allowanceConstants'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isValidCalendarDate(value) {
  if (!DATE_PATTERN.test(value ?? '')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function createAllowanceResult(overrides = {}) {
  return {
    allowanceCode: overrides.allowanceCode ?? '',
    definitionId: overrides.definitionId ?? null,
    allowanceSeriesId: overrides.allowanceSeriesId ?? null,
    name: overrides.name ?? '',
    effectiveFrom: overrides.effectiveFrom ?? '',
    effectiveTo: overrides.effectiveTo ?? '',
    calculationType: overrides.calculationType ?? '',
    inputs: structuredClone(overrides.inputs ?? {}),
    rate: overrides.rate ?? null,
    calculationBase: overrides.calculationBase ?? null,
    rawAmount: overrides.rawAmount ?? null,
    percentageAmount: overrides.percentageAmount ?? null,
    minimumAmount: overrides.minimumAmount ?? null,
    minimumApplied: overrides.minimumApplied ?? false,
    baseTransportAllowance: overrides.baseTransportAllowance ?? null,
    daOnTransportAllowance: structuredClone(overrides.daOnTransportAllowance ?? {}),
    totalTransportAllowance: overrides.totalTransportAllowance ?? null,
    amount: overrides.amount ?? null,
    components: structuredClone(overrides.components ?? {}),
    ruleId: overrides.ruleId ?? null,
    status: overrides.status ?? ALLOWANCE_STATUSES.UNRESOLVED,
    reason: overrides.reason ?? null,
    unresolvedReasons: [...(overrides.unresolvedReasons ?? [])],
    userMetadata: structuredClone(overrides.userMetadata ?? {}),
    provenance: {
      sourceType: overrides.provenance?.sourceType ?? ALLOWANCE_SOURCE_TYPES.SYSTEM_RULE,
      authority: overrides.provenance?.authority ?? null,
      ruleEffectiveFrom: overrides.provenance?.ruleEffectiveFrom ?? null,
      definitionId: overrides.provenance?.definitionId ?? null,
    },
  }
}

export function validateAllowanceResult(result = {}) {
  const errors = []
  if (!result.allowanceCode) errors.push({ code: 'MISSING_ALLOWANCE_CODE', field: 'allowanceCode' })
  if (!result.name) errors.push({ code: 'MISSING_ALLOWANCE_NAME', field: 'name' })
  if (!isValidCalendarDate(result.effectiveFrom)) errors.push({ code: 'INVALID_EFFECTIVE_FROM', field: 'effectiveFrom' })
  if (!isValidCalendarDate(result.effectiveTo)) errors.push({ code: 'INVALID_EFFECTIVE_TO', field: 'effectiveTo' })
  if (isValidCalendarDate(result.effectiveFrom) && isValidCalendarDate(result.effectiveTo) && result.effectiveTo < result.effectiveFrom) {
    errors.push({ code: 'INVALID_EFFECTIVE_RANGE', field: 'effectiveTo' })
  }
  if (!Object.values(ALLOWANCE_STATUSES).includes(result.status)) errors.push({ code: 'INVALID_STATUS', field: 'status' })
  if (!Object.values(ALLOWANCE_SOURCE_TYPES).includes(result.provenance?.sourceType)) errors.push({ code: 'INVALID_SOURCE_TYPE', field: 'provenance.sourceType' })
  if (result.status === ALLOWANCE_STATUSES.RESOLVED && (result.amount === null || result.amount === '' || !Number.isFinite(Number(result.amount)))) {
    errors.push({ code: 'MISSING_RESOLVED_AMOUNT', field: 'amount' })
  }
  return { valid: errors.length === 0, errors }
}
