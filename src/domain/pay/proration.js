import { calendarDaysInclusive, calendarMonthEnd, calendarMonthStart } from '../dates/calendarDate'

export const PRORATION_METHODS = Object.freeze({
  CALENDAR_DAYS_IN_MONTH: 'CALENDAR_DAYS_IN_MONTH',
  FIXED_30_DAY_DIVISOR: 'FIXED_30_DAY_DIVISOR',
  MANUAL_FACTOR: 'MANUAL_FACTOR',
  MANUAL_SEGMENT_AMOUNT: 'MANUAL_SEGMENT_AMOUNT',
  NO_PRORATION_FULL_AMOUNT: 'NO_PRORATION_FULL_AMOUNT',
})

export const PRORATION_ROUNDING_METHODS = Object.freeze({
  NEAREST_RUPEE: 'NEAREST_RUPEE',
  IGNORE_BELOW_50_PAISE_AND_ROUND_50_PLUS: 'IGNORE_BELOW_50_PAISE_AND_ROUND_50_PLUS',
  FLOOR_RUPEE: 'FLOOR_RUPEE',
  MANUAL_AMOUNT: 'MANUAL_AMOUNT',
})

export const PRORATION_SOURCE_TYPES = Object.freeze({ SYSTEM_RULE: 'SYSTEM_RULE', USER_CONFIRMED: 'USER_CONFIRMED' })

export function createEmptyProrationConfig(overrides = {}) {
  return {
    casePolicy: overrides.casePolicy ?? null,
    monthPolicies: Array.isArray(overrides.monthPolicies) ? structuredClone(overrides.monthPolicies) : [],
    decisions: Array.isArray(overrides.decisions) ? structuredClone(overrides.decisions) : [],
  }
}

function decisionSpecificity(decision, request) {
  if (decision.month && decision.month !== request.month) return -1
  if (decision.componentCode && decision.componentCode !== request.componentCode) return -1
  if (decision.segmentFrom && decision.segmentFrom !== request.segmentFrom) return -1
  if (decision.segmentTo && decision.segmentTo !== request.segmentTo) return -1
  return (decision.componentCode ? 8 : 0) + (decision.month ? 4 : 0) + (decision.segmentFrom || decision.segmentTo ? 2 : 0)
}

export function resolveProrationDecision(config = {}, request = {}) {
  const normalized = createEmptyProrationConfig(config)
  const candidates = [
    ...normalized.decisions.map((decision, index) => ({ decision, index, specificity: decisionSpecificity(decision, request), scope: 'EXPLICIT_DECISION' })),
    ...normalized.monthPolicies.map((decision, index) => ({ decision, index, specificity: decisionSpecificity({ ...decision, month: decision.month }, request), scope: 'MONTH_POLICY' })),
    ...(normalized.casePolicy ? [{ decision: normalized.casePolicy, index: 0, specificity: 0, scope: 'CASE_POLICY' }] : []),
  ].filter(({ specificity }) => specificity >= 0)
    .sort((first, second) => second.specificity - first.specificity || second.index - first.index)
  const match = candidates[0]
  if (!match) return { status: 'UNRESOLVED', reason: 'PRORATION_BASIS_NOT_CONFIRMED', decision: null }
  const decision = structuredClone(match.decision)
  if (match.scope === 'EXPLICIT_DECISION' && !decision.id) return { status: 'UNRESOLVED', reason: 'PRORATION_DECISION_ID_REQUIRED', decision }
  if (!Object.values(PRORATION_METHODS).includes(decision.method)) return { status: 'UNRESOLVED', reason: 'INVALID_PRORATION_METHOD', decision }
  const sourceType = decision.sourceType ?? PRORATION_SOURCE_TYPES.USER_CONFIRMED
  if (!Object.values(PRORATION_SOURCE_TYPES).includes(sourceType)) return { status: 'UNRESOLVED', reason: 'INVALID_PRORATION_SOURCE_TYPE', decision }
  return { status: 'RESOLVED', scope: match.scope, decision: { ...decision, sourceType } }
}

function applyRounding(rawAmount, decision) {
  if (Number.isInteger(rawAmount)) return { status: 'RESOLVED', method: 'NOT_REQUIRED', rawAmount, finalAmount: rawAmount }
  const rounding = decision.roundingDecision ?? (decision.roundingMethod ? { method: decision.roundingMethod, manualAmount: decision.roundedAmount } : null)
  if (!rounding?.method) return { status: 'UNRESOLVED', reason: 'PRORATION_ROUNDING_NOT_CONFIRMED', rawAmount, finalAmount: null }
  let finalAmount
  if (rounding.method === PRORATION_ROUNDING_METHODS.NEAREST_RUPEE) finalAmount = Math.round(rawAmount)
  else if (rounding.method === PRORATION_ROUNDING_METHODS.IGNORE_BELOW_50_PAISE_AND_ROUND_50_PLUS) finalAmount = Math.floor(rawAmount + 0.5)
  else if (rounding.method === PRORATION_ROUNDING_METHODS.FLOOR_RUPEE) finalAmount = Math.floor(rawAmount)
  else if (rounding.method === PRORATION_ROUNDING_METHODS.MANUAL_AMOUNT && Number.isFinite(Number(rounding.manualAmount)) && Number(rounding.manualAmount) >= 0) finalAmount = Number(rounding.manualAmount)
  else return { status: 'UNRESOLVED', reason: 'INVALID_PRORATION_ROUNDING_DECISION', rawAmount, finalAmount: null, method: rounding.method }
  return { status: 'RESOLVED', method: rounding.method, rawAmount, finalAmount, sourceType: decision.sourceType }
}

