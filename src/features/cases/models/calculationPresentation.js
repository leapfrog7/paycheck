const COMPONENT_NAMES = {
  BASIC_PAY: 'Basic Pay',
  DA: 'Dearness Allowance',
  HRA: 'House Rent Allowance',
  TRANSPORT_ALLOWANCE: 'Transport Allowance',
}

const REASON_GUIDANCE = {
  DRAWN_PAY_NOT_ENTERED: ['Add what you were paid', 'Drawn Pay has not been entered for this month.', 'drawn'],
  DRAWN_GROSS_NOT_ENTERED: ['Add the gross amount paid', 'A Drawn Pay record exists, but its gross amount is still unknown.', 'drawn'],
  MISSING_HRA_ELIGIBILITY: ['Confirm HRA eligibility', 'Tell PayCheck whether HRA applied during this period.', 'allowances'],
  MISSING_HRA_LOCATION_STATE: ['Add the HRA posting category', 'HRA needs the applicable city classification for this period.', 'allowances'],
  MISSING_TRANSPORT_ALLOWANCE_ELIGIBILITY: ['Confirm Transport Allowance eligibility', 'Tell PayCheck whether Transport Allowance applied during this period.', 'allowances'],
  MISSING_TRANSPORT_LOCATION_STATE: ['Add the transport city category', 'Transport Allowance needs the applicable posting category for this period.', 'allowances'],
  MISSING_TRANSPORT_CITY_CATEGORY: ['Choose the transport city category', 'Select whether the posting was in a higher-rate city or another place.', 'allowances'],
  APPLICABLE_DA_RATE_UNRESOLVED: ['Review the applicable DA period', 'The dated DA rate needed for this calculation could not be resolved.', 'history'],
  UNRESOLVED_FINANCIAL_COMPONENTS: ['Complete salary-component details', 'One or more selected salary components need more information before Gross Expected Pay can be finalized.', 'allowances'],
  MONTHLY_PRORATION_RULE_NOT_IMPLEMENTED: ['Review this partial month', 'Pay changed within this month and the partial-month calculation still needs confirmation.', 'history'],
  PRORATION_BASIS_NOT_CONFIRMED: ['Confirm the partial-month method', 'Choose how this partial month should be calculated.', 'history'],
  PRORATION_ROUNDING_NOT_CONFIRMED: ['Confirm partial-month rounding', 'The rounding method for this partial month has not been confirmed.', 'history'],
  CUSTOM_ALLOWANCE_PRORATION_NOT_CONFIRMED: ['Review the custom allowance', 'Confirm how this custom allowance should be handled in a partial month.', 'allowances'],
  PRIOR_UNRESOLVED_EVENT_MAY_AFFECT_DNI: ['Review an earlier career change', 'An earlier unresolved event may have changed the next increment date.', 'events'],
  DNI_MISMATCH: ['Check the increment date', 'The recorded annual increment date does not match the current next increment date.', 'events'],
  INCREMENT_DATE_DOES_NOT_MATCH_DNI: ['Check the increment date', 'The recorded annual increment date does not match the current next increment date.', 'events'],
  SAME_LEVEL_TARGET: ['Choose the promoted level', 'The promotion target must be above the current level.', 'events'],
  SAME_FINANCIAL_STRUCTURE: ['Choose the new pay structure', 'The selected career change does not move to a different financial structure.', 'events'],
  LOWER_LEVEL_TARGET: ['Review the promoted level', 'The selected target is below the current level.', 'events'],
  MISSING_TARGET_LEVEL: ['Add the promoted level', 'Choose the level that applied after this career change.', 'events'],
  INVALID_TARGET_LEVEL: ['Review the promoted level', 'The selected target level is not available in the pay matrix.', 'events'],
  NO_SUITABLE_TARGET_CELL: ['Review fixation details', 'No valid cell could be selected from the supplied promotion details.', 'events'],
  NO_NEXT_CELL_AVAILABLE: ['Review the pay position', 'The current level does not contain a higher cell for this increment.', 'events'],
  NON_STANDARD_PAY_STATE_REQUIRES_REFIXATION: ['Confirm the historical pay position', 'This pay position needs an explicit correction or refixation before later events can be applied.', 'events'],
  NOTIONAL_ONLY_NO_MONETARY_ENTITLEMENT: ['Notional pay only', 'This period changes the pay record but does not create a monetary entitlement.', 'history'],
  DUE_PAY_LEDGER_UNAVAILABLE: ['Complete Expected Pay first', 'The month-wise Expected Pay calculation is not available yet.', 'history'],
  INVALID_FINANCIAL_SEGMENT: ['Review opening pay', 'A valid pay position is required for this period.', 'basics'],
}

function humanizeCode(value) {
  return String(value ?? '')
    .replaceAll('_', ' ')
    .replace(/\bCPC\b/g, 'CPC')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase())
}

export function componentName(component) {
  return COMPONENT_NAMES[component] ?? humanizeCode(component)
}

export function explainCalculationReason(reason, fallbackMessage = '') {
  const code = String(reason ?? '')
  if (code.startsWith('DUE_COMPONENT_UNRESOLVED:')) {
    const component = code.split(':')[1]
    return { code, title: `Complete ${componentName(component)}`, message: `${componentName(component)} needs more information in Expected Pay.`, actionStep: 'allowances' }
  }
  if (code.startsWith('DUE_EVENT_UNRESOLVED:')) {
    return { code, title: 'Review a career change', message: 'A recorded pay event could not be applied, so later pay remains provisional.', actionStep: 'events' }
  }
  if (code.includes('DNI') && (code.includes('UNRESOLVED') || code.includes('NOT_IMPLEMENTED'))) {
    return { code, title: 'Confirm the next increment date', message: 'The next increment date after this change needs review before later increments can be applied.', actionStep: 'events' }
  }
  if (code.includes('NOT_IMPLEMENTED')) {
    return { code, title: 'This rule needs review', message: fallbackMessage || 'PayCheck does not yet have enough verified rule coverage to finalize this part automatically.', actionStep: 'history' }
  }
  const known = REASON_GUIDANCE[code]
  if (known) return { code, title: known[0], message: known[1], actionStep: known[2] }
  return {
    code,
    title: 'Review the information for this calculation',
    message: fallbackMessage || 'Some information could not be applied automatically. Review the relevant pay or service details.',
    actionStep: 'history',
  }
}

export function explainDueMonth(month) {
  if (month?.unresolvedEventIds?.length) return explainCalculationReason(`DUE_EVENT_UNRESOLVED:${month.unresolvedEventIds[0]}`)
  if (month?.unresolvedComponents?.length) return explainCalculationReason(`DUE_COMPONENT_UNRESOLVED:${month.unresolvedComponents[0]}`)
  return explainCalculationReason(month?.reason)
}

export function technicalLabel(value) {
  return humanizeCode(value)
}
