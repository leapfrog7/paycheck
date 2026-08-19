import { getSixthCpcPayBand } from './6cpcPayBands'

export const FIFTH_TO_SIXTH_CPC_MAPPING_AUTHORITY = Object.freeze({
  sourceFamily: 'Central Civil Services (Revised Pay) Rules, 2008',
  government: 'Government of India',
  ministry: 'Ministry of Finance',
  department: 'Department of Expenditure',
  ordinaryEffectiveDate: '2006-01-01',
})

function supported(number, payBand, gradePay) {
  const band = getSixthCpcPayBand(payBand)
  if (!band || !band.gradePays.includes(gradePay)) throw new Error(`Unsupported controlled 6th CPC mapping for S-${number}.`)
  return Object.freeze({
    sourceScaleId: `S5_S${number}`,
    sourceScaleCode: `S-${number}`,
    status: 'SUPPORTED',
    payBand: band.code,
    payBandMinimum: band.minimum,
    payBandMaximum: band.maximum,
    gradePay,
    authority: FIFTH_TO_SIXTH_CPC_MAPPING_AUTHORITY,
  })
}

function unsupported(number, reason, targetStructure) {
  return Object.freeze({
    sourceScaleId: `S5_S${number}`,
    sourceScaleCode: `S-${number}`,
    status: 'UNSUPPORTED',
    reason,
    targetStructure,
    authority: FIFTH_TO_SIXTH_CPC_MAPPING_AUTHORITY,
  })
}

const mappings = [
  unsupported(1, '5CPC_TO_6CPC_MINUS_1S_NOT_IMPLEMENTED', '-1S'),
  unsupported(2, '5CPC_TO_6CPC_MINUS_1S_NOT_IMPLEMENTED', '-1S'),
  unsupported(3, '5CPC_TO_6CPC_MINUS_1S_NOT_IMPLEMENTED', '-1S'),
  supported(4, 'PB-1', 1800),
  supported(5, 'PB-1', 1900),
  supported(6, 'PB-1', 2000),
  supported(7, 'PB-1', 2400),
  supported(8, 'PB-1', 2800),
  supported(9, 'PB-2', 4200),
  supported(10, 'PB-2', 4200),
  supported(11, 'PB-2', 4200),
  supported(12, 'PB-2', 4200),
  supported(13, 'PB-2', 4600),
  supported(14, 'PB-2', 4800),
  supported(15, 'PB-2', 5400),
  supported(16, 'PB-3', 5400),
  supported(17, 'PB-3', 5400),
  supported(18, 'PB-3', 6600),
  supported(19, 'PB-3', 6600),
  supported(20, 'PB-3', 6600),
  supported(21, 'PB-3', 7600),
  supported(22, 'PB-3', 7600),
  supported(23, 'PB-3', 7600),
  supported(24, 'PB-4', 8700),
  supported(25, 'PB-4', 8700),
  supported(26, 'PB-4', 8900),
  supported(27, 'PB-4', 8900),
  supported(28, 'PB-4', 10000),
  supported(29, 'PB-4', 10000),
  unsupported(30, '6CPC_GP_12000_NOT_IMPLEMENTED', 'PB-4 + GP 12000'),
  unsupported(31, '6CPC_HAG_PLUS_STRUCTURE_NOT_IMPLEMENTED', 'HAG+ 75500–80000'),
  unsupported(32, '6CPC_HAG_PLUS_STRUCTURE_NOT_IMPLEMENTED', 'HAG+ 75500–80000'),
  unsupported(33, '6CPC_APEX_STRUCTURE_NOT_IMPLEMENTED', 'Apex 80000 fixed'),
  unsupported(34, '6CPC_CABINET_SECRETARY_STRUCTURE_NOT_IMPLEMENTED', 'Cabinet Secretary 90000 fixed'),
]

export const FIFTH_TO_SIXTH_CPC_MAPPINGS = Object.freeze(mappings)

export function get5CpcTo6CpcMapping(scaleId) {
  return FIFTH_TO_SIXTH_CPC_MAPPINGS.find(({ sourceScaleId }) => sourceScaleId === scaleId) ?? null
}
