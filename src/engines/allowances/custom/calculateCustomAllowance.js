import { ALLOWANCE_CALCULATION_TYPES, ALLOWANCE_DEFINITION_STATUSES, ALLOWANCE_SOURCE_TYPES, ALLOWANCE_STATUSES } from '../../../domain/allowances/allowanceConstants'
import { createAllowanceResult, isValidCalendarDate } from '../../../domain/allowances/allowanceResult'
import { validateCustomAllowanceDefinition } from '../../../domain/allowances/customAllowance'
import { calculateDearnessAllowance } from '../da/calculateDa'
import { getApplicableDaRule } from '../da/daRuleLookup'
import { roundAllowanceFractionToRupee } from '../da/daRounding'

function resultBase(definition, segment, overrides = {}) {
  return createAllowanceResult({
    allowanceCode: 'CUSTOM', definitionId: definition?.id ?? null,
    allowanceSeriesId: definition?.seriesId ?? null,
    name: definition?.name ?? 'Custom Allowance',
    effectiveFrom: overrides.effectiveFrom ?? segment?.from ?? definition?.effectiveFrom ?? '',
    effectiveTo: overrides.effectiveTo ?? segment?.to ?? definition?.effectiveTo ?? '',
    calculationType: definition?.calculationType ?? '',
    userMetadata: definition?.metadata ?? {},
    provenance: {
      sourceType: ALLOWANCE_SOURCE_TYPES.USER_DEFINED,
      authority: null,
      ruleEffectiveFrom: null,
      definitionId: definition?.id ?? null,
    },
    ...overrides,
  })
}

function unresolved(reason, definition, segment, errors = []) {
  return resultBase(definition, segment, { status: ALLOWANCE_STATUSES.UNRESOLVED, reason, unresolvedReasons: [reason, ...errors] })
}

function notApplicable(reason, definition, segment) {
  return resultBase(definition, segment, { status: ALLOWANCE_STATUSES.NOT_APPLICABLE, reason, amount: null })
}

function percentageResult(definition, segment, calculationBase, inputs) {
  const rate = Number(definition.rate)
  const rateBasisPoints = rate * 100
  if (!Number.isSafeInteger(rateBasisPoints)) return unresolved('CUSTOM_ALLOWANCE_RATE_PRECISION_NOT_SUPPORTED', definition, segment, ['Percentage rates may contain at most two decimal places.'])
  const rounding = roundAllowanceFractionToRupee(calculationBase * rateBasisPoints, 10000)
  if (!rounding.success) return unresolved(rounding.reason, definition, segment, rounding.errors)
  return resultBase(definition, segment, {
    inputs: { ...inputs, rate }, rate, calculationBase,
    rawAmount: (calculationBase * rateBasisPoints) / 10000,
    amount: rounding.amount, status: ALLOWANCE_STATUSES.RESOLVED,
    components: { rounding },
  })
}

export function calculateCustomAllowance({
  definition,
  payHistorySegment,
  daRuleLookup = getApplicableDaRule,
  daCalculator = calculateDearnessAllowance,
} = {}) {
  const segment = payHistorySegment
  const validation = validateCustomAllowanceDefinition(definition)
  if (!validation.valid) return unresolved('INVALID_CUSTOM_ALLOWANCE_DEFINITION', definition, segment, validation.errors.map(({ code }) => code))
  if (!segment || !isValidCalendarDate(segment.from) || !isValidCalendarDate(segment.to) || segment.to < segment.from) {
    return unresolved('INVALID_PAY_HISTORY_SEGMENT', definition, segment, ['A valid dated Pay History Segment is required.'])
  }
  if (definition.status !== ALLOWANCE_DEFINITION_STATUSES.ACTIVE) return notApplicable('CUSTOM_ALLOWANCE_INACTIVE', definition, segment)
  if (segment.to < definition.effectiveFrom || definition.effectiveTo && segment.from > definition.effectiveTo) {
    return notApplicable('CUSTOM_ALLOWANCE_OUTSIDE_EFFECTIVE_RANGE', definition, segment)
  }
  const basicPay = Number(segment.basicPay ?? segment.payState?.basicPay)
  if (!Number.isSafeInteger(basicPay) || basicPay < 0) return unresolved('INVALID_BASIC_PAY', definition, segment)
  const effectiveFrom = segment.from > definition.effectiveFrom ? segment.from : definition.effectiveFrom
  const effectiveTo = definition.effectiveTo && definition.effectiveTo < segment.to ? definition.effectiveTo : segment.to

  if ([ALLOWANCE_CALCULATION_TYPES.FIXED_MONTHLY, ALLOWANCE_CALCULATION_TYPES.MANUAL_MONTHLY_AMOUNT].includes(definition.calculationType)) {
    return resultBase(definition, segment, {
      effectiveFrom, effectiveTo,
      inputs: { enteredAmount: Number(definition.amount) },
      calculationBase: null, rawAmount: Number(definition.amount), amount: Number(definition.amount),
      status: ALLOWANCE_STATUSES.RESOLVED,
    })
  }
  if (definition.calculationType === ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC) {
    return percentageResult(definition, { ...segment, from: effectiveFrom, to: effectiveTo }, basicPay, { basicPay })
  }
  if (definition.calculationType === ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC_PLUS_DA) {
    const daRule = daRuleLookup({ date: effectiveFrom, cpc: segment.payState?.cpc })
    if (!daRule?.success) return unresolved('CUSTOM_ALLOWANCE_DA_UNRESOLVED', definition, segment, daRule?.errors ?? [])
    const daResult = daCalculator({ payHistorySegment: { ...segment, from: effectiveFrom, to: effectiveTo }, applicableDaRule: daRule })
    if (daResult?.status !== ALLOWANCE_STATUSES.RESOLVED) return unresolved('CUSTOM_ALLOWANCE_DA_UNRESOLVED', definition, segment, daResult?.unresolvedReasons ?? [])
    const calculationBase = basicPay + daResult.amount
    const result = percentageResult(definition, { ...segment, from: effectiveFrom, to: effectiveTo }, calculationBase, { basicPay, dearnessAllowance: daResult.amount, daRate: daResult.rate })
    result.components = { ...result.components, dearnessAllowance: { amount: daResult.amount, rate: daResult.rate, ruleId: daResult.ruleId } }
    return result
  }
  return unresolved('UNSUPPORTED_CUSTOM_ALLOWANCE_CALCULATION_TYPE', definition, segment)
}
