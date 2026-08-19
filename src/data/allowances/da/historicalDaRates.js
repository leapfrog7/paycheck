export const DEARNESS_COMPONENT_TYPES = Object.freeze({
  DA: 'DA',
  DEARNESS_PAY: 'DEARNESS_PAY',
})

export const DA_BASE_TYPES = Object.freeze({
  BASIC_PAY: 'BASIC_PAY',
  BASIC_PAY_PLUS_DEARNESS_PAY: 'BASIC_PAY_PLUS_DEARNESS_PAY',
  CUSTOM_COMPONENTS: 'CUSTOM_COMPONENTS',
})

export const DA_AUTHORITY = Object.freeze({
  country: 'Government of India',
  ministry: 'Ministry of Finance',
  issuingAuthority: 'Department of Expenditure',
  authorityStatus: 'RATE_VERIFIED_REFERENCE_PENDING',
})

export const DA_SERIES_FOUNDATION = Object.freeze([
  { cpc: 5, seriesId: '5CPC_MAINLINE_DA', resetDate: '1996-01-01', resetRate: 0, status: 'VERIFIED' },
  { cpc: 6, seriesId: '6CPC_MAINLINE_DA', resetDate: '2006-01-01', resetRate: 0, status: 'VERIFIED' },
  { cpc: 7, seriesId: '7CPC_PAYABLE_DA', resetDate: '2016-01-01', resetRate: 0, status: 'VERIFIED' },
])

const suppliedRates = {
  5: [
    ['1996-01-01', 0], ['1996-07-01', 4], ['1997-01-01', 8], ['1997-07-01', 13],
    ['1998-01-01', 16], ['1998-07-01', 22], ['1999-01-01', 32], ['1999-07-01', 37],
    ['2000-01-01', 38], ['2000-07-01', 41], ['2001-01-01', 43], ['2001-07-01', 45],
    ['2002-01-01', 49], ['2002-07-01', 52], ['2003-01-01', 55], ['2003-07-01', 59],
    ['2004-01-01', 61], ['2004-04-01', 11], ['2004-07-01', 14], ['2005-01-01', 17],
    ['2005-07-01', 21],
  ],
  6: [
    ['2006-01-01', 0], ['2006-07-01', 2], ['2007-01-01', 6], ['2007-07-01', 9],
    ['2008-01-01', 12], ['2008-07-01', 16], ['2009-01-01', 22], ['2009-07-01', 27],
    ['2010-01-01', 35], ['2010-07-01', 45], ['2011-01-01', 51], ['2011-07-01', 58],
    ['2012-01-01', 65], ['2012-07-01', 72], ['2013-01-01', 80], ['2013-07-01', 90],
    ['2014-01-01', 100], ['2014-07-01', 107], ['2015-01-01', 113], ['2015-07-01', 119],
    ['2016-01-01', 125],
  ],
  7: [
    ['2016-01-01', 0], ['2016-07-01', 2], ['2017-01-01', 4], ['2017-07-01', 5],
    ['2018-01-01', 7], ['2018-07-01', 9], ['2019-01-01', 12], ['2019-07-01', 17],
    ['2021-07-01', 31], ['2022-01-01', 34], ['2022-07-01', 38], ['2023-01-01', 42],
    ['2023-07-01', 46], ['2024-01-01', 50], ['2024-07-01', 53], ['2025-01-01', 55],
    ['2025-07-01', 58], ['2026-01-01', 60],
  ],
}

const closedSeriesCoverageEnd = Object.freeze({
  5: '2005-12-31',
  6: '2016-01-01',
})

function previousCalendarDay(value) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function createSeriesRecords(cpc, entries) {
  const seriesId = DA_SERIES_FOUNDATION.find((series) => series.cpc === cpc).seriesId
  return entries.map(([effectiveFrom, rate], index) => {
    const postDearnessPayMerger = cpc === 5 && effectiveFrom >= '2004-04-01'
    return Object.freeze({
      cpc,
      seriesId,
      effectiveFrom,
      effectiveTo: entries[index + 1] ? previousCalendarDay(entries[index + 1][0]) : closedSeriesCoverageEnd[cpc] ?? null,
      rate,
      componentType: postDearnessPayMerger ? DEARNESS_COMPONENT_TYPES.DEARNESS_PAY : DEARNESS_COMPONENT_TYPES.DA,
      basis: postDearnessPayMerger ? DA_BASE_TYPES.BASIC_PAY_PLUS_DEARNESS_PAY : DA_BASE_TYPES.BASIC_PAY,
      basisRuleId: postDearnessPayMerger ? '5CPC_POST_2004_DEARNESS_PAY_BASE' : `${cpc}CPC_DA_ON_BASIC_PAY`,
      calculationBasisStatus: postDearnessPayMerger ? 'PROVISIONAL' : 'VERIFIED',
      structuralMarker: effectiveFrom === '2004-04-01' ? 'DEARNESS_PAY_MERGER_RESIDUAL_DA_11_PERCENT' : null,
      ruleId: `${cpc}CPC_DA_${effectiveFrom.replaceAll('-', '_')}`,
      status: 'VERIFIED',
      authority: DA_AUTHORITY,
    })
  })
}

export const HISTORICAL_DA_RATES = Object.freeze([
  ...createSeriesRecords(5, suppliedRates[5]),
  ...createSeriesRecords(6, suppliedRates[6]),
  ...createSeriesRecords(7, suppliedRates[7]),
])
