import { EVENT_STATUS } from '../../../domain/events/eventStatus'
import { EVENT_TYPES } from '../../../domain/events/eventTypes'
import { createServiceEvent } from '../models/payCase'

export default function FifthToSixthCpcTransitionForm({ onAdd }) {
  function addTransition() {
    onAdd(createServiceEvent({
      type: EVENT_TYPES.CPC_TRANSITION,
      title: '6th CPC Transition',
      status: EVENT_STATUS.CONFIRMED,
      eventDate: '2006-01-01',
      effectiveFrom: '2006-01-01',
      employeeSwitchDate: '2006-01-01',
      statutoryEffectiveDate: '2006-01-01',
      fromCpc: 5,
      toCpc: 6,
      ruleId: '5CPC_TO_6CPC_RULE7',
      note: 'Normal switch on 01 Jan 2006. Bunching and post-transition DNI remain unresolved in this phase.',
    }))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">6th CPC Transition</h2>
      <p className="mt-1 text-sm text-slate-600">Add the ordinary replacement-scale transition under the CCS (Revised Pay) Rules, 2008.</p>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="font-medium text-slate-900">Normal switch on 01 Jan 2006</p>
        <p className="mt-1 text-sm text-slate-600">Delayed options, upgraded or merged structures, and bunching are not calculated.</p>
        <button type="button" onClick={addTransition} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          Add 6th CPC Transition
        </button>
      </div>
    </section>
  )
}
