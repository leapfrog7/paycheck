import {
  ANNUAL_INCREMENT_TREATMENTS,
  buildGuidedExpectedPay,
  OTHER_CHANGE_LABELS,
} from '../models/buildGuidedExpectedPay'
import { explainCalculationReason } from '../models/calculationPresentation'

function money(value) {
  return value === null || value === undefined ? '—' : `₹${Number(value).toLocaleString('en-IN')}`
}

function monthLabel(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}-01T00:00:00Z`))
}

export default function ExpectedPayPreview({ caseData, goal }) {
  const preview = buildGuidedExpectedPay(caseData)
  const { ledger, resolvedMonths, latestResolved, pendingChanges, preparedCase } = preview
  const monthCount = ledger.success ? ledger.months.length : 0
  const guidedIncrementCount = preparedCase.serviceEvents.filter((event) => event.source === 'GUIDED_SETUP').length
  const routineUnsure = caseData.careerChangeReview?.annualIncrementTreatment === ANNUAL_INCREMENT_TREATMENTS.UNSURE
  const needsCareerDetails = pendingChanges.length > 0
  const status = preview.isComplete ? 'ready' : 'provisional'
  const ledgerError = ledger.errors?.[0]?.message ?? ledger.errors?.[0]
  const ledgerGuidance = ledger.success ? null : explainCalculationReason(ledger.reason, ledgerError)

  return (
    <div className="expected-preview" aria-live="polite">
      <div className={`expected-preview__hero expected-preview__hero--${status}`}>
        <span className="expected-preview__status-icon" aria-hidden="true">{preview.isComplete ? '✓' : '!'}</span>
        <div>
          <p>{preview.isComplete ? 'Expected Pay is ready to review' : 'A provisional Expected Pay is ready'}</p>
          <h3>{preview.isComplete ? 'Your guided setup has enough information.' : 'A few details still need your attention.'}</h3>
          <small>{preview.isComplete ? 'You can inspect every month and rule in the workspace.' : 'PayCheck has calculated only what the confirmed information supports.'}</small>
        </div>
      </div>

      <div className="expected-preview__metrics">
        <article>
          <span>{preview.isComplete ? 'Estimated gross due' : resolvedMonths.length === monthCount ? 'Calculated so far' : 'Resolved months total'}</span>
          <strong>{money(preview.totalGrossDue)}</strong>
          <small>{resolvedMonths.length} of {monthCount} months resolved</small>
        </article>
        <article>
          <span>Opening Basic Pay</span>
          <strong>{money(caseData.startingPay.basicPay)}</strong>
          <small>{caseData.payCommission}</small>
        </article>
        <article>
          <span>{latestResolved ? `${monthLabel(latestResolved.month)} Basic Pay` : 'Latest Basic Pay'}</span>
          <strong>{money(latestResolved?.components?.basicPay)}</strong>
          <small>{guidedIncrementCount ? `${guidedIncrementCount} routine increment${guidedIncrementCount === 1 ? '' : 's'} replayed` : 'No routine increments replayed'}</small>
        </article>
      </div>

      {!ledger.success ? (
        <div className="expected-preview__notice expected-preview__notice--warning" role="alert">
          <strong>{ledgerGuidance.title}</strong>
          <span>{ledgerGuidance.message}</span>
        </div>
      ) : null}

      {ledger.success && ledger.status !== 'RESOLVED' ? (
        <div className="expected-preview__notice expected-preview__notice--warning">
          <strong>{monthCount - resolvedMonths.length} month{monthCount - resolvedMonths.length === 1 ? '' : 's'} need more salary-component information.</strong>
          <span>The workspace will show exactly which component is missing in each month.</span>
        </div>
      ) : null}

      {needsCareerDetails || routineUnsure ? (
        <div className="expected-preview__notice expected-preview__notice--action">
          <strong>Career history needs a quick review.</strong>
          <span>
            {pendingChanges.length
              ? `Add details for: ${pendingChanges.map((change) => OTHER_CHANGE_LABELS[change]).join(', ')}.`
              : 'Confirm whether routine annual increments applied.'}
          </span>
        </div>
      ) : null}

      <dl className="review-list">
        <div><dt>Your goal</dt><dd>{goal.title}</dd></div>
        <div><dt>Period</dt><dd>{monthLabel(caseData.calculationStartDate.slice(0, 7))} – {monthLabel(caseData.calculationEndDate.slice(0, 7))}</dd></div>
        <div><dt>Salary components</dt><dd>{Object.entries(caseData.applicableAllowances).filter(([, enabled]) => enabled).map(([key]) => ({ basicPay: 'Basic Pay', da: 'DA', hra: 'HRA', transportAllowance: 'Transport Allowance' })[key]).join(', ')}</dd></div>
        <div><dt>Calculation basis</dt><dd>Confirmed inputs and dated rules only</dd></div>
      </dl>
    </div>
  )
}
