import { Link } from 'react-router-dom'
import { getCases } from '../storage/caseStorage'

export default function SavedCasesPage() {
  const cases = getCases()

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Saved Cases
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Previously created pay cases</h1>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {cases.length === 0 ? (
          <p className="text-slate-600">No saved cases yet. Create a new calculation to get started.</p>
        ) : (
          <div className="space-y-3">
            {cases.map((caseItem) => (
              <Link
                key={caseItem.id}
                to={`/case/${caseItem.id}`}
                className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{caseItem.caseName}</p>
                    <p className="text-sm text-slate-500">
                      {caseItem.employeeName || 'Employee not provided'}
                    </p>
                  </div>
                  <div className="text-sm text-slate-500">
                    {caseItem.payCommission} • {caseItem.calculationStartDate || '—'} to {caseItem.calculationEndDate || '—'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
