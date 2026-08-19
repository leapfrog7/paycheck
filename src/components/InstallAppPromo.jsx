import InstallAppButton from './InstallAppButton'
import ProductIcon from './ProductIcon'
import { useInstallPrompt } from '../pwa/installPromptContext'

export default function InstallAppPromo() {
  const { installed } = useInstallPrompt()
  if (installed) return null

  return (
    <section className="install-app-promo" aria-label="Install PayCheck">
      <span className="install-app-promo__icon" aria-hidden="true"><ProductIcon name="install" size={22} /></span>
      <div>
        <strong>Use PayCheck like an app</strong>
        <p>Add it to your home screen for quicker access. Your saved calculations remain private in this browser.</p>
      </div>
      <InstallAppButton className="install-app-button--promo" />
    </section>
  )
}
