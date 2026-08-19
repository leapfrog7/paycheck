import { getCalculationGoal } from '../../../data/calculationGoals'
import { EVENT_TYPES } from '../../../domain/events/eventTypes'
import { buildDueDrawnComparison } from '../../../engines/pay/comparison/buildDueDrawnComparison'
import { ANNUAL_INCREMENT_TREATMENTS, OTHER_CHANGE_LABELS, OTHER_CHANGE_TYPES } from './buildGuidedExpectedPay'
import { buildCaseDuePayLedger } from './buildCaseDuePayLedger'

const CAREER_EVENT_TYPES = {
  [OTHER_CHANGE_TYPES.PROMOTION]: [EVENT_TYPES.REGULAR_PROMOTION, EVENT_TYPES.AD_HOC_PROMOTION, EVENT_TYPES.RETROSPECTIVE_PROMOTION],
  [OTHER_CHANGE_TYPES.MACP_ACP]: [EVENT_TYPES.MACP, EVENT_TYPES.ACP],
  [OTHER_CHANGE_TYPES.PAY_REVISION]: [EVENT_TYPES.CPC_TRANSITION],
  [OTHER_CHANGE_TYPES.PAY_CORRECTION]: [EVENT_TYPES.PAY_CORRECTION, EVENT_TYPES.PAY_REFIXATION, EVENT_TYPES.NOTIONAL_REFIXATION, EVENT_TYPES.NOTIONAL_FIXATION],
}

const COMPONENT_LABELS = {
  HRA: 'House Rent Allowance',
  TRANSPORT_ALLOWANCE: 'Transport Allowance',
  DA: 'Dearness Allowance',
  BASIC_PAY: 'Basic Pay',
}

function unique(items) {
  return [...new Set(items)]
}

function findPendingCareerChanges(caseData) {
  const selected = caseData?.careerChangeReview?.otherChanges ?? []
  const eventTypes = new Set((caseData?.serviceEvents ?? []).map((event) => event.type))
  const pending = selected.filter((change) => {
    if (change === OTHER_CHANGE_TYPES.NONE) return false
    if (change === OTHER_CHANGE_TYPES.UNSURE) return true
    return !(CAREER_EVENT_TYPES[change] ?? []).some((type) => eventTypes.has(type))
  })
  if (caseData?.careerChangeReview?.annualIncrementTreatment === ANNUAL_INCREMENT_TREATMENTS.UNSURE) {
    pending.unshift('ROUTINE_INCREMENT_REVIEW')
  }
  return unique(pending)
}

function careerLabel(change) {
  return change === 'ROUTINE_INCREMENT_REVIEW' ? 'routine annual increments' : OTHER_CHANGE_LABELS[change]
}

function sumResolvedDue(months) {
  return months.reduce((total, month) => total + Number(month.grossDue ?? 0), 0)
}

function sumComparableDrawn(months) {
  return months
    .filter((month) => month.status === 'RESOLVED')
    .reduce((total, month) => total + Number(month.drawn?.gross ?? 0), 0)
}

function outcomeFromDifference(difference) {
  if (difference > 0) return 'ARREAR'
  if (difference < 0) return 'RECOVERY'
  return 'NIL'
}

