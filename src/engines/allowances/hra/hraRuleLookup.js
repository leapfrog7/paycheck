import { HRA_SCHEMES } from '../../../data/allowances/hra/hraRuleSchemes'
import { isValidCalendarDate } from '../../../domain/allowances/allowanceResult'

function unresolved(reason, errors, input) {
  return { success: false, status: 'UNRESOLVED', reason, errors, input: { ...input } }
}

export function getApplicableHraScheme({ date, cpc, schemes = HRA_SCHEMES } = {}) {
  if (!isValidCalendarDate(date)) return unresolved('INVALID_DATE', ['A valid HRA applicability date is required.'], { date, cpc })
  const cpcNumber = Number(cpc)
  if (![5, 6, 7].includes(cpcNumber)) return unresolved('INVALID_CPC', ['A supported CPC-specific HRA scheme is required.'], { date, cpc })
  if (cpcNumber === 7 && date < '2017-07-01') {
    return unresolved('7CPC_PRE_JULY_2017_HRA_RULE_NOT_IMPLEMENTED', ['The continuation HRA rule before 01 July 2017 is not implemented.'], { date, cpc: cpcNumber })
  }
  const candidates = schemes.filter((scheme) => scheme.status === 'VERIFIED'
    && Number(scheme.cpc) === cpcNumber
    && scheme.effectiveFrom <= date
    && (!scheme.effectiveTo || scheme.effectiveTo >= date))
  if (candidates.length === 0) return unresolved('NO_VERIFIED_HRA_SCHEME', [`No verified ${cpcNumber}th CPC HRA scheme covers ${date}.`], { date, cpc: cpcNumber })
  if (candidates.length > 1) return unresolved('OVERLAPPING_HRA_SCHEMES', ['More than one verified HRA scheme covers the requested date and CPC.'], { date, cpc: cpcNumber })
  return { success: true, status: 'RESOLVED', scheme: structuredClone(candidates[0]) }
}

export function resolveHraRate({ scheme, hraCityClass, daRate = null } = {}) {
  if (!scheme?.classes?.includes(hraCityClass)) return unresolved('INVALID_HRA_CITY_CLASS', ['The HRA city class is not valid for the applicable scheme.'], { hraCityClass, schemeId: scheme?.id })
  if (Number(scheme.cpc) !== 7) return { success: true, status: 'RESOLVED', rate: scheme.rateRules[0].rates[hraCityClass], threshold: null }
  if (!Number.isFinite(Number(daRate))) return unresolved('APPLICABLE_DA_RATE_UNRESOLVED', ['A resolved central DA rate is required for 7th CPC HRA.'], { hraCityClass, schemeId: scheme.id })
  const thresholdRule = [...scheme.rateRules].reverse().find(({ daThreshold }) => Number(daRate) >= daThreshold)
  return { success: true, status: 'RESOLVED', rate: thresholdRule.rates[hraCityClass], threshold: thresholdRule.daThreshold }
}
