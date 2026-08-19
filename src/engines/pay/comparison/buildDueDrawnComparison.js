import { compareDueDrawnMonth } from './compareMonth'
import { summarizeDueDrawnComparison } from './summarizeComparison'

export function buildDueDrawnComparison({ duePayLedger, drawnPayHistory = [] } = {}) {
  if (!duePayLedger?.success) {
    return {
      success: false,
      status: 'UNRESOLVED',
      reason: duePayLedger?.reason ?? 'DUE_PAY_LEDGER_UNAVAILABLE',
      months: [],
      summary: summarizeDueDrawnComparison([]),
      provenance: { duePayLedger, drawnPayHistory },
    }
  }
  const drawnByMonth = new Map(drawnPayHistory.map((record) => [record.month, record]))
  const months = duePayLedger.months.map((dueMonth) => compareDueDrawnMonth(
    dueMonth,
    drawnByMonth.get(dueMonth.month) ?? null,
  ))
  const summary = summarizeDueDrawnComparison(months)
  return {
    success: true,
    status: summary.status,
    months,
    summary,
    ignoredDrawnMonths: drawnPayHistory
      .filter((record) => !duePayLedger.months.some((month) => month.month === record.month))
      .map((record) => record.month),
    provenance: { duePayLedger, drawnPayHistory },
  }
}
