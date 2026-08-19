import { useCallback, useEffect, useMemo, useState } from 'react'
import { InstallPromptContext } from './installPromptContext'

function standaloneMode() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function InstallPromptProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(() => standaloneMode())

  useEffect(() => {
    const capturePrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }
    const markInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', capturePrompt)
    window.addEventListener('appinstalled', markInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt)
      window.removeEventListener('appinstalled', markInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'unavailable' }
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return choice
  }, [deferredPrompt])

  const value = useMemo(() => ({
    canPrompt: Boolean(deferredPrompt),
    installed,
    install,
  }), [deferredPrompt, install, installed])

  return <InstallPromptContext.Provider value={value}>{children}</InstallPromptContext.Provider>
}
