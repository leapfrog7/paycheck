import { EVENT_STATUS_OPTIONS } from '../../../domain/events/eventStatus'
import { EVENT_TYPE_LABELS, EVENT_TYPES } from '../../../domain/events/eventTypes'
import { FIXATION_OPTION_LABELS } from '../../../domain/events/fixationOptions'
import { calculatePayEventTimeline } from '../../../engines/pay/eventTimeline'
import { explainCalculationReason } from '../models/calculationPresentation'

function formatCurrency(value) {
  return `₹${Number(value).toLocaleString('en-IN')}`
}

function formatDate(dateValue) {
  if (!dateValue) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateValue}T00:00:00Z`))
}

function formatStepValue(value) {
  if (Array.isArray(value)) return value.join(' + ')
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => `${key}: ${item}`).join(', ')
  }
  return String(value)
}

function CalculationDetails({ result }) {
  return (
    <details className="mt-3 border-t border-blue-200 pt-3">
      <summary className="cursor-pointer font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        Detailed calculation
      </summary>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-blue-900">
        {result.steps.map(({ operation, ...details }) => (
          <li key={operation} className="break-words">
            <span className="font-medium">{operation.replaceAll('_', ' ')}</span>
            <dl className="mt-1 grid gap-x-2 text-xs sm:grid-cols-[auto_1fr]">
              {Object.entries(details).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-blue-700">{key}</dt>
                  <dd>{formatStepValue(value)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
      <p className="mt-2">{result.explanation}</p>
    </details>
  )
}

function getErrorMessage(error) {
  return typeof error === 'string' ? error : error?.message
}

export default function ServiceEventTimeline({ caseData, detailed = false }) {
  const events = Array.isArray(caseData?.serviceEvents) ? caseData.serviceEvents : []
  const openingState = caseData?.openingPayState ?? caseData?.startingPay ?? {}
  const normalizedOpeningState = {
    ...openingState,
    cpc: Number(openingState.cpc ?? 7),
    level: openingState.level ?? openingState.payLevel,
    payScaleId: openingState.payScaleId ?? openingState.payScaleCode ?? openingState.payScale,
    stageIndex: openingState.stageIndex === '' ? '' : Number(openingState.stageIndex),
    payInBand: openingState.payInBand ?? openingState.payInPayBand,
    cellIndex: openingState.cellIndex === '' ? '' : Number(openingState.cellIndex),
    basicPay: openingState.basicPay === '' ? '' : Number(openingState.basicPay),
    gradePay: openingState.gradePay === '' ? '' : Number(openingState.gradePay),
  }
  const { entries } = calculatePayEventTimeline(normalizedOpeningState, events)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Service &amp; pay timeline</h2>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          {entries.length} events
        </span>
      </div>

      <div className="space-y-3">
        {!entries.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="font-semibold text-slate-900">Nothing changed yet</p>
            <p className="mt-1 text-sm text-slate-600">Add a promotion, MACP or pay revision when applicable.</p>
          </div>
        ) : null}
        {entries.map(({ event, result: calculationResult }) => {
          const statusOption = EVENT_STATUS_OPTIONS.find((item) => item.value === event.status)
          const fixationLabel = FIXATION_OPTION_LABELS[event.fixationOption] ?? 'Unresolved'

          return (
            <article
              key={event.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {EVENT_TYPE_LABELS[event.type] ?? event.type}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">{event.title || 'Unnamed event'}</h3>
                </div>
                {statusOption && (
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {statusOption.label}
                  </span>
                )}
              </div>

              <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Event date</dt>
                  <dd className="font-medium text-slate-900">{event.eventDate || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Effective from</dt>
                  <dd className="font-medium text-slate-900">{event.effectiveFrom || '—'}</dd>
                </div>
                {detailed ? (
                  <div>
                    <dt className="text-slate-500">Rule</dt>
                    <dd className="font-medium text-slate-900">{event.ruleId || '—'}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-slate-500">Fixation option</dt>
                  <dd className="font-medium text-slate-900">{fixationLabel}</dd>
                </div>
              </dl>

              {event.type === EVENT_TYPES.ANNUAL_INCREMENT && calculationResult?.success && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <p className="font-semibold">Annual Increment</p>
                  <p className="mt-1 text-blue-700">{formatDate(calculationResult.after.effectiveFrom)}</p>
                  {Number(calculationResult.before.cpc) === 5 ? (
                    <div className="mt-2 grid gap-1 font-medium sm:grid-cols-[1fr_auto] sm:gap-x-4">
                      <span>5th CPC Scale {calculationResult.before.payScaleLabel}</span>
                      <span>{formatCurrency(calculationResult.before.basicPay)} → {formatCurrency(calculationResult.after.basicPay)}</span>
                    </div>
                  ) : Number(calculationResult.before.cpc) === 6 ? (
                    <div className="mt-2 grid gap-1 font-medium sm:grid-cols-[1fr_auto] sm:gap-x-4">
                      <span>{calculationResult.before.payBand} + GP {formatCurrency(calculationResult.before.gradePay)}</span>
                      <span>{formatCurrency(calculationResult.before.basicPay)} → {formatCurrency(calculationResult.after.basicPay)}</span>
                    </div>
                  ) : (
                    <p className="mt-1">
                      Level {calculationResult.before.level} {formatCurrency(calculationResult.before.basicPay)} → {formatCurrency(calculationResult.after.basicPay)}
                    </p>
                  )}
                  {detailed && calculationResult.steps?.length ? <CalculationDetails result={calculationResult} /> : null}
                </div>
              )}

              {event.type === EVENT_TYPES.CPC_TRANSITION && calculationResult?.success && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                  <p className="font-semibold">{Number(calculationResult.before.cpc) === 5 ? '5th CPC → 6th CPC' : '6th CPC → 7th CPC'}</p>
                  <p className="mt-1 text-blue-800">{formatDate(calculationResult.after.effectiveFrom)}</p>
                  {Number(calculationResult.before.cpc) === 5 ? (
                    <div className="mt-3 grid gap-1 font-medium sm:grid-cols-[1fr_auto] sm:gap-x-4">
                      <span>{calculationResult.sourcePayScale.standardScaleCode} · Basic {formatCurrency(calculationResult.existing5CpcBasicPay)}</span>
                      <span>× {calculationResult.fitmentFactor} → {formatCurrency(calculationResult.roundedFitment)}</span>
                      <span>{calculationResult.mappedPayBand} + GP {formatCurrency(calculationResult.mappedGradePay)}</span>
                      <span>Basic {formatCurrency(calculationResult.resultingBasicPay)}</span>
                      <span className="text-xs text-amber-800 sm:col-span-2">Confirm the next increment date after this revision. Bunching has not been evaluated.</span>
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-1 font-medium sm:grid-cols-[1fr_auto] sm:gap-x-4">
                      <span>{calculationResult.before.payBand} + GP {formatCurrency(calculationResult.before.gradePay)}</span>
                      <span>Basic {formatCurrency(calculationResult.calculated6CpcBasicPay)}</span>
                      <span>× {calculationResult.fitmentFactor}</span>
                      <span>→ Level {calculationResult.after.level}, {formatCurrency(calculationResult.after.basicPay)}</span>
                    </div>
                  )}
                  {detailed ? <CalculationDetails result={calculationResult} /> : null}
                </div>
              )}

              {event.type === EVENT_TYPES.REGULAR_PROMOTION && calculationResult?.success && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                  <p className="font-semibold">Regular Promotion</p>
                  <p className="mt-1 text-blue-700">{formatDate(calculationResult.after.effectiveFrom)}</p>
                  {calculationResult.payFixationEffect === 'NO_FRESH_FIXATION' ? (
                    <div className="mt-2 space-y-1 font-medium">
                      <p>
                        {Number(calculationResult.before.cpc) === 6
                          ? `${calculationResult.before.payBand} GP ${formatCurrency(calculationResult.before.gradePay)} → ${calculationResult.after.payBand} GP ${formatCurrency(calculationResult.after.gradePay)}`
                          : `Level ${calculationResult.before.level} → Level ${calculationResult.after.level}`}
                      </p>
                      <p>No fresh pay fixation</p>
                      <p>Basic Pay retained: {formatCurrency(calculationResult.after.basicPay)}</p>
                      <p className="text-xs text-blue-700">Previously upgraded through MACP{calculationResult.matchedMacpNumber ? ` ${calculationResult.matchedMacpNumber}` : ''}</p>
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-1 font-medium sm:grid-cols-[1fr_auto] sm:gap-x-4">
                      <span>
                        {Number(calculationResult.before.cpc) === 6
                          ? `${calculationResult.before.payBand} GP ${formatCurrency(calculationResult.before.gradePay)} → ${calculationResult.after.payBand} GP ${formatCurrency(calculationResult.after.gradePay)}`
                          : `Level ${calculationResult.before.level} → Level ${calculationResult.after.level}`}
                      </span>
                      <span>{formatCurrency(calculationResult.before.basicPay)} → {formatCurrency(calculationResult.after.basicPay)}</span>
                    </div>
                  )}
                  {calculationResult.dniStatus === 'UNRESOLVED' ? (
                    <p className="mt-2 text-xs font-medium text-amber-800">Confirm the next increment date after this promotion.</p>
                  ) : null}
                  {detailed ? <CalculationDetails result={calculationResult} /> : null}
                </div>
              )}

              {event.type === EVENT_TYPES.MACP && calculationResult?.success && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                  <p className="font-semibold">MACP{calculationResult.macpNumber ? ` ${calculationResult.macpNumber}` : ''}</p>
                  <p className="mt-1 text-blue-700">{formatDate(calculationResult.after.effectiveFrom)}</p>
                  <div className="mt-2 grid gap-1 font-medium sm:grid-cols-[1fr_auto] sm:gap-x-4">
                    <span>
                      {Number(calculationResult.before.cpc) === 6
                        ? `${calculationResult.before.payBand} GP ${formatCurrency(calculationResult.before.gradePay)} → ${calculationResult.after.payBand} GP ${formatCurrency(calculationResult.after.gradePay)}`
                        : `Level ${calculationResult.before.level} → Level ${calculationResult.after.level}`}
                    </span>
                    <span>{formatCurrency(calculationResult.before.basicPay)} → {formatCurrency(calculationResult.after.basicPay)}</span>
                  </div>
                  {calculationResult.dniStatus === 'UNRESOLVED' ? (
                    <p className="mt-2 text-xs font-medium text-amber-800">Confirm the next increment date after this MACP.</p>
                  ) : null}
                  {detailed ? <CalculationDetails result={calculationResult} /> : null}
                </div>
              )}

              {calculationResult && !calculationResult.success && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
                  <p className="font-semibold">{explainCalculationReason(calculationResult.reason, getErrorMessage(calculationResult.errors?.[0])).title}</p>
                  <p className="mt-1">{explainCalculationReason(calculationResult.reason, getErrorMessage(calculationResult.errors?.[0])).message}</p>
                  {detailed && calculationResult.reason ? <p className="technical-code mt-2">Reason: {calculationResult.reason}</p> : null}
                </div>
              )}

              {event.note && <p className="mt-4 text-sm text-slate-600">{event.note}</p>}
            </article>
          )
        })}
      </div>
    </div>
  )
}
