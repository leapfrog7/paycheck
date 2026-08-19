import {
  SIXTH_CPC_TO_SEVENTH_CPC_LEVEL_MAPPING,
} from '../../data/pay/6cpcTo7cpcMapping'
import { getSixthCpcPayBand } from '../../data/pay/6cpcPayBands'

const PAY_BAND_ALIASES = Object.freeze({
  PB1: 'PB-1',
  'PB-1': 'PB-1',
  PB2: 'PB-2',
  'PB-2': 'PB-2',
  PB3: 'PB-3',
  'PB-3': 'PB-3',
  PB4: 'PB-4',
  'PB-4': 'PB-4',
})

export function normalize6CpcPayBand(payBand) {
  if (typeof payBand !== 'string' || !payBand.trim()) {
    return null
  }

  return PAY_BAND_ALIASES[payBand.trim().toUpperCase()] ?? null
}

export function get6CpcTo7CpcMapping(payBandOrState, gradePayArgument) {
  const payBand = typeof payBandOrState === 'object'
    ? payBandOrState?.payBand ?? payBandOrState?.payBandCode
    : payBandOrState
  const gradePay = typeof payBandOrState === 'object'
    ? payBandOrState?.gradePay
    : gradePayArgument
  const normalizedPayBand = normalize6CpcPayBand(payBand)
  const numericGradePay = Number(gradePay)
  const level = normalizedPayBand && Number.isFinite(numericGradePay)
    ? SIXTH_CPC_TO_SEVENTH_CPC_LEVEL_MAPPING[normalizedPayBand]?.[numericGradePay]
    : null

  if (!level) {
    return null
  }

  const bandDefinition = getSixthCpcPayBand(normalizedPayBand)

  return {
    payBand: normalizedPayBand,
    payBandMinimum: bandDefinition.minimum,
    payBandMaximum: bandDefinition.maximum,
    gradePay: numericGradePay,
    level,
    ruleId: '6CPC_TO_7CPC_LEVEL_MAP',
  }
}

export function get7CpcLevelFor6CpcState(payState = {}) {
  return get6CpcTo7CpcMapping(payState)?.level ?? null
}
