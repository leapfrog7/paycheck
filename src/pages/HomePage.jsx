export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Overview
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          Welcome to PayCheck
        </h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600">
          Review employee pay changes, compare due and drawn amounts, and track arrears and
          recovery scenarios in a clean, auditable workspace.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Current status</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">Ready</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Scope</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">7th CPC</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Focus</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">Audit-ready</p>
        </div>
      </section>
    </div>
  )
}
