import { useEffect, useRef, useState } from 'react'
import ProductIcon from './ProductIcon'
import { useInstallPrompt } from '../pwa/installPromptContext'

function isAppleMobile() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function InstallAppButton({ className = '', onActivate }) {
  const { canPrompt, installed, install } = useInstallPrompt()
  const [showHelp, setShowHelp] = useState(false)
  const dialogRef = useRef(null)
  const openerRef = useRef(null)

  useEffect(() => {
    if (!showHelp) return undefined
    const opener = openerRef.current
    dialogRef.current?.focus()
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShowHelp(false)
      if (event.key !== 'Tab') return
      const focusable = [...dialogRef.current.querySelectorAll('button')]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      if (opener?.isConnected) opener.focus()
    }
  }, [showHelp])

  if (installed) return null

  async function handleInstall() {
    openerRef.current = document.activeElement
    onActivate?.()
    if (!canPrompt) {
      setShowHelp(true)
      return
    }
    await install()
  }

  return (
    <>
      <button type="button" className={`install-app-button ${className}`.trim()} onClick={handleInstall}>
        <ProductIcon name="install" size={18} />
        <span>Install app</span>
      </button>
      {showHelp ? (
        <div className="install-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHelp(false) }}>
          <section ref={dialogRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="install-dialog-title" className="install-dialog">
            <button type="button" className="install-dialog__close" aria-label="Close install instructions" onClick={() => setShowHelp(false)}>×</button>
            <span className="install-dialog__icon" aria-hidden="true"><ProductIcon name="install" size={24} /></span>
            <p className="section-kicker">Keep PayCheck handy</p>
            <h2 id="install-dialog-title">Install PayCheck on this device</h2>
            <p>{isAppleMobile()
              ? 'In Safari, tap Share and then “Add to Home Screen”.'
              : 'Open your browser menu and choose “Install app” or “Add to Home screen”. The direct prompt appears here whenever your browser makes it available.'}</p>
            <ul>
              <li>Open calculations from your home screen</li>
              <li>Use a focused, app-like window</li>
              <li>Keep the application shell available offline</li>
            </ul>
            <button type="button" className="primary-action" onClick={() => setShowHelp(false)}>Got it</button>
          </section>
        </div>
      ) : null}
    </>
  )
}
