export const PAY_COMMISSION_TYPES = {
  CPC5: '5th CPC',
  CPC6: '6th CPC',
  CPC7: '7th CPC',
}

export function createOpeningPayState(overrides = {}) {
  return {
    cpc: 7,
    effectiveFrom: '',
    payScaleId: '',
    payScaleLabel: '',
    payScale: '',
    stageIndex: '',
    payBand: '',
    payInPayBand: '',
    gradePay: '',
    level: '',
    cellIndex: '',
    basicPay: '',
    dni: '',
    ...overrides,
  }
}
