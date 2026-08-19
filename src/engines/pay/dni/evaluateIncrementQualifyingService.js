const UNSUPPORTED_SERVICE_EVENT_TYPES = new Set([
  'EOL',
  'NON_QUALIFYING_SERVICE',
  'WITHHELD_INCREMENT',
  'PENALTY_REDUCTION',
  'BREAK_IN_SERVICE',
  'SUSPENSION',
])

function historyEvent(item = {}) {
  return item.event ?? item.sourceEvent ?? item
}

export function evaluateIncrementQualifyingService({
  fromDate,
  candidateDni,
  eventHistory = [],
  serviceStatusHistory = [],
  explicitlyEstablished = false,
  ordinaryContinuousService = false,
} = {}) {
  const adverseEvent = [...eventHistory.map(historyEvent), ...serviceStatusHistory]
    .find((event) => UNSUPPORTED_SERVICE_EVENT_TYPES.has(event?.type) || event?.nonQualifyingService || event?.withheldIncrement)
  if (adverseEvent) {
    return {
      status: 'UNRESOLVED',
      fromDate,
      candidateDni,
      reason: 'NON_QUALIFYING_SERVICE_RULE_NOT_IMPLEMENTED',
      affectedBy: adverseEvent.type ?? 'SERVICE_STATUS',
    }
  }
  if (explicitlyEstablished || ordinaryContinuousService) {
    return { status: 'SATISFIED', fromDate, candidateDni, basis: explicitlyEstablished ? 'EXPLICITLY_ESTABLISHED' : 'ORDINARY_CONTINUOUS_SERVICE' }
  }
  return {
    status: 'UNRESOLVED',
    fromDate,
    candidateDni,
    reason: 'INCREMENT_QUALIFYING_SERVICE_NOT_ESTABLISHED',
  }
}
