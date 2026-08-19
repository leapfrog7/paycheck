import { EVENT_STATUS } from '../../../domain/events/eventStatus'
import { EVENT_TYPES } from '../../../domain/events/eventTypes'
import { FIXATION_OPTIONS } from '../../../domain/events/fixationOptions'
import { createOpeningPayState } from '../../../domain/pay/payState'
import { createCustomAllowanceDefinition } from '../../../domain/allowances/customAllowance'
import { normalizeDrawnPayHistory } from '../../../domain/pay/drawnPay'
import { getFifthCpcScale } from '../../../data/pay/5cpcPayScales'
import { createEmptyProrationConfig } from '../../../domain/pay/proration'

export const PAY_COMMISSION_OPTIONS = ['7th CPC', '6th CPC', '5th CPC']

export const DEFAULT_ALLOWANCES = {
  basicPay: true,
  da: false,
  hra: false,
  transportAllowance: false,
}

export function createServiceEvent(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: overrides.type ?? EVENT_TYPES.ANNUAL_INCREMENT,
    title: overrides.title ?? 'Service event',
    eventDate: overrides.eventDate ?? '',
    status: overrides.status ?? EVENT_STATUS.PLANNED,
    effectiveFrom: overrides.effectiveFrom ?? '',
    ruleId: overrides.ruleId ?? '',
    fixationOption: overrides.fixationOption ?? FIXATION_OPTIONS.UNRESOLVED,
    derivedFromEventId: overrides.derivedFromEventId ?? null,
    note: overrides.note ?? '',
    ...overrides,
  }
}

