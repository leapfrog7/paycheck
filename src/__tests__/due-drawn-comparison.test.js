import { describe, expect, it } from 'vitest'
import { createDrawnPayRecord } from '../domain/pay/drawnPay'
import { buildDueDrawnComparison } from '../engines/pay/comparison/buildDueDrawnComparison'
import { compareDueDrawnMonth } from '../engines/pay/comparison/compareMonth'
import { summarizeDueDrawnComparison } from '../engines/pay/comparison/summarizeComparison'

function dueMonth(overrides = {}) {
  return {
    month: '2024-01',
    status: 'RESOLVED',
    grossDue: 110320,
    reason: null,
    unresolvedComponents: [],
    unresolvedEventIds: [],
    components: {
      basicPay: 56900,
      da: 28450,
      hra: 17070,
      transportAllowance: 5400,
      customAllowances: [{ name: 'Due Special', amount: 2500 }],
    },
    segments: [{ provenance: { allowanceRuleIds: ['DA-RULE'] } }],
    ...overrides,
  }
}

function grossDrawn(grossDrawn, month = '2024-01') {
  return createDrawnPayRecord({ month, entryMode: 'GROSS_ONLY', grossDrawn })
}

describe('monthly Due–Drawn gross comparison', () => {
  it('returns a positive signed arrear', () => {
    expect(compareDueDrawnMonth(dueMonth(), grossDrawn(108000))).toMatchObject({
      signedDifference: 2320, outcome: 'ARREAR', arrearAmount: 2320, recoveryAmount: 0, status: 'RESOLVED',
    })
  })

  it('retains a negative signed recovery and a positive recovery amount', () => {
    expect(compareDueDrawnMonth(dueMonth(), grossDrawn(112000))).toMatchObject({
      signedDifference: -1680, outcome: 'RECOVERY', arrearAmount: 0, recoveryAmount: 1680,
    })
  })

  it('returns NIL for equal gross amounts', () => {
    expect(compareDueDrawnMonth(dueMonth(), grossDrawn(110320))).toMatchObject({ signedDifference: 0, outcome: 'NIL' })
  })

  it('distinguishes missing Drawn Pay from explicitly entered zero', () => {
    const missing = compareDueDrawnMonth(dueMonth(), null)
    expect(missing).toMatchObject({ status: 'UNRESOLVED', outcome: 'UNRESOLVED', signedDifference: null, arrearAmount: null, reasons: ['DRAWN_PAY_NOT_ENTERED'] })
    const zero = compareDueDrawnMonth(dueMonth(), grossDrawn(0))
    expect(zero).toMatchObject({ status: 'RESOLVED', signedDifference: 110320, outcome: 'ARREAR' })
  })

  it('resolves gross-only comparison without inventing components', () => {
    const result = compareDueDrawnMonth(dueMonth(), grossDrawn(108000))
    expect(result.componentComparison.basicPay).toMatchObject({ status: 'UNAVAILABLE', drawnAmount: null, signedDifference: null })
  })
})

describe('component comparison', () => {
  it('calculates signed Basic, DA, HRA and TA differences without extra DA-on-TA', () => {
    const drawn = createDrawnPayRecord({
      month: '2024-01',
      components: { basicPay: 56800, da: 28000, hra: 17000, transportAllowance: 5500 },
    })
    const result = compareDueDrawnMonth(dueMonth(), drawn)
    expect(result.componentComparison).toMatchObject({
      basicPay: { signedDifference: 100, status: 'COMPARABLE' },
      da: { signedDifference: 450, status: 'COMPARABLE' },
      hra: { signedDifference: 70, status: 'COMPARABLE' },
      transportAllowance: { signedDifference: -100, status: 'COMPARABLE' },
    })
  })

  it('compares only entered partial components while still resolving a separately known gross', () => {
    const drawn = createDrawnPayRecord({
      month: '2024-01', components: { basicPay: 56800, da: 28000 }, grossDrawn: 108000,
      otherAllowances: [{ name: 'Drawn Special', amount: 1000 }],
    })
    const result = compareDueDrawnMonth(dueMonth(), drawn)
    expect(result).toMatchObject({ status: 'RESOLVED', signedDifference: 2320 })
    expect(result.componentComparison.basicPay.status).toBe('COMPARABLE')
    expect(result.componentComparison.da.status).toBe('COMPARABLE')
    expect(result.componentComparison.hra).toMatchObject({ status: 'NOT_ENTERED', drawnAmount: null, signedDifference: null })
    expect(result.unmatchedAllowances).toMatchObject({ matchingStatus: 'NOT_ATTEMPTED', due: [{ name: 'Due Special', amount: 2500 }], drawn: [{ name: 'Drawn Special', amount: 1000 }] })
  })
})

