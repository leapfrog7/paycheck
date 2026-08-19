import { getSixthCpcPayBand } from '../../../data/pay/6cpcPayBands'
import { normalize6CpcPayBand } from '../../../domain/pay/6cpcTo7cpcMapping'
import { getPayMatrixLevel } from '../../../domain/pay/payMatrix'
import { TRANSPORT_CITY_CATEGORIES } from '../../../domain/allowances/locationState'
import { SIXTH_CPC_TRANSPORT_RULE, SEVENTH_CPC_TRANSPORT_RULE } from '../../../data/allowances/transport/transportAllowanceRules'
import { isValidCalendarDate } from '../../../domain/allowances/allowanceResult'

function unresolved(reason, errors, input = {}) {
  return { success: false, status: 'UNRESOLVED', reason, errors, input: { ...input } }
}

function resolveSixthCpc(payState, category) {
  const payBand = normalize6CpcPayBand(payState.payBand ?? payState.payBandCode)
  const payBandDefinition = getSixthCpcPayBand(payBand)
  const gradePay = Number(payState.gradePay)
  const payInBand = Number(payState.payInBand ?? payState.payInPayBand)
  const basicPay = Number(payState.basicPay)
  if (!payBandDefinition || !payBandDefinition.gradePays.includes(gradePay)
    || !Number.isFinite(payInBand) || payInBand <= 0 || basicPay !== payInBand + gradePay) {
    return unresolved('INVALID_6CPC_PAY_STATE', ['A valid 6th CPC Pay Band, Pay in Pay Band, Grade Pay, and Basic Pay identity are required.'], { payBand, payInBand, gradePay, basicPay })
  }
  let bracket
  if (gradePay >= 5400) bracket = SIXTH_CPC_TRANSPORT_RULE.brackets[0]
  else if ([4200, 4600, 4800].includes(gradePay)) bracket = SIXTH_CPC_TRANSPORT_RULE.brackets[1]
  else if (gradePay < 4200 && payInBand >= 7440) bracket = SIXTH_CPC_TRANSPORT_RULE.brackets[2]
  else if (gradePay < 4200 && payInBand < 7440) bracket = SIXTH_CPC_TRANSPORT_RULE.brackets[3]
  if (!bracket) return unresolved('UNSUPPORTED_6CPC_TRANSPORT_STRUCTURE', ['The 6th CPC Pay State does not match a supported Transport Allowance bracket.'])
  return { success: true, ruleFamily: SIXTH_CPC_TRANSPORT_RULE, bracket, ruleId: bracket.ruleId, baseTransportAllowance: bracket.rates[category], explanation: `${bracket.ruleId} applies from Grade Pay ₹${gradePay.toLocaleString('en-IN')} and Pay in Pay Band ₹${payInBand.toLocaleString('en-IN')}.` }
}

function resolveSeventhCpc(payState, category) {
  const level = String(payState.level ?? payState.payLevel)
  const basicPay = Number(payState.basicPay)
  if (!getPayMatrixLevel(level) || !Number.isSafeInteger(basicPay) || basicPay <= 0) {
    return unresolved('INVALID_7CPC_PAY_STATE', ['A supported 7th CPC Level and whole-rupee Basic Pay are required.'], { level, basicPay })
  }
  const exception = SEVENTH_CPC_TRANSPORT_RULE.exceptions[0]
  const bracket = exception.levels.includes(level) && basicPay >= exception.condition.value
    ? exception
    : SEVENTH_CPC_TRANSPORT_RULE.brackets.find(({ levels }) => levels.includes(level))
  if (!bracket) return unresolved('UNSUPPORTED_7CPC_TRANSPORT_STRUCTURE', ['The 7th CPC Level does not match a supported ordinary Transport Allowance bracket.'])
  return { success: true, ruleFamily: SEVENTH_CPC_TRANSPORT_RULE, bracket, ruleId: bracket.ruleId, baseTransportAllowance: bracket.rates[category], explanation: bracket === exception ? `Level ${level} Basic Pay ₹${basicPay.toLocaleString('en-IN')} meets the ₹24,200 enhanced-rate boundary.` : `${bracket.ruleId} applies to Level ${level}.` }
}

export function resolveTransportAllowanceRule({ date, payState = {}, transportCityCategory } = {}) {
  if (!isValidCalendarDate(date)) return unresolved('INVALID_DATE', ['A valid Transport Allowance applicability date is required.'], { date })
  if (!Object.values(TRANSPORT_CITY_CATEGORIES).includes(transportCityCategory)) {
    return unresolved('MISSING_TRANSPORT_CITY_CATEGORY', ['An explicit HIGHER_RATE_CITY or OTHER_PLACE category is required.'], { transportCityCategory })
  }
  const cpc = Number(payState.cpc)
  if (cpc === 5) return unresolved('5CPC_TRANSPORT_ALLOWANCE_RULE_NOT_IMPLEMENTED', ['5th CPC Transport Allowance is not implemented.'])
  if (cpc === 7 && date < SEVENTH_CPC_TRANSPORT_RULE.effectiveFrom) {
    return unresolved('7CPC_PRE_JULY_2017_TRANSPORT_ALLOWANCE_RULE_NOT_IMPLEMENTED', ['The 7th CPC continuation rule before 01 July 2017 is not implemented.'])
  }
  const ruleFamily = cpc === 6 ? SIXTH_CPC_TRANSPORT_RULE : cpc === 7 ? SEVENTH_CPC_TRANSPORT_RULE : null
  if (!ruleFamily) return unresolved('UNSUPPORTED_CPC', ['Only ordinary 6th and revised 7th CPC Transport Allowance are supported.'])
  if (date < ruleFamily.effectiveFrom || ruleFamily.effectiveTo && date > ruleFamily.effectiveTo) {
    return unresolved('NO_VERIFIED_TRANSPORT_ALLOWANCE_RULE', ['No verified Transport Allowance monetary rule covers the requested CPC and date.'])
  }
  return cpc === 6 ? resolveSixthCpc(payState, transportCityCategory) : resolveSeventhCpc(payState, transportCityCategory)
}
