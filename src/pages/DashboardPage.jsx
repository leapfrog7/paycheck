import { calculateGrossPay, calculateNetPay } from '../engines/payrollEngine'

export default function DashboardPage() {
  const grossPay = calculateGrossPay({ hourlyRate: 35, hoursWorked: 40 })
  const netPay = calculateNetPay({ grossPay, deductions: 260 })

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Paycheck</p>
            <h1 className="mt-2 text-3xl font-bold">Payroll dashboard</h1>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Gross pay</p>
            <p className="mt-2 text-2xl font-semibold">${grossPay.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Deductions</p>
            <p className="mt-2 text-2xl font-semibold">$260.00</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Net pay</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-400">${netPay.toFixed(2)}</p>
          </div>
        </section>
      </div>
    </main>
  )
}
