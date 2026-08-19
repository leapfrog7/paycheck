import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import ServiceEventTimeline from '../components/ServiceEventTimeline'
import RegularPromotionForm from '../components/RegularPromotionForm'
import MacpForm from '../components/MacpForm'
import PayHistory from '../components/PayHistory'
import CustomAllowancesSection from '../components/CustomAllowancesSection'
import DuePayLedger from '../components/DuePayLedger'
import DrawnPaySection from '../components/DrawnPaySection'
import ArrearRecoverySection from '../components/ArrearRecoverySection'
import CaseOverview from '../components/CaseOverview'
import CalculationViewToggle from '../components/CalculationViewToggle'
import FifthToSixthCpcTransitionForm from '../components/FifthToSixthCpcTransitionForm'
import { EVENT_TYPES } from '../../../domain/events/eventTypes'
import { getCase, updateCase } from '../../../storage/caseStorage'
import { GuidanceCard, LiveResultCard, StepIntro, WorkspaceProgress } from '../components/WorkspaceOverview'
import StandardAllowancesSection from '../components/StandardAllowancesSection'
import { calculatePayEventTimeline } from '../../../engines/pay/eventTimeline'
import {
  findPriorMacpForStructure,
  getFinancialStructure,
} from '../../../domain/events/promotionAfterMacp'
import { buildCaseOverview } from '../models/buildCaseOverview'
import { resolveWorkspaceStep, withWorkspaceStep } from '../models/workspaceNavigation'
import { readStorage, storageKeys, writeStorage } from '../../../storage'

