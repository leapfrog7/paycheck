import { readDniDecision } from '../../../domain/pay/dni/dniDecision'
import { createMultiStagePayTransformation } from '../../../domain/pay/multiStageTransformation'
import { roundSixthCpcIncrement } from './incrementRounding'
import { resolveHigherSixthCpcTarget, targetBandRequiresUndefinedAdjustment } from './fixationFromEventDate'
import { resolveDateOfNextIncrement } from '../dni/resolveDni'

function unresolved(reason, message, before, extra = {}) {
  return { success: false, status: 'UNRESOLVED', reason, errors: [message], before: { ...before }, ...extra }
}

export function calculate6CpcFixationFromLowerPostDni({ payState, event, context = {}, ruleId, semantics }) {
  const lowerDniDecision = readDniDecision(payState)
  if (!lowerDniDecision || lowerDniDecision.status !== 'RESOLVED') return unresolved('LOWER_POST_DNI_NOT_RESOLVED', 'A resolved lower-post DNI is required.', payState)
  const lowerPostDni = lowerDniDecision.date
  const eventDate = event.effectiveDate ?? event.eventDate ?? ''
  if (eventDate >= lowerPostDni) return unresolved('EVENT_DATE_NOT_BEFORE_LOWER_POST_DNI', 'The promotion or MACP date must be strictly before the resolved lower-post DNI.', payState, { lowerPostDni })

  const target = resolveHigherSixthCpcTarget(payState, event.targetPayBand, event.targetGradePay)
  if (!target.valid) return unresolved(target.reason, 'A valid higher target Pay Band and Grade Pay are required.', payState)
  const { targetPayBand, targetGradePay } = target
  if (targetPayBand.code !== payState.payBand) return unresolved('6CPC_INTERIM_CROSS_PAY_BAND_RULE_NOT_IMPLEMENTED', 'Interim treatment across Pay Bands is not implemented because unchanged lower Pay in Pay Band cannot be forced into another band.', payState)

  const interimBasicPay = payState.payInBand + targetGradePay
  const interimPayState = {
    cpc: 6, effectiveFrom: eventDate, payBand: targetPayBand.code,
    payInBand: payState.payInBand, gradePay: targetGradePay, basicPay: interimBasicPay,
    dni: lowerPostDni, dniDecision: lowerDniDecision,
    ...(semantics.reachedBy ? { reachedBy: semantics.reachedBy } : {}),
    ...(semantics.macpNumber != null ? { macpNumber: semantics.macpNumber } : {}),
  }

  const annualRawIncrement = Number((payState.basicPay * 0.03).toFixed(2))
  const annualIncrement = roundSixthCpcIncrement(annualRawIncrement)
  const lowerPayInBandAfterAnnual = payState.payInBand + annualIncrement
  const basicAfterAnnual = lowerPayInBandAfterAnnual + payState.gradePay
  const promotionRawIncrement = Number((basicAfterAnnual * 0.03).toFixed(2))
  const promotionIncrement = roundSixthCpcIncrement(promotionRawIncrement)
  const finalPayInBand = lowerPayInBandAfterAnnual + promotionIncrement
  if (targetBandRequiresUndefinedAdjustment(payState, targetPayBand, finalPayInBand)) return unresolved('TARGET_PAY_BAND_ADJUSTMENT_RULE_NOT_IMPLEMENTED', 'Final Pay in Pay Band requires an unimplemented target-band adjustment.', payState)
  const finalBasicPay = finalPayInBand + targetGradePay
  const dniDecision = resolveDateOfNextIncrement({
    payState: { ...payState, effectiveFrom: lowerPostDni },
    triggeringEvent: { ...event, type: 'FIXATION_FROM_LOWER_POST_DNI', fixationDate: lowerPostDni },
    eventHistory: context.history ?? [], serviceStatusHistory: context.serviceStatusHistory ?? [], context,
  })
  const finalPayState = {
    cpc: 6, effectiveFrom: lowerPostDni, payBand: targetPayBand.code,
    payInBand: finalPayInBand, gradePay: targetGradePay, basicPay: finalBasicPay,
    dni: dniDecision.status === 'RESOLVED' ? dniDecision.date : { status: 'UNRESOLVED', reason: dniDecision.reason },
    dniDecision,
    ...(semantics.reachedBy ? { reachedBy: semantics.reachedBy } : {}),
    ...(semantics.macpNumber != null ? { macpNumber: semantics.macpNumber } : {}),
  }
  const result = createMultiStagePayTransformation({
    event, ruleId, before: payState, lowerPostDni, interimPayState,
    interimSteps: [{ operation: 'RETAIN_LOWER_PAY_IN_BAND', result: payState.payInBand }, { operation: 'GRANT_TARGET_GRADE_PAY_INTERIM', result: targetGradePay }, { operation: 'CALCULATE_INTERIM_BASIC_PAY', result: interimBasicPay }],
    finalPayState,
    finalSteps: [
      { operation: 'CALCULATE_LOWER_POST_ANNUAL_INCREMENT', base: payState.basicPay, raw: annualRawIncrement, result: annualIncrement },
      { operation: 'ADD_ANNUAL_INCREMENT_TO_LOWER_PAY_IN_BAND', result: lowerPayInBandAfterAnnual },
      { operation: 'CALCULATE_PROMOTIONAL_INCREMENT_SEQUENTIALLY', base: basicAfterAnnual, raw: promotionRawIncrement, result: promotionIncrement },
      { operation: 'ADD_PROMOTIONAL_INCREMENT_TO_PAY_IN_BAND', result: finalPayInBand },
      { operation: 'SUBSTITUTE_TARGET_GRADE_PAY', result: targetGradePay },
      { operation: 'CALCULATE_FINAL_BASIC_PAY', result: finalBasicPay },
    ],
    dniDecision, semantics,
  })
  return { ...result, annualIncrement, lowerPayInBandAfterAnnual, basicAfterAnnual, promotionIncrement, finalPayInBand, finalBasicPay }
}
