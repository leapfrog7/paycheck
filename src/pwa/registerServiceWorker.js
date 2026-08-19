export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      await navigator.serviceWorker.ready
    } catch (error) {
      console.warn('PayCheck offline support could not be enabled.', error)
    }
  })
}
