import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'

export default function SiteFooter() {
  return <footer className="site-footer"><div className="site-footer__inner"><div><BrandLogo /><p>Deterministic, traceable tools for Central Government pay and benefits.</p></div><nav aria-label="Footer navigation"><div><strong>Calculate</strong><Link to="/?new=1">Pay &amp; Arrears</Link><Link to="/#calculators">All calculators</Link></div><div><strong>Your work</strong><Link to="/#my-calculations">My calculations</Link><Link to="/saved-cases">Saved cases</Link></div><div><strong>Understand</strong><Link to="/#how-it-works">How it works</Link><Link to="/#trust">Methodology &amp; privacy</Link></div></nav></div><div className="site-footer__bottom"><span>PayCheck calculations are based on structured rules and your entered information.</span><span>Results should be verified against official service records.</span></div></footer>
}
