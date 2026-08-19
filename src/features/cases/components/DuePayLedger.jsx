import { useState } from 'react'
import { buildCaseDuePayLedger } from '../models/buildCaseDuePayLedger'
import { explainCalculationReason, explainDueMonth, technicalLabel } from '../models/calculationPresentation'

function formatCurrency(value) {
  return value === null || value === undefined ? '—' : `₹${Number(value).toLocaleString('en-IN')}`
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function formatMonth(value) {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}-01T00:00:00Z`))
}

function allowanceRows(segment) {
  return [
    ['Dearness Allowance', segment.allowances.da],
    ['House Rent Allowance', segment.allowances.hra],
    ['Transport Allowance', segment.allowances.transportAllowance],
    ...segment.allowances.custom.map((result) => [result.name, result]),
  ]
}

function StatusBadge({ resolved }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${resolved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-950'}`}>
      {resolved ? 'Resolved' : 'Needs information'}
    </span>
  )
}

export default function DuePayLedger({ caseData, detailed = false }) {
  const [filter, setFilter] = useState('all')
  const ledger = buildCaseDuePayLedger(caseData)
  const ledgerGuidance = ledger.success
    ? null
    : explainCalculationReason(ledger.reason, ledger.errors?.[0]?.message ?? ledger.errors?.[0])
  const unresolvedCount = ledger.success ? ledger.months.filter((month) => month.status !== 'RESOLVED').length : 0
  const visibleMonths = ledger.success && filter === 'attention'
    ? ledger.months.filter((month) => month.status !== 'RESOLVED')
    : ledger.success ? ledger.months : []

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Due Pay</h2>
          <p className="mt-1 text-sm text-slate-600">Monthly due salary from replayed pay and dated allowance rules.</p>
        </div>
        {ledger.success ? <StatusBadge resolved={ledger.status === 'RESOLVED'} /> : null}
      </div>

      {!ledger.success ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
          <p className="font-semibold">{ledgerGuidance.title}</p>
          <p className="mt-1">{ledgerGuidance.message}</p>
          {detailed && ledgerGuidance.code ? <p className="technical-code mt-2">Reason: {ledgerGuidance.code}</p> : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="ledger-toolbar">
            <span>{ledger.months.length} months · {unresolvedCount} need attention</span>
            <div className="ledger-filters" aria-label="Filter Due Pay months">
              <button type="button" className={filter === 'all' ? 'selected' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All months</button>
              <button type="button" className={filter === 'attention' ? 'selected' : ''} aria-pressed={filter === 'attention'} onClick={() => setFilter('attention')}>Needs attention ({unresolvedCount})</button>
            </div>
          </div>
          {!visibleMonths.length ? <p className="ledger-empty">Every Due Pay month is resolved.</p> : null}
          {visibleMonths.map((month) => {
            const resolved = month.status === 'RESOLVED'
            const guidance = resolved ? null : explainDueMonth(month)
            return (
              <article key={month.month} className="rounded-xl border border-slate-200 bg-slate-50 p-4 [content-visibility:auto]">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div>
                    <p className="font-semibold text-slate-900">{formatMonth(month.month)}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(month.periodStart)}–{formatDate(month.periodEnd)}</p>
                  </div>
                  <p className="font-semibold text-slate-900">
                    {resolved ? `Gross due ${formatCurrency(month.grossDue)}` : 'Gross due not final'}
                  </p>
                  <StatusBadge resolved={resolved} />
                </div>

                {!resolved ? (
                  <div className="calculation-guidance mt-3" role="status">
                    <strong>{guidance.title}</strong>
                    <span>{guidance.message}</span>
                  </div>
                ) : (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                    <div><dt className="text-slate-500">Basic Pay</dt><dd className="font-medium text-slate-900">{formatCurrency(month.components.basicPay)}</dd></div>
                    <div><dt className="text-slate-500">Allowances</dt><dd className="font-medium text-slate-900">{formatCurrency(month.allowanceTotal)}</dd></div>
                    <div><dt className="text-slate-500">Gross Due</dt><dd className="font-semibold text-slate-900">{formatCurrency(month.grossDue)}</dd></div>
                  </dl>
                )}

                <details className="mt-3 border-t border-slate-200 pt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    {detailed ? 'View calculation audit' : 'See salary breakdown'}
                  </summary>
                  <div className="mt-3 space-y-3">
                    {month.segments.map((segment) => (
                      <div key={`${segment.effectiveFrom}-${segment.effectiveTo}`} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <p className="font-semibold text-slate-900">{formatDate(segment.effectiveFrom)}–{formatDate(segment.effectiveTo)}</p>
                        <p className="mt-1 text-slate-700">Basic Pay: {formatCurrency(segment.basicPay)}</p>
                        <dl className="mt-2 space-y-1">
                          {allowanceRows(segment).map(([label, result]) => (
                            <div key={`${label}-${result.definitionId ?? result.allowanceCode}`} className="flex justify-between gap-4">
                              <dt className="text-slate-600">{label}</dt>
                              <dd className="text-right font-medium text-slate-900">
                                {result.status === 'RESOLVED'
                                  ? formatCurrency(result.amount)
                                  : result.status === 'NOT_APPLICABLE'
                                    ? 'Not selected'
                                    : explainCalculationReason(result.reason).message}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        {segment.confidence === 'AFFECTED_BY_PRIOR_UNRESOLVED_EVENT' ? <p className="mt-2 text-xs font-medium text-amber-900">An earlier career change still needs review.</p> : null}
                        {detailed ? (
                          <div className="technical-audit mt-3">
                            <p>Confidence: {technicalLabel(segment.confidence)}</p>
                            <p>Rules: {segment.provenance.allowanceRuleIds.join(', ') || 'No selected allowance rule'}</p>
                            {allowanceRows(segment).filter(([, result]) => result.reason).map(([label, result]) => (
                              <p key={`${label}-${result.reason}`}>{label} reason: {result.reason}</p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </details>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
