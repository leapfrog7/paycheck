import { parseCalendarDate } from '../dates/calendarDate'
import { validate5CpcPayState, validate6CpcPayState, validate7CpcPayState } from '../pay/payStateValidation'

export const PAY_CORRECTION_MODES = Object.freeze({
  STRUCTURED: 'STRUCTURED_CORRECTION',
  MANUAL: 'MANUAL_HISTORICAL_STATE',
})

export const PAY_STATE_SOURCE_TYPES = Object.freeze({
  SYSTEM_DERIVED: 'SYSTEM_DERIVED',
  USER_CONFIRMED: 'USER_CONFIRMED',
  USER_ENTERED_HISTORICAL: 'USER_ENTERED_HISTORICAL',
})

export const CORRECTION_BASES = Object.freeze({ BEFORE_EVENT: 'BEFORE_EVENT', AFTER_EVENT: 'AFTER_EVENT' })

const STATE_FIELDS = ['cpc', 'payScaleId', 'stageIndex', 'payBand', 'payInBand', 'gradePay', 'level', 'cellIndex', 'basicPay', 'dni']

function failure(reason, message, before = {}) {
  return { success: false, status: 'UNRESOLVED', ruleId: 'PAY_REFIXATION', reason, errors: [{ code: reason, message }], before: structuredClone(before) }
}

function warningsFor(event, manualWarnings = []) {
  const warnings = [
    { code: 'MANUAL_PAY_STATE_OVERRIDE', message: 'This corrected pay state replaces calculated pay from its effective date and subsequent pay is recalculated from it.' },
    { code: 'DUE_PAY_TRAJECTORY_CHANGED', message: 'Use Drawn Pay instead if the intent is only to record what was actually paid.' },
    ...manualWarnings,
  ]
  if (!event.reference) warnings.push({ code: 'CORRECTION_WITHOUT_REFERENCE', message: 'No user-supplied order or record reference was entered.' })
  return warnings
}

function manualState(input = {}) {
  const errors = []
  const warnings = []
  const cpc = Number(input.cpc)
  const basicPay = Number(input.basicPay)
  if (![5, 6, 7].includes(cpc)) errors.push({ code: 'MISSING_OR_INVALID_CPC', message: 'Manual historical state requires CPC 5, 6, or 7.' })
  if (!Number.isFinite(basicPay) || basicPay < 0) errors.push({ code: 'INVALID_BASIC_PAY', message: 'Basic Pay must be finite and non-negative.' })
  if (cpc === 5 && !(input.payScaleId ?? input.payScaleCode ?? input.payScale)) errors.push({ code: 'MISSING_PAY_SCALE', message: 'A known 5th CPC Pay Scale identity is required.' })
  if (cpc === 6) {
    const hasComponents = input.payInBand !== undefined || input.payInPayBand !== undefined || input.gradePay !== undefined
    if (hasComponents) {
      const payInBand = Number(input.payInBand ?? input.payInPayBand)
      const gradePay = Number(input.gradePay)
      if (!Number.isFinite(payInBand) || payInBand < 0 || !Number.isFinite(gradePay) || gradePay < 0) errors.push({ code: 'INVALID_6CPC_COMPONENTS', message: 'Entered Pay in Band and Grade Pay must be finite and non-negative.' })
      else if (basicPay !== payInBand + gradePay) warnings.push({ code: 'INCONSISTENT_6CPC_COMPONENTS', message: 'Entered Basic Pay does not equal Pay in Band plus Grade Pay; values were retained without repair.' })
    } else warnings.push({ code: '6CPC_BASIC_ONLY_MANUAL_STATE', message: 'Only aggregate 6th CPC Basic Pay is known; component-dependent future rules may be unresolved.' })
  }
  if (cpc === 7 && !(input.level ?? input.payLevel)) errors.push({ code: 'MISSING_PAY_LEVEL', message: 'A known 7th CPC Level identity is required.' })
  if (errors.length) return { valid: false, errors, warnings }
  warnings.push({ code: 'NON_STANDARD_PAY_STATE', message: 'Rule conformity was not required because this is user-confirmed historical state.' })
  return {
    valid: true, errors, warnings,
    state: { ...structuredClone(input), cpc, basicPay, structuralStatus: 'NON_STANDARD_CONFIRMED', sourceType: PAY_STATE_SOURCE_TYPES.USER_CONFIRMED },
  }
}

function structuredState(input = {}) {
  const cpc = Number(input.cpc)
  const validation = cpc === 5 ? validate5CpcPayState(input) : cpc === 6 ? validate6CpcPayState(input) : cpc === 7 ? validate7CpcPayState(input) : { valid: false, errors: ['A valid CPC is required.'] }
  if (!validation.valid) return { valid: false, errors: validation.errors }
  if (!input.dni) return { valid: false, errors: [{ code: 'MISSING_DNI', message: 'A corrected structured Pay State requires DNI.' }] }
  return {
    valid: true, errors: [], warnings: [],
    state: { ...(validation.normalizedState ?? structuredClone(input)), structuralStatus: 'STANDARD', sourceType: PAY_STATE_SOURCE_TYPES.USER_CONFIRMED },
  }
}

