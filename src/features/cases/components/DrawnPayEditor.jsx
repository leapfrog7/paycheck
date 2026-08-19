import { useState } from 'react'
import {
  DRAWN_PAY_ENTRY_MODES,
  calculateDrawnComponentTotal,
  createDrawnPayRecord,
} from '../../../domain/pay/drawnPay'

const COMPONENT_FIELDS = [
  ['basicPay', 'Basic Pay'],
  ['da', 'Dearness Allowance'],
  ['hra', 'House Rent Allowance'],
  ['transportAllowance', 'Transport Allowance'],
]

const inputValue = (value) => value === null || value === undefined ? '' : value

function formatMonth(month) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`))
}

export default function DrawnPayEditor({ draft, setDraft, errors, onSave, onCancel }) {
  const [componentBackup, setComponentBackup] = useState(draft.components)
  const normalized = createDrawnPayRecord(draft)
  const componentTotal = calculateDrawnComponentTotal(normalized)

  function update(path, value) {
    if (path.startsWith('components.')) {
      const components = { ...draft.components, [path.slice(11)]: value }
      setComponentBackup(components)
      setDraft({ ...draft, components })
      return
    }
    setDraft({ ...draft, [path]: value })
  }

  function changeMode(entryMode) {
    if (entryMode === DRAWN_PAY_ENTRY_MODES.GROSS_ONLY) {
      setComponentBackup(draft.components)
      setDraft(createDrawnPayRecord({ ...draft, entryMode, components: {} }))
      return
    }
    setDraft(createDrawnPayRecord({ ...draft, entryMode, components: componentBackup }))
  }

  function addOtherAllowance() {
    setDraft((current) => ({ ...current, otherAllowances: [...current.otherAllowances, { name: '', amount: null }] }))
  }

  function updateOtherAllowance(index, field, value) {
    setDraft((current) => ({
      ...current,
      otherAllowances: current.otherAllowances.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }))
  }

  return (
    <section className="drawn-editor" aria-labelledby="drawn-editor-title">
      <div className="drawn-editor__header">
        <div><p>Detailed entry</p><h3 id="drawn-editor-title">{formatMonth(draft.month)}</h3></div>
        <button type="button" onClick={onCancel} aria-label="Close detailed Drawn Pay editor">×</button>
      </div>

      <fieldset className="drawn-method-choice">
        <legend>How do you want to enter this salary?</legend>
        <button type="button" aria-pressed={draft.entryMode === DRAWN_PAY_ENTRY_MODES.GROSS_ONLY} className={draft.entryMode === DRAWN_PAY_ENTRY_MODES.GROSS_ONLY ? 'selected' : ''} onClick={() => changeMode(DRAWN_PAY_ENTRY_MODES.GROSS_ONLY)}><strong>Gross only</strong><span>Fastest—from the payslip total</span></button>
        <button type="button" aria-pressed={draft.entryMode === DRAWN_PAY_ENTRY_MODES.COMPONENT_ENTRY} className={draft.entryMode === DRAWN_PAY_ENTRY_MODES.COMPONENT_ENTRY ? 'selected' : ''} onClick={() => changeMode(DRAWN_PAY_ENTRY_MODES.COMPONENT_ENTRY)}><strong>Salary components</strong><span>Basic, DA, HRA and more</span></button>
      </fieldset>

      {draft.entryMode === DRAWN_PAY_ENTRY_MODES.GROSS_ONLY ? (
        <label className="drawn-editor-field">Gross salary actually paid
          <span>Enter 0 only if nothing was actually paid.</span>
          <input autoFocus type="number" min="0" step="0.01" inputMode="decimal" value={inputValue(draft.grossDrawn)} onChange={(event) => update('grossDrawn', event.target.value)} placeholder="Enter gross amount" />
        </label>
      ) : (
        <>
          <div className="drawn-component-grid">
            {COMPONENT_FIELDS.map(([key, label]) => (
              <label className="drawn-editor-field" key={key}>{label}
                <input type="number" min="0" step="0.01" inputMode="decimal" value={inputValue(draft.components[key])} onChange={(event) => update(`components.${key}`, event.target.value)} placeholder="Not known" />
              </label>
            ))}
          </div>
          <div className="drawn-known-gross">
            <div><span>Component total</span><strong>{componentTotal === null ? 'Incomplete' : `₹${componentTotal.toLocaleString('en-IN')}`}</strong></div>
            <label className="drawn-editor-field">Known gross <span>Optional when some components are unknown</span><input type="number" min="0" step="0.01" inputMode="decimal" value={inputValue(draft.grossDrawn)} onChange={(event) => update('grossDrawn', event.target.value)} /></label>
          </div>
          <div className="drawn-other-allowances">
            {draft.otherAllowances.map((item, index) => (
              <div key={`${draft.month}-allowance-${index}`}>
                <input aria-label={`Other allowance ${index + 1} name`} value={item.name} onChange={(event) => updateOtherAllowance(index, 'name', event.target.value)} placeholder="Other allowance name" />
                <input aria-label={`Other allowance ${index + 1} amount`} type="number" min="0" step="0.01" inputMode="decimal" value={inputValue(item.amount)} onChange={(event) => updateOtherAllowance(index, 'amount', event.target.value)} placeholder="Amount" />
                <button type="button" onClick={() => setDraft((current) => ({ ...current, otherAllowances: current.otherAllowances.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button>
              </div>
            ))}
            <button type="button" className="drawn-add-allowance" onClick={addOtherAllowance}>+ Add another allowance</button>
          </div>
        </>
      )}

      <details className="drawn-source-details">
        <summary>Add note or payslip reference</summary>
        <div>
          <label className="drawn-editor-field">Note<input value={draft.note} onChange={(event) => update('note', event.target.value)} placeholder="Optional note" /></label>
          <label className="drawn-editor-field">Reference<input value={draft.reference} onChange={(event) => update('reference', event.target.value)} placeholder="e.g. January payslip" /></label>
        </div>
      </details>

      {errors.length ? <div className="drawn-editor-errors" role="alert">{errors.map((error, index) => <p key={`${error.code}-${index}`}>{error.message}</p>)}</div> : null}
      <p className="drawn-missing-zero"><strong>Blank</strong> means not known. <strong>₹0</strong> means zero was actually paid.</p>
      <div className="drawn-editor__actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="primary-action" onClick={onSave}>Save this month</button></div>
    </section>
  )
}
