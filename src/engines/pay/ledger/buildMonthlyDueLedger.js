import { validateCustomAllowanceDefinitions } from '../../../domain/allowances/customAllowance'
import { buildPayHistory } from '../history/buildPayHistory'
import { buildFinancialSegments } from './buildFinancialSegments'
import { calculateSegmentDue } from './calculateSegmentDue'

function failure(reason, errors) {
  return { success: false, status: 'UNRESOLVED', reason, errors, months: [], segments: [] }
}

function monthKey(date) {
  return date.slice(0, 7)
}

function sumResolved(results) {
  return results.reduce((total, result) => total + Number(result.finalAmount), 0)
}

function aggregateCustom(monthSegments) {
  const byId = new Map()
  monthSegments.forEach((segment) => segment.allowances.custom.forEach((allowance, index) => {
    const prorated = segment.proration.customAllowances[index]
    const item = byId.get(allowance.definitionId) ?? { definitionId: allowance.definitionId, name: allowance.name, amount: 0, sourceType: allowance.provenance.sourceType }
    if (prorated?.status === 'RESOLVED') item.amount += Number(prorated.finalAmount)
    byId.set(allowance.definitionId, item)
  }))
  return [...byId.values()]
}

export function buildMonthlyDueLedger({
  openingState = {}, events = [], startDate, endDate,
  locationHistory = [], eligibilityHistory = [], customAllowanceDefinitions = [],
  enabledAllowances = { da: true, hra: true, transportAllowance: true },
  prorationConfig = {}, registry,
} = {}) {
  const customValidation = validateCustomAllowanceDefinitions(customAllowanceDefinitions)
  if (!customValidation.valid) return failure('INVALID_CUSTOM_ALLOWANCE_DEFINITIONS', customValidation.errors)
  const payHistory = buildPayHistory({ openingState, events, startDate, endDate })
  if (!payHistory.success) return failure(payHistory.reason, payHistory.errors)
  const financial = buildFinancialSegments({ payHistory, startDate, endDate, locationHistory, eligibilityHistory, customAllowanceDefinitions })
  if (!financial.success) return failure(financial.reason, financial.errors)
  const segments = financial.segments.map((segment) => calculateSegmentDue({ segment, enabledAllowances, registry, prorationConfig }))
  const months = []
  for (const payMonth of payHistory.months) {
    const key = `${payMonth.year}-${String(payMonth.month).padStart(2, '0')}`
    const monthSegments = segments.filter((segment) => monthKey(segment.effectiveFrom) === key)
    const monetarySegments = monthSegments.filter(({ monetaryStatus }) => monetaryStatus !== 'NOTIONAL_ONLY')
    const entirelyNotional = monetarySegments.length === 0
    const resolved = !entirelyNotional && monetarySegments.every(({ status, grossDue }) => status === 'RESOLVED' && grossDue !== null)
      && monthSegments.every(({ status }) => ['RESOLVED', 'NOTIONAL_ONLY'].includes(status))
    const unresolvedComponents = [...new Set(monthSegments.flatMap((item) => item.unresolvedComponents))]
    const unresolvedProrationReasons = [...new Set(monthSegments.flatMap((item) => item.unresolvedProrationReasons ?? []))]
    const affectedByUnresolvedPayEvent = monthSegments.some((item) => item.confidence === 'AFFECTED_BY_PRIOR_UNRESOLVED_EVENT')
    const customAllowances = aggregateCustom(monetarySegments)
    const components = resolved ? {
      basicPay: sumResolved(monetarySegments.map(({ proration }) => proration.basicPay)),
      da: sumResolved(monetarySegments.map(({ proration }) => proration.da)),
      hra: sumResolved(monetarySegments.map(({ proration }) => proration.hra)),
      transportAllowance: sumResolved(monetarySegments.map(({ proration }) => proration.transportAllowance)),
      customAllowances,
    } : null
    const customAllowanceTotal = resolved ? customAllowances.reduce((total, item) => total + item.amount, 0) : null
    const grossDue = resolved ? monetarySegments.reduce((total, segment) => total + Number(segment.grossDue), 0) : null
    const fullMonth = monthSegments.length === 1 && monthSegments[0].proration.basicPay.method === 'FULL_MONTH'
    const reason = entirelyNotional
      ? 'NOTIONAL_ONLY_NO_MONETARY_ENTITLEMENT'
      : resolved ? null : unresolvedProrationReasons[0] ?? 'UNRESOLVED_FINANCIAL_COMPONENTS'

    months.push({
      month: key, periodStart: payMonth.periodStart, periodEnd: payMonth.periodEnd,
      segments: monthSegments, components, customAllowanceTotal,
      allowanceTotal: resolved ? components.da + components.hra + components.transportAllowance + customAllowanceTotal : null,
      grossDue,
      prorationStatus: fullMonth ? 'FULL_MONTH' : resolved ? 'RESOLVED' : 'UNRESOLVED_PRORATION',
      reason,
      status: entirelyNotional ? 'NOTIONAL_ONLY' : resolved ? 'RESOLVED' : 'PARTIALLY_RESOLVED',
      monetaryStatus: entirelyNotional ? 'NOTIONAL_ONLY' : 'MONETARY',
      unresolvedComponents, unresolvedProrationReasons,
      unresolvedEventIds: [...new Set(monthSegments.flatMap((item) => item.unresolvedEventIds))],
      confidence: affectedByUnresolvedPayEvent ? 'AFFECTED_BY_PRIOR_UNRESOLVED_EVENT' : 'VERIFIED_INPUTS',
    })
  }
  return {
    success: true, status: months.every(({ status }) => status === 'RESOLVED') ? 'RESOLVED' : 'PARTIALLY_RESOLVED',
    startDate, endDate, months, segments, payHistory,
  }
}
