import { ALLOWANCE_CALCULATION_TYPES, ALLOWANCE_SOURCE_TYPES, ALLOWANCE_STATUSES } from '../../../domain/allowances/allowanceConstants'
import { createAllowanceResult, isValidCalendarDate } from '../../../domain/allowances/allowanceResult'
import { roundDaAmountToRupee } from './daRounding'

function unresolved(reason, segment, rule, errors) {
  return createAllowanceResult({
    allowanceCode: 'DA',
    name: 'Dearness Allowance',
    effectiveFrom: segment?.from ?? '',
    effectiveTo: segment?.to ?? '',
    calculationType: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC,
    inputs: { cpc: segment?.payState?.cpc, basicPay: segment?.basicPay },
    rate: rule?.rate ?? null,
    ruleId: rule?.ruleId ?? null,
    status: ALLOWANCE_STATUSES.UNRESOLVED,
    unresolvedReasons: [reason, ...(errors ?? [])],
    provenance: { sourceType: ALLOWANCE_SOURCE_TYPES.SYSTEM_RULE, authority: rule?.authority ?? null, ruleEffectiveFrom: rule?.effectiveFrom ?? null },
  })
}

export function calculateDearnessAllowance({ payHistorySegment, applicableDaRule } = {}) {
  const rule = applicableDaRule?.success ? applicableDaRule.rule : applicableDaRule
  const segment = payHistorySegment
  if (!segment || !isValidCalendarDate(segment.from) || !isValidCalendarDate(segment.to) || segment.to < segment.from) {
    return unresolved('INVALID_PAY_HISTORY_SEGMENT', segment, rule, ['A valid dated Pay History Segment is required.'])
  }
  const cpc = Number(segment.payState?.cpc)
  const basicPay = Number(segment.basicPay ?? segment.payState?.basicPay)
  if (![5, 6, 7].includes(cpc) || !Number.isSafeInteger(basicPay) || basicPay < 0) {
    return unresolved('INVALID_PAY_STATE', segment, rule, ['A supported CPC Pay State with whole-rupee Basic Pay is required.'])
  }
  if (!rule || rule.status !== 'VERIFIED' || !Number.isSafeInteger(rule.rate) || Number(rule.cpc) !== cpc) {
    return unresolved('INVALID_APPLICABLE_DA_RULE', segment, rule, ['A verified DA rule from the same CPC series is required.'])
  }
  if (rule.calculationBasisStatus !== 'VERIFIED') {
    return unresolved('5CPC_DEARNESS_PAY_CALCULATION_BASE_NOT_IMPLEMENTED', segment, rule)
  }

  const effectiveFrom = segment.from > rule.effectiveFrom ? segment.from : rule.effectiveFrom
  const effectiveTo = rule.effectiveTo && rule.effectiveTo < segment.to ? rule.effectiveTo : segment.to
  if (effectiveTo < effectiveFrom) return unresolved('DA_RULE_OUTSIDE_SEGMENT', segment, rule)

  const rounding = roundDaAmountToRupee(basicPay, rule.rate)
  if (!rounding.success) return unresolved(rounding.reason, segment, rule, rounding.errors)
  const rawAmount = (basicPay * rule.rate) / 100

  return createAllowanceResult({
    allowanceCode: 'DA',
    name: 'Dearness Allowance',
    effectiveFrom,
    effectiveTo,
    calculationType: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC,
    inputs: { cpc, basicPay },
    rate: rule.rate,
    calculationBase: basicPay,
    rawAmount,
    amount: rounding.amount,
    components: { rounding },
    ruleId: rule.ruleId,
    status: ALLOWANCE_STATUSES.RESOLVED,
    provenance: { sourceType: ALLOWANCE_SOURCE_TYPES.SYSTEM_RULE, authority: rule.authority, ruleEffectiveFrom: rule.effectiveFrom },
  })
}
