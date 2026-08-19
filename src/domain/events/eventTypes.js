export const EVENT_TYPES = {
  ANNUAL_INCREMENT: 'ANNUAL_INCREMENT',
  REGULAR_PROMOTION: 'REGULAR_PROMOTION',
  AD_HOC_PROMOTION: 'AD_HOC_PROMOTION',
  REGULARISATION: 'REGULARISATION',
  ACP: 'ACP',
  MACP: 'MACP',
  CPC_TRANSITION: 'CPC_TRANSITION',
  PAY_REFIXATION: 'PAY_REFIXATION',
  DNI_ADJUSTMENT: 'DNI_ADJUSTMENT',
  NOTIONAL_REFIXATION: 'NOTIONAL_REFIXATION',
  PAY_CORRECTION: 'PAY_CORRECTION',
  RETROSPECTIVE_PROMOTION: 'RETROSPECTIVE_PROMOTION',
  NOTIONAL_FIXATION: 'NOTIONAL_FIXATION',
  TRANSFER: 'TRANSFER',
  RETIREMENT: 'RETIREMENT',
}

export const EVENT_TYPE_OPTIONS = [
  { value: EVENT_TYPES.ANNUAL_INCREMENT, label: 'Annual Increment' },
  { value: EVENT_TYPES.REGULAR_PROMOTION, label: 'Regular Promotion' },
  { value: EVENT_TYPES.AD_HOC_PROMOTION, label: 'Ad Hoc Promotion' },
  { value: EVENT_TYPES.REGULARISATION, label: 'Regularisation' },
  { value: EVENT_TYPES.ACP, label: 'ACP' },
  { value: EVENT_TYPES.MACP, label: 'MACP' },
  { value: EVENT_TYPES.CPC_TRANSITION, label: 'Pay Commission Transition' },
  { value: EVENT_TYPES.PAY_REFIXATION, label: 'Pay Refixation' },
  { value: EVENT_TYPES.DNI_ADJUSTMENT, label: 'DNI Adjustment' },
  { value: EVENT_TYPES.NOTIONAL_REFIXATION, label: 'Notional Refixation' },
  { value: EVENT_TYPES.PAY_CORRECTION, label: 'Pay Correction' },
  { value: EVENT_TYPES.RETROSPECTIVE_PROMOTION, label: 'Retrospective Promotion' },
  { value: EVENT_TYPES.NOTIONAL_FIXATION, label: 'Notional Fixation' },
  { value: EVENT_TYPES.TRANSFER, label: 'Transfer' },
  { value: EVENT_TYPES.RETIREMENT, label: 'Retirement' },
]

export const EVENT_TYPE_LABELS = Object.fromEntries(
  EVENT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

export const EVENT_TYPE_BY_VALUE = EVENT_TYPE_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option
  return accumulator
}, {})
