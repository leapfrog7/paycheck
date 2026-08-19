import { useState } from 'react'
import { buildDueDrawnComparison } from '../../../engines/pay/comparison/buildDueDrawnComparison'
import { buildCaseDuePayLedger } from '../models/buildCaseDuePayLedger'
import { componentName, explainCalculationReason, technicalLabel } from '../models/calculationPresentation'

const COMPONENT_KEYS = ['basicPay', 'da', 'hra', 'transportAllowance']

function formatCurrency(value) {
  return value === null || value === undefined ? '—' : `₹${Number(value).toLocaleString('en-IN')}`
}

function formatSignedCurrency(value) {
  if (value === null || value === undefined) return '—'
  if (value > 0) return `+${formatCurrency(value)}`
  if (value < 0) return `−${formatCurrency(Math.abs(value))}`
  return formatCurrency(0)
}

function formatMonth(value) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}-01T00:00:00Z`))
}

function outcomeLabel(month) {
  if (month.status !== 'RESOLVED') return 'Unresolved'
  if (month.outcome === 'ARREAR') return `Arrear ${formatCurrency(month.arrearAmount)}`
  if (month.outcome === 'RECOVERY') return `Recovery ${formatCurrency(month.recoveryAmount)}`
  return 'Nil difference'
}

export default function ArrearRecoverySection({ caseData, detailed = false }) {
  const [filter, setFilter] = useState('all')
  const comparison = buildDueDrawnComparison({
    duePayLedger: buildCaseDuePayLedger(caseData),
    drawnPayHistory: caseData?.drawnPayHistory ?? [],
  })
  const summary = comparison.summary
  const netLabel = summary.netDifference > 0
    ? 'Net Arrear'
    : summary.netDifference < 0 ? 'Net Recovery' : 'Net Difference'
  const comparisonGuidance = comparison.success ? null : explainCalculationReason(comparison.reason)
  const visibleMonths = comparison.success && filter === 'attention'
    ? comparison.months.filter((month) => month.status === 'UNRESOLVED')
    : comparison.success ? comparison.months : []

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Arrear / Recovery</h2>
        <p className="mt-1 text-sm text-slate-600">Monthly comparison of calculated Due Pay and independently recorded Drawn Pay.</p>
      </div>

      {!comparison.success ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
          <p className="font-semibold">{comparisonGuidance.title}</p>
          <p className="mt-1">{comparisonGuidance.message}</p>
          {detailed && comparisonGuidance.code ? <p className="technical-code mt-2">Reason: {comparisonGuidance.code}</p> : null}
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-medium text-emerald-800">Total Arrear</p><p className="mt-1 text-lg font-bold text-emerald-950">{formatCurrency(summary.totalArrear)}</p></div>
            <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs font-medium text-rose-800">Total Recovery</p><p className="mt-1 text-lg font-bold text-rose-950">{formatCurrency(summary.totalRecovery)}</p></div>
            <div className="rounded-xl bg-blue-50 p-3"><p className="text-xs font-medium text-blue-800">{netLabel}</p><p className="mt-1 text-lg font-bold text-blue-950">{formatCurrency(Math.abs(summary.netDifference))}</p></div>
            <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-medium text-slate-600">Resolved months</p><p className="mt-1 text-lg font-bold text-slate-900">{summary.resolvedMonths}</p></div>
            <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs font-medium text-amber-800">Unresolved months</p><p className="mt-1 text-lg font-bold text-amber-950">{summary.unresolvedMonths}</p></div>
          </div>

          {summary.totalsScope === 'RESOLVED_MONTHS_ONLY' ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">Totals currently include resolved months only and are not the final case totals.</p>
          ) : null}

          <div className="mt-4 space-y-3">
            <div className="ledger-toolbar">
              <span>{summary.totalMonths} months · {summary.unresolvedMonths} need attention</span>
              <div className="ledger-filters" aria-label="Filter comparison months">
                <button type="button" className={filter === 'all' ? 'selected' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All months</button>
                <button type="button" className={filter === 'attention' ? 'selected' : ''} aria-pressed={filter === 'attention'} onClick={() => setFilter('attention')}>Needs attention ({summary.unresolvedMonths})</button>
              </div>
            </div>
            {!visibleMonths.length ? <p className="ledger-empty">Every month is reconciled.</p> : null}
            {visibleMonths.map((month) => (
              <article key={month.month} className="rounded-xl border border-slate-200 bg-slate-50 p-4 [content-visibility:auto]">
                <div className="grid gap-3 sm:grid-cols-[1fr_repeat(3,auto)] sm:items-center sm:gap-6">
                  <p className="font-semibold text-slate-900">{formatMonth(month.month)}</p>
                  <p className="text-sm text-slate-700"><span className="text-slate-500">Due</span> {formatCurrency(month.due.gross)}</p>
                  <p className="text-sm text-slate-700"><span className="text-slate-500">Drawn</span> {formatCurrency(month.drawn?.gross)}</p>
                  <p className={`text-sm font-semibold ${month.status === 'UNRESOLVED' ? 'text-amber-900' : month.outcome === 'RECOVERY' ? 'text-rose-800' : month.outcome === 'ARREAR' ? 'text-emerald-800' : 'text-slate-700'}`}>{outcomeLabel(month)}</p>
                </div>

                {month.status === 'UNRESOLVED' ? (
                  <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    {[...new Map(month.reasons.map((reason) => {
                      const explanation = explainCalculationReason(reason)
                      return [explanation.message, explanation]
                    })).values()].map((explanation) => <p key={explanation.message}>{explanation.message}</p>)}
                    <p className="mt-1 font-medium">No monthly difference has been calculated.</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Signed difference: {formatSignedCurrency(month.signedDifference)}</p>
                )}

                <details className="mt-3 border-t border-slate-200 pt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">View comparison details</summary>
                  {month.drawn?.entryMode === 'GROSS_ONLY' ? (
                    <p className="mt-3 text-sm text-slate-600">Component-wise comparison unavailable because only Gross Drawn was entered.</p>
                  ) : (
                    <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {COMPONENT_KEYS.map((key) => {
                        const component = month.componentComparison[key]
                        return (
                          <div key={key} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                            <dt className="font-semibold text-slate-900">{component.label}</dt>
                            <dd className="mt-1 text-slate-600">Due {formatCurrency(component.dueAmount)}</dd>
                            <dd className="text-slate-600">Drawn {formatCurrency(component.drawnAmount)}</dd>
                            <dd className="mt-1 font-medium text-slate-900">{component.status === 'COMPARABLE' ? formatSignedCurrency(component.signedDifference) : component.status === 'NOT_ENTERED' ? 'Not entered' : 'Due component unresolved'}</dd>
                          </div>
                        )
                      })}
                    </dl>
                  )}
                  {(month.unmatchedAllowances.due.length || month.unmatchedAllowances.drawn.length) ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                      <p className="font-semibold text-slate-900">Other allowances are not automatically matched</p>
                      <p className="mt-1">Due: {month.unmatchedAllowances.due.map(({ name, amount }) => `${name} ${formatCurrency(amount)}`).join(', ') || 'None'}</p>
                      <p>Drawn: {month.unmatchedAllowances.drawn.map(({ name, amount }) => `${name} ${formatCurrency(amount)}`).join(', ') || 'None'}</p>
                    </div>
                  ) : null}
                  <p className="mt-3 text-xs text-slate-500">Due values remain traceable through the Due Pay salary breakdown above. Drawn source: {month.drawn?.sourceType === 'USER_ENTERED' ? 'User entered' : 'Not entered'}.</p>
                  {detailed ? (
                    <div className="technical-audit mt-3">
                      <p>Status: {technicalLabel(month.status)}</p>
                      <p>Outcome: {technicalLabel(month.outcome)}</p>
                      <p>Drawn entry mode: {technicalLabel(month.drawn?.entryMode ?? 'NOT_ENTERED')}</p>
                      {[...new Set(month.reasons)].map((reason) => <p key={reason}>Reason: {reason}</p>)}
                      {month.unresolvedComponents?.length ? <p>Unresolved components: {month.unresolvedComponents.map(componentName).join(', ')}</p> : null}
                    </div>
                  ) : null}
                </details>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
