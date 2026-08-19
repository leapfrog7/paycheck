import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(globalThis.process?.env?.CI)
const requestedBasePath = globalThis.process?.env?.PLAYWRIGHT_BASE_PATH || '/'
const basePath = `/${requestedBasePath.replace(/^\/+|\/+$/g, '')}${requestedBasePath === '/' ? '' : '/'}`
const serverOrigin = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.js',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `${serverOrigin}${basePath}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: {
    command: `npm run build -- --base=${basePath} && npm run preview -- --host 127.0.0.1 --port 4173 --base=${basePath}`,
    url: `${serverOrigin}${basePath}`,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
