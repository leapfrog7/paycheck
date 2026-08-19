export const CPC_SWITCH_OPTION_STATUS = Object.freeze({ CONFIRMED: 'CONFIRMED', SUPERSEDED: 'SUPERSEDED' })

export const CPC_SWITCH_BASES = Object.freeze({
  FROM_STATUTORY_DATE: 'FROM_STATUTORY_DATE',
  ON_NEXT_INCREMENT: 'ON_NEXT_INCREMENT',
  ON_SUBSEQUENT_INCREMENT: 'ON_SUBSEQUENT_INCREMENT',
  ON_PROMOTION_OR_UPGRADATION: 'ON_PROMOTION_OR_UPGRADATION',
  ON_VACATING_OR_CEASING_OLD_STRUCTURE: 'ON_VACATING_OR_CEASING_OLD_STRUCTURE',
})

export const CPC_TRANSITION_STATUTORY_DATES = Object.freeze({ '5-6': '2006-01-01', '6-7': '2016-01-01' })

const INCREMENT_BASES = new Set([CPC_SWITCH_BASES.ON_NEXT_INCREMENT, CPC_SWITCH_BASES.ON_SUBSEQUENT_INCREMENT])
const PROMOTION_TRIGGER_TYPES = new Set(['REGULAR_PROMOTION', 'ACP', 'MACP'])

const idOf = (event = {}) => event.id ?? event.eventId ?? null
const eventOf = (entry = {}) => entry.event ?? entry
const dateOf = (event = {}) => event.employeeSwitchDate ?? event.fixationDate ?? event.effectiveFrom ?? event.effectiveDate ?? event.eventDate ?? ''

function unresolved(reason, message, details = {}) {
  return { valid: false, status: 'UNRESOLVED', reason, errors: [{ code: reason, message }], ...details }
}

export function validateCpcSwitchOption(event = {}, context = {}) {
  const statutoryEffectiveDate = event.statutoryEffectiveDate
    ?? CPC_TRANSITION_STATUTORY_DATES[`${Number(event.fromCpc)}-${Number(event.toCpc)}`]
    ?? ''
  const employeeSwitchDate = dateOf(event)
  const dates = { statutoryEffectiveDate, employeeSwitchDate }
  if (!statutoryEffectiveDate || !employeeSwitchDate) return unresolved('MISSING_CPC_SWITCH_DATE', 'Both CPC switch dates are required.', dates)
  if (employeeSwitchDate < statutoryEffectiveDate) return unresolved('CPC_SWITCH_BEFORE_STATUTORY_EFFECTIVE_DATE', 'The employee switch date cannot precede the statutory CPC effective date.', dates)
  if (employeeSwitchDate === statutoryEffectiveDate) {
    return { valid: true, status: 'VALID', delayed: false, ...dates, basis: CPC_SWITCH_BASES.FROM_STATUTORY_DATE, triggerEventId: null }
  }

  const option = event.option ?? {}
  if (option.status !== CPC_SWITCH_OPTION_STATUS.CONFIRMED) return unresolved('CONFIRMED_DELAYED_CPC_OPTION_REQUIRED', 'A delayed CPC switch requires an active confirmed option.', dates)
  if (!Object.values(CPC_SWITCH_BASES).includes(option.basis) || option.basis === CPC_SWITCH_BASES.FROM_STATUTORY_DATE) return unresolved('INVALID_DELAYED_CPC_SWITCH_BASIS', 'The confirmed option must identify a supported delayed-switch basis.', dates)

  const history = context.history ?? []
  const appointmentEvent = eventOf(history.find((entry) => eventOf(entry).type === 'INITIAL_APPOINTMENT'))
  const appointmentDate = dateOf(appointmentEvent)
  if (appointmentDate && appointmentDate >= statutoryEffectiveDate) return unresolved('DELAYED_CPC_OPTION_NOT_ADMISSIBLE_FOR_NEW_APPOINTEE', 'The recorded first Government appointment is on or after the statutory CPC effective date.', dates)
  if (appointmentDate && ['TRANSFER', 'TRANSFER_APPOINTMENT'].includes(appointmentEvent.appointmentNature ?? appointmentEvent.appointmentType)) return unresolved('TRANSFER_APPOINTMENT_DELAYED_CPC_OPTION_NOT_IMPLEMENTED', 'Delayed-option adjudication for an identified transfer appointment is not implemented.', dates)
  if (event.multipleExistingPayStructures || option.multipleExistingPayStructures || context.multipleExistingPayStructures) return unresolved('MULTIPLE_EXISTING_PAY_STRUCTURES_OPTION_NOT_IMPLEMENTED', 'Delayed retention involving multiple existing pay structures is not implemented.', dates)

  const triggerRequired = INCREMENT_BASES.has(option.basis) || option.basis === CPC_SWITCH_BASES.ON_PROMOTION_OR_UPGRADATION
  if (triggerRequired && !option.triggerEventId) return unresolved('DELAYED_CPC_SWITCH_TRIGGER_REQUIRED', 'This delayed-switch basis requires a triggerEventId.', dates)
  if (triggerRequired) {
    const triggerEntry = history.find((entry) => idOf(eventOf(entry)) === option.triggerEventId)
    const trigger = triggerEntry && eventOf(triggerEntry)
    if (!trigger || dateOf(trigger) !== employeeSwitchDate || triggerEntry.result?.success !== true) return unresolved('DELAYED_CPC_SWITCH_TRIGGER_NOT_RESOLVED', 'The referenced old-CPC trigger must resolve successfully on the employee switch date.', { ...dates, triggerEventId: option.triggerEventId })
    if (INCREMENT_BASES.has(option.basis) && trigger.type !== 'ANNUAL_INCREMENT') return unresolved('INVALID_DELAYED_CPC_SWITCH_TRIGGER_TYPE', 'An increment-based option must reference an annual increment.', dates)
    if (option.basis === CPC_SWITCH_BASES.ON_PROMOTION_OR_UPGRADATION && !PROMOTION_TRIGGER_TYPES.has(trigger.type)) return unresolved('INVALID_DELAYED_CPC_SWITCH_TRIGGER_TYPE', 'A promotion/upgradation option must reference a supported promotion, ACP, or MACP event.', dates)
  }

  return {
    valid: true, status: 'VALID', delayed: true, ...dates, basis: option.basis,
    triggerEventId: option.triggerEventId ?? null,
    optionExerciseDate: option.optionExerciseDate ?? null,
    optionReference: option.optionReference ?? null,
  }
}
