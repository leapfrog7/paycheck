import { useState } from 'react'
import { SEVENTH_CPC_LEVELS } from '../../../data/pay/7cpcPayMatrix'
import {
  SIXTH_CPC_PAY_BAND_OPTIONS,
  compareSixthCpcFinancialStructures,
  getGradePaysForSixthCpcPayBand,
} from '../../../data/pay/6cpcPayBands'
import { EVENT_STATUS } from '../../../domain/events/eventStatus'
import { EVENT_TYPES } from '../../../domain/events/eventTypes'
import { FIXATION_OPTIONS, FIXATION_OPTION_LABELS } from '../../../domain/events/fixationOptions'
import { comparePayMatrixLevels } from '../../../domain/pay/payMatrix'
import { createServiceEvent } from '../models/payCase'

const MACP_FIXATION_OPTIONS = [
  FIXATION_OPTIONS.FROM_EVENT_DATE,
  FIXATION_OPTIONS.FROM_LOWER_POST_DNI,
]

export default function MacpForm({ payState, onAdd }) {
  const [effectiveDate, setEffectiveDate] = useState('')
  const [macpNumber, setMacpNumber] = useState('')
  const [targetPayBand, setTargetPayBand] = useState('')
  const [targetGradePay, setTargetGradePay] = useState('')
  const [targetLevel, setTargetLevel] = useState('')
  const [fixationOption, setFixationOption] = useState(FIXATION_OPTIONS.FROM_EVENT_DATE)
  const [error, setError] = useState('')
  const is6Cpc = Number(payState.cpc) === 6
  const targetGradePays = getGradePaysForSixthCpcPayBand(targetPayBand).filter(
    (gradePay) => compareSixthCpcFinancialStructures(
      { payBand: targetPayBand, gradePay },
      { payBand: payState.payBand, gradePay: payState.gradePay },
    ) > 0,
  )
  const higherLevels = SEVENTH_CPC_LEVELS.filter(
    ({ level }) => comparePayMatrixLevels(level, payState.level) > 0,
  )

  function handleSubmit(event) {
    event.preventDefault()

    const targetMissing = is6Cpc ? !targetPayBand || !targetGradePay : !targetLevel
    if (!effectiveDate || targetMissing) {
      setError(is6Cpc
        ? 'Effective date, target Pay Band, and target Grade Pay are required.'
        : 'Effective date and target Level are required.')
      return
    }

    onAdd(createServiceEvent({
      type: EVENT_TYPES.MACP,
      title: macpNumber ? `MACP ${macpNumber}` : 'MACP',
      eventDate: effectiveDate,
      effectiveDate,
      effectiveFrom: effectiveDate,
      status: EVENT_STATUS.CONFIRMED,
      ruleId: is6Cpc ? '6CPC_MACP_FIXATION' : '7CPC_MACP_FIXATION',
      macpNumber: macpNumber ? Number(macpNumber) : null,
      ...(is6Cpc
        ? { targetPayBand, targetGradePay: Number(targetGradePay) }
        : { targetLevel }),
      fixationOption,
      reachedBy: 'MACP',
    }))
    setEffectiveDate('')
    setMacpNumber('')
    setTargetPayBand('')
    setTargetGradePay('')
    setTargetLevel('')
    setFixationOption(FIXATION_OPTIONS.FROM_EVENT_DATE)
    setError('')
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Add event</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">{is6Cpc ? '6th' : '7th'} CPC MACP</h2>
        <p className="mt-1 text-sm text-slate-600">
          {is6Cpc
            ? `Current structure: ${payState.payBand} + GP ₹${Number(payState.gradePay).toLocaleString('en-IN')}`
            : `Current Level: ${payState.level}`}
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <label htmlFor="macp-effective-date" className="mb-1 block text-sm font-medium text-slate-700">Effective date</label>
          <input id="macp-effective-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </div>

        <div>
          <label htmlFor="macp-number" className="mb-1 block text-sm font-medium text-slate-700">MACP number (optional)</label>
          <select id="macp-number" value={macpNumber} onChange={(event) => setMacpNumber(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            <option value="">Not recorded</option>
            <option value="1">MACP 1</option>
            <option value="2">MACP 2</option>
            <option value="3">MACP 3</option>
          </select>
        </div>

        {is6Cpc ? (
          <>
            <div>
              <label htmlFor="macp-target-pay-band" className="mb-1 block text-sm font-medium text-slate-700">Target Pay Band</label>
              <select
                id="macp-target-pay-band"
                value={targetPayBand}
                onChange={(event) => {
                  setTargetPayBand(event.target.value)
                  setTargetGradePay('')
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select Pay Band</option>
                {SIXTH_CPC_PAY_BAND_OPTIONS.map((band) => <option key={band.code} value={band.code}>{band.label}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="macp-target-grade-pay" className="mb-1 block text-sm font-medium text-slate-700">Target Grade Pay</label>
              <select id="macp-target-grade-pay" value={targetGradePay} onChange={(event) => setTargetGradePay(event.target.value)} disabled={!targetPayBand} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="">Select higher Grade Pay</option>
                {targetGradePays.map((gradePay) => <option key={gradePay} value={gradePay}>₹{gradePay.toLocaleString('en-IN')}</option>)}
              </select>
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="macp-target-level" className="mb-1 block text-sm font-medium text-slate-700">Target Level</label>
            <select id="macp-target-level" value={targetLevel} onChange={(event) => setTargetLevel(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="">Select higher Level</option>
              {higherLevels.map(({ level }) => <option key={level} value={level}>Level {level}</option>)}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="macp-fixation-option" className="mb-1 block text-sm font-medium text-slate-700">Fixation option</label>
          <select id="macp-fixation-option" value={fixationOption} onChange={(event) => setFixationOption(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            {MACP_FIXATION_OPTIONS.map((option) => (
              <option key={option} value={option}>{FIXATION_OPTION_LABELS[option]}{option === FIXATION_OPTIONS.FROM_LOWER_POST_DNI ? ' — not yet calculated' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600" role="alert">{error}</p> : null}

      <div className="mt-4 flex justify-end">
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Add MACP event</button>
      </div>
    </form>
  )
}