export function createEmptyPayCase(overrides = {}) {
  const now = new Date().toISOString()

  return {
    id: overrides.id ?? crypto.randomUUID(),
    caseName: '',
    employeeName: '',
    calculationStartDate: '',
    calculationEndDate: '',
    payCommission: '7th CPC',
    startingPay: {
      payScaleId: '',
      payScaleLabel: '',
      stageIndex: '',
      payLevel: '',
      cellIndex: '',
      payBand: '',
      payInBand: '',
      gradePay: '',
      basicPay: '',
      effectiveFrom: '',
      dni: '',
    },
    openingPayState: createOpeningPayState({
      cpc: 7,
      effectiveFrom: '',
      level: '',
      cellIndex: '',
      basicPay: '',
      dni: '',
    }),
    incrementDateMonth: '',
    hraCityClass: '',
    locationHistory: [],
    allowanceEligibilityHistory: [],
    customAllowances: [],
    applicableAllowances: { ...DEFAULT_ALLOWANCES },
    serviceEvents: [],
    futureEventTimeline: [],
    drawnPayHistory: [],
    prorationConfig: createEmptyProrationConfig(),
    assumptions: [],
    unresolvedIssues: [],
    calculationGoal: 'ARREARS_RECOVERY',
    careerChangeReview: {
      annualIncrementTreatment: '',
      otherChanges: [],
    },
    lifecycleStatus: 'ACTIVE',
    setupStep: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function normalizeCaseInput(rawCase = {}) {
  const caseData = { ...createEmptyPayCase(rawCase) }
  const persistedScaleId = rawCase.startingPay?.payScaleId
    ?? rawCase.openingPayState?.payScaleId
    ?? rawCase.openingPayState?.payScaleCode
    ?? rawCase.openingPayState?.payScale
    ?? ''
  const canonicalScale = getFifthCpcScale(persistedScaleId)
  const payScaleId = canonicalScale?.id ?? persistedScaleId
  const payScaleLabel = canonicalScale?.label
    ?? rawCase.startingPay?.payScaleLabel
    ?? rawCase.openingPayState?.payScaleLabel
    ?? ''

  const openingPayState = {
    ...createOpeningPayState(),
    ...(rawCase.openingPayState ?? {}),
  }

  const startingPay = {
    payScaleId,
    payScaleLabel,
    stageIndex: rawCase.startingPay?.stageIndex ?? rawCase.openingPayState?.stageIndex ?? '',
    payLevel: rawCase.startingPay?.payLevel ?? rawCase.openingPayState?.level ?? '',
    cellIndex: rawCase.startingPay?.cellIndex ?? rawCase.openingPayState?.cellIndex ?? '',
    payBand: rawCase.startingPay?.payBand ?? rawCase.openingPayState?.payBand ?? '',
    payInBand: rawCase.startingPay?.payInBand ?? rawCase.openingPayState?.payInBand ?? '',
    gradePay: rawCase.startingPay?.gradePay ?? rawCase.openingPayState?.gradePay ?? '',
    basicPay: rawCase.startingPay?.basicPay ?? rawCase.openingPayState?.basicPay ?? '',
    effectiveFrom: rawCase.startingPay?.effectiveFrom ?? rawCase.openingPayState?.effectiveFrom ?? '',
    dni: rawCase.startingPay?.dni ?? rawCase.openingPayState?.dni ?? '',
  }

  caseData.startingPay = startingPay
  caseData.openingPayState = {
    ...openingPayState,
    cpc: rawCase.payCommission === '7th CPC'
      ? 7
      : rawCase.payCommission === '6th CPC'
        ? 6
        : rawCase.payCommission === '5th CPC' ? 5 : rawCase.openingPayState?.cpc ?? openingPayState.cpc,
    payScaleId,
    payScaleLabel,
    stageIndex: rawCase.startingPay?.stageIndex ?? rawCase.openingPayState?.stageIndex ?? startingPay.stageIndex,
    level: rawCase.startingPay?.payLevel ?? rawCase.openingPayState?.level ?? startingPay.payLevel,
    cellIndex: rawCase.startingPay?.cellIndex ?? rawCase.openingPayState?.cellIndex ?? startingPay.cellIndex,
    basicPay: rawCase.startingPay?.basicPay ?? rawCase.openingPayState?.basicPay ?? startingPay.basicPay,
    payBand: rawCase.startingPay?.payBand ?? rawCase.openingPayState?.payBand ?? startingPay.payBand,
    payInBand: rawCase.startingPay?.payInBand ?? rawCase.openingPayState?.payInBand ?? startingPay.payInBand,
    gradePay: rawCase.startingPay?.gradePay ?? rawCase.openingPayState?.gradePay ?? startingPay.gradePay,
    effectiveFrom: rawCase.startingPay?.effectiveFrom ?? rawCase.openingPayState?.effectiveFrom ?? '',
    dni: rawCase.startingPay?.dni ?? rawCase.openingPayState?.dni ?? '',
  }

  caseData.applicableAllowances = {
    ...DEFAULT_ALLOWANCES,
    ...(rawCase.applicableAllowances ?? {}),
  }

  caseData.careerChangeReview = {
    annualIncrementTreatment: rawCase.careerChangeReview?.annualIncrementTreatment ?? '',
    otherChanges: Array.isArray(rawCase.careerChangeReview?.otherChanges)
      ? rawCase.careerChangeReview.otherChanges
      : [],
  }

  caseData.serviceEvents = Array.isArray(rawCase.serviceEvents)
    ? rawCase.serviceEvents.map((event) => createServiceEvent(event))
    : []
  caseData.locationHistory = Array.isArray(rawCase.locationHistory) ? rawCase.locationHistory : []
  caseData.allowanceEligibilityHistory = Array.isArray(rawCase.allowanceEligibilityHistory)
    ? rawCase.allowanceEligibilityHistory
    : []
  caseData.customAllowances = Array.isArray(rawCase.customAllowances)
    ? rawCase.customAllowances.map((definition) => createCustomAllowanceDefinition(definition))
    : []
  caseData.futureEventTimeline = Array.isArray(rawCase.futureEventTimeline)
    ? rawCase.futureEventTimeline
    : []
  caseData.drawnPayHistory = normalizeDrawnPayHistory(
    rawCase.drawnPayHistory ?? rawCase.futureDrawnPayData ?? [],
  )
  caseData.prorationConfig = createEmptyProrationConfig(rawCase.prorationConfig ?? {})
  delete caseData.futureDrawnPayData
  caseData.assumptions = Array.isArray(rawCase.assumptions) ? rawCase.assumptions : []
  caseData.unresolvedIssues = Array.isArray(rawCase.unresolvedIssues)
    ? rawCase.unresolvedIssues
    : []

  return caseData
}
