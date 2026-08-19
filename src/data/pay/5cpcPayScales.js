export const FIFTH_CPC_STAGE_TYPES = Object.freeze({
  NORMAL: 'NORMAL',
  EFFICIENCY_BAR: 'EFFICIENCY_BAR',
  POST_EFFICIENCY_BAR: 'POST_EFFICIENCY_BAR',
})

export const FIFTH_CPC_SCALE_DATA_STATUS = 'VERIFIED_STANDARD_S_SERIES'
export const FIFTH_CPC_SCALE_AUTHORITY = Object.freeze({
  sourceFamily: 'Central Civil Services (Revised Pay) Rules, 1997',
  government: 'Government of India',
  ministry: 'Ministry of Finance',
  department: 'Department of Expenditure',
  effectiveFrom: '1996-01-01',
})

function generateSectionValues(section) {
  const { from, to, increment } = section
  if (![from, to, increment].every(Number.isFinite) || increment <= 0 || to < from || (to - from) % increment !== 0) {
    throw new Error('A 5th CPC scale section must completely and unambiguously define its stages.')
  }
  const values = []
  for (let value = from; value <= to; value += increment) values.push(value)
  return values
}

export function createFifthCpcStages(structure = {}) {
  if (structure.type !== 'EXPLICIT_STAGES') {
    const sections = structure.sections ?? []
    sections.forEach((section, index) => {
      if (index > 0 && section.from !== sections[index - 1].to) {
        throw new Error('Adjacent 5th CPC scale sections must meet at an explicitly encoded boundary.')
      }
    })
  }
  const values = structure.type === 'EXPLICIT_STAGES'
    ? [...(structure.values ?? [])]
    : (structure.sections ?? []).flatMap((section, index) => {
        const sectionValues = generateSectionValues(section)
        return index === 0 ? sectionValues : sectionValues.slice(1)
      })
  if (!values.length || values.some((value, index) => !Number.isFinite(value) || index > 0 && value <= values[index - 1])) {
    throw new Error('5th CPC stages must be an explicit, strictly increasing sequence.')
  }
  const efficiencyBars = structure.efficiencyBars ?? []
  return values.map((value, index) => {
    const barrier = efficiencyBars.find((item) => item.crossingTo === value)
    const afterBarrier = efficiencyBars.some((item) => index + 1 > values.indexOf(item.crossingTo))
    return Object.freeze({
      index: index + 1,
      value,
      stageType: barrier
        ? FIFTH_CPC_STAGE_TYPES.EFFICIENCY_BAR
        : afterBarrier ? FIFTH_CPC_STAGE_TYPES.POST_EFFICIENCY_BAR : FIFTH_CPC_STAGE_TYPES.NORMAL,
      requiresEfficiencyBarClearance: Boolean(barrier?.clearanceRequired),
    })
  })
}

function defineScale(definition) {
  const stages = Object.freeze(createFifthCpcStages(definition.structure))
  const incrementSections = Object.freeze((definition.structure.sections ?? []).map((item) => Object.freeze({ ...item })))
  const efficiencyBars = Object.freeze((definition.structure.efficiencyBars ?? []).map((item) => Object.freeze({ ...item })))
  const structure = Object.freeze({
    ...definition.structure,
    sections: incrementSections,
    values: definition.structure.values ? Object.freeze([...definition.structure.values]) : undefined,
    efficiencyBars,
  })
  return Object.freeze({
    ...definition,
    structure,
    authority: FIFTH_CPC_SCALE_AUTHORITY,
    effectiveFrom: FIFTH_CPC_SCALE_AUTHORITY.effectiveFrom,
    verificationStatus: 'VERIFIED_SUPPLIED_STANDARD_SCALE',
    minimum: stages[0].value,
    maximum: stages.at(-1).value,
    incrementSections,
    fixedScale: definition.structure.type === 'EXPLICIT_STAGES' && stages.length === 1,
    stages,
  })
}

function standardScale(number, monetaryLabel, sections) {
  const standardScaleCode = `S-${number}`
  return defineScale({
    id: `S5_S${number}`,
    standardScaleCode,
    label: `${standardScaleCode} — ₹${monetaryLabel.replaceAll('-', '–')}`,
    monetaryScale: monetaryLabel,
    structure: { type: 'SEGMENTED_INCREMENTS', sections, efficiencyBars: [] },
  })
}

