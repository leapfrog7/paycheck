import { ALLOWANCE_CODES } from '../../domain/allowances/allowanceConstants'
import { calculateDearnessAllowance } from './da/calculateDa'
import { calculateHouseRentAllowance } from './hra/calculateHra'
import { calculateTransportAllowance } from './transport/calculateTransportAllowance'
import { calculateCustomAllowance } from './custom/calculateCustomAllowance'

export function createAllowanceRegistry(initialEntries = []) {
  const calculators = new Map(initialEntries.map((entry) => [entry.allowanceCode, Object.freeze({ ...entry })]))
  return Object.freeze({
    get(allowanceCode) { return calculators.get(allowanceCode) ?? null },
    has(allowanceCode) { return calculators.has(allowanceCode) },
    entries() { return [...calculators.values()] },
    withCalculator(entry) { return createAllowanceRegistry([...calculators.values().filter(({ allowanceCode }) => allowanceCode !== entry.allowanceCode), entry]) },
  })
}

export const ALLOWANCE_REGISTRY = createAllowanceRegistry([
  { allowanceCode: ALLOWANCE_CODES.DA, engineId: 'DA_RULE_ENGINE', calculator: calculateDearnessAllowance, status: 'IMPLEMENTED' },
  { allowanceCode: ALLOWANCE_CODES.HRA, engineId: 'HRA_RULE_ENGINE', calculator: calculateHouseRentAllowance, status: 'IMPLEMENTED' },
  { allowanceCode: ALLOWANCE_CODES.TRANSPORT_ALLOWANCE, engineId: 'TRANSPORT_ALLOWANCE_RULE_ENGINE', calculator: calculateTransportAllowance, status: 'IMPLEMENTED' },
  { allowanceCode: ALLOWANCE_CODES.CUSTOM, engineId: 'CUSTOM_ALLOWANCE_ENGINE', calculator: calculateCustomAllowance, status: 'IMPLEMENTED' },
])
