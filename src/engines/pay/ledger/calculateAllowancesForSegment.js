import { ALLOWANCE_REGISTRY } from '../../allowances/allowanceRegistry'
import { getApplicableDaRule } from '../../allowances/da/daRuleLookup'

function notSelected(code) {
  return { allowanceCode: code, status: 'NOT_APPLICABLE', reason: 'ALLOWANCE_NOT_SELECTED', amount: 0 }
}

export function calculateAllowancesForSegment({
  segment,
  enabledAllowances = { da: true, hra: true, transportAllowance: true },
  registry = ALLOWANCE_REGISTRY,
} = {}) {
  const daCalculator = registry.get('DA').calculator
  const hraCalculator = registry.get('HRA').calculator
  const transportCalculator = registry.get('TRANSPORT_ALLOWANCE').calculator
  const customCalculator = registry.get('CUSTOM').calculator
  const daRule = getApplicableDaRule({ date: segment.effectiveFrom, cpc: segment.payState.cpc })
  const payHistorySegment = {
    from: segment.effectiveFrom, to: segment.effectiveTo,
    payState: segment.payState, basicPay: segment.basicPay, status: segment.payHistoryStatus,
  }

  const da = enabledAllowances.da
    ? daCalculator({ payHistorySegment, applicableDaRule: daRule })
    : notSelected('DA')
  const hra = enabledAllowances.hra
    ? hraCalculator({ payHistorySegment, applicableLocationState: segment.locationState, applicableEligibilityState: segment.eligibilityState })
    : notSelected('HRA')
  const transportAllowance = enabledAllowances.transportAllowance
    ? transportCalculator({ payHistorySegment, applicableLocationState: segment.locationState, applicableEligibilityState: segment.eligibilityState })
    : notSelected('TRANSPORT_ALLOWANCE')
  const custom = segment.customAllowanceDefinitions
    .map((definition) => customCalculator({ definition, payHistorySegment }))
    .filter((result) => result.status !== 'NOT_APPLICABLE')

  const namedResults = [
    ['DA', da], ['HRA', hra], ['TRANSPORT_ALLOWANCE', transportAllowance],
    ...custom.map((result) => [`CUSTOM:${result.definitionId}`, result]),
  ]
  const unresolvedComponents = namedResults.filter(([, result]) => result.status === 'UNRESOLVED').map(([name]) => name)
  const resolvedAllowanceTotal = namedResults.reduce((total, [, result]) => (
    result.status === 'RESOLVED' ? total + Number(result.amount) : total
  ), 0)
  const affectedByPayEvent = segment.payHistoryStatus !== 'RESOLVED' || segment.unresolvedEventIds.length > 0

  return {
    results: { da, hra, transportAllowance, custom },
    resolvedAllowanceTotal,
    unresolvedComponents,
    status: unresolvedComponents.length || affectedByPayEvent ? 'PARTIALLY_RESOLVED' : 'RESOLVED',
    calculationStatus: affectedByPayEvent ? 'RESOLVED_FROM_KNOWN_PAY_STATE' : 'RESOLVED',
    confidence: affectedByPayEvent ? 'AFFECTED_BY_PRIOR_UNRESOLVED_EVENT' : 'VERIFIED_INPUTS',
  }
}
