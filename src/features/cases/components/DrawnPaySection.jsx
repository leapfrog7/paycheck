import { useEffect, useMemo, useRef, useState } from 'react'
import {
  copyPreviousDrawnPayRecord,
  createDrawnPayRecord,
  upsertDrawnPayRecord,
} from '../../../domain/pay/drawnPay'
import {
  copyRecordToFollowingEmptyMonths,
  getDrawnPayProgress,
  importGrossDrawnRows,
  monthsInPeriod,
  saveQuickGrossEntry,
} from '../models/drawnPayWorkspace'
import DrawnPayBulkPaste from './DrawnPayBulkPaste'
import DrawnPayEditor from './DrawnPayEditor'
import DrawnPayQuickList from './DrawnPayQuickList'

const FILTERS = [
  ['all', 'All months'],
  ['missing', 'Needs entry'],
  ['entered', 'Entered'],
]

export default function DrawnPaySection({ caseData, onChange }) {
  const records = useMemo(() => caseData.drawnPayHistory ?? [], [caseData.drawnPayHistory])
  const [draft, setDraft] = useState(null)
  const [errors, setErrors] = useState([])
  const [filter, setFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [undoSnapshot, setUndoSnapshot] = useState(null)
  const editorRef = useRef(null)
  const months = useMemo(
    () => monthsInPeriod(caseData.calculationStartDate, caseData.calculationEndDate),
    [caseData.calculationStartDate, caseData.calculationEndDate],
  )
  const recordsByMonth = useMemo(() => new Map(records.map((record) => [record.month, record])), [records])
  const progress = useMemo(() => getDrawnPayProgress(months, records), [months, records])
  const periodOptions = { caseStartDate: caseData.calculationStartDate, caseEndDate: caseData.calculationEndDate }
  const draftMonth = draft?.month

  useEffect(() => {
    if (draftMonth) editorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [draftMonth])

  function acceptResult(result, message, undoable = false) {
    if (!result.valid) {
      setErrors(result.errors)
      return false
    }
    onChange(result.records)
    setErrors([])
    setNotice(message)
    setUndoSnapshot(undoable ? records : null)
    return true
  }

  function editMonth(month) {
    setDraft(createDrawnPayRecord(recordsByMonth.get(month) ?? { month }))
    setErrors([])
  }

  function saveDraft() {
    const result = upsertDrawnPayRecord(records, draft, periodOptions)
    if (acceptResult(result, `${draft.month} saved.`)) setDraft(null)
  }

  function saveGross(month, grossDrawn) {
    acceptResult(saveQuickGrossEntry(records, month, grossDrawn, periodOptions), `${month} saved automatically.`)
  }

  function copyPrevious(month) {
    const result = copyPreviousDrawnPayRecord(records, month, periodOptions)
    acceptResult(result, result.valid ? `${month} copied from the nearest earlier entry.` : '')
  }

  function copyForward(month) {
    const result = copyRecordToFollowingEmptyMonths(records, month, months, periodOptions)
    acceptResult(result, result.valid ? `Copied ${month} to ${result.copiedMonths.length} following empty month${result.copiedMonths.length === 1 ? '' : 's'}.` : '', true)
  }

  function importRows(rows) {
    const result = importGrossDrawnRows(records, rows, periodOptions)
    return acceptResult(result, result.valid ? `${result.importedMonths.length} gross amount${result.importedMonths.length === 1 ? '' : 's'} imported.` : '', true)
  }

  function removeMonth(month) {
    const record = recordsByMonth.get(month)
    if (!record) return
    onChange(records.filter((item) => item.month !== month))
    if (draft?.month === month) setDraft(null)
    setUndoSnapshot(records)
    setNotice(`${month} removed.`)
    setErrors([])
  }

  function undoLastChange() {
    if (!undoSnapshot) return
    onChange(undoSnapshot)
    setUndoSnapshot(null)
    setNotice('Last change undone.')
    setErrors([])
  }

  return (
    <section className="drawn-pay-section">
      <header className="drawn-pay-header">
        <div>
          <p className="case-header__eyebrow">Actually paid</p>
          <h2>Drawn Pay</h2>
          <p>Enter values from payslips or salary records. They remain independent of PayCheck’s Expected Pay calculation.</p>
        </div>
        <div className="drawn-progress" aria-label={`${progress.entered} of ${progress.total} months entered`}>
          <div><strong>{progress.entered} of {progress.total}</strong><span>months entered</span></div>
          <div className="drawn-progress__track"><span style={{ width: `${progress.percentage}%` }} /></div>
          <small>{progress.percentage}% complete</small>
        </div>
      </header>

      <div className="drawn-pay-guidance">
        <span aria-hidden="true">₹</span>
        <p><strong>Fastest method:</strong> enter the gross amount for each month and press Tab. Use detailed entry only when you want a component-wise comparison.</p>
        <p><strong>Blank ≠ ₹0.</strong> Blank means unknown; zero means nothing was paid.</p>
      </div>

      {notice ? <div className="drawn-save-notice" role="status"><span>✓ {notice}</span>{undoSnapshot ? <button type="button" onClick={undoLastChange}>Undo</button> : null}<button type="button" aria-label="Dismiss saved message" onClick={() => { setNotice(''); setUndoSnapshot(null) }}>×</button></div> : null}
      {errors.length && !draft ? <div className="drawn-global-errors" role="alert">{errors.map((error, index) => <p key={`${error.code}-${index}`}>{error.message}</p>)}</div> : null}

      <div className="drawn-toolbar">
        <div className="drawn-filters" aria-label="Filter salary months">
          {FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}{value === 'missing' ? ` (${progress.missing})` : value === 'entered' ? ` (${progress.entered})` : ''}</button>)}
        </div>
      </div>

      <DrawnPayBulkPaste months={months} records={records} onImport={importRows} />

      <div className="drawn-workspace">
        <div className="drawn-editor-column" ref={editorRef}>
          {draft ? (
            <DrawnPayEditor key={draft.month} draft={draft} setDraft={setDraft} errors={errors} onSave={saveDraft} onCancel={() => { setDraft(null); setErrors([]) }} />
          ) : (
            <aside className="drawn-editor-empty">
              <span aria-hidden="true">✦</span>
              <h3>Quick entry is ready</h3>
              <p>Type a gross amount directly beside any month. Choose <strong>Add details</strong> when you have component values or a payslip reference.</p>
              <ul><li>Copy the nearest previous month</li><li>Copy one entry to all later empty months</li><li>Paste two spreadsheet columns</li></ul>
            </aside>
          )}
        </div>

        <DrawnPayQuickList
          months={months}
          records={records}
          filter={filter}
          onSaveGross={saveGross}
          onCopyPrevious={copyPrevious}
          onCopyForward={copyForward}
          onEdit={editMonth}
          onRemove={removeMonth}
        />
      </div>
    </section>
  )
}
