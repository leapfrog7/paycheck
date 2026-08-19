import { SIXTH_CPC_TRANSPORT_RULE, SEVENTH_CPC_TRANSPORT_RULE } from '../../../data/allowances/transport/transportAllowanceRules'
import { ALLOWANCE_CALCULATION_TYPES, ALLOWANCE_SOURCE_TYPES, ALLOWANCE_STATUSES } from '../../../domain/allowances/allowanceConstants'
import { createAllowanceResult, isValidCalendarDate } from '../../../domain/allowances/allowanceResult'
import { getApplicableDaRule } from '../da/daRuleLookup'
import { roundAllowanceFractionToRupee } from '../da/daRounding'
import { resolveTransportAllowanceRule } from './transportAllowanceRuleResolver'

function earliestDate(...values) {
  return values.filter(Boolean).sort()[0] ?? null
}

function dateCovers(state, date) {
  return state && isValidCalendarDate(state.effectiveFrom) && state.effectiveFrom <= date && (!state.effectiveTo || state.effectiveTo >= date)
}

function resultBase(segment, ruleFamily, overrides = {}) {
  return createAllowanceResult({
    allowanceCode: 'TRANSPORT_ALLOWANCE', name: 'Transport Allowance',
    effectiveFrom: overrides.effectiveFrom ?? segment?.from ?? '',
    effectiveTo: overrides.effectiveTo ?? segment?.to ?? '',
    calculationType: ALLOWANCE_CALCULATION_TYPES.DEPENDENT_ALLOWANCE,
    inputs: overrides.inputs ?? { cpc: segment?.payState?.cpc, basicPay: segment?.basicPay },
    provenance: { sourceType: ALLOWANCE_SOURCE_TYPES.SYSTEM_RULE, authority: ruleFamily?.authority ?? null, ruleEffectiveFrom: ruleFamily?.effectiveFrom ?? null },
    ...overrides,
  })
}

function unresolved(reason, segment, ruleFamily, errors = []) {
  return resultBase(segment, ruleFamily, { status: ALLOWANCE_STATUSES.UNRESOLVED, reason, unresolvedReasons: [reason, ...errors] })
}

function unsupportedEligibilityCondition(conditions = {}) {
  if (conditions.disabledEmployeeDoubleRate || conditions.doubleRateForDisability) return 'DOUBLE_RATE_TRANSPORT_ALLOWANCE_NOT_IMPLEMENTED'
  if (conditions.officialCarEntitlement || conditions.officialCarOption) return 'OFFICIAL_CAR_OPTION_NOT_IMPLEMENTED'
  const unsupported = Object.entries(conditions).find(([key, value]) => key !== 'governmentTransportProvided' && value === true)
  return unsupported ? 'UNSUPPORTED_TRANSPORT_ALLOWANCE_ELIGIBILITY_CONDITION' : null
}

