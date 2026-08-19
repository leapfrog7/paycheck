export const DRAWN_PAY_ENTRY_MODES = Object.freeze({
  COMPONENT_ENTRY: 'COMPONENT_ENTRY',
  GROSS_ONLY: 'GROSS_ONLY',
})

export const DRAWN_PAY_COMPLETENESS = Object.freeze({
  COMPLETE_COMPONENTS: 'COMPLETE_COMPONENTS',
  PARTIAL_COMPONENTS: 'PARTIAL_COMPONENTS',
  GROSS_ONLY: 'GROSS_ONLY',
})

export const DRAWN_PAY_SOURCE_TYPES = Object.freeze({ USER_ENTERED: 'USER_ENTERED' })
export const DRAWN_PAY_STATUS = Object.freeze({ RECORDED: 'RECORDED' })

const COMPONENT_KEYS = ['basicPay', 'da', 'hra', 'transportAllowance']
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/

export function isValidCalendarMonth(value) {
  const match = MONTH_PATTERN.exec(value ?? '')
  return Boolean(match) && Number(match[2]) >= 1 && Number(match[2]) <= 12
}

function normalizeOptionalAmount(value) {
  if (value === '' || value === null || value === undefined) return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : value
}

function normalizeOtherAllowance(item = {}) {
  return {
    name: String(item.name ?? '').trim(),
    amount: normalizeOptionalAmount(item.amount),
  }
}

export function calculateDrawnComponentTotal(record = {}) {
  if (record.entryMode === DRAWN_PAY_ENTRY_MODES.GROSS_ONLY) return null
  const components = record.components ?? {}
  const amounts = [
    ...COMPONENT_KEYS.map((key) => components[key]),
    ...(record.otherAllowances ?? []).map(({ amount }) => amount),
  ]
  const entered = amounts.filter((amount) => amount !== null && amount !== undefined && amount !== '')
  if (!entered.length || entered.some((amount) => !Number.isFinite(Number(amount)))) return null
  return entered.reduce((total, amount) => total + Number(amount), 0)
}

function inferCompleteness(entryMode, components) {
  if (entryMode === DRAWN_PAY_ENTRY_MODES.GROSS_ONLY) return DRAWN_PAY_COMPLETENESS.GROSS_ONLY
  return COMPONENT_KEYS.every((key) => components[key] !== null)
    ? DRAWN_PAY_COMPLETENESS.COMPLETE_COMPONENTS
    : DRAWN_PAY_COMPLETENESS.PARTIAL_COMPONENTS
}

export function createDrawnPayRecord(overrides = {}) {
  const entryMode = overrides.entryMode === DRAWN_PAY_ENTRY_MODES.GROSS_ONLY
    ? DRAWN_PAY_ENTRY_MODES.GROSS_ONLY
    : DRAWN_PAY_ENTRY_MODES.COMPONENT_ENTRY
  const inputComponents = overrides.components ?? {}
  const components = Object.fromEntries(
    COMPONENT_KEYS.map((key) => [key, normalizeOptionalAmount(inputComponents[key])]),
  )
  const otherAllowances = Array.isArray(overrides.otherAllowances)
    ? overrides.otherAllowances.map(normalizeOtherAllowance)
    : []
  const record = {
    month: overrides.month ?? '',
    entryMode,
    completeness: inferCompleteness(entryMode, components),
    components,
    otherAllowances,
    grossDrawn: normalizeOptionalAmount(overrides.grossDrawn),
    sourceType: DRAWN_PAY_SOURCE_TYPES.USER_ENTERED,
    note: String(overrides.note ?? ''),
    reference: String(overrides.reference ?? ''),
    status: DRAWN_PAY_STATUS.RECORDED,
  }
  if (entryMode === DRAWN_PAY_ENTRY_MODES.COMPONENT_ENTRY) {
    record.grossDrawn = record.completeness === DRAWN_PAY_COMPLETENESS.COMPLETE_COMPONENTS
      ? calculateDrawnComponentTotal(record)
      : normalizeOptionalAmount(overrides.grossDrawn)
  }
  return record
}

