import { getPayMatrixLevel } from '../../domain/pay/payMatrix'

export const SIXTH_CPC_MACP_FINANCIAL_HIERARCHY = Object.freeze([
  ['PB-1', 1800], ['PB-1', 1900], ['PB-1', 2000], ['PB-1', 2400], ['PB-1', 2800],
  ['PB-2', 4200], ['PB-2', 4600], ['PB-2', 4800], ['PB-2', 5400],
  ['PB-3', 5400], ['PB-3', 6600], ['PB-3', 7600],
  ['PB-4', 8700], ['PB-4', 8900], ['PB-4', 10000],
].map(([payBand, gradePay]) => Object.freeze({ payBand, gradePay })))

export const SEVENTH_CPC_MACP_LEVEL_HIERARCHY = Object.freeze([
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '13A', '14', '15', '16', '17', '18',
])

export function getNextSixthCpcMacpStructure(payState = {}) {
  const index = SIXTH_CPC_MACP_FINANCIAL_HIERARCHY.findIndex(({ payBand, gradePay }) => payBand === payState.payBand && gradePay === Number(payState.gradePay))
  return index >= 0 ? SIXTH_CPC_MACP_FINANCIAL_HIERARCHY[index + 1] ?? null : null
}

export function getNextSeventhCpcMacpLevel(level) {
  const index = SEVENTH_CPC_MACP_LEVEL_HIERARCHY.indexOf(String(level))
  const next = index >= 0 ? SEVENTH_CPC_MACP_LEVEL_HIERARCHY[index + 1] : null
  return next && getPayMatrixLevel(next) ? next : null
}

export function resolveSixthCpcMacpTarget(payState, event = {}) {
  const expected = getNextSixthCpcMacpStructure(payState)
  if (!expected) return { status: 'UNRESOLVED', reason: 'NO_NEXT_MACP_FINANCIAL_STRUCTURE', expectedTarget: null }
  const supplied = event.targetPayBand || event.targetGradePay !== undefined
    ? { payBand: event.targetPayBand, gradePay: Number(event.targetGradePay) }
    : null
  if (supplied && (supplied.payBand !== expected.payBand || supplied.gradePay !== expected.gradePay)) {
    return { status: 'UNRESOLVED', reason: 'MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_STRUCTURE', expectedTarget: expected, suppliedTarget: supplied }
  }
  return { status: 'RESOLVED', target: expected, provenance: supplied ? 'LEGACY_USER_CONFIRMED_MATCHED_CONTROLLED_HIERARCHY' : 'CONTROLLED_MACPS_HIERARCHY' }
}

export function resolveSeventhCpcMacpTarget(payState, event = {}) {
  const expectedLevel = getNextSeventhCpcMacpLevel(payState.level)
  if (!expectedLevel) return { status: 'UNRESOLVED', reason: 'NO_NEXT_MACP_FINANCIAL_LEVEL', expectedTargetLevel: null }
  if (event.targetLevel !== undefined && event.targetLevel !== null && event.targetLevel !== '' && String(event.targetLevel) !== expectedLevel) {
    return { status: 'UNRESOLVED', reason: 'MACP_TARGET_NOT_IMMEDIATE_FINANCIAL_LEVEL', expectedTargetLevel: expectedLevel, suppliedTargetLevel: String(event.targetLevel) }
  }
  const supplied = event.targetLevel !== undefined && event.targetLevel !== null && event.targetLevel !== ''
  return { status: 'RESOLVED', targetLevel: expectedLevel, provenance: supplied ? 'LEGACY_USER_CONFIRMED_MATCHED_CONTROLLED_HIERARCHY' : 'CONTROLLED_MACPS_HIERARCHY' }
}
