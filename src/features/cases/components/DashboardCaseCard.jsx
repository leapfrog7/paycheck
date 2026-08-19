import { Link } from 'react-router-dom'
import { buildDueDrawnComparison } from '../../../engines/pay/comparison/buildDueDrawnComparison'
import { buildCaseDuePayLedger } from '../models/buildCaseDuePayLedger'

function currency(value) {
  return `₹${Math.abs(Number(value || 0)).toLocaleString('en-IN')}`
}

function dateLabel(value) {
  if (!value) return 'Not yet saved'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function getCaseResult(caseItem) {
  if (caseItem.lifecycleStatus === 'DRAFT') return { label: 'Draft', value: 'Setup not finished', tone: 'draft' }
  const due = buildCaseDuePayLedger(caseItem)
  if (!due.success) return { label: 'Needs information', value: 'Continue calculation', tone: 'attention' }
  const comparison = buildDueDrawnComparison({ duePayLedger: due, drawnPayHistory: caseItem.drawnPayHistory })
  if (comparison.summary.resolvedMonths) {
    const net = comparison.summary.netDifference
    return { label: net > 0 ? 'Arrear' : net < 0 ? 'Recovery' : 'Reconciled', value: currency(net), tone: net > 0 ? 'arrear' : net < 0 ? 'recovery' : 'calculated' }
  }
  const resolved = due.months.filter((month) => month.status === 'RESOLVED')
  const total = resolved.reduce((sum, month) => sum + Number(month.grossDue || 0), 0)
  return { label: due.status === 'RESOLVED' ? 'Projected Due Pay' : 'Needs information', value: resolved.length ? currency(total) : 'Continue calculation', tone: due.status === 'RESOLVED' ? 'calculated' : 'attention' }
}

export default function DashboardCaseCard({ caseItem, onResumeDraft, onDelete }) {
  const result = getCaseResult(caseItem)
  const isDraft = caseItem.lifecycleStatus === 'DRAFT'
  return (
    <article className="dashboard-case-card">
      <div className="dashboard-case-card__main">
        <div>
          <span className={`case-status case-status--${result.tone}`}>{result.label}</span>
          <h3>{caseItem.caseName || 'Untitled calculation'}</h3>
          <p>{caseItem.calculationStartDate || 'Period not set'} – {caseItem.calculationEndDate || 'Not set'}</p>
        </div>
        <div className={`case-result case-result--${result.tone}`}>
          <span>{result.label}</span><strong>{result.value}</strong>
        </div>
      </div>
      <footer>
        <span>Updated {dateLabel(caseItem.updatedAt)}</span>
        <div className="case-card-actions">
          {isDraft ? <button type="button" className="case-open-link" onClick={() => onResumeDraft(caseItem)}>Continue setup</button> : <Link className="case-open-link" to={`/case/${caseItem.id}`}>Open calculation</Link>}
          <details className="case-menu">
            <summary aria-label={`More actions for ${caseItem.caseName || 'untitled calculation'}`}>•••</summary>
            <div><button type="button" onClick={() => onDelete(caseItem)}>Delete</button></div>
          </details>
        </div>
      </footer>
    </article>
  )
}
