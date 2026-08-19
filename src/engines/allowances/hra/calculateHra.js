import { ALLOWANCE_CALCULATION_TYPES, ALLOWANCE_SOURCE_TYPES, ALLOWANCE_STATUSES } from '../../../domain/allowances/allowanceConstants'
import { createAllowanceResult, isValidCalendarDate } from '../../../domain/allowances/allowanceResult'
import { getApplicableDaRule } from '../da/daRuleLookup'
import { roundAllowanceFractionToRupee } from '../da/daRounding'
import { getApplicableHraScheme, resolveHraRate } from './hraRuleLookup'

function resultBase(segment, scheme, overrides = {}) {
  return createAllowanceResult({
    allowanceCode: 'HRA', name: 'House Rent Allowance',
    effectiveFrom: overrides.effectiveFrom ?? segment?.from ?? '',
    effectiveTo: overrides.effectiveTo ?? segment?.to ?? '',
    calculationType: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC,
    inputs: overrides.inputs ?? { cpc: segment?.payState?.cpc, basicPay: segment?.basicPay },
    ruleId: scheme?.ruleId ?? null,
    provenance: { sourceType: ALLOWANCE_SOURCE_TYPES.SYSTEM_RULE, authority: scheme?.authority ?? null, ruleEffectiveFrom: scheme?.effectiveFrom ?? null },
    ...overrides,
  })
}

function unresolved(reason, segment, scheme, errors = []) {
  return resultBase(segment, scheme, { status: ALLOWANCE_STATUSES.UNRESOLVED, reason, unresolvedReasons: [reason, ...errors] })
}

function dateCovers(state, date) {
  return state && isValidCalendarDate(state.effectiveFrom) && state.effectiveFrom <= date && (!state.effectiveTo || state.effectiveTo >= date)
}

function earliestDate(...values) {
  return values.filter(Boolean).sort()[0] ?? null
}

export function calculateHouseRentAllowance({
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
  if (![5, 6, 7].includes(cpc) || !Number.isSafeInteger(basicPay) || basicPay < 0) {
    return unresolved('INVALID_PAY_STATE', segment, null, ['A supported CPC Pay State with whole-rupee Basic Pay is required.'])
  }

  const schemeResult = getApplicableHraScheme({ date: segment.from, cpc })
  if (!schemeResult.success) return unresolved(schemeResult.reason, segment, null, schemeResult.errors)
  const scheme = schemeResult.scheme

  if (!dateCovers(applicableEligibilityState, segment.from)) return unresolved('MISSING_HRA_ELIGIBILITY', segment, scheme, ['A dated HRA eligibility state is required.'])
  const hraEligibility = applicableEligibilityState.allowances?.hra
  if (hraEligibility?.eligible === null || hraEligibility?.eligible === undefined) return unresolved('MISSING_HRA_ELIGIBILITY', segment, scheme, ['HRA eligibility must be explicitly confirmed.'])
  const ineligibleReason = hraEligibility.eligible === false
    ? 'HRA_NOT_ELIGIBLE'
    : hraEligibility.conditions?.governmentAccommodation === true ? 'GOVERNMENT_ACCOMMODATION_PROVIDED' : null
  if (ineligibleReason) {
    return resultBase(segment, scheme, {
      effectiveTo: earliestDate(segment.to, applicableEligibilityState.effectiveTo),
      inputs: { cpc, basicPay, eligibilityReason: ineligibleReason },
      calculationBase: basicPay, rawAmount: 0, percentageAmount: 0, amount: 0,
      status: ALLOWANCE_STATUSES.RESOLVED,
      components: { eligibility: { eligible: false, reason: ineligibleReason } },
    })
  }

  if (!dateCovers(applicableLocationState, segment.from)) return unresolved('MISSING_HRA_LOCATION_STATE', segment, scheme, ['A dated HRA location state is required.'])
  if (applicableLocationState.hra?.scheme !== scheme.id) return unresolved('HRA_SCHEME_MISMATCH', segment, scheme, ['The location HRA scheme does not match the applicable dated rule.'])
  const hraCityClass = applicableLocationState.hra?.class

  let daRule = null
  let daRate = null
  if (cpc === 7) {
    const daResult = daRuleLookup({ date: segment.from, cpc })
    if (!daResult?.success) return unresolved('APPLICABLE_DA_RATE_UNRESOLVED', segment, scheme, daResult?.errors ?? [])
    daRule = daResult.rule
    daRate = daRule.rate
  }
  const rateResult = resolveHraRate({ scheme, hraCityClass, daRate })
  if (!rateResult.success) return unresolved(rateResult.reason, segment, scheme, rateResult.errors)

  const rateBasisPoints = Math.round(rateResult.rate * 100)
  const rounding = roundAllowanceFractionToRupee(basicPay * rateBasisPoints, 10000)
  if (!rounding.success) return unresolved(rounding.reason, segment, scheme, rounding.errors)
  const percentageAmount = rounding.amount
  const minimumAmount = scheme.minimumMonthlyByClass?.[hraCityClass] ?? null
  const minimumApplied = minimumAmount !== null && percentageAmount < minimumAmount
  const effectiveTo = earliestDate(segment.to, scheme.effectiveTo, applicableLocationState.effectiveTo, applicableEligibilityState.effectiveTo, daRule?.effectiveTo)

  return resultBase(segment, scheme, {
    effectiveTo,
    inputs: { cpc, basicPay, hraCityClass, daRate },
    rate: rateResult.rate,
    calculationBase: basicPay,
    rawAmount: (basicPay * rateBasisPoints) / 10000,
    percentageAmount,
    minimumAmount,
    minimumApplied,
    amount: minimumApplied ? minimumAmount : percentageAmount,
    status: ALLOWANCE_STATUSES.RESOLVED,
    components: { percentageCalculation: { rate: rateResult.rate, amount: percentageAmount, rounding }, minimumRule: minimumAmount === null ? null : { minimumAmount, applied: minimumApplied }, daThreshold: rateResult.threshold },
  })
}
