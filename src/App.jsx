import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppErrorBoundary from './components/AppErrorBoundary'
import AppShell from './components/AppShell'
import DashboardPage from './pages/DashboardPage'

const CaseWorkspacePage = lazy(() => import('./features/cases/pages/CaseWorkspacePage'))
const SavedCasesPage = lazy(() => import('./pages/SavedCasesPage'))

function RouteLoading() {
  return <div className="route-loading" role="status">Loading your calculation…</div>
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppErrorBoundary>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/new-calculation" element={<Navigate to="/?new=1" replace />} />
              <Route path="/saved-cases" element={<SavedCasesPage />} />
              <Route path="/case/:caseId" element={<CaseWorkspacePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </BrowserRouter>
  )
}

export default App