export function calculateProratedComponent({ fullMonthlyAmount, componentCode, segmentFrom, segmentTo, decisionResolution } = {}) {
  const amount = Number(fullMonthlyAmount)
  const month = segmentFrom?.slice(0, 7) ?? ''
  const eligibleDays = calendarDaysInclusive(segmentFrom, segmentTo)
  const base = { month, componentCode, segmentFrom, segmentTo, eligibleDays, fullMonthlyAmount: Number.isFinite(amount) ? amount : null }
  if (!Number.isFinite(amount) || amount < 0) return { ...base, status: 'UNRESOLVED', reason: 'FULL_MONTH_COMPONENT_UNRESOLVED', finalAmount: null }
  if (decisionResolution?.status !== 'RESOLVED') return { ...base, status: 'UNRESOLVED', reason: decisionResolution?.reason ?? 'PRORATION_BASIS_NOT_CONFIRMED', finalAmount: null, decision: decisionResolution?.decision ?? null }
  const decision = decisionResolution.decision
  const warnings = decision.sourceType === PRORATION_SOURCE_TYPES.USER_CONFIRMED
    ? [{ code: 'USER_CONFIRMED_PRORATION', message: 'A user-confirmed proration basis is being used for this component and month.' }]
    : []
  if (!decision.reference && decision.sourceType === PRORATION_SOURCE_TYPES.USER_CONFIRMED) warnings.push({ code: 'PRORATION_WITHOUT_REFERENCE', message: 'No user-supplied proration reference was entered.' })

  let divisor = null
  let factor = null
  let rawProratedAmount
  if (decision.method === PRORATION_METHODS.MANUAL_SEGMENT_AMOUNT) {
    if (!Number.isFinite(Number(decision.segmentAmount)) || Number(decision.segmentAmount) < 0) return { ...base, status: 'UNRESOLVED', reason: 'INVALID_MANUAL_SEGMENT_AMOUNT', finalAmount: null, decision, warnings }
    return { ...base, status: 'RESOLVED', sourceType: decision.sourceType, method: decision.method, divisor, factor, rawProratedAmount: Number(decision.segmentAmount), roundingDecision: { status: 'RESOLVED', method: 'NOT_APPLICABLE' }, finalAmount: Number(decision.segmentAmount), decision, warnings }
  }
  if (decision.method === PRORATION_METHODS.NO_PRORATION_FULL_AMOUNT) factor = 1
  else if (decision.method === PRORATION_METHODS.MANUAL_FACTOR) {
    factor = Number(decision.factor)
    if (!Number.isFinite(factor) || factor < 0 || factor > 1) return { ...base, status: 'UNRESOLVED', reason: 'INVALID_MANUAL_PRORATION_FACTOR', finalAmount: null, decision, warnings }
  } else if (decision.method === PRORATION_METHODS.CALENDAR_DAYS_IN_MONTH) {
    divisor = calendarDaysInclusive(calendarMonthStart(segmentFrom), calendarMonthEnd(segmentFrom))
    factor = eligibleDays / divisor
  } else if (decision.method === PRORATION_METHODS.FIXED_30_DAY_DIVISOR) {
    divisor = 30
    factor = eligibleDays / divisor
    if (factor > 1) return { ...base, status: 'UNRESOLVED', reason: 'PRORATION_FACTOR_EXCEEDS_ONE', divisor, factor, finalAmount: null, decision, warnings: [...warnings, { code: 'ANOMALOUS_PRORATION_FACTOR', message: 'The confirmed divisor produces a factor greater than one.' }] }
  }
  rawProratedAmount = amount * factor
  const roundingDecision = applyRounding(rawProratedAmount, decision)
  if (roundingDecision.status !== 'RESOLVED') return { ...base, status: 'UNRESOLVED', reason: roundingDecision.reason, sourceType: decision.sourceType, method: decision.method, divisor, factor, rawProratedAmount, roundingDecision, finalAmount: null, decision, warnings }
  return { ...base, status: 'RESOLVED', sourceType: decision.sourceType, method: decision.method, divisor, factor, rawProratedAmount, roundingDecision, finalAmount: roundingDecision.finalAmount, decision, warnings }
}
