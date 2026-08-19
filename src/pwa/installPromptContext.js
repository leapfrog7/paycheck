import { createContext, useContext } from 'react'

export const InstallPromptContext = createContext(null)

export function useInstallPrompt() {
  const value = useContext(InstallPromptContext)
  if (!value) throw new Error('useInstallPrompt must be used inside InstallPromptProvider')
  return value
}
