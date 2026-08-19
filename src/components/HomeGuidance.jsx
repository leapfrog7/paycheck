import ProductIcon from './ProductIcon'

const steps = [
  ['1', 'Start small', 'Choose a period and opening pay. That is enough to see the first useful projection.'],
  ['2', 'Build confidence', 'Add increments, promotions, allowances and Drawn Pay only when they apply.'],
  ['3', 'Understand the result', 'Review every monthly difference, assumption and rule behind the total.'],
]

export function HowItWorks() {
  return <section id="how-it-works" className="home-section how-section"><header className="home-section__header"><div><p className="section-kicker">Designed around your question</p><h2>From “Is my pay correct?” to a clear answer</h2><p>No long form up front. PayCheck reveals the right detail as your calculation develops.</p></div></header><div className="how-grid">{steps.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
}

export function TrustSection() {
  return <section id="trust" className="trust-section"><div className="trust-section__intro"><span><ProductIcon name="shield" size={26} /></span><div><p className="section-kicker">Built for confidence</p><h2>Your calculation stays understandable</h2><p>PayCheck uses deterministic calculation engines—not AI guesses—to produce financial results.</p></div></div><div className="trust-points"><div><ProductIcon name="lock" /><span><strong>Private by default</strong>Your cases stay in this browser.</span></div><div><ProductIcon name="history" /><span><strong>Traceable</strong>Inputs, assumptions and rules remain visible.</span></div><div><ProductIcon name="check" /><span><strong>Reproducible</strong>The same inputs produce the same result.</span></div></div></section>
}
