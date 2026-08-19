function money(value) {
  return value === null || value === undefined ? '—' : `₹${Math.abs(Number(value)).toLocaleString('en-IN')}`
}

function monthRange(caseData) {
  const format = (value) => value
    ? new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 7)}-01T00:00:00Z`))
    : 'Not set'
  return `${format(caseData.calculationStartDate)} – ${format(caseData.calculationEndDate)}`
}

function ProgressState({ state }) {
  const labels = { complete: 'Ready', partial: 'In progress', pending: 'Not started', attention: 'Needs attention' }
  return <span className={`overview-stage__status overview-stage__status--${state}`}>{labels[state]}</span>
}

export default function CaseOverview({ caseData, model, onAction }) {
  const isArrearsGoal = model.goal.id === 'ARREARS_RECOVERY'
  const expectedState = model.dueComplete ? 'complete' : model.counts.resolvedDueMonths ? 'attention' : 'pending'
  const drawnState = model.counts.drawnMonths >= model.counts.totalMonths && model.counts.totalMonths ? 'complete' : model.counts.drawnMonths ? 'partial' : 'pending'
  const resultState = model.allCompared ? 'complete' : model.counts.comparedMonths ? 'partial' : 'pending'

  return (
    <div className="case-overview">
      <section className={`overview-result overview-result--${model.result.tone}`}>
        <div className="overview-result__main">
          <div className="overview-result__topline">
            <span className="overview-confidence"><span aria-hidden="true">{model.allCompared ? '✓' : '●'}</span>{model.confidence}</span>
            <span className="saved-indicator"><span aria-hidden="true">✓</span> Saved on this device</span>
          </div>
          <p className="overview-result__label">{model.result.label}</p>
          <p className="overview-result__amount">{money(model.result.amount)}</p>
          <p className="overview-result__outcome">{model.result.outcome}</p>
          <p className="overview-result__explanation">{model.result.explanation}</p>
          <p className="overview-result__coverage">{model.coverage}</p>
          <div className="overview-result__actions">
            <button type="button" className="primary-action" onClick={() => onAction(model.primaryAction.actionStep)}>{model.primaryAction.actionLabel}</button>
            <button type="button" className="overview-secondary-action" onClick={() => onAction('history')}>View Expected Pay by month</button>
          </div>
        </div>
        <aside className="overview-case-facts" aria-label="Case summary">
          <p>Your case</p>
          <dl>
            <div><dt>Goal</dt><dd>{model.goal.title}</dd></div>
            <div><dt>Period</dt><dd>{monthRange(caseData)}</dd></div>
            <div><dt>Opening Basic</dt><dd>{money(caseData.openingPayState?.basicPay ?? caseData.startingPay?.basicPay)}</dd></div>
            <div><dt>Latest projected Basic</dt><dd>{money(model.latestBasicPay)}</dd></div>
          </dl>
        </aside>
      </section>

      <section className="overview-section" aria-labelledby="overview-progress-title">
        <div className="overview-section__heading">
          <div><p className="case-header__eyebrow">Calculation journey</p><h2 id="overview-progress-title">See where your case stands</h2></div>
          <p>Complete only what applies. Your current calculation remains visible throughout.</p>
        </div>
        <div className="overview-stages">
          <button type="button" onClick={() => onAction('history')} className="overview-stage">
            <span className="overview-stage__number" aria-hidden="true">1</span>
            <span className="overview-stage__body"><strong>Expected Pay</strong><small>{model.counts.resolvedDueMonths} of {model.counts.totalMonths} months calculated</small></span>
            <ProgressState state={expectedState} />
          </button>
          {isArrearsGoal ? (
            <>
              <button type="button" onClick={() => onAction('drawn')} className="overview-stage">
                <span className="overview-stage__number" aria-hidden="true">2</span>
                <span className="overview-stage__body"><strong>Actually Paid</strong><small>{model.counts.drawnMonths} of {model.counts.totalMonths} months entered</small></span>
                <ProgressState state={drawnState} />
              </button>
              <button type="button" onClick={() => onAction('result')} className="overview-stage">
                <span className="overview-stage__number" aria-hidden="true">3</span>
                <span className="overview-stage__body"><strong>Difference</strong><small>{model.counts.comparedMonths} months reconciled</small></span>
                <ProgressState state={resultState} />
              </button>
            </>
          ) : (
            <button type="button" onClick={() => onAction('events')} className="overview-stage overview-stage--wide">
              <span className="overview-stage__number" aria-hidden="true">2</span>
              <span className="overview-stage__body"><strong>Career changes</strong><small>{model.counts.serviceEvents} dated change{model.counts.serviceEvents === 1 ? '' : 's'} recorded</small></span>
              <ProgressState state={model.pendingCareerChanges.length ? 'attention' : 'complete'} />
            </button>
          )}
        </div>
      </section>

      <div className="overview-lower-grid">
        <section className="overview-section" aria-labelledby="overview-next-title">
          <div className="overview-section__heading overview-section__heading--compact">
            <div><p className="case-header__eyebrow">Smart next steps</p><h2 id="overview-next-title">What needs your attention</h2></div>
          </div>
          {model.attentionItems.length ? (
            <div className="overview-attention-list">
              {model.attentionItems.map((item, index) => (
                <article key={item.id} className={`overview-attention overview-attention--${item.tone}`}>
                  <span className="overview-attention__icon" aria-hidden="true">{index === 0 ? '→' : '•'}</span>
                  <div><strong>{item.title}</strong><p>{item.description}</p></div>
                  <button type="button" onClick={() => onAction(item.actionStep)}>{item.actionLabel}</button>
                </article>
              ))}
            </div>
          ) : (
            <div className="overview-all-clear"><span aria-hidden="true">✓</span><div><strong>No missing information for this stage</strong><p>Your confirmed inputs support the result shown above. Detailed rules remain available in each section.</p></div></div>
          )}
        </section>

        <aside className="overview-section overview-totals" aria-label="Calculation snapshot">
          <p className="case-header__eyebrow">Calculation snapshot</p>
          <h2>{isArrearsGoal ? 'Due, paid and difference' : 'Pay progression'}</h2>
          {isArrearsGoal ? (
            <dl>
              <div><dt>Expected Pay calculated</dt><dd>{money(model.totals.due)}</dd></div>
              <div><dt>Actually Paid compared</dt><dd>{money(model.totals.drawn)}</dd></div>
              <div className="overview-totals__net"><dt>Net difference so far</dt><dd>{money(model.totals.difference)}</dd></div>
            </dl>
          ) : (
            <dl>
              <div><dt>Opening Basic Pay</dt><dd>{money(caseData.openingPayState?.basicPay ?? caseData.startingPay?.basicPay)}</dd></div>
              <div><dt>Latest projected Basic</dt><dd>{money(model.latestBasicPay)}</dd></div>
              <div className="overview-totals__net"><dt>Dated events replayed</dt><dd>{model.counts.serviceEvents}</dd></div>
            </dl>
          )}
          <p className="overview-totals__note">Figures use confirmed inputs and the existing dated rule engine. Partial totals are labelled and never presented as final.</p>
        </aside>
      </div>
    </div>
  )
}
