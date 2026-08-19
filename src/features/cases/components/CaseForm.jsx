import { useMemo, useState } from 'react'
import { SEVENTH_CPC_LEVELS } from '../../../data/pay/7cpcPayMatrix'
import {
  SIXTH_CPC_PAY_BAND_OPTIONS,
  getGradePaysForSixthCpcPayBand,
} from '../../../data/pay/6cpcPayBands'
import { getCell, getCellsForLevel } from '../../../domain/pay/payMatrix'
import { validate6CpcPayState, validate7CpcPayState } from '../../../domain/pay/payStateValidation'
import { PAY_COMMISSION_OPTIONS, createEmptyPayCase } from '../models/payCase'
import { FIFTH_CPC_PAY_SCALES, getFifthCpcScale, getFifthCpcStages } from '../../../data/pay/5cpcPayScales'
import { validate5CpcPayState } from '../../../domain/pay/payStateValidation'

const initialFormState = createEmptyPayCase()

function isValidDate(dateValue) {
  return Boolean(dateValue) && !Number.isNaN(new Date(dateValue).getTime())
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

export default function CaseForm({ onSubmit, submitLabel = 'Create Case' }) {
  const [formData, setFormData] = useState(initialFormState)
  const [errors, setErrors] = useState({})
  const [fifthCpcScaleSearch, setFifthCpcScaleSearch] = useState('')

  const allowanceOptions = useMemo(
    () => [
      { key: 'da', label: 'DA' },
      { key: 'hra', label: 'HRA' },
      { key: 'transportAllowance', label: 'Transport Allowance' },
    ],
    [],
  )

  const is7Cpc = formData.payCommission === '7th CPC'
  const is6Cpc = formData.payCommission === '6th CPC'
  const is5Cpc = formData.payCommission === '5th CPC'
  const selectedFifthCpcScale = is5Cpc ? getFifthCpcScale(formData.startingPay.payScaleId) : null
  const selectedFifthCpcStages = selectedFifthCpcScale ? getFifthCpcStages(selectedFifthCpcScale.id) : []
  const visibleFifthCpcScales = FIFTH_CPC_PAY_SCALES.filter((scale) => {
    const matches = `${scale.standardScaleCode} ${scale.monetaryScale} ${scale.label}`
      .toLowerCase().includes(fifthCpcScaleSearch.trim().toLowerCase())
    return matches || scale.id === formData.startingPay.payScaleId
  })
  const selectedLevelCells = is7Cpc ? getCellsForLevel(formData.startingPay.payLevel) : []
  const selectedCell = is7Cpc
    ? getCell(formData.startingPay.payLevel, Number(formData.startingPay.cellIndex))
    : null
  const selectedGradePays = is6Cpc
    ? getGradePaysForSixthCpcPayBand(formData.startingPay.payBand)
    : []
  const derived6CpcBasicPay = is6Cpc && Number(formData.startingPay.payInBand) > 0 && Number(formData.startingPay.gradePay) > 0
    ? Number(formData.startingPay.payInBand) + Number(formData.startingPay.gradePay)
    : null

  function updateField(field, value) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updatePayCommission(value) {
    setFormData((current) => ({
      ...current,
      payCommission: value,
      startingPay: {
        ...createEmptyPayCase().startingPay,
      },
    }))
    setErrors({})
    setFifthCpcScaleSearch('')
  }

  function updateStartingPayField(field, value) {
    setFormData((current) => {
      const nextState = {
        ...current,
        startingPay: {
          ...current.startingPay,
          [field]: value,
        },
      }

      if (field === 'payLevel' && current.payCommission === '7th CPC') {
        const firstCell = getCellsForLevel(value)[0]
        nextState.startingPay = {
          ...nextState.startingPay,
          payLevel: value,
          cellIndex: firstCell ? firstCell.index : '',
          basicPay: firstCell ? firstCell.value : '',
        }
      }

      if (field === 'cellIndex' && current.payCommission === '7th CPC') {
        const nextCell = getCell(value || current.startingPay.payLevel, Number(value))
        nextState.startingPay = {
          ...nextState.startingPay,
          cellIndex: value,
          basicPay: nextCell ? nextCell.value : '',
        }
      }

      if (field === 'payScaleId' && current.payCommission === '5th CPC') {
        const scale = getFifthCpcScale(value)
        const firstStage = scale?.stages[0]
        nextState.startingPay = {
          ...nextState.startingPay,
          payScaleId: value,
          payScaleLabel: scale?.label ?? '',
          stageIndex: firstStage?.index ?? '',
          basicPay: firstStage?.value ?? '',
        }
      }

      if (field === 'stageIndex' && current.payCommission === '5th CPC') {
        const stage = getFifthCpcStages(current.startingPay.payScaleId)
          .find((item) => item.index === Number(value))
        nextState.startingPay = {
          ...nextState.startingPay,
          stageIndex: value,
          basicPay: stage?.value ?? '',
        }
      }


      if (field === 'payBand' && current.payCommission === '6th CPC') {
        nextState.startingPay = {
          ...nextState.startingPay,
          gradePay: '',
          basicPay: '',
        }
      }

      if (current.payCommission === '6th CPC' && (field === 'payInBand' || field === 'gradePay')) {
        const payInBand = Number(nextState.startingPay.payInBand)
        const gradePay = Number(nextState.startingPay.gradePay)
        nextState.startingPay.basicPay = payInBand > 0 && gradePay > 0
          ? payInBand + gradePay
          : ''
      }

      return nextState
    })
  }

  function toggleAllowance(optionKey) {
    setFormData((current) => ({
      ...current,
      applicableAllowances: {
        ...current.applicableAllowances,
        [optionKey]: !current.applicableAllowances[optionKey],
      },
    }))
  }

  function validate() {
    const nextErrors = {}

    if (!formData.caseName?.trim()) {
      nextErrors.caseName = 'Case title is required.'
    }

    if (!isValidDate(formData.calculationStartDate)) {
      nextErrors.calculationStartDate = 'Calculation start date is required.'
    }

    if (!isValidDate(formData.calculationEndDate)) {
      nextErrors.calculationEndDate = 'Calculation end date is required.'
    }

    if (
      isValidDate(formData.calculationStartDate) &&
      isValidDate(formData.calculationEndDate) &&
      new Date(formData.calculationEndDate) < new Date(formData.calculationStartDate)
    ) {
      nextErrors.calculationEndDate = 'End date must not precede start date.'
    }

    if (!is5Cpc && !is6Cpc && !formData.startingPay?.payLevel) {
      nextErrors.payLevel = 'Pay level is required.'
    }

    if (formData.payCommission === '7th CPC') {
      const validationResult = validate7CpcPayState({
        cpc: 7,
        level: formData.startingPay?.payLevel,
        cellIndex: formData.startingPay?.cellIndex,
        basicPay: formData.startingPay?.basicPay,
      })

      if (!validationResult.valid) {
        nextErrors.payLevel = validationResult.errors[0]
        nextErrors.basicPay = validationResult.errors[0]
      }
    } else if (is6Cpc) {
      const validationResult = validate6CpcPayState({
        cpc: 6,
        payBand: formData.startingPay.payBand,
        payInBand: formData.startingPay.payInBand,
        gradePay: formData.startingPay.gradePay,
        basicPay: formData.startingPay.basicPay,
        dni: formData.startingPay.dni,
      })

      validationResult.errors.forEach((error) => {
        nextErrors[error.field] ??= error.message
      })
    } else if (is5Cpc) {
      const validationResult = validate5CpcPayState({ cpc: 5, ...formData.startingPay })
      validationResult.errors.forEach((error) => { nextErrors[error.field] ??= error.message })
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!validate()) {
      return
    }

    const numericStartingPay = is6Cpc
      ? {
          ...formData.startingPay,
          payInBand: Number(formData.startingPay.payInBand),
          gradePay: Number(formData.startingPay.gradePay),
          basicPay: derived6CpcBasicPay,
        }
      : is5Cpc ? {
          ...formData.startingPay,
          stageIndex: Number(formData.startingPay.stageIndex),
          basicPay: Number(formData.startingPay.basicPay),
        } : {
          ...formData.startingPay,
          basicPay: Number(formData.startingPay.basicPay),
        }
    const openingPayState = is6Cpc
      ? {
          cpc: 6,
          effectiveFrom: formData.startingPay.effectiveFrom || '',
          payBand: formData.startingPay.payBand,
          payInBand: Number(formData.startingPay.payInBand),
          gradePay: Number(formData.startingPay.gradePay),
          basicPay: derived6CpcBasicPay,
          dni: formData.startingPay.dni,
        }
      : is5Cpc ? {
          cpc: 5,
          effectiveFrom: formData.startingPay.effectiveFrom || '',
          payScaleId: formData.startingPay.payScaleId,
          payScaleLabel: formData.startingPay.payScaleLabel,
          stageIndex: Number(formData.startingPay.stageIndex),
          basicPay: Number(formData.startingPay.basicPay),
          dni: formData.startingPay.dni,
        } : {
          cpc: 7,
          level: formData.startingPay.payLevel,
          cellIndex: formData.startingPay.cellIndex,
          basicPay: Number(formData.startingPay.basicPay),
          dni: formData.startingPay.dni || '',
        }

    const payload = {
      ...formData,
      caseName: formData.caseName.trim(),
      employeeName: formData.employeeName.trim(),
      startingPay: numericStartingPay,
      openingPayState,
      applicableAllowances: {
        basicPay: true,
        ...formData.applicableAllowances,
      },
    }

    onSubmit(payload)
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Case details</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Case title</label>
            <input
              value={formData.caseName}
              onChange={(event) => updateField('caseName', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="e.g. Junior Assistant Pay Case"
            />
            {errors.caseName && <p className="mt-1 text-sm text-red-600">{errors.caseName}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Employee name (optional)</label>
            <input
              value={formData.employeeName}
              onChange={(event) => updateField('employeeName', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Employee name"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pay commission</label>
            <select
              value={formData.payCommission}
              onChange={(event) => updatePayCommission(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {PAY_COMMISSION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Calculation period</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Calculation start date</label>
            <input
              type="date"
              value={formData.calculationStartDate}
              onChange={(event) => updateField('calculationStartDate', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {errors.calculationStartDate && (
              <p className="mt-1 text-sm text-red-600">{errors.calculationStartDate}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Calculation end date</label>
            <input
              type="date"
              value={formData.calculationEndDate}
              onChange={(event) => updateField('calculationEndDate', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {errors.calculationEndDate && (
              <p className="mt-1 text-sm text-red-600">{errors.calculationEndDate}</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Starting pay</h2>
        {is5Cpc ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Pay Scale</label>
              <input type="search" value={fifthCpcScaleSearch} onChange={(event) => setFifthCpcScaleSearch(event.target.value)} placeholder="Search S-12, 6500 or 10500" className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              <select value={formData.startingPay.payScaleId} onChange={(event) => updateStartingPayField('payScaleId', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="">Select verified pay scale</option>
                {visibleFifthCpcScales.map((scale) => <option key={scale.id} value={scale.id}>{scale.label}</option>)}
              </select>
              {errors.payScaleId && <p className="mt-1 text-sm text-red-600">{errors.payScaleId}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Basic Pay stage</label>
              <select value={formData.startingPay.stageIndex} onChange={(event) => updateStartingPayField('stageIndex', event.target.value)} disabled={!selectedFifthCpcStages.length} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="">Select valid stage</option>
                {selectedFifthCpcStages.map((stage) => <option key={stage.index} value={stage.index}>{formatCurrency(stage.value)}</option>)}
              </select>
              {(errors.stageIndex || errors.basicPay) && <p className="mt-1 text-sm text-red-600">{errors.stageIndex ?? errors.basicPay}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date of Next Increment</label>
              <input type="date" value={formData.startingPay.dni} onChange={(event) => updateStartingPayField('dni', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              {errors.dni && <p className="mt-1 text-sm text-red-600">{errors.dni}</p>}
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Selected Basic Pay</span>
              <output className="block rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-base font-semibold text-slate-900">{formData.startingPay.basicPay === '' ? 'Select a prescribed stage' : formatCurrency(formData.startingPay.basicPay)}</output>
            </div>
            <p className="text-xs text-slate-500 md:col-span-2">Only locally verified scale data is listed. Unsupported scales remain unresolved until authoritative data is added.</p>
          </div>
        ) : is7Cpc ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Level</label>
              <select
                value={formData.startingPay.payLevel}
                onChange={(event) => updateStartingPayField('payLevel', event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select level</option>
                {SEVENTH_CPC_LEVELS.map((level) => (
                  <option key={level.level} value={level.level}>
                    Level {level.level}
                  </option>
                ))}
              </select>
              {errors.payLevel && <p className="mt-1 text-sm text-red-600">{errors.payLevel}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cell</label>
              <select
                value={formData.startingPay.cellIndex}
                onChange={(event) => updateStartingPayField('cellIndex', event.target.value)}
                disabled={!selectedLevelCells.length}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">Select cell</option>
                {selectedLevelCells.map((cell) => (
                  <option key={cell.index} value={cell.index}>
                    Cell {cell.index} — {formatCurrency(cell.value)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Basic pay</label>
              <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-base font-semibold text-slate-900">
                {selectedCell ? formatCurrency(selectedCell.value) : 'Select a valid Cell'}
              </div>
              {errors.basicPay && <p className="mt-1 text-sm text-red-600">{errors.basicPay}</p>}
            </div>
          </div>
        ) : is6Cpc ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Pay Band</label>
              <select
                value={formData.startingPay.payBand}
                onChange={(event) => updateStartingPayField('payBand', event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select Pay Band</option>
                {SIXTH_CPC_PAY_BAND_OPTIONS.map((payBand) => (
                  <option key={payBand.code} value={payBand.code}>{payBand.label}</option>
                ))}
              </select>
              {errors.payBand && <p className="mt-1 text-sm text-red-600">{errors.payBand}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Grade Pay</label>
              <select
                value={formData.startingPay.gradePay}
                onChange={(event) => updateStartingPayField('gradePay', event.target.value)}
                disabled={!selectedGradePays.length}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">Select Grade Pay</option>
                {selectedGradePays.map((gradePay) => (
                  <option key={gradePay} value={gradePay}>{formatCurrency(gradePay)}</option>
                ))}
              </select>
              {errors.gradePay && <p className="mt-1 text-sm text-red-600">{errors.gradePay}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Pay in Pay Band</label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.startingPay.payInBand}
                onChange={(event) => updateStartingPayField('payInBand', event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="e.g. 13500"
              />
              {errors.payInBand && <p className="mt-1 text-sm text-red-600">{errors.payInBand}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirmed DNI</label>
              <input
                type="date"
                value={formData.startingPay.dni}
                onChange={(event) => updateStartingPayField('dni', event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {errors.dni && <p className="mt-1 text-sm text-red-600">{errors.dni}</p>}
            </div>

            <div className="md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Basic Pay</span>
              <output className="block rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-base font-semibold text-slate-900">
                {derived6CpcBasicPay ? formatCurrency(derived6CpcBasicPay) : 'Select Grade Pay and enter Pay in Pay Band'}
              </output>
              {errors.basicPay && <p className="mt-1 text-sm text-red-600">{errors.basicPay}</p>}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Pay level</label>
              <input
                value={formData.startingPay.payLevel}
                onChange={(event) => updateStartingPayField('payLevel', event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="e.g. 7"
              />
              {errors.payLevel && <p className="mt-1 text-sm text-red-600">{errors.payLevel}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Basic pay</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.startingPay.basicPay}
                onChange={(event) => updateStartingPayField('basicPay', event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="0.00"
              />
              {errors.basicPay && <p className="mt-1 text-sm text-red-600">{errors.basicPay}</p>}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Allowances</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="font-medium text-slate-700">Basic Pay</span>
            <span className="text-sm text-slate-500">Always included</span>
          </div>

          {allowanceOptions.map((option) => (
            <label
              key={option.key}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <span className="font-medium text-slate-700">{option.label}</span>
              <input
                type="checkbox"
                checked={Boolean(formData.applicableAllowances[option.key])}
                onChange={() => toggleAllowance(option.key)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-500"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
