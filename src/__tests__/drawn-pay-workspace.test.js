import { describe, expect, it } from 'vitest'
import { createDrawnPayRecord } from '../domain/pay/drawnPay'
import {
  copyRecordToFollowingEmptyMonths,
  getDrawnPayProgress,
  importGrossDrawnRows,
  monthsInPeriod,
  parseGrossDrawnPaste,
  saveQuickGrossEntry,
} from '../features/cases/models/drawnPayWorkspace'

const periodOptions = { caseStartDate: '2025-01-01', caseEndDate: '2025-05-31' }
const months = monthsInPeriod(periodOptions.caseStartDate, periodOptions.caseEndDate)

describe('fast Drawn Pay workspace helpers', () => {
  it('builds inclusive salary months and progress without counting outside records', () => {
    const records = [
      createDrawnPayRecord({ month: '2025-01', entryMode: 'GROSS_ONLY', grossDrawn: 80000 }),
      createDrawnPayRecord({ month: '2024-12', entryMode: 'GROSS_ONLY', grossDrawn: 79000 }),
    ]

    expect(months).toEqual(['2025-01', '2025-02', '2025-03', '2025-04', '2025-05'])
    expect(getDrawnPayProgress(months, records)).toEqual({ entered: 1, missing: 4, total: 5, percentage: 20 })
  })

  it('quick-saves an actual zero distinctly from an unentered month', () => {
    const result = saveQuickGrossEntry([], '2025-01', '0', periodOptions)

    expect(result.valid).toBe(true)
    expect(result.record).toMatchObject({ month: '2025-01', entryMode: 'GROSS_ONLY', grossDrawn: 0 })
  })

  it('copies a saved record only into later empty months', () => {
    const records = [
      createDrawnPayRecord({ month: '2025-01', entryMode: 'GROSS_ONLY', grossDrawn: 80000 }),
      createDrawnPayRecord({ month: '2025-03', entryMode: 'GROSS_ONLY', grossDrawn: 83000 }),
    ]
    const result = copyRecordToFollowingEmptyMonths(records, '2025-01', months, periodOptions)

    expect(result.valid).toBe(true)
    expect(result.copiedMonths).toEqual(['2025-02', '2025-04', '2025-05'])
    expect(result.records.find((record) => record.month === '2025-03').grossDrawn).toBe(83000)
    expect(result.records.find((record) => record.month === '2025-05').grossDrawn).toBe(80000)
  })

  it('parses spreadsheet rows with tabs, commas, currency signs and zero', () => {
    const parsed = parseGrossDrawnPaste('2025-01\t₹80,000\n2025-02, 0\n2025-03 82500', months)

    expect(parsed.valid).toBe(true)
    expect(parsed.rows).toEqual([
      { month: '2025-01', grossDrawn: 80000 },
      { month: '2025-02', grossDrawn: 0 },
      { month: '2025-03', grossDrawn: 82500 },
    ])
  })

  it('rejects duplicate and out-of-period pasted months before importing', () => {
    const parsed = parseGrossDrawnPaste('2025-01 80000\n2025-01 81000\n2025-06 82000', months)

    expect(parsed.valid).toBe(false)
    expect(parsed.errors.map((error) => error.message)).toEqual([
      '2025-01 appears more than once.',
      '2025-06 is outside this case period.',
    ])
  })

  it('imports valid rows as gross-only records while leaving other months unchanged', () => {
    const records = [createDrawnPayRecord({
      month: '2025-01', components: { basicPay: 50000, da: 25000, hra: 10000, transportAllowance: 5000 },
    })]
    const result = importGrossDrawnRows(records, [
      { month: '2025-01', grossDrawn: 91000 },
      { month: '2025-02', grossDrawn: 92000 },
    ], periodOptions)

    expect(result.valid).toBe(true)
    expect(result.importedMonths).toEqual(['2025-01', '2025-02'])
    expect(result.records[0]).toMatchObject({ month: '2025-01', entryMode: 'GROSS_ONLY', grossDrawn: 91000 })
    expect(Object.values(result.records[0].components)).toEqual([null, null, null, null])
  })
})
