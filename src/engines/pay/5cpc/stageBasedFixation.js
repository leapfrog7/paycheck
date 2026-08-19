import { getFifthCpcScale, getFifthCpcStages, getNextFifthCpcStage } from '../../../data/pay/5cpcPayScales'

export function selectFifthCpcTargetStage(targetPayScaleId, referenceAmount) {
  const stage = getFifthCpcStages(targetPayScaleId).find(({ value }) => value >= Number(referenceAmount)) ?? null
  if (!stage) return null
  return { method: stage.value === Number(referenceAmount) ? 'EXACT_STAGE' : 'NEXT_HIGHER_STAGE', stage }
}

export function calculateFifthCpcStageBasedFixation(before, targetPayScaleId, { sameScaleReason = 'SAME_SOURCE_AND_TARGET_PAY_SCALE', unavailableIncrementReason = 'LOWER_SCALE_PROMOTIONAL_INCREMENT_NOT_AVAILABLE' } = {}) {
  if (!targetPayScaleId) return { success: false, reason: 'MISSING_TARGET_PAY_SCALE' }
  const targetScale = getFifthCpcScale(targetPayScaleId)
  if (!targetScale) return { success: false, reason: 'INVALID_TARGET_PAY_SCALE' }
  if (targetScale.id === before.payScaleId) return { success: false, reason: sameScaleReason, targetScale }
  const lowerIncrementStage = getNextFifthCpcStage(before.payScaleId, before.stageIndex)
  if (!lowerIncrementStage) return { success: false, reason: unavailableIncrementReason, targetScale }
  if (lowerIncrementStage.requiresEfficiencyBarClearance) return { success: false, reason: 'EFFICIENCY_BAR_CLEARANCE_REQUIRED', targetScale, lowerIncrementStage }
  const targetLookup = selectFifthCpcTargetStage(targetScale.id, lowerIncrementStage.value)
  if (!targetLookup) return { success: false, reason: 'NO_SUITABLE_STAGE_IN_TARGET_SCALE', targetScale, lowerIncrementStage, referenceAmount: lowerIncrementStage.value }
  return { success: true, targetScale, lowerIncrementStage, targetLookup, referenceAmount: lowerIncrementStage.value }
}
