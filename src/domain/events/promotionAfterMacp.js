import { EVENT_TYPES } from './eventTypes'

export const PROMOTION_AFTER_MACP_RULE_ID = 'PROMOTION_AFTER_MACP_SAME_FINANCIAL_STRUCTURE'

function getEffectiveDate(event = {}) {
  return event.effectiveDate ?? event.eventDate ?? event.effectiveFrom ?? ''
}

function getTargetStructure(cpc, event = {}) {
  if (Number(cpc) === 6) {
    return {
      cpc: 6,
      payBand: event.targetPayBand,
      gradePay: Number(event.targetGradePay),
    }
  }

  if (Number(cpc) === 7) {
    return { cpc: 7, level: String(event.targetLevel ?? '') }
  }

  return null
}

export function getFinancialStructure(payState = {}) {
  if (Number(payState.cpc) === 6) {
    return {
      cpc: 6,
      payBand: payState.payBand,
      gradePay: Number(payState.gradePay),
    }
  }

  if (Number(payState.cpc) === 7) {
    return { cpc: 7, level: String(payState.level ?? '') }
  }

  return null
}

export function financialStructuresEqual(first, second) {
  if (!first || !second || Number(first.cpc) !== Number(second.cpc)) return false
  if (Number(first.cpc) === 6) {
    return first.payBand === second.payBand && Number(first.gradePay) === Number(second.gradePay)
  }
  if (Number(first.cpc) === 7) return String(first.level) === String(second.level)
  return false
}

function getMacpTransformation(entry = {}) {
  const event = entry.event ?? entry.sourceEvent ?? {}
  const transformation = entry.result ?? entry.transformation ?? entry

  if (event.type !== EVENT_TYPES.MACP && transformation.eventType !== EVENT_TYPES.MACP) return null
  if (!transformation.success || !transformation.after) return null

  return { event, transformation }
}

export function findPriorMacpForStructure(history = [], structure, beforeDate) {
  return history
    .map(getMacpTransformation)
    .filter(Boolean)
    .filter(({ event, transformation }) => {
      const eventDate = getEffectiveDate(event) || transformation.after.effectiveFrom || ''
      return eventDate && eventDate < beforeDate
        && financialStructuresEqual(getFinancialStructure(transformation.after), structure)
    })
    .sort((first, second) => {
      const firstDate = getEffectiveDate(first.event) || first.transformation.after.effectiveFrom
      const secondDate = getEffectiveDate(second.event) || second.transformation.after.effectiveFrom
      return secondDate.localeCompare(firstDate)
    })[0] ?? null
}

export function resolvePromotionAfterMacp(currentPayState = {}, promotionEvent = {}, history = []) {
  if (promotionEvent.type !== EVENT_TYPES.REGULAR_PROMOTION) return { matched: false }

  const effectiveDate = getEffectiveDate(promotionEvent)
  const currentStructure = getFinancialStructure(currentPayState)
  const targetStructure = getTargetStructure(currentPayState.cpc, promotionEvent)

  if (!effectiveDate || !financialStructuresEqual(currentStructure, targetStructure)) {
    return { matched: false }
  }

  const matched = findPriorMacpForStructure(history, targetStructure, effectiveDate)
  if (matched) {
    return {
      matched: true,
      interactionRuleId: PROMOTION_AFTER_MACP_RULE_ID,
      matchedMacpEventId: matched.event.id ?? matched.transformation.eventId ?? null,
      matchedMacpNumber: matched.event.macpNumber ?? matched.transformation.macpNumber ?? null,
      currentFinancialStructure: currentStructure,
      promotionTargetStructure: targetStructure,
      careerEffect: 'PROMOTED',
      payFixationEffect: 'NO_FRESH_FIXATION',
      reason: 'TARGET_STRUCTURE_ALREADY_GRANTED_THROUGH_MACP',
    }
  }

  const hasPriorCrossCpcMacp = history
    .map(getMacpTransformation)
    .filter(Boolean)
    .some(({ event, transformation }) => {
      const eventDate = getEffectiveDate(event) || transformation.after.effectiveFrom || ''
      return eventDate && eventDate < effectiveDate
        && Number(transformation.after.cpc) !== Number(currentPayState.cpc)
    })

  if (hasPriorCrossCpcMacp) {
    return {
      matched: false,
      unresolved: true,
      reason: 'CROSS_CPC_MACP_EQUIVALENCE_NOT_IMPLEMENTED',
    }
  }

  return { matched: false }
}

export function createNoFreshFixationPromotionRecord(payState, event, interaction) {
  const effectiveDate = getEffectiveDate(event)
  const before = structuredClone(payState)
  const after = {
    ...structuredClone(payState),
    effectiveFrom: effectiveDate,
  }

  return {
    success: true,
    status: 'CALCULATED',
    eventId: event.id ?? event.eventId ?? null,
    eventType: EVENT_TYPES.REGULAR_PROMOTION,
    effectiveDate,
    ruleId: PROMOTION_AFTER_MACP_RULE_ID,
    interactionRuleId: PROMOTION_AFTER_MACP_RULE_ID,
    before,
    matchedMacpEventId: interaction.matchedMacpEventId,
    matchedMacpNumber: interaction.matchedMacpNumber,
    currentFinancialStructure: interaction.currentFinancialStructure,
    promotionTargetStructure: interaction.promotionTargetStructure,
    careerEffect: 'PROMOTED',
    payFixationEffect: 'NO_FRESH_FIXATION',
    reason: interaction.reason,
    dniEffect: 'NONE',
    after,
    steps: [
      {
        operation: 'MATCH_PRIOR_MACP_FINANCIAL_STRUCTURE',
        matchedMacpEventId: interaction.matchedMacpEventId,
        matchedMacpNumber: interaction.matchedMacpNumber,
        result: 'TARGET_STRUCTURE_ALREADY_GRANTED_THROUGH_MACP',
      },
      {
        operation: 'RECORD_CAREER_PROMOTION_WITHOUT_FRESH_PAY_FIXATION',
        careerEffect: 'PROMOTED',
        payFixationEffect: 'NO_FRESH_FIXATION',
        result: before.basicPay,
      },
      { operation: 'PRESERVE_DNI', result: before.dni },
    ],
    explanation: `Regular promotion was granted to a post carrying the same financial structure already obtained through MACP${interaction.matchedMacpNumber ? ` ${interaction.matchedMacpNumber}` : ''}. No further pay fixation is admissible; the existing pay has therefore been retained.`,
  }
}
