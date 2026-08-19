import { useState } from 'react'
import { ALLOWANCE_CALCULATION_TYPES, ALLOWANCE_DEFINITION_STATUSES } from '../../../domain/allowances/allowanceConstants'
import { createCustomAllowanceDefinition, validateCustomAllowanceDefinitions } from '../../../domain/allowances/customAllowance'

const METHOD_OPTIONS = [
  { value: ALLOWANCE_CALCULATION_TYPES.FIXED_MONTHLY, label: 'Fixed monthly amount', input: 'amount' },
  { value: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC, label: '% of Basic Pay', input: 'rate' },
  { value: ALLOWANCE_CALCULATION_TYPES.PERCENTAGE_OF_BASIC_PLUS_DA, label: '% of Basic Pay + DA', input: 'rate' },
  { value: ALLOWANCE_CALCULATION_TYPES.MANUAL_MONTHLY_AMOUNT, label: 'Manual monthly amount', input: 'amount' },
]

const EMPTY_FORM = Object.freeze({
  id: '', seriesId: '', name: '', calculationType: ALLOWANCE_CALCULATION_TYPES.FIXED_MONTHLY,
  amount: '', rate: '', effectiveFrom: '', effectiveTo: '', description: '', note: '', reference: '', status: ALLOWANCE_DEFINITION_STATUSES.ACTIVE,
})

function methodLabel(value) {
  return METHOD_OPTIONS.find((option) => option.value === value)?.label ?? 'Custom method'
}

function formFromDefinition(definition) {
  return {
    id: definition.id, seriesId: definition.seriesId, name: definition.name,
    calculationType: definition.calculationType,
    amount: definition.amount ?? '', rate: definition.rate ?? '',
    effectiveFrom: definition.effectiveFrom, effectiveTo: definition.effectiveTo ?? '',
    description: definition.metadata?.description ?? '', note: definition.metadata?.note ?? '',
    reference: definition.metadata?.reference ?? '',
    status: definition.status,
  }
}

function displayValue(definition) {
  return [ALLOWANCE_CALCULATION_TYPES.FIXED_MONTHLY, ALLOWANCE_CALCULATION_TYPES.MANUAL_MONTHLY_AMOUNT].includes(definition.calculationType)
    ? `₹${Number(definition.amount).toLocaleString('en-IN')}`
    : `${Number(definition.rate).toLocaleString('en-IN')}%`
}

export default function CustomAllowancesSection({ definitions = [], onChange }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [error, setError] = useState('')
  const method = METHOD_OPTIONS.find((option) => option.value === form.calculationType)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function openNew() {
    setForm(EMPTY_FORM)
    setError('')
    setIsFormOpen(true)
  }

  function openEdit(definition) {
    setForm(formFromDefinition(definition))
    setError('')
    setIsFormOpen(true)
  }

  function openVersion(definition) {
    setForm({ ...formFromDefinition(definition), id: '', effectiveFrom: '', effectiveTo: '', status: ALLOWANCE_DEFINITION_STATUSES.ACTIVE })
    setError('End the prior version before adding a new version in the same series.')
    setIsFormOpen(true)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const definitionId = form.id || crypto.randomUUID()
    const seriesId = form.seriesId || definitionId
    const candidate = createCustomAllowanceDefinition({
      id: definitionId, seriesId, name: form.name.trim(), calculationType: form.calculationType,
      amount: method.input === 'amount' ? Number(form.amount) : null,
      rate: method.input === 'rate' ? Number(form.rate) : null,
      effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || null,
      status: form.status,
      metadata: { description: form.description.trim(), note: form.note.trim(), reference: form.reference.trim() },
    })
    const next = form.id
      ? definitions.map((item) => item.id === form.id ? candidate : item)
      : [...definitions, candidate]
    const validation = validateCustomAllowanceDefinitions(next)
    if (!validation.valid) {
      const firstError = validation.errors[0]
      setError(firstError.code === 'CUSTOM_ALLOWANCE_DATE_RANGE_OVERLAP'
        ? 'This version overlaps another version of the same allowance. Adjust the effective dates.'
        : `Please correct ${firstError.field ?? 'the allowance details'}.`)
      return
    }
    onChange(next)
    setForm(EMPTY_FORM)
    setError('')
    setIsFormOpen(false)
  }

  function deactivate(definition) {
    onChange(definitions.map((item) => item.id === definition.id
      ? { ...item, status: ALLOWANCE_DEFINITION_STATUSES.INACTIVE }
      : item))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Custom Allowances</h2>
          <p className="mt-1 text-sm text-slate-600">User-defined amounts only. These are not verified Government entitlements.</p>
        </div>
        <button type="button" onClick={openNew} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          Add allowance
        </button>
      </div>

      {definitions.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {definitions.map((definition) => (
            <article key={definition.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{definition.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{methodLabel(definition.calculationType)} · {displayValue(definition)}</p>
                  <p className="mt-1 text-xs text-slate-500">{definition.effectiveFrom} to {definition.effectiveTo ?? 'ongoing'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${definition.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{definition.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>
              </div>
              {definition.metadata?.reference ? <p className="mt-3 text-xs text-slate-600">User reference: {definition.metadata.reference}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => openEdit(definition)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white">Edit</button>
                <button type="button" onClick={() => openVersion(definition)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white">Add new version</button>
                {definition.status === 'ACTIVE' ? <button type="button" onClick={() => deactivate(definition)} className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50">Deactivate</button> : null}
              </div>
            </article>
          ))}
        </div>
      ) : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No custom allowances recorded.</p>}

      {isFormOpen ? (
        <form onSubmit={handleSubmit} className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="custom-allowance-name" className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input id="custom-allowance-name" value={form.name} onChange={(event) => updateField('name', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" required />
            </div>
            <div>
              <label htmlFor="custom-allowance-method" className="mb-1 block text-sm font-medium text-slate-700">Calculation method</label>
              <select id="custom-allowance-method" value={form.calculationType} onChange={(event) => updateField('calculationType', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                {METHOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="custom-allowance-value" className="mb-1 block text-sm font-medium text-slate-700">{method.input === 'amount' ? 'Monthly amount' : 'Rate (%)'}</label>
              <input id="custom-allowance-value" type="number" min="0" step="0.01" value={method.input === 'amount' ? form.amount : form.rate} onChange={(event) => updateField(method.input, event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label htmlFor="custom-effective-from" className="mb-1 block text-sm font-medium text-slate-700">Effective from</label><input id="custom-effective-from" type="date" value={form.effectiveFrom} onChange={(event) => updateField('effectiveFrom', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" required /></div>
              <div><label htmlFor="custom-effective-to" className="mb-1 block text-sm font-medium text-slate-700">Effective to <span className="font-normal text-slate-500">(optional)</span></label><input id="custom-effective-to" type="date" value={form.effectiveTo} onChange={(event) => updateField('effectiveTo', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
            </div>
            <div><label htmlFor="custom-description" className="mb-1 block text-sm font-medium text-slate-700">Description or note <span className="font-normal text-slate-500">(optional)</span></label><textarea id="custom-description" value={form.description} onChange={(event) => updateField('description', event.target.value)} rows="2" className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
            <div><label htmlFor="custom-reference" className="mb-1 block text-sm font-medium text-slate-700">User reference <span className="font-normal text-slate-500">(optional)</span></label><input id="custom-reference" value={form.reference} onChange={(event) => updateField('reference', event.target.value)} placeholder="For example, Office Order dated 14.07.2023" className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>
          </div>
          {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Save allowance</button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
