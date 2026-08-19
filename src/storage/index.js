export const storageKeys = {
  payroll: 'paycheck:payroll',
  settings: 'paycheck:settings',
  calculationView: 'paycheck:calculation-view',
}

export function readStorage(key, fallback = null) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch (error) {
    console.warn(`Failed to read storage for ${key}:`, error)
    return fallback
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.warn(`Failed to write storage for ${key}:`, error)
    return false
  }
}

export function clearStorage(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.warn(`Failed to clear storage for ${key}:`, error)
    return false
  }
}
