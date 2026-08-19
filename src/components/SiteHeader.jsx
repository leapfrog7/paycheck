import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import ProductIcon from './ProductIcon'
import { CALCULATOR_CATALOG } from '../data/calculatorCatalog'
import InstallAppButton from './InstallAppButton'

export default function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const home = location.pathname === '/'
  const close = () => setMobileOpen(false)
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <BrandLogo />
        <nav className="desktop-nav" aria-label="Primary navigation">
          <details className="calculator-nav">
            <summary>Calculators <span aria-hidden="true">⌄</span></summary>
            <div className="calculator-nav__menu">
              <p>Government service calculators</p>
              {CALCULATOR_CATALOG.map((item) => <Link key={item.id} to={item.status === 'AVAILABLE' ? '/?new=1' : `/#calculators`}><ProductIcon name={item.icon} /><span><strong>{item.title}</strong><small>{item.status === 'COMING_SOON' ? 'Coming soon' : item.status === 'INCLUDED' ? 'Included with Pay & Arrears' : 'Available now'}</small></span></Link>)}
            </div>
          </details>
          <Link className={home ? 'active' : ''} to="/#my-calculations">My Calculations</Link>
          <Link to="/#how-it-works">How it works</Link>
          <Link to="/#trust">Methodology</Link>
        </nav>
        <div className="site-header__actions">
          <InstallAppButton className="header-install" />
          <Link className="header-cta" to="/?new=1"><span aria-hidden="true">＋</span> New Calculation</Link>
          <button type="button" className="mobile-menu-button" aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}><ProductIcon name={mobileOpen ? 'close' : 'menu'} /></button>
        </div>
      </div>
      {mobileOpen ? <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation"><p>Explore PayCheck</p><Link to="/#calculators" onClick={close}>All calculators <ProductIcon name="arrow" /></Link><Link to="/#my-calculations" onClick={close}>My calculations <ProductIcon name="arrow" /></Link><Link to="/#how-it-works" onClick={close}>How it works <ProductIcon name="arrow" /></Link><Link to="/#trust" onClick={close}>Methodology &amp; privacy <ProductIcon name="arrow" /></Link><InstallAppButton className="mobile-nav__install" /><Link className="mobile-nav__cta" to="/?new=1" onClick={close}>Start a Pay Calculation</Link></nav> : null}
    </header>
  )
}
