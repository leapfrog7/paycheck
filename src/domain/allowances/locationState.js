import { isValidCalendarDate } from './allowanceResult'

export const TRANSPORT_CITY_CATEGORIES = Object.freeze({
  HIGHER_RATE_CITY: 'HIGHER_RATE_CITY',
  OTHER_PLACE: 'OTHER_PLACE',
})

export function createLocationState(overrides = {}) {
  return {
    city: overrides.city ?? '',
    effectiveFrom: overrides.effectiveFrom ?? '',
    effectiveTo: overrides.effectiveTo ?? null,
    hra: {
      scheme: overrides.hra?.scheme ?? '',
      class: overrides.hra?.class ?? '',
    },
    transport: {
      category: overrides.transport?.category ?? '',
    },
    source: overrides.source ?? 'EXPLICIT_SELECTION',
  }
}

export function validateLocationState(state = {}, hraSchemes = []) {
  const errors = []
  if (!isValidCalendarDate(state.effectiveFrom)) errors.push({ code: 'INVALID_EFFECTIVE_FROM', field: 'effectiveFrom' })
  if (state.effectiveTo !== null && !isValidCalendarDate(state.effectiveTo)) errors.push({ code: 'INVALID_EFFECTIVE_TO', field: 'effectiveTo' })
  if (state.effectiveTo && state.effectiveTo < state.effectiveFrom) errors.push({ code: 'INVALID_EFFECTIVE_RANGE', field: 'effectiveTo' })
  const scheme = hraSchemes.find(({ id }) => id === state.hra?.scheme)
  if (!scheme) errors.push({ code: 'INVALID_HRA_SCHEME', field: 'hra.scheme' })
  else if (!scheme.classes.includes(state.hra?.class)) errors.push({ code: 'INVALID_HRA_CLASS', field: 'hra.class' })
  if (!Object.values(TRANSPORT_CITY_CATEGORIES).includes(state.transport?.category)) errors.push({ code: 'INVALID_TRANSPORT_CATEGORY', field: 'transport.category' })
  return { valid: errors.length === 0, errors }
}
