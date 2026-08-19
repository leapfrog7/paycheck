export const ACP_SCHEME_ID = 'ACP_1999'
export const ACP_ELIGIBILITY_STATUS = Object.freeze({
  CONFIRMED_EXTERNALLY: 'CONFIRMED_EXTERNALLY',
  UNRESOLVED: 'UNRESOLVED',
})
export const ACP_SCHEME_PERIOD_STATUS = 'VERIFIED_THROUGH_2008_08_31'
export const ACP_SCHEME_METADATA = Object.freeze({
  scheme: ACP_SCHEME_ID,
  firstFinancialUpgradationFrameworkYears: 12,
  secondFinancialUpgradationFrameworkYears: 24,
  eligibilityCalculationStatus: 'NOT_IMPLEMENTED',
  hierarchyResolutionStatus: 'NOT_IMPLEMENTED',
  normalEffectiveTo: '2008-08-31',
  supersededBy: 'MACPS',
  periodStatus: ACP_SCHEME_PERIOD_STATUS,
})

export function createAcpEligibilityDecision({ acpNumber, status, schemeApplicabilityStatus, reason = null, source = null } = {}) {
  return {
    scheme: ACP_SCHEME_ID,
    requestedBenefit: Number(acpNumber),
    status,
    schemeApplicabilityStatus,
    reason,
    source,
    automaticServiceEligibilityEvaluated: false,
  }
}

export function isExternallyConfirmedAcpDecision(decision, acpNumber) {
  return decision?.scheme === ACP_SCHEME_ID
    && Number(decision.requestedBenefit) === Number(acpNumber)
    && decision.status === ACP_ELIGIBILITY_STATUS.CONFIRMED_EXTERNALLY
    && decision.schemeApplicabilityStatus === ACP_ELIGIBILITY_STATUS.CONFIRMED_EXTERNALLY
}
