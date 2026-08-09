import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/new-calculation', label: 'New Calculation' },
  { to: '/saved-cases', label: 'Saved Cases' },
]

export default function AppShell() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-sm">
                P
              </div>
              <div>
                <div className="text-xl font-bold tracking-tight text-slate-900">
                  PayCheck
                </div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Central Government Pay &amp; Arrears Calculator
                </div>
              </div>
            </div>

            <div className="border-l border-slate-200 pl-0 md:pl-6">
              <p className="text-sm font-medium text-slate-700">
                Check your pay. Understand the difference.
              </p>
            </div>
          </div>

          <nav aria-label="Main navigation" className="flex flex-wrap gap-2 pb-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
