const paths = {
  calculator: <><rect x="4" y="2.5" width="16" height="19" rx="3" /><path d="M7.5 6.5h9M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4" /></>,
  history: <><path d="M4 12a8 8 0 1 0 2.3-5.65L4 8.5" /><path d="M4 4v4.5h4.5M12 7.5V12l3 2" /></>,
  shield: <><path d="M12 2.5 20 6v5.5c0 5.2-3.4 8.7-8 10-4.6-1.3-8-4.8-8-10V6l8-3.5Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  wallet: <><path d="M4 6.5h14a2 2 0 0 1 2 2v10H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12v3.5" /><path d="M15 11h5v4h-5a2 2 0 0 1 0-4Z" /></>,
  umbrella: <><path d="M3 11a9 9 0 0 1 18 0c-2.2-1.6-4.2-1.6-6 0-2-1.6-4-1.6-6 0-2-1.6-4-1.6-6 0ZM12 2v16.5a2.5 2.5 0 0 0 5 0" /></>,
  document: <><path d="M6 2.5h8l4 4V21H6a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2Z" /><path d="M14 2.5v5h4M8 12h6M8 16h6" /></>,
  arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  install: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M12 6v9M8.5 11.5 12 15l3.5-3.5M8 18h8" /></>,
}

export default function ProductIcon({ name, size = 20, className = '' }) {
  return <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