export function calculateTransportAllowance({
  payHistorySegment,
  applicableLocationState,
  applicableEligibilityState,
  daRuleLookup = getApplicableDaRule,
} = {}) {
  const segment = payHistorySegment
  if (!segment || !isValidCalendarDate(segment.from) || !isValidCalendarDate(segment.to) || segment.to < segment.from) {
    return unresolved('INVALID_PAY_HISTORY_SEGMENT', segment, null, ['A valid dated Pay History Segment is required.'])
  }
  const cpc = Number(segment.payState?.cpc)
  const basicPay = Number(segment.basicPay ?? segment.payState?.basicPay)
  if (cpc === 5) return unresolved('5CPC_TRANSPORT_ALLOWANCE_RULE_NOT_IMPLEMENTED', segment, null)
  const ruleFamily = cpc === 6 ? SIXTH_CPC_TRANSPORT_RULE : cpc === 7 ? SEVENTH_CPC_TRANSPORT_RULE : null
  if (!ruleFamily || !Number.isSafeInteger(basicPay) || basicPay <= 0) return unresolved('INVALID_PAY_STATE', segment, ruleFamily, ['A supported 6th or 7th CPC Pay State is required.'])
  if (cpc === 7 && segment.from < SEVENTH_CPC_TRANSPORT_RULE.effectiveFrom) {
    return unresolved('7CPC_PRE_JULY_2017_TRANSPORT_ALLOWANCE_RULE_NOT_IMPLEMENTED', segment, ruleFamily)
  }
  if (segment.from < ruleFamily.effectiveFrom || ruleFamily.effectiveTo && segment.from > ruleFamily.effectiveTo) {
    return unresolved('NO_VERIFIED_TRANSPORT_ALLOWANCE_RULE', segment, ruleFamily)
  }

  if (!dateCovers(applicableEligibilityState, segment.from)) return unresolved('MISSING_TRANSPORT_ALLOWANCE_ELIGIBILITY', segment, ruleFamily, ['A dated Transport Allowance eligibility state is required.'])
  const eligibility = applicableEligibilityState.allowances?.transportAllowance
  if (eligibility?.eligible === null || eligibility?.eligible === undefined) return unresolved('MISSING_TRANSPORT_ALLOWANCE_ELIGIBILITY', segment, ruleFamily, ['Transport Allowance eligibility must be explicitly confirmed.'])
  const deferredCondition = unsupportedEligibilityCondition(eligibility.conditions)
  if (deferredCondition) return unresolved(deferredCondition, segment, ruleFamily)
  const ineligibleReason = eligibility.eligible === false
    ? 'TRANSPORT_ALLOWANCE_NOT_ELIGIBLE'
    : eligibility.conditions?.governmentTransportProvided === true ? 'GOVERNMENT_TRANSPORT_PROVIDED' : null
  if (ineligibleReason) {
    return resultBase(segment, ruleFamily, {
      effectiveTo: earliestDate(segment.to, ruleFamily.effectiveTo, applicableEligibilityState.effectiveTo),
      inputs: { cpc, basicPay, eligibilityReason: ineligibleReason },
      baseTransportAllowance: 0,
      daOnTransportAllowance: { rate: null, rawAmount: 0, amount: 0, rounding: null },
      totalTransportAllowance: 0, amount: 0, status: ALLOWANCE_STATUSES.RESOLVED,
      components: { baseTransportAllowance: 0, daOnTransportAllowance: 0, eligibility: { eligible: false, reason: ineligibleReason } },
    })
  }

  if (!dateCovers(applicableLocationState, segment.from)) return unresolved('MISSING_TRANSPORT_LOCATION_STATE', segment, ruleFamily, ['A dated Transport Allowance location state is required.'])
  const transportCityCategory = applicableLocationState.transport?.category
  const resolution = resolveTransportAllowanceRule({ date: segment.from, payState: { ...segment.payState, basicPay }, transportCityCategory })
  if (!resolution.success) return unresolved(resolution.reason, segment, ruleFamily, resolution.errors)

  const daResult = daRuleLookup({ date: segment.from, cpc })
  if (!daResult?.success) return unresolved('APPLICABLE_DA_RATE_UNRESOLVED', segment, ruleFamily, daResult?.errors ?? [])
  const daRule = daResult.rule
  const rounding = roundAllowanceFractionToRupee(resolution.baseTransportAllowance * daRule.rate, 100)
  if (!rounding.success) return unresolved(rounding.reason, segment, ruleFamily, rounding.errors)
  const rawDaOnTransportAllowance = (resolution.baseTransportAllowance * daRule.rate) / 100
  const totalTransportAllowance = resolution.baseTransportAllowance + rounding.amount
  const effectiveTo = earliestDate(segment.to, ruleFamily.effectiveTo, applicableLocationState.effectiveTo, applicableEligibilityState.effectiveTo, daRule.effectiveTo)

  return resultBase(segment, ruleFamily, {
    effectiveTo,
    inputs: {
      cpc, level: segment.payState?.level ?? null, payBand: segment.payState?.payBand ?? null,
      payInBand: segment.payState?.payInBand ?? null, gradePay: segment.payState?.gradePay ?? null,
      basicPay, transportCityCategory, daRate: daRule.rate,
    },
    baseTransportAllowance: resolution.baseTransportAllowance,
    daOnTransportAllowance: { rate: daRule.rate, rawAmount: rawDaOnTransportAllowance, amount: rounding.amount, rounding },
    totalTransportAllowance,
    amount: totalTransportAllowance,
    ruleId: resolution.ruleId,
    status: ALLOWANCE_STATUSES.RESOLVED,
    components: {
      baseTransportAllowance: { amount: resolution.baseTransportAllowance, ruleId: resolution.ruleId, explanation: resolution.explanation },
      daOnTransportAllowance: { rate: daRule.rate, rawAmount: rawDaOnTransportAllowance, amount: rounding.amount, roundingRule: rounding.operation, daRuleId: daRule.ruleId },
    },
  })
}
