import { buildPayHistory } from '../../../engines/pay/history/buildPayHistory'
import { EVENT_TYPE_LABELS } from '../../../domain/events/eventTypes'
import { explainCalculationReason } from '../models/calculationPresentation'

function formatCurrency(value) {
  return `₹${Number(value).toLocaleString('en-IN')}`
}

function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat('en-IN', {
    day: options.day ?? '2-digit',
    month: options.month ?? 'short',
    year: options.year ?? 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function describeStructure(payState) {
  if (Number(payState?.cpc) === 5) {
    return `5th CPC Scale ${payState.payScaleLabel ?? payState.payScaleId}`
  }
  if (Number(payState?.cpc) === 6) {
    return `${payState.payBand} / GP ${formatCurrency(payState.gradePay)}`
  }
  return `Level ${payState?.level} / Cell ${payState?.cellIndex}`
}

function normalizeOpeningState(caseData) {
  const state = caseData?.openingPayState ?? caseData?.startingPay ?? {}
  return {
    ...state,
    cpc: Number(state.cpc ?? caseData?.payCommission),
    level: state.level ?? state.payLevel,
    payScaleId: state.payScaleId ?? state.payScaleCode ?? state.payScale,
    stageIndex: state.stageIndex === '' ? '' : Number(state.stageIndex),
    payInBand: state.payInBand ?? state.payInPayBand,
    cellIndex: state.cellIndex === '' ? '' : Number(state.cellIndex),
    basicPay: state.basicPay === '' ? '' : Number(state.basicPay),
    gradePay: state.gradePay === '' ? '' : Number(state.gradePay),
  }
}

function StatusBadge({ status }) {
  const unresolved = status !== 'RESOLVED'
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${unresolved ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
      {unresolved ? 'Partially resolved' : 'Resolved'}
    </span>
  )
}

function Segment({ segment, detailed }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-500">
        {formatDate(segment.from)}–{formatDate(segment.to)}
      </p>
      <p className="mt-1 font-medium text-slate-900">{describeStructure(segment.payState)}</p>
      <p className="mt-1 text-sm text-slate-700">Basic Pay {formatCurrency(segment.basicPay)}</p>
      {segment.derivedFrom.latestAppliedEventId ? (
        <p className="mt-2 text-xs text-slate-500">
          {detailed
            ? `From event ${segment.derivedFrom.latestAppliedEventId} · ${segment.derivedFrom.ruleId ?? 'recorded transformation'}`
            : 'From a recorded career change'}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">From opening Pay State</p>
      )}
    </div>
  )
}

export default function PayHistory({ caseData, detailed = false }) {
  const history = buildPayHistory({
    openingState: normalizeOpeningState(caseData),
    events: caseData?.serviceEvents ?? [],
    startDate: caseData?.calculationStartDate,
    endDate: caseData?.calculationEndDate,
  })
  const historyError = history.errors?.[0]?.message ?? history.errors?.[0]

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Pay History</h2>
          <p className="mt-1 text-sm text-slate-600">Month-wise Basic Pay only; no salary proration or allowances.</p>
        </div>
        {history.success ? <StatusBadge status={history.status} /> : null}
      </div>

      {!history.success ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
          <p className="font-semibold">{explainCalculationReason(history.reason, historyError).title}</p>
          <p className="mt-1">{explainCalculationReason(history.reason, historyError).message}</p>
          {detailed && history.reason ? <p className="technical-code mt-2">Reason: {history.reason}</p> : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {history.months.map((period) => {
            const changedMidMonth = period.segments.length > 1
            const hasDetails = changedMidMonth || period.events.length > 0 || period.unresolvedEventIds.length > 0
            return (
              <article key={`${period.year}-${period.month}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 [content-visibility:auto]">
                <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_1fr_auto] sm:items-center">
                  <p className="font-semibold text-slate-900">
                    {formatDate(period.periodStart, { day: undefined, month: 'long' }).replace(/^\d{2} /, '')}
                  </p>
                  <p className="text-sm text-slate-700">{changedMidMonth ? 'Changed mid-month' : describeStructure(period.payState)}</p>
                  <p className="font-semibold text-slate-900">{changedMidMonth ? '—' : formatCurrency(period.basicPay)}</p>
                  <StatusBadge status={period.status} />
                </div>

                {hasDetails ? (
                  <details className="mt-3 border-t border-slate-200 pt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                      View period details
                    </summary>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {period.segments.map((segment) => <Segment key={`${segment.from}-${segment.to}`} segment={segment} detailed={detailed} />)}
                    </div>
                    {period.events.length ? (
                      <div className="mt-3 text-xs text-slate-600">
                        <p className="font-semibold text-slate-700">Events in this period</p>
                        <ul className="mt-1 space-y-1">
                          {period.events.map((event) => (
                            <li key={`${event.eventId}-${event.effectiveDate}`}>
                              {formatDate(event.effectiveDate)} · {EVENT_TYPE_LABELS[event.eventType] ?? 'Career change'} ·{' '}
                              {event.success ? 'Applied' : explainCalculationReason(event.reason).message}
                              {detailed ? ` · ${event.eventType} · ${event.success ? event.payFixationEffect ?? event.ruleId : event.reason}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </details>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
