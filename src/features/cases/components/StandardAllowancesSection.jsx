import { useMemo } from 'react'
import { getApplicableHraScheme } from '../../../engines/allowances/hra/hraRuleLookup'
import { buildAllowanceSetup, getAllowanceSetup, validateAllowanceSetup } from '../models/buildAllowanceSetup'

const ALLOWANCES = [
  ['da', 'Dearness Allowance', 'Calculated from the applicable dated DA rate.'],
  ['hra', 'House Rent Allowance', 'Requires eligibility and HRA city classification.'],
  ['transportAllowance', 'Transport Allowance', 'Requires eligibility and the applicable city category.'],
]

export default function StandardAllowancesSection({ caseData, onChange, compact = false }) {
  const setup = getAllowanceSetup(caseData)
  const cpc = Number(String(caseData.payCommission).match(/\d+/)?.[0] ?? caseData.openingPayState?.cpc)
  const schemeResult = useMemo(() => getApplicableHraScheme({ date: caseData.calculationStartDate, cpc }), [caseData.calculationStartDate, cpc])
  const hraClasses = schemeResult.success ? schemeResult.scheme.classes : []
  const missing = validateAllowanceSetup(caseData, setup)

  function apply(nextAllowances, nextSetup = setup) {
    const base = { ...caseData, applicableAllowances: nextAllowances }
    onChange({ applicableAllowances: nextAllowances, ...buildAllowanceSetup(base, nextSetup) })
  }

  function toggle(key) {
    apply({ ...caseData.applicableAllowances, [key]: !caseData.applicableAllowances?.[key] })
  }

  function updateSetup(key, value) {
    const next = { ...setup, [key]: value }
    if (key === 'hraStatus' && value !== 'ELIGIBLE') next.hraClass = ''
    if (key === 'transportStatus' && value !== 'ELIGIBLE') next.transportCategory = ''
    apply(caseData.applicableAllowances, next)
  }

  return (
    <section className={compact ? 'standard-allowances standard-allowances--compact' : 'standard-allowances'}>
      {!compact ? <div><h3>Standard allowances</h3><p>Select an allowance only when it applies. PayCheck will ask for the minimum facts needed to calculate it.</p></div> : null}
      <div className="allowance-toggle-list">
        <div className="allowance-toggle allowance-toggle--fixed"><span><strong>Basic Pay</strong><small>Always included</small></span><span>Included</span></div>
        {ALLOWANCES.map(([key, label, description]) => <label key={key} className="allowance-toggle"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={Boolean(caseData.applicableAllowances?.[key])} onChange={() => toggle(key)} /></label>)}
      </div>

      {caseData.applicableAllowances?.hra ? <div className="allowance-context"><h4>House Rent Allowance</h4><div className="allowance-context__fields"><label>HRA position<select value={setup.hraStatus} onChange={(event) => updateSetup('hraStatus', event.target.value)}><option value="">Select one</option><option value="ELIGIBLE">HRA is payable</option><option value="GOVERNMENT_ACCOMMODATION">Government accommodation provided</option><option value="NOT_ELIGIBLE">Not eligible for HRA</option></select></label>{setup.hraStatus === 'ELIGIBLE' ? <label>HRA city class<select value={setup.hraClass} onChange={(event) => updateSetup('hraClass', event.target.value)}><option value="">Select class</option>{hraClasses.map((item) => <option key={item} value={item}>Class {item}</option>)}</select></label> : null}</div></div> : null}

      {caseData.applicableAllowances?.transportAllowance ? <div className="allowance-context"><h4>Transport Allowance</h4><div className="allowance-context__fields"><label>Transport Allowance position<select value={setup.transportStatus} onChange={(event) => updateSetup('transportStatus', event.target.value)}><option value="">Select one</option><option value="ELIGIBLE">Transport Allowance is payable</option><option value="GOVERNMENT_TRANSPORT">Government transport provided</option><option value="NOT_ELIGIBLE">Not eligible for Transport Allowance</option></select></label>{setup.transportStatus === 'ELIGIBLE' ? <label>Place of posting<select value={setup.transportCategory} onChange={(event) => updateSetup('transportCategory', event.target.value)}><option value="">Select category</option><option value="HIGHER_RATE_CITY">Higher-rate city</option><option value="OTHER_PLACE">Other place</option></select></label> : null}</div></div> : null}

      {missing.length ? <div className="allowance-guidance" role="status"><strong>Complete the selected allowances</strong>{missing.map((item) => <p key={item}>{item}</p>)}</div> : null}
    </section>
  )
}
