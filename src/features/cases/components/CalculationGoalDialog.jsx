import { useEffect, useRef } from 'react'
import ProductIcon from '../../../components/ProductIcon'
import { CALCULATION_GOALS } from '../../../data/calculationGoals'

export default function CalculationGoalDialog({ onChoose, onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const opener = document.activeElement
    dialogRef.current?.focus()
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const focusable = [...dialogRef.current.querySelectorAll('button')]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      if (opener?.isConnected) opener.focus()
    }
  }, [onClose])

  return (
    <div className="setup-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="goal-dialog-title" className="goal-dialog">
        <header className="goal-dialog__header">
          <div><p>Start with your question</p><h2 id="goal-dialog-title">What do you want to know?</h2><span>Choose the outcome that matters today. We’ll guide you through only the information it needs.</span></div>
          <button type="button" onClick={onClose} aria-label="Close goal selection">×</button>
        </header>
        <div className="goal-grid">
          {CALCULATION_GOALS.map((goal) => (
            <button type="button" key={goal.id} className={goal.recommended ? 'goal-card goal-card--recommended' : 'goal-card'} onClick={() => onChoose(goal.id)}>
              <span className="goal-card__icon"><ProductIcon name={goal.icon} size={22} /></span>
              {goal.recommended ? <span className="goal-card__badge">Most common</span> : null}
              <strong>{goal.title}</strong><small>{goal.description}</small>
              <span className="goal-card__reassurance"><ProductIcon name="check" size={14} />{goal.reassurance}</span>
              <span className="goal-card__action">Choose this <ProductIcon name="arrow" size={16} /></span>
            </button>
          ))}
        </div>
        <footer className="goal-dialog__footer"><ProductIcon name="lock" size={15} /> Your work is saved privately in this browser as you continue.</footer>
      </section>
    </div>
  )
}
