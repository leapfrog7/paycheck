import { useEffect, useRef } from 'react'

const WORKSPACE_STEPS = [
  ['overview', 'Overview'],
  ['basics', 'Basics'],
  ['history', 'Pay History'],
  ['events', 'Career Changes'],
  ['allowances', 'Allowances'],
  ['drawn', 'Drawn Pay'],
  ['result', 'Result'],
]

function currency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

export function WorkspaceProgress({ activeStep, onStepChange, completion }) {
  const currentRef = useRef(null)
  const activeIndex = WORKSPACE_STEPS.findIndex(([id]) => id === activeStep)

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    currentRef.current?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeStep])

  return (
    <div className="workspace-navigation">
      <p className="workspace-navigation__position" aria-live="polite">
        Section {activeIndex + 1} of {WORKSPACE_STEPS.length}: {WORKSPACE_STEPS[activeIndex]?.[1]}
      </p>
      <nav aria-label="Case completion" className="workspace-steps">
      {WORKSPACE_STEPS.map(([id, label], index) => {
        const isOverview = id === 'overview'
        const state = !isOverview && completion[id] ? 'complete' : activeStep === id ? 'current' : 'available'
        return (
          <button
            key={id}
            ref={activeStep === id ? currentRef : null}
            type="button"
            aria-current={activeStep === id ? 'step' : undefined}
            aria-controls="workspace-panel"
            onClick={() => onStepChange(id)}
            className={`workspace-step workspace-step--${state}`}
          >
            <span className="workspace-step__number" aria-hidden="true">{isOverview ? '⌂' : completion[id] ? '✓' : index}</span>
            <span>{label}</span>
          </button>
        )
      })}
      </nav>
    </div>
  )
}

export function LiveResultCard({ model, onAction }) {
  const tone = model.outcome === 'RECOVERY' ? 'recovery' : model.outcome === 'ARREAR' ? 'arrear' : 'neutral'
  return (
    <aside className={`live-result live-result--${tone}`} aria-label="Current calculation result">
      <div className="flex items-center justify-between gap-3">
        <p className="live-result__eyebrow">{model.confidence}</p>
        <span className="saved-indicator"><span aria-hidden="true">✓</span> Saved</span>
      </div>
      <p className="live-result__label">{model.label}</p>
      <p className="live-result__amount">{model.amount == null ? '—' : currency(Math.abs(model.amount))}</p>
      <p className="live-result__outcome">{model.outcome}</p>
      <p className="live-result__coverage">{model.coverage}</p>
      <button type="button" className="primary-action" onClick={() => onAction(model.actionStep)}>
        {model.actionLabel}
      </button>
    </aside>
  )
}

export function StepIntro({ eyebrow, title, description, summary }) {
  return (
    <header className="step-intro">
      <p className="step-intro__eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      {summary ? <div className="step-summary">{summary}</div> : null}
    </header>
  )
}

export function GuidanceCard({ title, children, action, onAction, tone = 'attention' }) {
  return (
    <div className={`guidance guidance--${tone}`}>
      <div>
        <p className="guidance__label">{tone === 'blocking' ? 'Required to continue' : tone === 'info' ? 'Good to know' : 'Improve this calculation'}</p>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
      {action ? <button type="button" onClick={onAction} className="secondary-action">{action}</button> : null}
    </div>
  )
}
