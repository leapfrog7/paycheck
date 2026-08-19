import { useNavigate } from 'react-router-dom'
import CaseForm from '../features/cases/components/CaseForm'
import { createCase } from '../storage/caseStorage'

export default function NewCalculationPage() {
  const navigate = useNavigate()

  function handleCreateCase(formData) {
    const savedCase = createCase({
      ...formData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    navigate(`/case/${savedCase.id}`)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          New Calculation
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Create a Pay Case</h1>
      </section>

      <CaseForm onSubmit={handleCreateCase} submitLabel="Save Case" />
    </div>
  )
}
