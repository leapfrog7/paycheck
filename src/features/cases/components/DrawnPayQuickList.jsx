import { useMemo, useState } from 'react'
import { DRAWN_PAY_ENTRY_MODES } from '../../../domain/pay/drawnPay'

function formatMonth(month) {
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`))
}

function money(value) {
  return value === null || value === undefined ? '—' : `₹${Number(value).toLocaleString('en-IN')}`
}

function recordLabel(record) {
  if (!record) return 'Not entered'
  if (record.entryMode === DRAWN_PAY_ENTRY_MODES.GROSS_ONLY) return record.grossDrawn === 0 ? '₹0 recorded' : 'Gross recorded'
  return record.completeness === 'PARTIAL_COMPONENTS' ? 'Partial components' : 'Components recorded'
}

function QuickGrossRow({ month, record, previousExists, emptyMonthsAfter, onSaveGross, onCopyPrevious, onCopyForward, onEdit, onRemove }) {
  const isGrossOnly = record?.entryMode === DRAWN_PAY_ENTRY_MODES.GROSS_ONLY
  const [value, setValue] = useState(isGrossOnly ? String(record.grossDrawn ?? '') : '')

  function commit() {
    if (value === '') {
      setValue(isGrossOnly ? String(record.grossDrawn ?? '') : '')
      return
    }
    onSaveGross(month, value)
  }

  return (
    <article className={`drawn-row drawn-row--${record ? 'entered' : 'missing'}`}>
      <div className="drawn-row__month">
        <strong>{formatMonth(month)}</strong>
        <span className={`drawn-status drawn-status--${record ? 'entered' : 'missing'}`}>{recordLabel(record)}</span>
      </div>

      <div className="drawn-row__entry">
        {record && !isGrossOnly ? (
          <div className="drawn-component-summary"><strong>{money(record.grossDrawn)}</strong><span>Calculated from entered components</span></div>
        ) : (
          <label>
            <span className="sr-only">Gross salary actually paid for {formatMonth(month)}</span>
            <span className="drawn-currency-prefix" aria-hidden="true">₹</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
              placeholder="Not entered"
            />
          </label>
        )}
      </div>

      <div className="drawn-row__actions">
        {!record && previousExists ? <button type="button" onClick={() => onCopyPrevious(month)}>Copy previous</button> : null}
        <button type="button" onClick={() => onEdit(month)}>{record && !isGrossOnly ? 'Edit components' : 'Add details'}</button>
        {record ? (
          <details className="drawn-row-menu">
            <summary aria-label={`More actions for ${formatMonth(month)}`}>•••</summary>
            <div>
              {emptyMonthsAfter ? <button type="button" onClick={() => onCopyForward(month)}>Copy to {emptyMonthsAfter} following empty month{emptyMonthsAfter === 1 ? '' : 's'}</button> : null}
              <button type="button" className="drawn-row-menu__remove" onClick={() => onRemove(month)}>Remove entry</button>
            </div>
          </details>
        ) : null}
      </div>
    </article>
  )
}

export default function DrawnPayQuickList({ months, records, filter, onSaveGross, onCopyPrevious, onCopyForward, onEdit, onRemove }) {
  const recordsByMonth = useMemo(() => new Map(records.map((record) => [record.month, record])), [records])
  const rowMetadata = useMemo(() => {
    const metadata = new Map()
    let previousExists = false
    months.forEach((month) => {
      metadata.set(month, { previousExists, emptyMonthsAfter: 0 })
      if (recordsByMonth.has(month)) previousExists = true
    })
    let emptyMonthsAfter = 0
    for (let index = months.length - 1; index >= 0; index -= 1) {
      const month = months[index]
      metadata.get(month).emptyMonthsAfter = emptyMonthsAfter
      if (!recordsByMonth.has(month)) emptyMonthsAfter += 1
    }
    return metadata
  }, [months, recordsByMonth])
  const visibleMonths = months.filter((month) => {
    if (filter === 'missing') return !recordsByMonth.has(month)
    if (filter === 'entered') return recordsByMonth.has(month)
    return true
  })

  return (
    <section className="drawn-quick-list" aria-label="Monthly Drawn Pay">
      <div className="drawn-list-heading" aria-hidden="true"><span>Salary month</span><span>Gross actually paid</span><span>Actions</span></div>
      {visibleMonths.length ? visibleMonths.map((month) => {
        const record = recordsByMonth.get(month)
        const metadata = rowMetadata.get(month)
        return (
          <QuickGrossRow
            key={`${month}-${record?.entryMode ?? 'missing'}-${record?.grossDrawn ?? 'blank'}`}
            month={month}
            record={record}
            previousExists={metadata.previousExists}
            emptyMonthsAfter={metadata.emptyMonthsAfter}
            onSaveGross={onSaveGross}
            onCopyPrevious={onCopyPrevious}
            onCopyForward={onCopyForward}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        )
      }) : <div className="drawn-filter-empty">No months match this view.</div>}
    </section>
  )
}
