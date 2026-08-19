import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DashboardCaseCard from '../features/cases/components/DashboardCaseCard'
import { deleteCase, getCases } from '../storage/caseStorage'
import CalculatorDirectory from '../components/CalculatorDirectory'
import { HowItWorks, TrustSection } from '../components/HomeGuidance'
import ProductIcon from '../components/ProductIcon'
import CalculationGoalDialog from '../features/cases/components/CalculationGoalDialog'
import InstallAppPromo from '../components/InstallAppPromo'

const NewCalculationDialog = lazy(() => import('../features/cases/components/NewCalculationDialog'))

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [cases, setCases] = useState(() => getCases())
  const [draftToResume, setDraftToResume] = useState(null)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const newFlowOpen = searchParams.get('new') === '1'
  const sortedCases = useMemo(() => [...cases].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)), [cases])
  const refreshCases = useCallback(() => setCases(getCases()), [])

  function openNew() { setDraftToResume(null); setSelectedGoal(null); setSearchParams({ new: '1' }) }
  function closeDialog() { setDraftToResume(null); setSelectedGoal(null); setSearchParams({}); refreshCases() }
  function resumeDraft(item) { setDraftToResume(item); setSelectedGoal(item.calculationGoal); setSearchParams({}) }
  function removeCase(item) {
    if (!window.confirm(`Delete “${item.caseName || 'Untitled calculation'}”? This cannot be undone.`)) return
    deleteCase(item.id)
    refreshCases()
  }

  return (
    <div className="dashboard-home">
      <section className="dashboard-hero">
        <div className="dashboard-hero__content"><p className="dashboard-hero__eyebrow"><span aria-hidden="true">✦</span> Your pay, made understandable</p><h1>Check your pay.<br />{' '}Know what you are due.</h1><p>Rebuild your pay history, calculate arrears or recovery, and understand every step behind the result.</p><div className="dashboard-hero__actions"><button type="button" className="dashboard-new" onClick={openNew}><ProductIcon name="calculator" /> Start a Pay Calculation</button><a href="#calculators" className="dashboard-secondary">Explore calculators <ProductIcon name="arrow" size={17} /></a></div><div className="hero-reassurance"><span><ProductIcon name="lock" size={15} /> Saved in your browser</span><span><ProductIcon name="shield" size={15} /> Rule-based results</span><span><ProductIcon name="history" size={15} /> Full calculation trail</span></div></div>
        <div className="hero-preview" aria-label="Example calculation journey"><div className="hero-preview__header"><span>Example pay check</span><strong>Estimate ready</strong></div><div className="hero-preview__amount"><small>Projected Due Pay</small><strong>₹58,600</strong><span>Current Basic Pay</span></div><ol><li className="done"><span>✓</span>Opening pay added</li><li className="done"><span>✓</span>Pay history calculated</li><li><span>3</span>Add Drawn Pay to find arrears</li></ol><p>This is an illustration. Your result uses only your inputs.</p></div>
      </section>

      <InstallAppPromo />

      <section id="my-calculations" className="dashboard-cases" aria-labelledby="recent-cases-title">
        <header><div><p>Calculations</p><h2 id="recent-cases-title">Recent cases</h2></div>{sortedCases.length ? <span>{sortedCases.length} saved</span> : null}</header>
        {sortedCases.length ? <div className="dashboard-case-list">{sortedCases.map((item) => <DashboardCaseCard key={item.id} caseItem={item} onResumeDraft={resumeDraft} onDelete={removeCase} />)}</div> : <div className="dashboard-empty"><div className="dashboard-empty__mark" aria-hidden="true">₹</div><h3>No calculations yet</h3><p>Start with your Basic Pay and calculation period. You can add career changes, allowances and Drawn Pay as you go.</p><button type="button" className="dashboard-new" onClick={openNew}>Start a calculation</button></div>}
      </section>

      <CalculatorDirectory onStart={openNew} />
      <HowItWorks />
      <TrustSection />

      {newFlowOpen && !selectedGoal ? <CalculationGoalDialog onChoose={setSelectedGoal} onClose={closeDialog} /> : null}
      {selectedGoal || draftToResume ? (
        <Suspense fallback={<div className="setup-backdrop"><div className="dialog-loading" role="status">Preparing your guided setup…</div></div>}>
          <NewCalculationDialog calculationGoal={selectedGoal || draftToResume.calculationGoal} initialCase={draftToResume} onBackToGoals={draftToResume ? null : () => setSelectedGoal(null)} onClose={closeDialog} onDraftSaved={refreshCases} />
        </Suspense>
      ) : null}
    </div>
  )
}
