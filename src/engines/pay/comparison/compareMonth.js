import { DRAWN_PAY_ENTRY_MODES } from '../../../domain/pay/drawnPay'

export const COMPARISON_OUTCOMES = Object.freeze({
  ARREAR: 'ARREAR',
  RECOVERY: 'RECOVERY',
  NIL: 'NIL',
  UNRESOLVED: 'UNRESOLVED',
})

export const COMPARISON_STATUS = Object.freeze({
  RESOLVED: 'RESOLVED',
  UNRESOLVED: 'UNRESOLVED',
})

export const COMPONENT_COMPARISON_STATUS = Object.freeze({
  COMPARABLE: 'COMPARABLE',
  NOT_ENTERED: 'NOT_ENTERED',
  UNAVAILABLE: 'UNAVAILABLE',
  UNRESOLVED: 'UNRESOLVED',
})

const SYSTEM_COMPONENTS = [
  ['basicPay', 'Basic Pay'],
  ['da', 'DA'],
  ['hra', 'HRA'],
  ['transportAllowance', 'Transport Allowance'],
]

function knownDueComponent(dueMonth, key) {
  if (dueMonth.components) return dueMonth.components[key]
  if (dueMonth.segments?.length !== 1) return null
  const segment = dueMonth.segments[0]
  if (key === 'basicPay') return Number.isFinite(Number(segment.basicPay)) ? Number(segment.basicPay) : null
  const result = segment.allowances?.[key]
  return result?.status === 'RESOLVED' || result?.status === 'NOT_APPLICABLE'
    ? result.amount
    : null
}

function compareComponents(dueMonth, drawnRecord) {
  const grossOnly = drawnRecord?.entryMode === DRAWN_PAY_ENTRY_MODES.GROSS_ONLY
  return Object.fromEntries(SYSTEM_COMPONENTS.map(([key, label]) => {
    const dueAmount = knownDueComponent(dueMonth, key)
    const drawnAmount = grossOnly ? null : drawnRecord?.components?.[key] ?? null
    let status = COMPONENT_COMPARISON_STATUS.COMPARABLE
    if (grossOnly) status = COMPONENT_COMPARISON_STATUS.UNAVAILABLE
    else if (drawnAmount === null) status = COMPONENT_COMPARISON_STATUS.NOT_ENTERED
    else if (dueAmount === null) status = COMPONENT_COMPARISON_STATUS.UNRESOLVED
    return [key, {
      component: key,
      label,
      dueAmount,
      drawnAmount,
      signedDifference: status === COMPONENT_COMPARISON_STATUS.COMPARABLE
        ? Number(dueAmount) - Number(drawnAmount)
        : null,
      status,
    }]
  }))
}

function unresolvedReasons(dueMonth, drawnRecord) {
  if (!drawnRecord) return ['DRAWN_PAY_NOT_ENTERED']
  if (dueMonth.status !== 'RESOLVED' || dueMonth.grossDue === null) {
    return [
      dueMonth.reason ?? 'DUE_PAY_NOT_FULLY_RESOLVED',
      ...(dueMonth.unresolvedComponents ?? []).map((component) => `DUE_COMPONENT_UNRESOLVED:${component}`),
      ...(dueMonth.unresolvedEventIds ?? []).map((eventId) => `DUE_EVENT_UNRESOLVED:${eventId}`),
    ]
  }
  if (drawnRecord.grossDrawn === null || drawnRecord.grossDrawn === undefined) return ['DRAWN_GROSS_NOT_ENTERED']
  return []
}

function outcomeForDifference(signedDifference) {
  if (signedDifference > 0) return COMPARISON_OUTCOMES.ARREAR
  if (signedDifference < 0) return COMPARISON_OUTCOMES.RECOVERY
  return COMPARISON_OUTCOMES.NIL
}

export function compareDueDrawnMonth(dueMonth, drawnRecord = null) {
  if (!dueMonth?.month) throw new Error('A Due Pay month is required for comparison.')
  const reasons = unresolvedReasons(dueMonth, drawnRecord)
  const resolved = reasons.length === 0
  const signedDifference = resolved ? Number(dueMonth.grossDue) - Number(drawnRecord.grossDrawn) : null
  const outcome = resolved ? outcomeForDifference(signedDifference) : COMPARISON_OUTCOMES.UNRESOLVED

  return {
    month: dueMonth.month,
    due: {
      gross: dueMonth.grossDue,
      status: dueMonth.status,
      knownComponents: Object.fromEntries(SYSTEM_COMPONENTS.map(([key]) => [key, knownDueComponent(dueMonth, key)])),
      unresolvedComponents: dueMonth.unresolvedComponents ?? [],
    },
    drawn: drawnRecord ? {
      gross: drawnRecord.grossDrawn,
      entryMode: drawnRecord.entryMode,
      completeness: drawnRecord.completeness,
      sourceType: drawnRecord.sourceType,
    } : null,
    signedDifference,
    outcome,
    arrearAmount: resolved ? (signedDifference > 0 ? signedDifference : 0) : null,
    recoveryAmount: resolved ? (signedDifference < 0 ? Math.abs(signedDifference) : 0) : null,
    status: resolved ? COMPARISON_STATUS.RESOLVED : COMPARISON_STATUS.UNRESOLVED,
    reasons,
    componentComparison: compareComponents(dueMonth, drawnRecord),
    unmatchedAllowances: {
      due: dueMonth.components?.customAllowances ?? [],
      drawn: drawnRecord?.otherAllowances ?? [],
      matchingStatus: 'NOT_ATTEMPTED',
    },
    provenance: {
      dueMonthResult: dueMonth,
      drawnPayRecord: drawnRecord,
      dueSegments: dueMonth.segments ?? [],
    },
  }
}
