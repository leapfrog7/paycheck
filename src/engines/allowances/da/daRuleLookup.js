import { HISTORICAL_DA_RATES } from '../../../data/allowances/da/historicalDaRates'
import { isValidCalendarDate } from '../../../domain/allowances/allowanceResult'

function unresolved(reason, errors, input) {
  return { success: false, status: 'UNRESOLVED', reason, errors, input: { ...input } }
}

export function getApplicableDaRule({ date, cpc, rules = HISTORICAL_DA_RATES } = {}) {
  if (!isValidCalendarDate(date)) return unresolved('INVALID_DATE', ['A valid calendar date is required.'], { date, cpc })
  const cpcNumber = Number(cpc)
  if (![5, 6, 7].includes(cpcNumber)) return unresolved('INVALID_CPC', ['A supported CPC-specific DA series is required.'], { date, cpc })

  const candidates = rules.filter((rule) => (
    rule.status === 'VERIFIED'
    && Number(rule.cpc) === cpcNumber
    && rule.effectiveFrom <= date
    && (!rule.effectiveTo || rule.effectiveTo >= date)
  ))
  if (candidates.length === 0) {
    return unresolved('NO_VERIFIED_DA_RATE', [`No verified ${cpcNumber}th CPC DA rate covers ${date}.`], { date, cpc: cpcNumber })
  }
  if (candidates.length > 1) {
    return unresolved('OVERLAPPING_DA_RULES', [`More than one verified ${cpcNumber}th CPC DA rule covers ${date}.`], { date, cpc: cpcNumber })
  }
  return { success: true, status: 'RESOLVED', rule: structuredClone(candidates[0]) }
}

export function getDaRate(input = {}) {
  const result = getApplicableDaRule(input)
  return result.success ? { ...result, rate: result.rule.rate } : result
}
