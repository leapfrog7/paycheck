import { Link } from 'react-router-dom'

export default function BrandLogo() {
  return (
    <Link to="/" className="brand-logo" aria-label="PayCheck home">
      <svg className="brand-logo__mark" viewBox="0 0 44 44" aria-hidden="true">
        <rect width="44" height="44" rx="13" fill="currentColor" />
        <path d="M14 12h17M14 17h17M18 12c6.8 0 7 10 0 10h-4l13 12" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m25.5 26.5 2.4 2.4 5-5.3" fill="none" stroke="#bfdbfe" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span><strong>PayCheck</strong><small>Pay, pension &amp; benefits tools</small></span>
    </Link>
  )
}