function amountErrors(value, field) {
  if (value === null || value === undefined || value === '') return []
  return Number.isFinite(Number(value)) && Number(value) >= 0
    ? []
    : [{ code: 'INVALID_DRAWN_AMOUNT', field, message: `${field} must be a finite amount of zero or more.` }]
}

export function validateDrawnPayRecord(record, { caseStartDate, caseEndDate } = {}) {
  const normalized = createDrawnPayRecord(record)
  const errors = []
  if (!isValidCalendarMonth(normalized.month)) {
    errors.push({ code: 'INVALID_DRAWN_MONTH', field: 'month', message: 'Select a valid calendar month.' })
  } else {
    const startMonth = caseStartDate?.slice(0, 7)
    const endMonth = caseEndDate?.slice(0, 7)
    if ((startMonth && normalized.month < startMonth) || (endMonth && normalized.month > endMonth)) {
      errors.push({ code: 'DRAWN_MONTH_OUTSIDE_CASE', field: 'month', message: 'Month must be within the case period.' })
    }
  }
  if (normalized.entryMode === DRAWN_PAY_ENTRY_MODES.GROSS_ONLY) {
    if (normalized.grossDrawn === null) {
      errors.push({ code: 'GROSS_DRAWN_REQUIRED', field: 'grossDrawn', message: 'Gross drawn is required in gross-only mode.' })
    } else errors.push(...amountErrors(normalized.grossDrawn, 'Gross drawn'))
  } else {
    COMPONENT_KEYS.forEach((key) => errors.push(...amountErrors(normalized.components[key], key)))
    errors.push(...amountErrors(normalized.grossDrawn, 'Gross drawn'))
    normalized.otherAllowances.forEach((item, index) => {
      if (!item.name) errors.push({ code: 'OTHER_ALLOWANCE_NAME_REQUIRED', field: `otherAllowances.${index}.name`, message: 'Allowance name is required.' })
      if (item.amount === null) errors.push({ code: 'OTHER_ALLOWANCE_AMOUNT_REQUIRED', field: `otherAllowances.${index}.amount`, message: 'Allowance amount is required.' })
      else errors.push(...amountErrors(item.amount, `Other allowance ${index + 1}`))
    })
  }
  return { valid: errors.length === 0, errors, record: normalized }
}

export function normalizeDrawnPayHistory(history = []) {
  if (!Array.isArray(history)) return []
  return history.map(createDrawnPayRecord).sort((left, right) => left.month.localeCompare(right.month))
}

export function validateDrawnPayHistory(history, options = {}) {
  const records = normalizeDrawnPayHistory(history)
  const errors = records.flatMap((record) => validateDrawnPayRecord(record, options).errors)
  const seen = new Set()
  records.forEach((record) => {
    if (seen.has(record.month)) errors.push({ code: 'DUPLICATE_DRAWN_MONTH', field: 'month', month: record.month, message: 'Only one Drawn Pay record is allowed for each month.' })
    seen.add(record.month)
  })
  return { valid: errors.length === 0, errors, records }
}

export function upsertDrawnPayRecord(history, record, options = {}) {
  const validation = validateDrawnPayRecord(record, options)
  if (!validation.valid) return { ...validation, records: normalizeDrawnPayHistory(history) }
  const records = normalizeDrawnPayHistory(history)
  const existingIndex = records.findIndex(({ month }) => month === validation.record.month)
  if (existingIndex >= 0) records[existingIndex] = validation.record
  else records.push(validation.record)
  return { valid: true, errors: [], record: validation.record, records: normalizeDrawnPayHistory(records) }
}

export function copyPreviousDrawnPayRecord(history, month, options = {}) {
  const records = normalizeDrawnPayHistory(history)
  if (records.some((record) => record.month === month)) {
    return { valid: false, errors: [{ code: 'DUPLICATE_DRAWN_MONTH', field: 'month', message: 'Drawn Pay is already recorded for this month.' }], records }
  }
  const previous = records.filter((record) => record.month < month).at(-1)
  if (!previous) return { valid: false, errors: [{ code: 'NO_PREVIOUS_DRAWN_MONTH', field: 'month', message: 'There is no earlier recorded month to copy.' }], records }
  return upsertDrawnPayRecord(records, { ...previous, month }, options)
}
