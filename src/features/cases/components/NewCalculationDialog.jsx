import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FIFTH_CPC_PAY_SCALES, getFifthCpcScale, getFifthCpcStages } from '../../../data/pay/5cpcPayScales'
import { SIXTH_CPC_PAY_BAND_OPTIONS, getGradePaysForSixthCpcPayBand } from '../../../data/pay/6cpcPayBands'
import { getCell, getCellsForLevel } from '../../../domain/pay/payMatrix'
import { createCase, updateCase } from '../../../storage/caseStorage'
import { createEmptyPayCase, PAY_COMMISSION_OPTIONS } from '../models/payCase'
import { getAllowanceSetup, validateAllowanceSetup } from '../models/buildAllowanceSetup'
import { ANNUAL_INCREMENT_TREATMENTS, prepareGuidedCase } from '../models/buildGuidedExpectedPay'
import { getCalculationGoal } from '../../../data/calculationGoals'
import ProductIcon from '../../../components/ProductIcon'
import SeventhCpcLevelOptions from './SeventhCpcLevelOptions'
import StandardAllowancesSection from './StandardAllowancesSection'
import GuidedCareerChanges from './GuidedCareerChanges'
import ExpectedPayPreview from './ExpectedPayPreview'

const STEPS = ['Period', 'Pay at the beginning', 'What changed', 'Salary components', 'Expected Pay']
const ERROR_TARGETS = {
  start: 'setup-start-month',
  end: 'setup-end-month',
  pay: 'setup-pay-position',
  dni: 'setup-next-increment-date',
  changes: 'setup-career-changes',
  allowances: 'setup-allowances',
}
const money = (value) => value === '' ? '—' : `₹${Number(value).toLocaleString('en-IN')}`

function autoName(start, end) {
  const format = (value) => value
    ? new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 7)}-01T00:00:00Z`))
    : ''
  return start && end ? `${format(start)} – ${format(end)}` : 'Untitled calculation'
}

function monthEnd(value) {
  if (!value) return ''
  const [year, month] = value.split('-').map(Number)
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${value}-${String(day).padStart(2, '0')}`
}

