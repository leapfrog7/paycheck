import {
  DRAWN_PAY_ENTRY_MODES,
  createDrawnPayRecord,
  upsertDrawnPayRecord,
} from '../../../domain/pay/drawnPay'

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/

export function monthsInPeriod(startDate, endDate) {
  const start = /^(\d{4})-(\d{2})/.exec(startDate ?? '')
  const end = /^(\d{4})-(\d{2})/.exec(endDate ?? '')
  if (!start || !end) return []
  const cursor = new Date(Date.UTC(Number(start[1]), Number(start[2]) - 1, 1))
  const finish = new Date(Date.UTC(Number(end[1]), Number(end[2]) - 1, 1))
  const months = []
  while (cursor <= finish) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return months
}

export function getDrawnPayProgress(months, records) {
  const coveredMonths = new Set(months)
  const entered = records.filter((record) => coveredMonths.has(record.month)).length
  return {
    entered,
    missing: Math.max(months.length - entered, 0),
    total: months.length,
    percentage: months.length ? Math.round((entered / months.length) * 100) : 0,
  }
}

export function saveQuickGrossEntry(records, month, grossDrawn, periodOptions) {
  const existing = records.find((record) => record.month === month)
  return upsertDrawnPayRecord(records, {
    ...existing,
    month,
    entryMode: DRAWN_PAY_ENTRY_MODES.GROSS_ONLY,
    grossDrawn,
    components: {},
    otherAllowances: [],
    reference: existing?.reference || 'Quick gross entry',
  }, periodOptions)
}

export function copyRecordToFollowingEmptyMonths(records, sourceMonth, months, periodOptions) {
  const source = records.find((record) => record.month === sourceMonth)
  if (!source) return { valid: false, errors: [{ code: 'DRAWN_SOURCE_NOT_FOUND', message: 'Save this month before copying it forward.' }], records }
  const occupied = new Set(records.map((record) => record.month))
  const targets = months.filter((month) => month > sourceMonth && !occupied.has(month))
  let nextRecords = records
  for (const month of targets) {
    const result = upsertDrawnPayRecord(nextRecords, createDrawnPayRecord({
      ...source,
      month,
      note: source.note,
      reference: source.reference ? `${source.reference} · copied forward` : `Copied from ${sourceMonth}`,
    }), periodOptions)
    if (!result.valid) return { ...result, copiedMonths: [] }
    nextRecords = result.records
  }
  return { valid: true, errors: [], records: nextRecords, copiedMonths: targets }
}

function parseAmount(value) {
  const normalized = String(value ?? '').replace(/[₹,\s]/g, '')
  if (normalized === '') return null
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

export function parseGrossDrawnPaste(text, allowedMonths = []) {
  const allowed = new Set(allowedMonths)
  const rows = []
  const errors = []
  const seen = new Set()

  String(text ?? '').split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line) return
    const match = /^(\d{4}-\d{2})\s*(?:,|\t|\s)\s*(.+)$/.exec(line)
    if (!match || !MONTH_PATTERN.test(match[1])) {
      errors.push({ line: index + 1, message: 'Use YYYY-MM followed by the gross amount.' })
      return
    }
    const month = match[1]
    const monthNumber = Number(month.slice(5))
    const amount = parseAmount(match[2])
    if (monthNumber < 1 || monthNumber > 12) errors.push({ line: index + 1, message: `${month} is not a valid month.` })
    else if (allowed.size && !allowed.has(month)) errors.push({ line: index + 1, message: `${month} is outside this case period.` })
    else if (seen.has(month)) errors.push({ line: index + 1, message: `${month} appears more than once.` })
    else if (amount === null) errors.push({ line: index + 1, message: 'Gross amount must be zero or more.' })
    else {
      rows.push({ month, grossDrawn: amount })
      seen.add(month)
    }
  })
  return { valid: errors.length === 0 && rows.length > 0, rows, errors }
}

export function importGrossDrawnRows(records, rows, periodOptions) {
  let nextRecords = records
  const importedMonths = []
  for (const row of rows) {
    const result = saveQuickGrossEntry(nextRecords, row.month, row.grossDrawn, periodOptions)
    if (!result.valid) return { ...result, importedMonths: [] }
    nextRecords = result.records
    importedMonths.push(row.month)
  }
  return { valid: true, errors: [], records: nextRecords, importedMonths }
}
