import { EVENT_TYPES } from './eventTypes'

function reachedStructure(after = {}) {
  if (Number(after.cpc) === 5) return { cpc: 5, payScaleId: after.payScaleId }
  if (Number(after.cpc) === 6) return { cpc: 6, payBand: after.payBand, gradePay: Number(after.gradePay) }
  if (Number(after.cpc) === 7) return { cpc: 7, level: String(after.level) }
  return null
}

export function deriveFinancialProgressions(history = []) {
  return history.flatMap((entry) => {
    const event = entry.event ?? entry
    const result = entry.result ?? entry.transformation
    if (![EVENT_TYPES.ACP, EVENT_TYPES.MACP].includes(event.type) || !result?.success || !result.after) return []
    return [{
      eventId: event.id ?? event.eventId ?? result.eventId ?? null,
      eventType: event.type,
      scheme: result.scheme ?? result.schemeId ?? (event.type === EVENT_TYPES.ACP ? 'ACP_1999' : 'MACPS'),
      number: Number(event.acpNumber ?? event.macpNumber ?? result.acpNumber ?? result.macpNumber),
      effectiveDate: event.effectiveDate ?? event.eventDate ?? result.after.effectiveFrom,
      reachedStructure: reachedStructure(result.after),
    }]
  })
}
