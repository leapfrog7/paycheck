import { EVENT_TYPES } from '../../domain/events/eventTypes'
import { calculate6CpcTo7CpcTransition } from './6cpcTo7cpcTransition'
import { calculate5CpcTo6CpcTransition } from './5cpcTo6cpcTransition'
import { calculate7CpcAnnualIncrement } from './7cpc/annualIncrement'
import { calculate6CpcAnnualIncrement } from './6cpc/annualIncrement'
import { calculate5CpcAnnualIncrement } from './5cpc/annualIncrement'
import { calculate5CpcRegularPromotion } from './5cpc/regularPromotion'
import { calculate5CpcAcp } from './5cpc/acp'
import { calculate7CpcRegularPromotion } from './7cpc/regularPromotion'
import { calculate6CpcRegularPromotion } from './6cpc/regularPromotion'
import { calculate6CpcMacpFixation } from './6cpc/macpFixation'
import { calculate7CpcMacpFixation } from './7cpc/macpFixation'
import {
  createNoFreshFixationPromotionRecord,
  resolvePromotionAfterMacp,
} from '../../domain/events/promotionAfterMacp'
import { resolveDateOfNextIncrement } from './dni/resolveDni'
import { applyDniAdjustment, applyPayRefixation } from '../../domain/events/payCorrection'
import { validate6CpcPayState } from '../../domain/pay/payStateValidation'

