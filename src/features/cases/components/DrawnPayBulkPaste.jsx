import { useMemo, useState } from 'react'
import { parseGrossDrawnPaste } from '../models/drawnPayWorkspace'

export default function DrawnPayBulkPaste({ months, records, onImport }) {
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseGrossDrawnPaste(text, months), [months, text])
  const existingMonths = new Set(records.map((record) => record.month))
  const updateCount = parsed.rows.filter((row) => existingMonths.has(row.month)).length

  function importRows() {
    if (!parsed.valid) return
    if (onImport(parsed.rows)) setText('')
  }

  return (
    <details className="drawn-bulk-paste">
      <summary><span aria-hidden="true">▦</span><span><strong>Paste monthly gross amounts</strong><small>Useful for copying two columns from a spreadsheet</small></span></summary>
      <div className="drawn-bulk-paste__body">
        <label>Month and gross amount
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows="5" placeholder={'2025-01\t85000\n2025-02\t85000\n2025-03\t87200'} />
        </label>
        <p>Use one row per month: <strong>YYYY-MM</strong>, then a tab, comma, or space, then the gross amount.</p>
        {text && parsed.errors.length ? <div className="drawn-paste-errors" role="alert">{parsed.errors.map((error) => <p key={`${error.line}-${error.message}`}>Line {error.line}: {error.message}</p>)}</div> : null}
        {parsed.rows.length ? <div className="drawn-paste-preview"><strong>{parsed.rows.length} valid month{parsed.rows.length === 1 ? '' : 's'} ready</strong><span>{updateCount ? `${updateCount} existing month${updateCount === 1 ? '' : 's'} will be replaced with gross-only values.` : 'No existing entries will be overwritten.'}</span></div> : null}
        <button type="button" className="secondary-action" disabled={!parsed.valid} onClick={importRows}>Import gross amounts</button>
      </div>
    </details>
  )
}
