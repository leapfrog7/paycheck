export const DNI_STATUS = Object.freeze({ RESOLVED: 'RESOLVED', UNRESOLVED: 'UNRESOLVED' })

export function createResolvedDniDecision({ cpc, date, ruleId, trigger, qualifyingService, explanation }) {
  return {
    cpc: Number(cpc),
    trigger,
    ruleId,
    candidateDni: date,
    qualifyingService,
    status: DNI_STATUS.RESOLVED,
    date,
    dni: date,
    reason: null,
    explanation,
  }
}

export function createUnresolvedDniDecision({ cpc, ruleId, trigger, candidateDni = null, qualifyingService, reason, explanation }) {
  return {
    cpc: Number(cpc),
    trigger,
    ruleId,
    candidateDni,
    qualifyingService,
    status: DNI_STATUS.UNRESOLVED,
    date: null,
    dni: null,
    reason,
    explanation,
  }
}

export function readDniDecision(payState = {}) {
  const record = payState.dniDecision ?? payState.dniResolution
  if (record?.status === DNI_STATUS.RESOLVED && (record.date ?? record.dni)) {
    const date = record.date ?? record.dni
    return { ...record, date, dni: date, candidateDni: record.candidateDni ?? date }
  }
  if (record?.status === DNI_STATUS.UNRESOLVED) return { ...record, date: null, dni: null }
  if (typeof payState.dni === 'string' && payState.dni) {
    return createResolvedDniDecision({
      cpc: payState.cpc,
      date: payState.dni,
      ruleId: `${Number(payState.cpc)}CPC_CONFIRMED_DNI`,
      trigger: { type: 'CONFIRMED_PAY_STATE', eventId: null, effectiveDate: payState.effectiveFrom ?? null },
      qualifyingService: { status: 'SATISFIED', basis: 'CONFIRMED_PAY_STATE' },
      explanation: 'DNI was supplied as a confirmed Pay State fact.',
    })
  }
  if (payState.dni?.status === DNI_STATUS.RESOLVED && payState.dni.date) return { ...payState.dni, dni: payState.dni.date }
  if (payState.dni?.status === DNI_STATUS.UNRESOLVED) return { ...payState.dni, date: null, dni: null }
  return null
}