export function applyPayEvent(payState = {}, event = {}, context = {}) {
  if (context.sameDateCorrectionOrderingUnresolved) {
    return {
      success: false, status: 'UNRESOLVED', ruleId: 'SAME_DATE_CORRECTION_ORDERING',
      reason: 'SAME_DATE_CORRECTION_ORDER_UNRESOLVED',
      errors: ['A correction and another financial event share this date without an explicit BEFORE_EVENT or AFTER_EVENT relation.'],
      before: { ...payState },
    }
  }
  if ([EVENT_TYPES.PAY_REFIXATION, EVENT_TYPES.NOTIONAL_REFIXATION].includes(event.type)) return applyPayRefixation(payState, event)
  if (event.type === EVENT_TYPES.DNI_ADJUSTMENT) return applyDniAdjustment(payState, event)
  if (payState.structuralStatus === 'NON_STANDARD_CONFIRMED') {
    const safelyExecutableSixthCpcState = Number(payState.cpc) === 6 && validate6CpcPayState(payState).valid
    if (!safelyExecutableSixthCpcState) {
      return {
        success: false, status: 'UNRESOLVED', ruleId: event.ruleId ?? event.type,
        reason: 'NON_STANDARD_PAY_STATE_REQUIRES_REFIXATION',
        errors: ['This rule requires a standard CPC structure. Insert a later structured PAY_REFIXATION before applying it.'],
        before: { ...payState },
      }
    }
  }
  if (event.type === EVENT_TYPES.ANNUAL_INCREMENT && context.consumedAnnualIncrementDates?.has(event.effectiveDate ?? event.eventDate)) {
    return {
      success: false, status: 'UNRESOLVED', ruleId: 'LOWER_POST_DNI_INCREMENT_CONSUMPTION',
      reason: 'ANNUAL_INCREMENT_ALREADY_CONSUMED_BY_DNI_FIXATION',
      errors: ['The lower-post annual increment on this date was already consumed atomically by promotion/MACP fixation.'],
      before: { ...payState },
    }
  }
  if (context.sameDateDniOrderingUnresolved) {
    const dniDecision = {
      cpc: Number(payState.cpc), trigger: event.type, ruleId: 'SAME_DATE_DNI_EVENT_ORDERING', candidateDni: null,
      qualifyingService: null, status: 'UNRESOLVED', date: null, dni: null,
      reason: 'SAME_DATE_DNI_EVENT_ORDERING_NOT_IMPLEMENTED',
      explanation: 'An annual increment and promotion, ACP, or MACP occur on the same date; no documented ordering rule is implemented.',
    }
    return { success: false, status: 'UNRESOLVED', ruleId: dniDecision.ruleId, reason: dniDecision.reason, errors: [dniDecision.explanation], before: { ...payState }, dniDecision }
  }
  if (event.type === EVENT_TYPES.CPC_TRANSITION) {
    if (Number(event.fromCpc) === 5 && Number(event.toCpc) === 6) {
      return calculate5CpcTo6CpcTransition(payState, event, context)
    }
    if (Number(event.fromCpc) !== 6 || Number(event.toCpc) !== 7) {
      return {
        success: false,
        status: 'UNRESOLVED',
        ruleId: event.ruleId || 'CPC_TRANSITION',
        reason: 'UNSUPPORTED_CPC_TRANSITION',
        errors: ['Only the 6th CPC to 7th CPC transition is currently supported.'],
        before: { ...payState },
      }
    }

    return calculate6CpcTo7CpcTransition(payState, event, context)
  }

  if (event.type === EVENT_TYPES.ANNUAL_INCREMENT) {
    if (Number(payState.cpc) === 5) {
      return calculate5CpcAnnualIncrement(payState, event, context)
    }
    if (Number(payState.cpc) === 6) {
      return calculate6CpcAnnualIncrement(payState, event, context)
    }
    return calculate7CpcAnnualIncrement(payState, event, context)
  }

  if (event.type === EVENT_TYPES.ACP) {
    if (Number(payState.cpc) === 5) return calculate5CpcAcp(payState, event, context)
    return { success: false, status: 'UNRESOLVED', ruleId: '5CPC_ACP_SCHEME_1999_FIXATION', reason: 'UNSUPPORTED_CPC', errors: ['ACP fixation is implemented only for a valid 5th CPC Pay State.'], before: { ...payState } }
  }

  if (event.type === EVENT_TYPES.REGULAR_PROMOTION) {
    if (Number(payState.cpc) === 5) {
      return calculate5CpcRegularPromotion(payState, event, context)
    }
    const interaction = resolvePromotionAfterMacp(payState, event, context.history ?? [])
    if (interaction.matched) {
      const result = createNoFreshFixationPromotionRecord(payState, event, interaction)
      const dniDecision = resolveDateOfNextIncrement({ payState, triggeringEvent: { ...event, payFixationEffect: 'NO_FRESH_FIXATION' }, eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context })
      result.dniDecision = dniDecision
      result.after.dniDecision = dniDecision
      return result
    }
    if (interaction.unresolved) {
      return {
        success: false,
        status: 'UNRESOLVED',
        ruleId: 'PROMOTION_AFTER_MACP_SAME_FINANCIAL_STRUCTURE',
        reason: interaction.reason,
        errors: ['Cross-CPC MACP equivalence cannot be inferred without explicit provenance.'],
        before: { ...payState },
      }
    }

    if (Number(payState.cpc) === 6) {
      return calculate6CpcRegularPromotion(payState, event, context)
    }

    if (Number(payState.cpc) !== 7) {
      return {
        success: false,
        status: 'UNRESOLVED',
        ruleId: '7CPC_PROMOTION_RULE13',
        reason: 'INVALID_SOURCE_CPC',
        errors: ['Only a valid 7th CPC Pay State is supported for Rule 13 fixation.'],
        before: { ...payState },
      }
    }

    return calculate7CpcRegularPromotion(payState, event, context)
  }

  if (event.type === EVENT_TYPES.MACP) {
    if (Number(payState.cpc) === 6) {
      return calculate6CpcMacpFixation(payState, event, context)
    }

    if (Number(payState.cpc) === 7) {
      return calculate7CpcMacpFixation(payState, event, context)
    }

    return {
      success: false,
      status: 'UNRESOLVED',
      ruleId: '7CPC_MACP_FIXATION',
      reason: 'UNSUPPORTED_CPC',
      errors: ['Only 6th and 7th CPC MACP fixation are implemented.'],
      before: { ...payState },
    }
  }

  return null
}