export default function NewCalculationDialog({ calculationGoal, initialCase, onBackToGoals, onClose, onDraftSaved }) {
  const navigate = useNavigate()
  const goal = getCalculationGoal(calculationGoal || initialCase?.calculationGoal)
  const dialogRef = useRef(null)
  const stepHeadingRef = useRef(null)
  const persistedRef = useRef(Boolean(initialCase?.id))
  const [step, setStep] = useState(Math.min(initialCase?.setupStep || 1, STEPS.length))
  const [data, setData] = useState(() => createEmptyPayCase({ ...initialCase, calculationGoal: goal.id, lifecycleStatus: 'DRAFT' }))
  const [errors, setErrors] = useState({})
  const [savedSignature, setSavedSignature] = useState('')
  const meaningful = Boolean(data.caseName || data.calculationStartDate || data.calculationEndDate || data.startingPay.basicPay)
  const autosavePayload = useMemo(() => ({ ...data, caseName: data.caseName || autoName(data.calculationStartDate, data.calculationEndDate), lifecycleStatus: 'DRAFT', setupStep: step }), [data, step])
  const autosaveSignature = JSON.stringify(autosavePayload)
  const saved = Boolean(initialCase) && !savedSignature ? true : savedSignature === autosaveSignature
  const cells = useMemo(() => getCellsForLevel(data.startingPay.payLevel), [data.startingPay.payLevel])
  const grades = useMemo(() => getGradePaysForSixthCpcPayBand(data.startingPay.payBand), [data.startingPay.payBand])
  const stages = useMemo(() => getFifthCpcStages(data.startingPay.payScaleId), [data.startingPay.payScaleId])

  useEffect(() => {
    const opener = document.activeElement
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    stepHeadingRef.current?.focus()
  }, [step])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        if (meaningful) {
          const payload = { ...data, caseName: data.caseName || autoName(data.calculationStartDate, data.calculationEndDate), lifecycleStatus: 'DRAFT', setupStep: step }
          if (persistedRef.current) updateCase(data.id, payload)
          else createCase(payload)
          onDraftSaved?.()
        }
        onClose()
      }
      if (event.key !== 'Tab') return
      const focusable = [...dialogRef.current.querySelectorAll('button, input, select, [href], summary')].filter((item) => !item.disabled)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [data, meaningful, onClose, onDraftSaved, step])

  useEffect(() => {
    if (!meaningful) return undefined
    const timer = window.setTimeout(() => {
      if (persistedRef.current) updateCase(autosavePayload.id, autosavePayload)
      else createCase(autosavePayload)
      persistedRef.current = true
      setSavedSignature(autosaveSignature)
      onDraftSaved?.()
    }, 300)
    return () => window.clearTimeout(timer)
  }, [autosavePayload, autosaveSignature, meaningful, onDraftSaved])

  function setField(field, value) { setData((current) => ({ ...current, [field]: value })) }
  function setPeriodMonth(field, value) { setField(field, field === 'calculationStartDate' ? (value ? `${value}-01` : '') : monthEnd(value)) }

  function setPay(field, value) {
    setData((current) => {
      let pay = { ...current.startingPay, [field]: value }
      if (field === 'payLevel') {
        const first = getCellsForLevel(value)[0]
        pay = { ...pay, cellIndex: first?.index ?? '', basicPay: first?.value ?? '' }
      }
      if (field === 'cellIndex') {
        const cell = getCell(current.startingPay.payLevel, Number(value))
        pay.basicPay = cell?.value ?? ''
      }
      if (field === 'payBand') pay = { ...pay, gradePay: '', basicPay: '' }
      if (current.payCommission === '6th CPC' && (field === 'payInBand' || field === 'gradePay')) {
        const total = Number(pay.payInBand) + Number(pay.gradePay)
        pay.basicPay = Number(pay.payInBand) && Number(pay.gradePay) ? total : ''
      }
      if (field === 'payScaleId') {
        const scale = getFifthCpcScale(value)
        const first = scale?.stages[0]
        pay = { ...pay, payScaleLabel: scale?.label || '', stageIndex: first?.index ?? '', basicPay: first?.value ?? '' }
      }
      if (field === 'stageIndex') {
        const stage = getFifthCpcStages(current.startingPay.payScaleId).find((item) => item.index === Number(value))
        pay.basicPay = stage?.value ?? ''
      }
      return { ...current, startingPay: pay }
    })
  }

  function changeCpc(value) {
    setData((current) => ({ ...current, payCommission: value, startingPay: createEmptyPayCase().startingPay }))
    setErrors({})
  }

  function validateCurrent() {
    const nextErrors = {}
    if (step === 1) {
      if (!data.calculationStartDate) nextErrors.start = 'Choose a start month.'
      if (!data.calculationEndDate) nextErrors.end = 'Choose an end month.'
      if (data.calculationStartDate && data.calculationEndDate && data.calculationEndDate < data.calculationStartDate) nextErrors.end = 'End month must follow the start month.'
    }
    if (step === 2) {
      if (!data.startingPay.basicPay) nextErrors.pay = 'Select your opening pay position.'
      if (data.payCommission === '6th CPC' && !data.startingPay.dni) nextErrors.dni = 'Confirm the next increment date.'
    }
    if (step === 3) {
      const review = data.careerChangeReview
      if (!review.annualIncrementTreatment || !review.otherChanges.length) nextErrors.changes = 'Answer both questions so PayCheck knows what it can safely calculate.'
      if (review.annualIncrementTreatment === ANNUAL_INCREMENT_TREATMENTS.INCLUDE && !data.startingPay.dni) nextErrors.changes = 'Add the next increment date before including routine increments.'
    }
    if (step === 4) {
      const allowanceErrors = validateAllowanceSetup(data, getAllowanceSetup(data))
      if (allowanceErrors.length) nextErrors.allowances = allowanceErrors.join(' ')
    }
    setErrors(nextErrors)
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      window.requestAnimationFrame(() => document.getElementById(ERROR_TARGETS[firstError])?.focus())
    }
    return !Object.keys(nextErrors).length
  }

  function next() { if (validateCurrent()) setStep((value) => Math.min(STEPS.length, value + 1)) }

  function finish() {
    const prepared = prepareGuidedCase(data)
    const payload = { ...prepared, caseName: data.caseName || autoName(data.calculationStartDate, data.calculationEndDate), lifecycleStatus: 'ACTIVE', setupStep: STEPS.length, setupVersion: 2, startingPay: { ...data.startingPay, basicPay: Number(data.startingPay.basicPay) } }
    const stored = persistedRef.current ? updateCase(data.id, payload) : createCase(payload)
    navigate(`/case/${stored.id}?step=overview`)
  }

  function saveExit() {
    if (meaningful) {
      const payload = { ...data, caseName: data.caseName || autoName(data.calculationStartDate, data.calculationEndDate), lifecycleStatus: 'DRAFT', setupStep: step }
      if (persistedRef.current) updateCase(data.id, payload)
      else createCase(payload)
    }
    onDraftSaved?.()
    onClose()
  }

  return (
    <div className="setup-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) saveExit() }}>
      <section ref={dialogRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="setup-title" className="setup-dialog setup-dialog--guided">
        <header className="setup-header">
          <div><p>{goal.title}</p><h2 ref={stepHeadingRef} tabIndex="-1" id="setup-title">{STEPS[step - 1]}</h2></div>
          <div className="setup-save-state">{saved ? '✓ Draft saved' : meaningful ? 'Saving…' : 'Not saved yet'}</div>
          <button type="button" className="setup-close" onClick={saveExit} aria-label="Save draft and close setup">×</button>
        </header>

        <div className="setup-progress">
          <div className="setup-progress__labels"><span>Step {step} of {STEPS.length}</span><span>{Math.round(step / STEPS.length * 100)}%</span></div>
          <div><span style={{ width: `${step / STEPS.length * 100}%` }} /></div>
          <ol>{STEPS.map((name, index) => <li key={name} aria-current={index + 1 === step ? 'step' : undefined}>{index + 1}. {name}</li>)}</ol>
        </div>

        <div className="setup-content">
          {step === 1 ? (
            <div className="setup-fields">
              <div className="setup-goal-context">
                <span><ProductIcon name={goal.icon} size={18} /></span>
                <div><strong>{goal.title}</strong><small>{goal.reassurance}</small></div>
                {onBackToGoals && !meaningful ? <button type="button" onClick={onBackToGoals}>Change goal</button> : null}
              </div>
              <p className="setup-lead">Which salary months do you want PayCheck to examine? Full months avoid confusing partial-month assumptions.</p>
              <label className="field field--wide">Case name <span>Optional</span><input value={data.caseName} onChange={(event) => setField('caseName', event.target.value)} placeholder={autoName(data.calculationStartDate, data.calculationEndDate)} /></label>
              <label className="field">From month<input id="setup-start-month" type="month" value={data.calculationStartDate.slice(0, 7)} aria-invalid={Boolean(errors.start)} aria-describedby={errors.start ? 'setup-start-error' : undefined} onChange={(event) => setPeriodMonth('calculationStartDate', event.target.value)} />{errors.start ? <em id="setup-start-error" role="alert">{errors.start}</em> : null}</label>
              <label className="field">To month<input id="setup-end-month" type="month" value={data.calculationEndDate.slice(0, 7)} aria-invalid={Boolean(errors.end)} aria-describedby={errors.end ? 'setup-end-error' : undefined} onChange={(event) => setPeriodMonth('calculationEndDate', event.target.value)} />{errors.end ? <em id="setup-end-error" role="alert">{errors.end}</em> : null}</label>
              <div className="setup-tip field--wide"><span aria-hidden="true">💡</span><p><strong>Start with the month the difference began.</strong> You can extend or shorten the period later.</p></div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="setup-fields">
              <p className="setup-lead">Enter the pay position that applied on {data.calculationStartDate || 'the first day of the period'}. This becomes the auditable starting point.</p>
              <div id="setup-pay-position" tabIndex="-1" aria-invalid={Boolean(errors.pay)} aria-describedby={errors.pay ? 'setup-pay-error' : undefined} className="field field--wide"><span>Starting pay structure</span><div className="choice-row">{PAY_COMMISSION_OPTIONS.map((item) => <button type="button" key={item} className={data.payCommission === item ? 'selected' : ''} aria-pressed={data.payCommission === item} onClick={() => changeCpc(item)}>{item}</button>)}</div></div>
              {data.payCommission === '7th CPC' ? <><label className="field">Pay Level<select value={data.startingPay.payLevel} onChange={(event) => setPay('payLevel', event.target.value)}><option value="">Select Level</option><SeventhCpcLevelOptions /></select></label><label className="field">Basic Pay / Cell<select value={data.startingPay.cellIndex} disabled={!cells.length} onChange={(event) => setPay('cellIndex', event.target.value)}><option value="">Select Cell</option>{cells.map((cell) => <option key={cell.index} value={cell.index}>Cell {cell.index} — {money(cell.value)}</option>)}</select></label></> : null}
              {data.payCommission === '6th CPC' ? <><label className="field">Pay Band<select value={data.startingPay.payBand} onChange={(event) => setPay('payBand', event.target.value)}><option value="">Select Pay Band</option>{SIXTH_CPC_PAY_BAND_OPTIONS.map((band) => <option key={band.code} value={band.code}>{band.label}</option>)}</select></label><label className="field">Grade Pay<select value={data.startingPay.gradePay} onChange={(event) => setPay('gradePay', event.target.value)} disabled={!grades.length}><option value="">Select Grade Pay</option>{grades.map((grade) => <option key={grade} value={grade}>{money(grade)}</option>)}</select></label><label className="field">Pay in Band<input type="number" min="1" value={data.startingPay.payInBand} onChange={(event) => setPay('payInBand', event.target.value)} /></label></> : null}
              {data.payCommission === '5th CPC' ? <><label className="field">Pay Scale<select value={data.startingPay.payScaleId} onChange={(event) => setPay('payScaleId', event.target.value)}><option value="">Search or select a scale</option>{FIFTH_CPC_PAY_SCALES.map((scale) => <option key={scale.id} value={scale.id}>{scale.label}</option>)}</select></label><label className="field">Basic Pay Stage<select value={data.startingPay.stageIndex} onChange={(event) => setPay('stageIndex', event.target.value)} disabled={!stages.length}><option value="">Select Stage</option>{stages.map((stage) => <option key={stage.index} value={stage.index}>{money(stage.value)}</option>)}</select></label></> : null}
              <label className="field">Next Increment Date <span>{data.payCommission === '6th CPC' ? 'Required' : 'Needed to include routine increments'}</span><input id="setup-next-increment-date" type="date" value={data.startingPay.dni} aria-invalid={Boolean(errors.dni)} aria-describedby={errors.dni ? 'setup-dni-error' : undefined} onChange={(event) => setPay('dni', event.target.value)} />{errors.dni ? <em id="setup-dni-error" role="alert">{errors.dni}</em> : null}</label>
              {errors.pay ? <p id="setup-pay-error" className="field-error field--wide" role="alert">{errors.pay}</p> : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div id="setup-career-changes" tabIndex="-1" aria-invalid={Boolean(errors.changes)} aria-describedby={errors.changes ? 'setup-changes-error' : undefined}>
              <p className="setup-lead">Tell us the shape of your service history. Exact details come later; this step prevents PayCheck from silently assuming that pay never changed.</p>
              <GuidedCareerChanges value={data.careerChangeReview} onChange={(careerChangeReview) => setField('careerChangeReview', careerChangeReview)} error={errors.changes} errorId="setup-changes-error" />
            </div>
          ) : null}

          {step === 4 ? (
            <div id="setup-allowances" tabIndex="-1" aria-invalid={Boolean(errors.allowances)} aria-describedby={errors.allowances ? 'setup-allowances-error' : undefined}>
              <p className="setup-lead">Choose what your Expected Pay should include. If you select HRA or Transport Allowance, PayCheck asks only for the context those rules require.</p>
              <StandardAllowancesSection compact caseData={data} onChange={(updates) => setData((current) => ({ ...current, ...updates }))} />
              {errors.allowances ? <p id="setup-allowances-error" className="field-error" role="alert">{errors.allowances}</p> : null}
              <p className="setup-optional">Basic Pay is always included. You can start with Basic + DA and add other components later.</p>
            </div>
          ) : null}

          {step === 5 ? <ExpectedPayPreview caseData={data} goal={goal} /> : null}
        </div>

        <footer className="setup-actions">
          <button type="button" className="setup-exit" onClick={saveExit}>Save &amp; exit</button>
          <div>
            {step > 1 ? <button type="button" className="setup-back" onClick={() => { setErrors({}); setStep((value) => value - 1) }}>Back</button> : null}
            {step < STEPS.length ? <button type="button" className="setup-next" onClick={next}>{step === 4 ? 'Review Expected Pay' : 'Continue'}</button> : <button type="button" className="setup-next" onClick={finish}>Open Case Overview</button>}
          </div>
        </footer>
      </section>
    </div>
  )
}
