import { calendarMonthEnd, calendarMonthStart } from '../../../domain/dates/calendarDate'
import { calculateProratedComponent, PRORATION_METHODS, resolveProrationDecision } from '../../../domain/pay/proration'
import { calculateAllowancesForSegment } from './calculateAllowancesForSegment'

function fullMonthResult(componentCode, amount, segment) {
  return {
    status: Number.isFinite(Number(amount)) ? 'RESOLVED' : 'UNRESOLVED',
    reason: Number.isFinite(Number(amount)) ? null : 'FULL_MONTH_COMPONENT_UNRESOLVED',
    month: segment.effectiveFrom.slice(0, 7), componentCode,
    segmentFrom: segment.effectiveFrom, segmentTo: segment.effectiveTo,
    eligibleDays: segment.days, fullMonthlyAmount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    method: 'FULL_MONTH', divisor: null, factor: 1,
    rawProratedAmount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    roundingDecision: { status: 'RESOLVED', method: 'NOT_REQUIRED' },
    finalAmount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    warnings: [],
  }
}

function notPayableResult(componentCode, amount, segment) {
  return {
    status: 'NOT_PAYABLE', reason: 'NOTIONAL_ONLY_NO_MONETARY_ENTITLEMENT',
    month: segment.effectiveFrom.slice(0, 7), componentCode,
    segmentFrom: segment.effectiveFrom, segmentTo: segment.effectiveTo,
    eligibleDays: segment.days, fullMonthlyAmount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    method: null, divisor: null, factor: null, rawProratedAmount: null,
    roundingDecision: null, finalAmount: null, warnings: [],
  }
}

function customDefinitionDecision(definition) {
  if (definition?.prorationPolicy === 'FULL_MONTH') {
    return { status: 'RESOLVED', scope: 'CUSTOM_ALLOWANCE_DEFINITION', decision: { method: PRORATION_METHODS.NO_PRORATION_FULL_AMOUNT, sourceType: 'USER_CONFIRMED', reference: definition.metadata?.reference ?? null } }
  }
  if (definition?.prorationPolicy === 'NOT_PRORATABLE') return { status: 'UNRESOLVED', reason: 'CUSTOM_ALLOWANCE_PRORATION_NOT_CONFIRMED', decision: null }
  return null
}

function calculateComponent({ componentCode, amount, segment, prorationConfig, customDefinition }) {
  if (segment.monetaryStatus === 'NOTIONAL_ONLY') return notPayableResult(componentCode, amount, segment)
  const needsProration = segment.effectiveFrom !== calendarMonthStart(segment.effectiveFrom)
    || segment.effectiveTo !== calendarMonthEnd(segment.effectiveTo)
  if (!needsProration) return fullMonthResult(componentCode, amount, segment)
  const request = { month: segment.effectiveFrom.slice(0, 7), componentCode, segmentFrom: segment.effectiveFrom, segmentTo: segment.effectiveTo }
  let decisionResolution = resolveProrationDecision(prorationConfig, request)
  if (decisionResolution.status !== 'RESOLVED' && customDefinition) decisionResolution = customDefinitionDecision(customDefinition) ?? decisionResolution
  if (decisionResolution.status !== 'RESOLVED' && customDefinition && !customDefinition.prorationPolicy) decisionResolution = { ...decisionResolution, reason: 'CUSTOM_ALLOWANCE_PRORATION_NOT_CONFIRMED' }
  return calculateProratedComponent({ fullMonthlyAmount: amount, componentCode, segmentFrom: segment.effectiveFrom, segmentTo: segment.effectiveTo, decisionResolution })
}

export function calculateSegmentDue({ segment, enabledAllowances, registry, prorationConfig } = {}) {
  if (!segment || !Number.isFinite(Number(segment.basicPay))) return { success: false, status: 'UNRESOLVED', reason: 'INVALID_FINANCIAL_SEGMENT', segment }
  const allowances = calculateAllowancesForSegment({ segment, enabledAllowances, registry })
  const basicPay = calculateComponent({ componentCode: 'BASIC_PAY', amount: segment.basicPay, segment, prorationConfig })
  const da = calculateComponent({ componentCode: 'DA', amount: allowances.results.da.amount, segment, prorationConfig })
  const hra = calculateComponent({ componentCode: 'HRA', amount: allowances.results.hra.amount, segment, prorationConfig })
  const transportAllowance = calculateComponent({ componentCode: 'TRANSPORT_ALLOWANCE', amount: allowances.results.transportAllowance.amount, segment, prorationConfig })
  const customAllowances = allowances.results.custom.map((result) => {
    const definition = segment.customAllowanceDefinitions.find(({ id }) => id === result.definitionId)
    return calculateComponent({ componentCode: `CUSTOM:${result.definitionId}`, amount: result.amount, segment, prorationConfig, customDefinition: definition })
  })
  const componentResults = [basicPay, da, hra, transportAllowance, ...customAllowances]
  const unresolvedProration = componentResults.filter(({ status }) => status === 'UNRESOLVED')
  const payableResults = componentResults.filter(({ status }) => status === 'RESOLVED')
  const notionalOnly = segment.monetaryStatus === 'NOTIONAL_ONLY'
  const fullMonthlyGross = allowances.unresolvedComponents.length ? null : Number(segment.basicPay) + allowances.resolvedAllowanceTotal
  const finalGross = !notionalOnly && !unresolvedProration.length && !allowances.unresolvedComponents.length
    ? payableResults.reduce((total, result) => total + Number(result.finalAmount), 0)
    : null
  const unresolvedComponents = [...new Set([
    ...allowances.unresolvedComponents,
    ...unresolvedProration.map(({ componentCode }) => componentCode),
  ])]

  return {
    success: true, ...segment, allowances: allowances.results,
    allowanceTotal: allowances.unresolvedComponents.length ? null : allowances.resolvedAllowanceTotal,
    knownResolvedAllowanceTotal: allowances.resolvedAllowanceTotal,
    grossDueBeforeProration: fullMonthlyGross,
    grossDue: finalGross,
    proration: { basicPay, da, hra, transportAllowance, customAllowances },
    unresolvedProrationReasons: [...new Set(unresolvedProration.map(({ reason }) => reason))],
    unresolvedComponents,
    status: notionalOnly ? 'NOTIONAL_ONLY' : unresolvedComponents.length || allowances.status !== 'RESOLVED' ? 'PARTIALLY_RESOLVED' : 'RESOLVED',
    calculationStatus: notionalOnly ? 'NOTIONAL_ONLY' : unresolvedProration.length ? 'PRORATION_UNRESOLVED' : 'RESOLVED',
    confidence: allowances.confidence,
    reason: notionalOnly ? 'NOTIONAL_ONLY_NO_MONETARY_ENTITLEMENT' : unresolvedProration[0]?.reason ?? null,
    provenance: {
      ...segment.provenance,
      notionalRefixationEventId: segment.notionalRefixationEventId,
      allowanceRuleIds: [allowances.results.da.ruleId, allowances.results.hra.ruleId, allowances.results.transportAllowance.ruleId].filter(Boolean),
      customAllowanceDefinitionIds: allowances.results.custom.map(({ definitionId }) => definitionId),
    },
  }
}
