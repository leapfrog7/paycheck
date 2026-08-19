import { get5CpcTo6CpcMapping } from '../../data/pay/5cpcTo6cpcMapping'
import { getFifthCpcScale } from '../../data/pay/5cpcPayScales'
import { validate5CpcPayState } from '../../domain/pay/payStateValidation'
import {
  FIFTH_TO_SIXTH_CPC_RULE7_ROUNDING_ID,
  roundUpRule7FitmentToNext10,
} from './5cpcTo6cpcFitmentRounding'
import { resolveDateOfNextIncrement } from './dni/resolveDni'
import { validateCpcSwitchOption } from '../../domain/events/cpcSwitchOption'

export const FIFTH_TO_SIXTH_CPC_FITMENT_FACTOR = 1.86
export const FIFTH_TO_SIXTH_CPC_RULE_ID = '5CPC_TO_6CPC_RULE7'
export const FIFTH_TO_SIXTH_CPC_ORDINARY_EFFECTIVE_DATE = '2006-01-01'

function unresolved(reason, errors, before, extra = {}) {
  return {
    success: false,
    status: 'UNRESOLVED',
    ruleId: FIFTH_TO_SIXTH_CPC_RULE_ID,
    reason,
    errors,
    before: { ...before },
    ...extra,
  }
}

function structuralVariationRequested(event) {
  return Boolean(
    event.upgradedScale
    || event.mergedScale
    || event.postSpecificRevisedGradePay
    || event.replacementScaleDifferent
    || event.structuralUpgradation
    || ['UPGRADED_SCALE', 'MERGED_SCALE', 'POST_SPECIFIC_REPLACEMENT'].includes(event.transitionTreatment),
  )
}

export function calculate5CpcTo6CpcTransition(payState = {}, event = {}, context = {}) {
  const validation = validate5CpcPayState(payState)
  if (!validation.valid) return unresolved('INVALID_SOURCE_PAY_STATE', validation.errors, payState)
  const before = validation.normalizedState

  if (Number(event.fromCpc) !== 5 || Number(event.toCpc) !== 6) {
    return unresolved('INVALID_CPC_TRANSITION', [{ code: 'INVALID_CPC_TRANSITION', message: 'The transition event must explicitly identify 5th CPC to 6th CPC.' }], before)
  }
  if (structuralVariationRequested(event)) {
    return unresolved('STRUCTURAL_UPGRADATION_RULE_NOT_IMPLEMENTED', [{ code: 'STRUCTURAL_UPGRADATION_RULE_NOT_IMPLEMENTED', message: 'Upgraded, merged, or post-specific replacement structures are not implemented.' }], before)
  }

  const optionDecision = validateCpcSwitchOption(event, context)
  const effectiveDate = optionDecision.employeeSwitchDate
  if (!optionDecision.valid) return unresolved(optionDecision.reason, optionDecision.errors, before, { effectiveDate, optionDecision })

  const mapping = get5CpcTo6CpcMapping(before.payScaleId)
  if (!mapping) {
    return unresolved('UNMAPPED_5CPC_PAY_SCALE', [{ code: 'UNMAPPED_5CPC_PAY_SCALE', message: 'The source scale has no controlled ordinary 6th CPC mapping.' }], before)
  }
  if (mapping.status !== 'SUPPORTED') {
    return unresolved(mapping.reason, [{ code: mapping.reason, message: `${mapping.sourceScaleCode} maps to ${mapping.targetStructure}, which is not implemented in the current 6th CPC Pay State.` }], before, { mapping })
  }

  const rawFitment = Number((before.basicPay * FIFTH_TO_SIXTH_CPC_FITMENT_FACTOR).toFixed(2))
  const roundedFitment = roundUpRule7FitmentToNext10(rawFitment)
  const minimumApplied = roundedFitment < mapping.payBandMinimum
  const payInBand = Math.max(roundedFitment, mapping.payBandMinimum)
  const basicPay = payInBand + mapping.gradePay
  const sourceScale = getFifthCpcScale(before.payScaleId)
  const dniResolution = resolveDateOfNextIncrement({ payState: { cpc: 6 }, triggeringEvent: { ...event, type: optionDecision.delayed ? 'DELAYED_CPC_SWITCH' : 'CPC_TRANSITION', effectiveDate }, eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context })
  const after = {
    cpc: 6,
    effectiveFrom: effectiveDate,
    payBand: mapping.payBand,
    payInBand,
    gradePay: mapping.gradePay,
    basicPay,
    dni: null,
    dniResolution,
    dniDecision: dniResolution,
  }

  return {
    success: true,
    status: 'CALCULATED',
    ruleId: FIFTH_TO_SIXTH_CPC_RULE_ID,
    effectiveDate,
    statutoryEffectiveDate: optionDecision.statutoryEffectiveDate,
    employeeSwitchDate: effectiveDate,
    switchOption: optionDecision,
    before,
    sourcePayScale: { id: sourceScale.id, standardScaleCode: sourceScale.standardScaleCode, label: sourceScale.label },
    sourceStageIndex: before.stageIndex,
    existing5CpcBasicPay: before.basicPay,
    fitmentFactor: FIFTH_TO_SIXTH_CPC_FITMENT_FACTOR,
    rawFitment,
    roundingRuleId: FIFTH_TO_SIXTH_CPC_RULE7_ROUNDING_ID,
    roundedFitment,
    mappedPayBand: mapping.payBand,
    mappedPayBandMinimum: mapping.payBandMinimum,
    mappedPayBandMaximum: mapping.payBandMaximum,
    minimumApplied,
    payInBand,
    mappedGradePay: mapping.gradePay,
    resultingBasicPay: basicPay,
    bunchingApplied: false,
    bunchingStatus: 'NOT_EVALUATED',
    dniStatus: 'UNRESOLVED',
    dniReason: dniResolution.reason,
    dniDecision: dniResolution,
    after,
    steps: [
      { operation: 'APPLY_RULE7_FITMENT_FACTOR', from: before.basicPay, factor: FIFTH_TO_SIXTH_CPC_FITMENT_FACTOR, result: rawFitment },
      { operation: 'ROUND_UP_TO_NEXT_MULTIPLE_OF_10', from: rawFitment, result: roundedFitment, ruleId: FIFTH_TO_SIXTH_CPC_RULE7_ROUNDING_ID },
      { operation: 'APPLY_PAY_BAND_MINIMUM', calculated: roundedFitment, minimum: mapping.payBandMinimum, minimumApplied, result: payInBand },
      { operation: 'ADD_PRESCRIBED_GRADE_PAY', payInBand, gradePay: mapping.gradePay, result: basicPay },
      { operation: 'RETAIN_POST_TRANSITION_DNI_AS_UNRESOLVED', reason: dniResolution.reason },
    ],
    explanation: 'Existing 5th CPC Basic Pay was multiplied by 1.86 and rounded upward to the next multiple of ₹10. Pay in the Pay Band was then determined subject to the minimum of the corresponding Pay Band, and the prescribed Grade Pay was added.',
  }
}