function fixedScale(number, value) {
  const standardScaleCode = `S-${number}`
  return defineScale({
    id: `S5_S${number}`,
    standardScaleCode,
    label: `${standardScaleCode} — ₹${value.toLocaleString('en-IN')} FIXED`,
    monetaryScale: `${value} FIXED`,
    structure: { type: 'EXPLICIT_STAGES', values: [value], efficiencyBars: [] },
  })
}

const section = (from, to, increment) => ({ from, to, increment })

export const FIFTH_CPC_PAY_SCALES = Object.freeze([
  standardScale(1, '2550-55-2660-60-3200', [section(2550, 2660, 55), section(2660, 3200, 60)]),
  standardScale(2, '2610-60-3150-65-3540', [section(2610, 3150, 60), section(3150, 3540, 65)]),
  standardScale(3, '2650-65-3300-70-4000', [section(2650, 3300, 65), section(3300, 4000, 70)]),
  standardScale(4, '2750-70-3800-75-4400', [section(2750, 3800, 70), section(3800, 4400, 75)]),
  standardScale(5, '3050-75-3950-80-4590', [section(3050, 3950, 75), section(3950, 4590, 80)]),
  standardScale(6, '3200-85-4900', [section(3200, 4900, 85)]),
  standardScale(7, '4000-100-6000', [section(4000, 6000, 100)]),
  standardScale(8, '4500-125-7000', [section(4500, 7000, 125)]),
  standardScale(9, '5000-150-8000', [section(5000, 8000, 150)]),
  standardScale(10, '5500-175-9000', [section(5500, 9000, 175)]),
  standardScale(11, '6500-200-6900', [section(6500, 6900, 200)]),
  standardScale(12, '6500-200-10500', [section(6500, 10500, 200)]),
  standardScale(13, '7450-225-11500', [section(7450, 11500, 225)]),
  standardScale(14, '7500-250-12000', [section(7500, 12000, 250)]),
  standardScale(15, '8000-275-13500', [section(8000, 13500, 275)]),
  fixedScale(16, 9000),
  standardScale(17, '9000-275-9550', [section(9000, 9550, 275)]),
  standardScale(18, '10325-325-10975', [section(10325, 10975, 325)]),
  standardScale(19, '10000-325-15200', [section(10000, 15200, 325)]),
  standardScale(20, '10650-325-15850', [section(10650, 15850, 325)]),
  standardScale(21, '12000-375-16500', [section(12000, 16500, 375)]),
  standardScale(22, '12750-375-16500', [section(12750, 16500, 375)]),
  standardScale(23, '12000-375-18000', [section(12000, 18000, 375)]),
  standardScale(24, '14300-400-18300', [section(14300, 18300, 400)]),
  standardScale(25, '15100-400-18300', [section(15100, 18300, 400)]),
  standardScale(26, '16400-450-20000', [section(16400, 20000, 450)]),
  standardScale(27, '16400-450-20900', [section(16400, 20900, 450)]),
  standardScale(28, '14300-450-22400', [section(14300, 22400, 450)]),
  standardScale(29, '18400-500-22400', [section(18400, 22400, 500)]),
  standardScale(30, '22400-525-24500', [section(22400, 24500, 525)]),
  standardScale(31, '22400-600-26000', [section(22400, 26000, 600)]),
  standardScale(32, '24050-650-26000', [section(24050, 26000, 650)]),
  fixedScale(33, 26000),
  fixedScale(34, 30000),
])

export const FIFTH_CPC_PAY_SCALE_ALIASES = Object.freeze({
  S5_3050_75_3950_80_4590: 'S5_S5',
  S5_6500_200_10500: 'S5_S12',
})

export function getFifthCpcScale(scaleId) {
  const canonicalId = FIFTH_CPC_PAY_SCALE_ALIASES[scaleId] ?? scaleId
  return FIFTH_CPC_PAY_SCALES.find(({ id }) => id === canonicalId) ?? null
}

export function getFifthCpcStages(scaleId) {
  return getFifthCpcScale(scaleId)?.stages ?? []
}

export function findFifthCpcStage(scaleId, basicPay) {
  const amount = Number(basicPay)
  return getFifthCpcStages(scaleId).find(({ value }) => value === amount) ?? null
}

export function getFifthCpcStage(scaleId, stageIndex) {
  const index = Number(stageIndex)
  return Number.isInteger(index) ? getFifthCpcStages(scaleId).find((stage) => stage.index === index) ?? null : null
}

export function getNextFifthCpcStage(scaleId, stageIndex) {
  return getFifthCpcStage(scaleId, Number(stageIndex) + 1)
}
