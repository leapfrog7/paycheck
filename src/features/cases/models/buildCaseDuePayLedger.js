import { buildMonthlyDueLedger } from '../../../engines/pay/ledger/buildMonthlyDueLedger'

export function normalizeCaseOpeningPayState(caseData) {
  const state = caseData?.openingPayState ?? caseData?.startingPay ?? {}
  return {
    ...state,
    cpc: Number(state.cpc ?? String(caseData?.payCommission).match(/\d+/)?.[0]),
    level: state.level ?? state.payLevel,
    payScaleId: state.payScaleId ?? state.payScaleCode ?? state.payScale,
    stageIndex: state.stageIndex === '' ? '' : Number(state.stageIndex),
    payInBand: state.payInBand ?? state.payInPayBand,
    cellIndex: state.cellIndex === '' ? '' : Number(state.cellIndex),
    basicPay: state.basicPay === '' ? '' : Number(state.basicPay),
    gradePay: state.gradePay === '' ? '' : Number(state.gradePay),
  }
}

export function buildCaseDuePayLedger(caseData) {
  const enabled = caseData?.applicableAllowances ?? {}
  return buildMonthlyDueLedger({
    openingState: normalizeCaseOpeningPayState(caseData),
    events: caseData?.serviceEvents ?? [],
    startDate: caseData?.calculationStartDate,
    endDate: caseData?.calculationEndDate,
    locationHistory: caseData?.locationHistory ?? [],
    eligibilityHistory: caseData?.allowanceEligibilityHistory ?? [],
    customAllowanceDefinitions: caseData?.customAllowances ?? [],
    prorationConfig: caseData?.prorationConfig ?? {},
    enabledAllowances: {
      da: Boolean(enabled.da),
      hra: Boolean(enabled.hra),
      transportAllowance: Boolean(enabled.transportAllowance),
    },
  })
}