function changedFields(before, after) {
  return Object.fromEntries(STATE_FIELDS.flatMap((field) => {
    const beforeValue = before[field] ?? null
    const afterValue = after[field] ?? null
    return JSON.stringify(beforeValue) === JSON.stringify(afterValue) ? [] : [[field, { before: beforeValue, after: afterValue }]]
  }))
}

export function applyPayRefixation(payState = {}, event = {}) {
  const effectiveDate = event.effectiveDate ?? event.eventDate ?? ''
  if (!parseCalendarDate(effectiveDate)) return failure('INVALID_EFFECTIVE_DATE', 'A valid correction effectiveDate is required.', payState)
  const notional = event.type === 'NOTIONAL_REFIXATION'
  const monetaryBenefitFrom = event.monetaryBenefitFrom ?? (notional ? '' : effectiveDate)
  if (notional && (!parseCalendarDate(monetaryBenefitFrom) || monetaryBenefitFrom < effectiveDate)) return failure('INVALID_MONETARY_BENEFIT_DATE', 'monetaryBenefitFrom must be a valid date on or after the notional effective date.', payState)
  const mode = event.correctionMode ?? event.mode
  if (!Object.values(PAY_CORRECTION_MODES).includes(mode)) return failure('INVALID_CORRECTION_MODE', 'Select STRUCTURED_CORRECTION or MANUAL_HISTORICAL_STATE.', payState)
  const resolution = mode === PAY_CORRECTION_MODES.STRUCTURED ? structuredState(event.correctedPayState) : manualState(event.correctedPayState)
  if (!resolution.valid) return { ...failure('INVALID_CORRECTED_PAY_STATE', 'The corrected Pay State does not satisfy the selected correction mode.', payState), errors: resolution.errors }

  const eventId = event.id ?? event.eventId ?? null
  const provenance = {
    sourceType: PAY_STATE_SOURCE_TYPES.USER_CONFIRMED, reasonCategory: event.reasonCategory ?? null,
    reference: event.reference ?? null, note: event.note ?? null, authorityDate: event.authorityDate ?? null,
    enteredAt: event.enteredAt ?? null, derivedFromEventId: eventId,
  }
  const after = { ...resolution.state, effectiveFrom: effectiveDate, correctionProvenance: provenance }
  return {
    success: true, status: 'CALCULATED', ruleId: notional ? 'NOTIONAL_REFIXATION' : 'PAY_REFIXATION',
    eventType: event.type, eventId, stateReplacement: true, certaintyReset: true,
    effectiveDate, monetaryBenefitFrom, monetaryEffect: notional && monetaryBenefitFrom > effectiveDate ? 'NOTIONAL_THEN_MONETARY' : 'MONETARY',
    correctionMode: mode, structuralStatus: after.structuralStatus, before: structuredClone(payState), after,
    changedFields: changedFields(payState, after), provenance,
    warnings: warningsFor(event, resolution.warnings),
    explanation: `Pay State manually refixed from ${effectiveDate} using user-confirmed data. Subsequent events are recalculated from the corrected state.`,
  }
}

export function applyDniAdjustment(payState = {}, event = {}) {
  const effectiveDate = event.effectiveDate ?? event.eventDate ?? ''
  if (!parseCalendarDate(effectiveDate)) return failure('INVALID_EFFECTIVE_DATE', 'A valid DNI adjustment effectiveDate is required.', payState)
  if (!parseCalendarDate(event.newDni) || event.newDni < effectiveDate) return failure('INVALID_ADJUSTED_DNI', 'newDni must be a valid date on or after the adjustment effective date.', payState)
  const eventId = event.id ?? event.eventId ?? null
  const dniDecision = {
    cpc: Number(payState.cpc), trigger: { type: 'DNI_ADJUSTMENT', eventId, effectiveDate }, ruleId: null,
    candidateDni: event.newDni, qualifyingService: null, status: 'RESOLVED', date: event.newDni, dni: event.newDni,
    reason: null, sourceType: PAY_STATE_SOURCE_TYPES.USER_CONFIRMED, derivedFromEventId: eventId,
    explanation: 'DNI was replaced by a user-confirmed adjustment.',
  }
  const after = { ...structuredClone(payState), effectiveFrom: effectiveDate, dni: event.newDni, dniDecision }
  return {
    success: true, status: 'CALCULATED', ruleId: 'DNI_ADJUSTMENT', eventType: 'DNI_ADJUSTMENT', eventId,
    effectiveDate, before: structuredClone(payState), after, dniDecision,
    changedFields: { dni: { before: payState.dni ?? null, after: event.newDni } },
    provenance: { sourceType: PAY_STATE_SOURCE_TYPES.USER_CONFIRMED, reasonCategory: event.reasonCategory ?? null, reference: event.reference ?? null, note: event.note ?? null, derivedFromEventId: eventId },
    warnings: event.reference ? [] : [{ code: 'CORRECTION_WITHOUT_REFERENCE', message: 'No user-supplied order or record reference was entered.' }],
    explanation: `DNI was manually adjusted to ${event.newDni}; all other Pay State fields were retained.`,
  }
}
