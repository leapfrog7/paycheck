import { isValidCalendarDate } from './allowanceResult'

export function createAllowanceEligibilityState(overrides = {}) {
  return {
    effectiveFrom: overrides.effectiveFrom ?? '',
    effectiveTo: overrides.effectiveTo ?? null,
    allowances: {
      hra: {
        eligible: overrides.allowances?.hra?.eligible ?? null,
        conditions: { governmentAccommodation: overrides.allowances?.hra?.conditions?.governmentAccommodation ?? null, ...(overrides.allowances?.hra?.conditions ?? {}) },
      },
      transportAllowance: {
        eligible: overrides.allowances?.transportAllowance?.eligible ?? null,
        conditions: { governmentTransportProvided: overrides.allowances?.transportAllowance?.conditions?.governmentTransportProvided ?? null, ...(overrides.allowances?.transportAllowance?.conditions ?? {}) },
      },
      ...(overrides.allowances ?? {}),
    },
  }
}

export function validateAllowanceEligibilityState(state = {}) {
  const errors = []
  if (!isValidCalendarDate(state.effectiveFrom)) errors.push({ code: 'INVALID_EFFECTIVE_FROM', field: 'effectiveFrom' })
  if (state.effectiveTo !== null && !isValidCalendarDate(state.effectiveTo)) errors.push({ code: 'INVALID_EFFECTIVE_TO', field: 'effectiveTo' })
  if (state.effectiveTo && state.effectiveTo < state.effectiveFrom) errors.push({ code: 'INVALID_EFFECTIVE_RANGE', field: 'effectiveTo' })
  return { valid: errors.length === 0, errors }
}