describe('unresolved Due Pay', () => {
  it('preserves pending-proration reason and calculates no amount', () => {
    const due = dueMonth({ status: 'PARTIALLY_RESOLVED', grossDue: null, components: null, reason: 'MONTHLY_PRORATION_RULE_NOT_IMPLEMENTED' })
    expect(compareDueDrawnMonth(due, grossDrawn(108000))).toMatchObject({
      status: 'UNRESOLVED', signedDifference: null, arrearAmount: null, recoveryAmount: null,
      reasons: ['MONTHLY_PRORATION_RULE_NOT_IMPLEMENTED'],
    })
  })

  it('preserves unresolved allowance information and does not use a partial total', () => {
    const due = dueMonth({ status: 'PARTIALLY_RESOLVED', grossDue: null, components: null, reason: 'UNRESOLVED_FINANCIAL_COMPONENTS', unresolvedComponents: ['HRA'] })
    const result = compareDueDrawnMonth(due, grossDrawn(108000))
    expect(result.reasons).toEqual(['UNRESOLVED_FINANCIAL_COMPONENTS', 'DUE_COMPONENT_UNRESOLVED:HRA'])
    expect(result.signedDifference).toBeNull()
  })
})

describe('case comparison and summary', () => {
  it('retains separate arrear, recovery and net totals', () => {
    const months = [
      { status: 'RESOLVED', arrearAmount: 2000, recoveryAmount: 0 },
      { status: 'RESOLVED', arrearAmount: 0, recoveryAmount: 500 },
      { status: 'RESOLVED', arrearAmount: 0, recoveryAmount: 0 },
    ]
    expect(summarizeDueDrawnComparison(months)).toMatchObject({
      totalArrear: 2000, totalRecovery: 500, netDifference: 1500,
      resolvedMonths: 3, unresolvedMonths: 0, status: 'RESOLVED', totalsScope: 'ALL_MONTHS',
    })
  })

  it('labels aggregation as resolved-months-only when any month is unresolved', () => {
    const summary = summarizeDueDrawnComparison([
      { status: 'RESOLVED', arrearAmount: 2000, recoveryAmount: 0 },
      { status: 'UNRESOLVED', arrearAmount: null, recoveryAmount: null },
    ])
    expect(summary).toMatchObject({ totalArrear: 2000, unresolvedMonths: 1, status: 'PARTIALLY_RESOLVED', totalsScope: 'RESOLVED_MONTHS_ONLY' })
  })

  it('uses only Due ledger months and flags out-of-coverage Drawn records', () => {
    const duePayLedger = { success: true, months: [dueMonth()] }
    const result = buildDueDrawnComparison({ duePayLedger, drawnPayHistory: [grossDrawn(108000), grossDrawn(999, '2023-12')] })
    expect(result.months).toHaveLength(1)
    expect(result.ignoredDrawnMonths).toEqual(['2023-12'])
    expect(result.provenance.duePayLedger).toBe(duePayLedger)
    expect(result.months[0].provenance.drawnPayRecord).toBe(result.provenance.drawnPayHistory[0])
  })
})