function formatDate(value) {
  if (!value) return 'Not entered'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

export default function CaseWorkspacePage() {
  const { caseId } = useParams()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [caseItem, setCaseItem] = useState(() => getCase(caseId))
  const activeStep = resolveWorkspaceStep(searchParams.get('step') ?? location.state?.initialStep)
  const [detailedView, setDetailedView] = useState(() => readStorage(storageKeys.calculationView, 'simple') === 'audit')
  const workspacePanelRef = useRef(null)
  const initialSectionRef = useRef(true)
  const overview = useMemo(() => caseItem ? buildCaseOverview(caseItem) : null, [caseItem])

  useEffect(() => {
    if (initialSectionRef.current) {
      initialSectionRef.current = false
      return
    }
    window.requestAnimationFrame(() => workspacePanelRef.current?.focus())
  }, [activeStep])

  if (!caseItem) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Case not found</h2>
      </div>
    )
  }

  const allowanceList = Object.entries(caseItem.applicableAllowances ?? {})
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)

  const openingPayState = caseItem.openingPayState ?? {
    cpc: caseItem.payCommission,
    effectiveFrom: caseItem.startingPay?.effectiveFrom ?? '',
    level: caseItem.startingPay?.payLevel ?? '',
    basicPay: caseItem.startingPay?.basicPay ?? '',
    dni: caseItem.startingPay?.dni ?? '',
  }
  const calculatedTimeline = calculatePayEventTimeline(openingPayState, caseItem.serviceEvents ?? [])
  const currentPayState = calculatedTimeline.currentPayState
  const hasMacpProvenanceForCurrentStructure = Boolean(
    findPriorMacpForStructure(
      calculatedTimeline.entries,
      getFinancialStructure(currentPayState),
      '9999-12-31',
    ),
  )
  const hasFifthToSixthTransition = (caseItem.serviceEvents ?? []).some((event) => (
    event.type === EVENT_TYPES.CPC_TRANSITION && Number(event.fromCpc) === 5 && Number(event.toCpc) === 6
  ))
  const dueLedger = overview.dueLedger
  const comparison = overview.comparison
  const resolvedDueMonths = dueLedger.success
    ? dueLedger.months.filter((month) => month.status === 'RESOLVED')
    : []
  const allowanceNeedsInfo = dueLedger.success && dueLedger.months.some((month) => (
    month.unresolvedComponents?.some((component) => ['HRA', 'TRANSPORT_ALLOWANCE'].includes(component))
  ))
  const totalMonths = dueLedger.success ? dueLedger.months.length : 0
  const drawnCount = caseItem.drawnPayHistory?.length ?? 0
  const enabledAllowanceCount = allowanceList.length
  const completion = {
    basics: Boolean(caseItem.calculationStartDate && caseItem.calculationEndDate && openingPayState.basicPay),
    history: resolvedDueMonths.length > 0,
    events: overview.pendingCareerChanges.length === 0 && overview.unresolvedEventIds.length === 0,
    allowances: dueLedger.success && dueLedger.status === 'RESOLVED',
    drawn: totalMonths > 0 && drawnCount >= totalMonths,
    result: totalMonths > 0 && comparison.success && comparison.summary.unresolvedMonths === 0,
  }
  const completedCount = Object.values(completion).filter(Boolean).length
  const resultModel = {
    confidence: overview.confidence,
    label: overview.result.label,
    amount: overview.result.amount,
    outcome: overview.result.outcome,
    coverage: overview.coverage,
    actionLabel: overview.primaryAction.actionLabel,
    actionStep: overview.primaryAction.actionStep,
  }

  function addServiceEvent(event) {
    const updatedCase = updateCase(caseId, {
      serviceEvents: [...(caseItem.serviceEvents ?? []), event],
    })

    if (updatedCase) setCaseItem(updatedCase)
  }

  function updateCustomAllowances(customAllowances) {
    const updatedCase = updateCase(caseId, { customAllowances })
    if (updatedCase) setCaseItem(updatedCase)
  }

  function updateStandardAllowances(updates) {
    const updatedCase = updateCase(caseId, updates)
    if (updatedCase) setCaseItem(updatedCase)
  }

  function updateDrawnPayHistory(drawnPayHistory) {
    const updatedCase = updateCase(caseId, { drawnPayHistory })
    if (updatedCase) setCaseItem(updatedCase)
  }

  function changeWorkspaceStep(step) {
    setSearchParams(withWorkspaceStep(searchParams, step))
  }

  function changeDetailedView(nextDetailed) {
    setDetailedView(nextDetailed)
    writeStorage(storageKeys.calculationView, nextDetailed ? 'audit' : 'simple')
  }

  return (
    <div className="case-workspace">
      <header className="case-header">
        <div>
          <p className="case-header__eyebrow">Your pay case</p>
          <h1>{caseItem.caseName}</h1>
          <p>{formatDate(caseItem.calculationStartDate)} – {formatDate(caseItem.calculationEndDate)} · {caseItem.payCommission}</p>
        </div>
        <div className="case-header__progress"><span className={`case-confidence case-confidence--${overview.allCompared ? 'complete' : overview.dueComplete ? 'calculated' : 'attention'}`}>{overview.confidence}</span><strong>{completedCount} of 6</strong><span>sections complete</span></div>
      </header>

      <WorkspaceProgress activeStep={activeStep} onStepChange={changeWorkspaceStep} completion={completion} />
      <CalculationViewToggle detailed={detailedView} onChange={changeDetailedView} />

      <div className={`workspace-layout ${activeStep === 'overview' ? 'workspace-layout--overview' : ''}`}>
        <div ref={workspacePanelRef} tabIndex="-1" role="region" aria-label={`${activeStep} case section`} className="workspace-panel" id="workspace-panel">
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {resultModel.label}: {resultModel.amount == null ? 'not calculated' : `₹${Math.abs(Number(resultModel.amount)).toLocaleString('en-IN')}`}. {resultModel.coverage}
          </p>
          {activeStep === 'overview' ? <CaseOverview caseData={caseItem} model={overview} onAction={changeWorkspaceStep} /> : null}
          {activeStep === 'basics' ? <>
            <StepIntro eyebrow="Step 1" title="Let’s confirm the essentials" description="These details are enough to begin a useful pay projection." summary={<><strong>Opening Basic: {openingPayState.basicPay ? `₹${Number(openingPayState.basicPay).toLocaleString('en-IN')}` : 'Not entered'}</strong><span>{caseItem.employeeName || 'Employee name not provided'}</span></>} />
            <div className="summary-grid">
              <dl className="summary-card"><dt>Calculation period</dt><dd>{caseItem.calculationStartDate || 'Not entered'} – {caseItem.calculationEndDate || 'Not entered'}</dd></dl>
              <dl className="summary-card"><dt>Starting pay structure</dt><dd>{caseItem.payCommission}</dd></dl>
              <dl className="summary-card"><dt>Current Basic Pay</dt><dd>{openingPayState.basicPay ? `₹${Number(openingPayState.basicPay).toLocaleString('en-IN')}` : 'Not entered'}</dd></dl>
              <dl className="summary-card"><dt>Level / pay band</dt><dd>{openingPayState.payScaleLabel || openingPayState.level || openingPayState.payBand || 'Not entered'}</dd></dl>
            </div>
            {caseItem.assumptions?.length ? <details className="audit-disclosure"><summary>Using {caseItem.assumptions.length} assumptions</summary><ul>{caseItem.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}
          </> : null}

          {activeStep === 'history' ? <><StepIntro eyebrow="Step 2" title="Your calculated pay history" description="Review the projected path first; technical rules stay available when you need them." summary={<><strong>{resolvedDueMonths.length} months calculated</strong><span>Current projected Basic: {currentPayState?.basicPay ? `₹${Number(currentPayState.basicPay).toLocaleString('en-IN')}` : '—'}</span></>} />{overview.unresolvedEventIds.length ? <GuidanceCard title="Review a career change that could not be applied" action="Review changes" onAction={() => changeWorkspaceStep('events')}>Later pay remains provisional until the recorded change has valid dates and fixation details.</GuidanceCard> : allowanceNeedsInfo ? <GuidanceCard title="Confirm the allowances you selected" action="Complete allowances" onAction={() => changeWorkspaceStep('allowances')}>HRA and Transport Allowance need eligibility and posting details before Gross Due can be finalized.</GuidanceCard> : null}<PayHistory caseData={caseItem} detailed={detailedView} /><DuePayLedger caseData={caseItem} detailed={detailedView} /></> : null}

          {activeStep === 'events' ? <><StepIntro eyebrow="Step 3" title="What changed during this period?" description="Add only the career changes that apply to you." summary={<><strong>{caseItem.serviceEvents?.length ?? 0} changes recorded</strong><span>Promotion, MACP and pay revisions appear on your timeline</span></>} /><section className="rounded-2xl border border-slate-200 bg-white p-5"><ServiceEventTimeline key={caseId} caseData={caseItem} detailed={detailedView} /></section><div className="event-form-grid">{Number(openingPayState.cpc) === 5 && !hasFifthToSixthTransition ? <FifthToSixthCpcTransitionForm onAdd={addServiceEvent} /> : null}{(Number(openingPayState.cpc) === 7 && openingPayState.level) || (Number(openingPayState.cpc) === 6 && openingPayState.payBand) ? <RegularPromotionForm payState={currentPayState} onAdd={addServiceEvent} allowSameStructure={hasMacpProvenanceForCurrentStructure} /> : null}{(Number(openingPayState.cpc) === 6 && openingPayState.payBand) || (Number(openingPayState.cpc) === 7 && openingPayState.level) ? <MacpForm payState={currentPayState} onAdd={addServiceEvent} /> : null}</div></> : null}

          {activeStep === 'allowances' ? <><StepIntro eyebrow="Step 4" title="Allowances that apply" description="Basic Pay is already included. Add only allowances relevant to this case." summary={<><strong>{enabledAllowanceCount ? `${enabledAllowanceCount} allowances selected` : 'Basic Pay only'}</strong><span>{allowanceList.join(', ') || 'You can refine this later'}</span></>} />{!enabledAllowanceCount ? <GuidanceCard title="Add allowances for a more complete result" tone="attention">Your Basic Pay projection remains available while allowance details are incomplete.</GuidanceCard> : null}<StandardAllowancesSection caseData={caseItem} onChange={updateStandardAllowances} /><CustomAllowancesSection definitions={caseItem.customAllowances ?? []} onChange={updateCustomAllowances} /></> : null}

          {activeStep === 'drawn' ? <><StepIntro eyebrow="Step 5" title="What were you actually paid?" description="Enter Drawn Pay month by month to compare it independently with Due Pay." summary={<><strong>{drawnCount} of {totalMonths} months entered</strong><span>Blank means not entered; ₹0 means nothing was paid</span></>} />{drawnCount === 0 ? <GuidanceCard title="Your Due Pay is ready" tone="info">Add what you were actually paid to calculate arrears or recovery.</GuidanceCard> : null}<DrawnPaySection caseData={caseItem} onChange={updateDrawnPayHistory} /></> : null}

          {activeStep === 'result' ? <><StepIntro eyebrow="Step 6" title="Due versus Drawn" description="See the final month-wise difference, with partial totals clearly qualified." summary={<><strong>{comparison.summary.resolvedMonths} of {comparison.summary.totalMonths} months reconciled</strong><span>{comparison.summary.unresolvedMonths ? `${comparison.summary.unresolvedMonths} months need more information` : 'All available months reconciled'}</span></>} />{comparison.summary.unresolvedMonths ? <GuidanceCard title={overview.primaryAction.actionLabel} onAction={() => changeWorkspaceStep(overview.primaryAction.actionStep)} action={overview.primaryAction.actionLabel}>Partial totals include reconciled months only. Complete the suggested step before treating the net amount as final.</GuidanceCard> : null}<ArrearRecoverySection caseData={caseItem} detailed={detailedView} /></> : null}
        </div>
        {activeStep !== 'overview' ? <LiveResultCard model={resultModel} onAction={changeWorkspaceStep} /> : null}
      </div>
    </div>
  )
}
