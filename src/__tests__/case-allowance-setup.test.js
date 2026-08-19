import { describe, expect, it } from 'vitest'
import { buildMonthlyDueLedger } from '../engines/pay/ledger/buildMonthlyDueLedger'
import { buildAllowanceSetup } from '../features/cases/models/buildAllowanceSetup'

describe('case allowance setup', () => {
  it('creates the dated eligibility and location context required by HRA and Transport Allowance', () => {
    const caseData = {
      payCommission: '7th CPC',
      calculationStartDate: '2025-01-01',
      applicableAllowances: { basicPay: true, da: true, hra: true, transportAllowance: true },
    }
    const context = buildAllowanceSetup(caseData, {
      hraStatus: 'ELIGIBLE', hraClass: 'X',
      transportStatus: 'ELIGIBLE', transportCategory: 'HIGHER_RATE_CITY',
    })
    const ledger = buildMonthlyDueLedger({
      openingState: { cpc: 7, level: '7', cellIndex: 1, basicPay: 44900, dni: '2025-07-01' },
      events: [], startDate: '2025-01-01', endDate: '2025-01-31',
      locationHistory: context.locationHistory,
      eligibilityHistory: context.allowanceEligibilityHistory,
      enabledAllowances: { da: true, hra: true, transportAllowance: true },
    })

    expect(ledger.months[0]).toMatchObject({
      status: 'RESOLVED',
      unresolvedComponents: [],
      components: { basicPay: 44900, hra: 13470 },
    })
  })
})
