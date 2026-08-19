import ProductIcon from './ProductIcon'
import { CALCULATOR_CATALOG } from '../data/calculatorCatalog'

export default function CalculatorDirectory({ onStart }) {
  return (
    <section id="calculators" className="home-section calculator-directory" aria-labelledby="calculator-directory-title">
      <header className="home-section__header"><div><p className="section-kicker">Calculator library</p><h2 id="calculator-directory-title">What would you like to understand?</h2><p>Start with the question that matters today. Your saved work remains ready when you return.</p></div><span className="library-count">2 available experiences</span></header>
      <div className="calculator-grid">
        {CALCULATOR_CATALOG.map((item) => (
          <article key={item.id} className={`calculator-card calculator-card--${item.status.toLowerCase()}`}>
            <div className="calculator-card__top"><span className="calculator-card__icon"><ProductIcon name={item.icon} size={23} /></span><span className="calculator-availability">{item.status === 'COMING_SOON' ? 'Coming soon' : item.status === 'INCLUDED' ? 'Included' : 'Available now'}</span></div>
            <h3>{item.title}</h3><p>{item.description}</p>
            {item.status === 'COMING_SOON' ? <span className="calculator-card__future">In the PayCheck roadmap</span> : <button type="button" onClick={onStart}>{item.action}<ProductIcon name="arrow" size={17} /></button>}
          </article>
        ))}
      </div>
    </section>
  )
}