export function buildCaseOverview(caseData) {
  const goal = getCalculationGoal(caseData?.calculationGoal)
  const dueLedger = buildCaseDuePayLedger(caseData)
  const comparison = buildDueDrawnComparison({
    duePayLedger: dueLedger,
    drawnPayHistory: caseData?.drawnPayHistory ?? [],
  })
  const dueMonths = dueLedger.success ? dueLedger.months : []
  const resolvedDueMonths = dueMonths.filter((month) => month.status === 'RESOLVED')
  const totalMonths = dueMonths.length
  const totalDue = sumResolvedDue(resolvedDueMonths)
  const totalDrawn = comparison.success ? sumComparableDrawn(comparison.months) : 0
  const drawnCount = caseData?.drawnPayHistory?.length ?? 0
  const latestResolved = resolvedDueMonths.at(-1) ?? null
  const latestPayHistoryMonth = dueLedger.success ? dueLedger.payHistory?.months?.at(-1) : null
  const latestBasicPay = latestResolved?.components?.basicPay ?? latestPayHistoryMonth?.basicPay ?? null
  const pendingCareerChanges = findPendingCareerChanges(caseData)
  const unresolvedComponents = unique(dueMonths.flatMap((month) => month.unresolvedComponents ?? []))
  const unresolvedEventIds = unique(dueMonths.flatMap((month) => month.unresolvedEventIds ?? []))
  const unresolvedDueMonths = dueMonths.filter((month) => month.status !== 'RESOLVED')
  const missingDrawnMonths = comparison.success ? comparison.months.filter((month) => (
    month.reasons?.includes('DRAWN_PAY_NOT_ENTERED') || month.reasons?.includes('DRAWN_GROSS_NOT_ENTERED')
  )).length : totalMonths
  const allCompared = comparison.success && comparison.summary.totalMonths > 0 && comparison.summary.unresolvedMonths === 0
  const dueComplete = dueLedger.success && dueLedger.status === 'RESOLVED' && pendingCareerChanges.length === 0
  const hasComparedMonths = comparison.success && comparison.summary.resolvedMonths > 0
  const isArrearsGoal = goal.id === 'ARREARS_RECOVERY'

  const attentionItems = []
  if (!dueLedger.success) {
    attentionItems.push({
      id: 'opening-pay', tone: 'blocking', title: 'Opening pay needs attention',
      description: 'Confirm the calculation period and opening pay position so PayCheck can build Expected Pay.',
      actionLabel: 'Review opening pay', actionStep: 'basics',
    })
  }
  if (pendingCareerChanges.length) {
    attentionItems.push({
      id: 'career-changes', tone: 'attention', title: 'Add the change details you identified',
      description: `Review ${pendingCareerChanges.map(careerLabel).join(', ')}. Until then, later pay is provisional.`,
      actionLabel: 'Add change details', actionStep: 'events',
    })
  }
  if (unresolvedEventIds.length) {
    attentionItems.push({
      id: 'unresolved-events', tone: 'attention', title: 'Review a career change that could not be applied',
      description: `${unresolvedEventIds.length} recorded event${unresolvedEventIds.length === 1 ? '' : 's'} need corrected dates or fixation details before later pay can be finalized.`,
      actionLabel: 'Review career changes', actionStep: 'events',
    })
  }
  if (unresolvedComponents.length) {
    attentionItems.push({
      id: 'salary-components', tone: 'attention', title: 'Complete salary-component details',
      description: `${unresolvedComponents.map((component) => COMPONENT_LABELS[component] ?? component).join(' and ')} cannot yet be finalized.`,
      actionLabel: 'Complete components', actionStep: 'allowances',
    })
  }
  if (dueLedger.success && unresolvedDueMonths.length && !unresolvedComponents.length && !unresolvedEventIds.length) {
    attentionItems.push({
      id: 'incomplete-expected-pay', tone: 'attention', title: 'Review incomplete Expected Pay months',
      description: `${unresolvedDueMonths.length} month${unresolvedDueMonths.length === 1 ? '' : 's'} need calculation details before Gross Expected Pay can be finalized.`,
      actionLabel: 'Review Expected Pay', actionStep: 'history',
    })
  }
  if (isArrearsGoal && dueLedger.success && missingDrawnMonths > 0) {
    attentionItems.push({
      id: 'drawn-pay', tone: 'next', title: drawnCount ? 'Continue entering what you were paid' : 'Add what you were actually paid',
      description: `${missingDrawnMonths} of ${totalMonths} months still need Drawn Pay before the final difference is known.`,
      actionLabel: drawnCount ? 'Continue Drawn Pay' : 'Enter Drawn Pay', actionStep: 'drawn',
    })
  }

  let primaryAction = attentionItems[0]
  if (!primaryAction) {
    if (isArrearsGoal && allCompared) primaryAction = { actionLabel: 'View arrear / recovery', actionStep: 'result' }
    else if (goal.id === 'CHECK_FIXATION') primaryAction = { actionLabel: 'Review career changes', actionStep: 'events' }
    else primaryAction = { actionLabel: 'Review monthly pay history', actionStep: 'history' }
  }

  let confidence = 'Needs information'
  if (allCompared) confidence = 'Fully reconciled'
  else if (hasComparedMonths) confidence = 'Partially reconciled'
  else if (dueComplete) confidence = 'Expected Pay calculated'
  else if (resolvedDueMonths.length || latestBasicPay !== null) confidence = 'Estimate available'

  let result = {
    label: resolvedDueMonths.length ? 'Expected Pay calculated so far' : latestBasicPay !== null ? 'Latest Basic Pay available' : 'Expected Pay not available',
    amount: resolvedDueMonths.length ? totalDue : latestBasicPay,
    outcome: resolvedDueMonths.length ? 'EXPECTED PAY' : latestBasicPay !== null ? 'BASIC PAY ONLY' : 'NEEDS INFORMATION',
    tone: resolvedDueMonths.length ? 'neutral' : 'attention',
    explanation: resolvedDueMonths.length
      ? 'This is calculated salary, not arrears. Add Drawn Pay to find the difference.'
      : latestBasicPay !== null
        ? 'Your Basic Pay path is available. Complete selected salary components to finalize Gross Expected Pay.'
        : 'Complete the next suggested step to start the calculation.',
  }

  if (!isArrearsGoal && latestBasicPay !== null) {
    result = {
      label: goal.id === 'CHECK_FIXATION' ? 'Projected Basic Pay after recorded changes' : 'Latest projected Basic Pay',
      amount: latestBasicPay,
      outcome: 'CURRENT BASIC',
      tone: dueComplete ? 'calculated' : 'attention',
      explanation: `Projected for ${latestResolved?.month ?? latestPayHistoryMonth?.year + '-' + String(latestPayHistoryMonth?.month).padStart(2, '0')}. Open Pay History to inspect the monthly path.`,
    }
  } else if (hasComparedMonths) {
    const difference = comparison.summary.netDifference
    const outcome = outcomeFromDifference(difference)
    result = {
      label: allCompared ? (outcome === 'ARREAR' ? 'Net arrear' : outcome === 'RECOVERY' ? 'Net recovery' : 'Net difference') : 'Net difference so far',
      amount: Math.abs(difference),
      outcome,
      tone: outcome === 'ARREAR' ? 'arrear' : outcome === 'RECOVERY' ? 'recovery' : 'calculated',
      explanation: allCompared ? 'Every month in the selected period has been reconciled.' : 'This includes reconciled months only and is not the final case total.',
    }
  }

  const coverage = allCompared
    ? `${comparison.summary.resolvedMonths} of ${totalMonths} months reconciled`
    : resolvedDueMonths.length
      ? `${resolvedDueMonths.length} of ${totalMonths} months have calculated Expected Pay`
      : latestBasicPay !== null
        ? `Basic Pay path available; 0 of ${totalMonths} Gross Pay months finalized`
        : 'Add opening pay to begin the calculation'

  return {
    goal,
    dueLedger,
    comparison,
    confidence,
    result,
    coverage,
    primaryAction,
    attentionItems,
    pendingCareerChanges,
    unresolvedComponents,
    unresolvedEventIds,
    totals: {
      due: resolvedDueMonths.length ? totalDue : null,
      drawn: hasComparedMonths ? totalDrawn : null,
      difference: hasComparedMonths ? comparison.summary.netDifference : null,
    },
    counts: {
      totalMonths,
      resolvedDueMonths: resolvedDueMonths.length,
      drawnMonths: drawnCount,
      comparedMonths: comparison.summary.resolvedMonths,
      serviceEvents: caseData?.serviceEvents?.length ?? 0,
    },
    latestBasicPay,
    dueComplete,
    allCompared,
  }
}
