import { parseCalendarDate } from '../dates/calendarDate'

export const CAREER_PROGRESSION_SCHEMES = Object.freeze({ ACP: 'ACP_1999', MACP: 'MACPS' })
export const MACPS_EFFECTIVE_FROM = '2008-09-01'
export const ACP_NORMAL_EFFECTIVE_TO = '2008-08-31'

export const MACPS_METADATA = Object.freeze({
  scheme: CAREER_PROGRESSION_SCHEMES.MACP,
  effectiveFrom: MACPS_EFFECTIVE_FROM,
  progressionFrameworkYears: Object.freeze([10, 20, 30]),
  automaticEligibilityStatus: 'NOT_IMPLEMENTED',
})

export function getCareerProgressionSchemeForDate(date) {
  if (!parseCalendarDate(date)) return { status: 'UNRESOLVED', scheme: null, reason: 'INVALID_EFFECTIVE_DATE' }
  return date < MACPS_EFFECTIVE_FROM
    ? { status: 'RESOLVED', scheme: CAREER_PROGRESSION_SCHEMES.ACP, effectiveTo: ACP_NORMAL_EFFECTIVE_TO, basis: 'BENEFIT_EFFECTIVE_DATE' }
    : { status: 'RESOLVED', scheme: CAREER_PROGRESSION_SCHEMES.MACP, effectiveFrom: MACPS_EFFECTIVE_FROM, basis: 'BENEFIT_EFFECTIVE_DATE' }
}
