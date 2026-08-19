import { EVENT_TYPES } from '../../../domain/events/eventTypes'
import { EVENT_STATUS } from '../../../domain/events/eventStatus'
import { buildCaseDuePayLedger } from './buildCaseDuePayLedger'

export const ANNUAL_INCREMENT_TREATMENTS = {
  INCLUDE: 'INCLUDE_ROUTINE',
  EXCLUDE: 'DO_NOT_INCLUDE',
  UNSURE: 'NOT_SURE',
}

export const OTHER_CHANGE_TYPES = {
  PROMOTION: 'PROMOTION',
  MACP_ACP: 'MACP_ACP',
  PAY_REVISION: 'PAY_REVISION',
  PAY_CORRECTION: 'PAY_CORRECTION',
  NONE: 'NONE',
  UNSURE: 'NOT_SURE',
}

export const OTHER_CHANGE_LABELS = {
  [OTHER_CHANGE_TYPES.PROMOTION]: 'Promotion',
  [OTHER_CHANGE_TYPES.MACP_ACP]: 'MACP / ACP',
  [OTHER_CHANGE_TYPES.PAY_REVISION]: 'Pay revision / CPC switch',
  [OTHER_CHANGE_TYPES.PAY_CORRECTION]: 'Pay correction or refixation',
  [OTHER_CHANGE_TYPES.NONE]: 'Nothing else changed',
  [OTHER_CHANGE_TYPES.UNSURE]: 'I’m not sure',
}

export function createOpeningStateFromSetup(data) {
  const pay = data.startingPay
  if (data.payCommission === '5th CPC') {
    return { cpc: 5, effectiveFrom: data.calculationStartDate, payScaleId: pay.payScaleId, payScaleLabel: pay.payScaleLabel, stageIndex: Number(pay.stageIndex), basicPay: Number(pay.basicPay), dni: pay.dni }
  }
  if (data.payCommission === '6th CPC') {
    return { cpc: 6, effectiveFrom: data.calculationStartDate, payBand: pay.payBand, payInBand: Number(pay.payInBand), gradePay: Number(pay.gradePay), basicPay: Number(pay.basicPay), dni: pay.dni }
  }
  return { cpc: 7, effectiveFrom: data.calculationStartDate, level: pay.payLevel, cellIndex: Number(pay.cellIndex), basicPay: Number(pay.basicPay), dni: pay.dni }
}

function addOneYear(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const nextYear = year + 1
  const lastDay = new Date(Date.UTC(nextYear, month, 0)).getUTCDate()
  return `${nextYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

export function buildRoutineIncrementEvents({ dni, startDate, endDate } = {}) {
  if (!dni || !startDate || !endDate || endDate < startDate) return []
  let incrementDate = dni
  while (incrementDate < startDate) incrementDate = addOneYear(incrementDate)

  const events = []
  while (incrementDate <= endDate) {
    events.push({
      id: `guided-annual-increment-${incrementDate}`,
      type: EVENT_TYPES.ANNUAL_INCREMENT,
      title: 'Routine annual increment',
      eventDate: incrementDate,
      effectiveDate: incrementDate,
      effectiveFrom: incrementDate,
      status: EVENT_STATUS.CONFIRMED,
      source: 'GUIDED_SETUP',
      note: 'Included after confirmation in guided setup.',
    })
    incrementDate = addOneYear(incrementDate)
  }
  return events
}

export function getPendingCareerChanges(caseData) {
  const changes = caseData?.careerChangeReview?.otherChanges ?? []
  return changes.filter((change) => ![OTHER_CHANGE_TYPES.NONE].includes(change))
}

export function prepareGuidedCase(caseData) {
  const existingEvents = (caseData.serviceEvents ?? []).filter((event) => event.source !== 'GUIDED_SETUP')
  const includeRoutine = caseData.careerChangeReview?.annualIncrementTreatment === ANNUAL_INCREMENT_TREATMENTS.INCLUDE
  const generatedEvents = includeRoutine
    ? buildRoutineIncrementEvents({
      dni: caseData.startingPay?.dni,
      startDate: caseData.calculationStartDate,
      endDate: caseData.calculationEndDate,
    })
    : []

  return {
    ...caseData,
    openingPayState: createOpeningStateFromSetup(caseData),
    serviceEvents: [...existingEvents, ...generatedEvents],
  }
}

export function buildGuidedExpectedPay(caseData) {
  const preparedCase = prepareGuidedCase(caseData)
  const pendingChanges = getPendingCareerChanges(caseData)
  const ledger = buildCaseDuePayLedger(preparedCase)
  const resolvedMonths = ledger.success ? ledger.months.filter((month) => month.status === 'RESOLVED') : []
  const latestResolved = resolvedMonths.at(-1) ?? null
  const totalGrossDue = resolvedMonths.reduce((total, month) => total + Number(month.grossDue), 0)
  const incrementDecision = caseData.careerChangeReview?.annualIncrementTreatment
  const routineDecisionResolved = Boolean(incrementDecision)
    && incrementDecision !== ANNUAL_INCREMENT_TREATMENTS.UNSURE

  return {
    preparedCase,
    ledger,
    pendingChanges,
    resolvedMonths,
    latestResolved,
    totalGrossDue,
    isComplete: ledger.success && ledger.status === 'RESOLVED' && pendingChanges.length === 0 && routineDecisionResolved,
  }
}
