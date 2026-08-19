import { createAllowanceEligibilityState } from '../../../domain/allowances/eligibilityState'
import { createLocationState } from '../../../domain/allowances/locationState'
import { getApplicableHraScheme } from '../../../engines/allowances/hra/hraRuleLookup'

export function getAllowanceSetup(caseData = {}) {
  if (caseData.allowanceSetup) return caseData.allowanceSetup
  const eligibility = caseData.allowanceEligibilityHistory?.[0]?.allowances ?? {}
  const location = caseData.locationHistory?.[0] ?? {}
  const hra = eligibility.hra
  const transport = eligibility.transportAllowance
  return {
    hraStatus: hra?.conditions?.governmentAccommodation ? 'GOVERNMENT_ACCOMMODATION' : hra?.eligible === true ? 'ELIGIBLE' : hra?.eligible === false ? 'NOT_ELIGIBLE' : '',
    hraClass: location.hra?.class ?? '',
    transportStatus: transport?.conditions?.governmentTransportProvided ? 'GOVERNMENT_TRANSPORT' : transport?.eligible === true ? 'ELIGIBLE' : transport?.eligible === false ? 'NOT_ELIGIBLE' : '',
    transportCategory: location.transport?.category ?? '',
  }
}

export function buildAllowanceSetup(caseData, setup) {
  const enabled = caseData.applicableAllowances ?? {}
  const from = caseData.calculationStartDate
  const cpc = Number(String(caseData.payCommission).match(/\d+/)?.[0] ?? caseData.openingPayState?.cpc)
  const scheme = getApplicableHraScheme({ date: from, cpc })
  const needsEligibility = enabled.hra || enabled.transportAllowance
  const needsLocation = enabled.hra && setup.hraStatus === 'ELIGIBLE'
    || enabled.transportAllowance && setup.transportStatus === 'ELIGIBLE'

  return {
    allowanceSetup: setup,
    allowanceEligibilityHistory: needsEligibility ? [{
      id: `opening-eligibility-${from}`,
      ...createAllowanceEligibilityState({
        effectiveFrom: from,
        allowances: {
          hra: {
            eligible: setup.hraStatus ? setup.hraStatus === 'ELIGIBLE' : null,
            conditions: { governmentAccommodation: setup.hraStatus === 'GOVERNMENT_ACCOMMODATION' },
          },
          transportAllowance: {
            eligible: setup.transportStatus ? setup.transportStatus === 'ELIGIBLE' : null,
            conditions: { governmentTransportProvided: setup.transportStatus === 'GOVERNMENT_TRANSPORT' },
          },
        },
      }),
    }] : [],
    locationHistory: needsLocation ? [{
      id: `opening-location-${from}`,
      ...createLocationState({
        effectiveFrom: from,
        hra: { scheme: scheme.success ? scheme.scheme.id : '', class: setup.hraClass },
        transport: { category: setup.transportCategory },
      }),
    }] : [],
  }
}

export function validateAllowanceSetup(caseData, setup) {
  const enabled = caseData.applicableAllowances ?? {}
  const missing = []
  if (enabled.hra && !setup.hraStatus) missing.push('Confirm whether HRA is payable.')
  if (enabled.hra && setup.hraStatus === 'ELIGIBLE' && !setup.hraClass) missing.push('Select the HRA city class.')
  if (enabled.transportAllowance && !setup.transportStatus) missing.push('Confirm whether Transport Allowance is payable.')
  if (enabled.transportAllowance && setup.transportStatus === 'ELIGIBLE' && !setup.transportCategory) missing.push('Select the Transport Allowance city category.')
  return missing
}
