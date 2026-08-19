import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

function pwaServiceWorker() {
  let basePath = '/'

  return {
    name: 'paycheck-pwa-service-worker',
    apply: 'build',
    configResolved(config) {
      basePath = config.base
    },
    generateBundle(_options, bundle) {
      const withBase = (fileName = '') => `${basePath}${fileName}`
      const bundleUrls = Object.keys(bundle).map((fileName) => withBase(fileName))
      const fixedUrls = [
        withBase(),
        withBase('index.html'),
        withBase('manifest.webmanifest'),
        withBase('app-icon.svg'),
        withBase('app-icon-192.png'),
        withBase('app-icon-512.png'),
      ]
      const precacheUrls = [...new Set([...fixedUrls, ...bundleUrls])]
      const version = createHash('sha256').update(precacheUrls.join('|')).digest('hex').slice(0, 10)
      const template = readFileSync(new URL('./scripts/service-worker-template.txt', import.meta.url), 'utf8')
      const source = template
        .replace('__CACHE_NAME__', `paycheck-shell-${version}`)
        .replace('__PRECACHE_URLS__', JSON.stringify(precacheUrls, null, 2))

      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pwaServiceWorker()],
})
