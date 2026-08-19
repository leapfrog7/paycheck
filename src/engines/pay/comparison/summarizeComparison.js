import { COMPARISON_STATUS } from './compareMonth'

export function summarizeDueDrawnComparison(months = []) {
  const resolved = months.filter((month) => month.status === COMPARISON_STATUS.RESOLVED)
  const totalArrear = resolved.reduce((total, month) => total + month.arrearAmount, 0)
  const totalRecovery = resolved.reduce((total, month) => total + month.recoveryAmount, 0)
  const unresolvedMonths = months.length - resolved.length
  return {
    totalArrear,
    totalRecovery,
    netDifference: totalArrear - totalRecovery,
    resolvedMonths: resolved.length,
    unresolvedMonths,
    totalMonths: months.length,
    status: unresolvedMonths === 0 ? 'RESOLVED' : 'PARTIALLY_RESOLVED',
    totalsScope: unresolvedMonths === 0 ? 'ALL_MONTHS' : 'RESOLVED_MONTHS_ONLY',
  }
}
