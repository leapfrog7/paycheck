import { expect, test } from '@playwright/test'

function watchConsoleErrors(page) {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

const seededCase = {
  id: 'phase-6-case',
  caseName: 'Phase 6 verification',
  calculationGoal: 'ARREARS_RECOVERY',
  calculationStartDate: '2025-01-01',
  calculationEndDate: '2025-02-28',
  payCommission: '7th CPC',
  startingPay: {
    payLevel: '6', cellIndex: 9, basicPay: 44900, effectiveFrom: '2025-01-01', dni: '2025-07-01',
  },
  openingPayState: {
    cpc: 7, level: '6', cellIndex: 9, basicPay: 44900, effectiveFrom: '2025-01-01', dni: '2025-07-01',
  },
  applicableAllowances: { basicPay: true, da: false, hra: true, transportAllowance: false },
  careerChangeReview: { annualIncrementTreatment: 'EXCLUDE', otherChanges: ['NONE'] },
  serviceEvents: [],
  drawnPayHistory: [],
  locationHistory: [],
  allowanceEligibilityHistory: [],
  customAllowances: [],
  assumptions: [],
  unresolvedIssues: [],
  lifecycleStatus: 'ACTIVE',
  setupStep: 5,
  createdAt: '2026-08-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
}

test('guided setup directs focus to the first invalid field', async ({ page }) => {
  const consoleErrors = watchConsoleErrors(page)
  await page.goto('./')

  await page.getByRole('button', { name: /start a pay calculation/i }).first().click()
  await page.getByRole('button', { name: /calculate arrears or recovery/i }).click()
  await expect(page.getByRole('heading', { name: 'Period' })).toBeFocused()

  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByLabel('From month')).toBeFocused()
  await expect(page.getByText('Choose a start month.')).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('workspace navigation, filtering, and audit detail survive the real browser', async ({ page }) => {
  const consoleErrors = watchConsoleErrors(page)
  await page.addInitScript((caseData) => {
    localStorage.setItem('paycheck:cases', JSON.stringify([caseData]))
  }, seededCase)

  await page.goto('./case/phase-6-case?step=history')
  await expect(page).toHaveURL(/step=history/)
  await expect(page.getByRole('heading', { name: 'Your calculated pay history' })).toBeVisible()
  await expect(page.getByText('MISSING_HRA_ELIGIBILITY')).toHaveCount(0)

  await page.getByRole('button', { name: /needs attention \(2\)/i }).first().click()
  await expect(page.getByText('Every Due Pay month is resolved.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Detailed audit' }).click()
  await page.getByText('View calculation audit').first().click()
  await expect(page.getByText(/MISSING_HRA_ELIGIBILITY/).first()).toBeVisible()

  await page.getByRole('button', { name: /drawn pay/i }).first().click()
  await expect(page).toHaveURL(/step=drawn/)
  await expect(page.locator('#workspace-panel')).toBeFocused()
  expect(consoleErrors).toEqual([])
})

test('PWA metadata, install help, and offline shell are available', async ({ page, context }, testInfo) => {
  const consoleErrors = watchConsoleErrors(page)
  const failedRequests = []
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText })
  })
  await page.goto('./')

  const manifest = await page.evaluate(async () => {
    const response = await fetch(document.querySelector('link[rel="manifest"]').href)
    return response.json()
  })
  expect(manifest).toMatchObject({ short_name: 'PayCheck', display: 'standalone', start_url: './?source=pwa' })
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192' }),
    expect.objectContaining({ sizes: '512x512' }),
  ]))

  await page.locator('.install-app-promo').getByRole('button', { name: 'Install app' }).click()
  await expect(page.getByRole('dialog', { name: 'Install PayCheck on this device' })).toBeVisible()
  await page.getByRole('button', { name: 'Got it' }).click()

  const workerUrl = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    await new Promise((resolve) => setTimeout(resolve, 500))
    return registration.active?.scriptURL
  })
  expect(workerUrl).toContain('/sw.js')

  await page.reload()
  await expect(page.getByRole('heading', { name: /check your pay/i })).toBeVisible()
  const offlineState = await page.evaluate(async () => {
    const cacheNames = await caches.keys()
    const cachedUrls = (await Promise.all(cacheNames.map(async (name) => {
      const cache = await caches.open(name)
      return (await cache.keys()).map((request) => request.url)
    }))).flat()
    return {
      controlled: Boolean(navigator.serviceWorker.controller),
      hasJavaScript: cachedUrls.some((url) => url.endsWith('.js')),
      hasIndex: cachedUrls.some((url) => url.endsWith('/index.html')),
      cachedUrls,
      currentAssets: [...document.querySelectorAll('script[src], link[rel="stylesheet"]')].map((element) => element.href || element.src),
    }
  })
  expect(offlineState).toMatchObject({ controlled: true, hasJavaScript: true, hasIndex: true })
  expect(offlineState.cachedUrls).toEqual(expect.arrayContaining(offlineState.currentAssets))
  await context.setOffline(true)
  const offlineResponse = await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  await context.setOffline(false)
  expect({
    responseStatus: offlineResponse?.status(),
    failedRequests,
    offlineState,
    bodyText: (await page.locator('body').innerText()).slice(0, 200),
  }).toMatchObject({ responseStatus: 200, failedRequests: [], bodyText: expect.stringMatching(/check your pay/i) })
  expect(consoleErrors).toEqual([])
  await expect(page.getByRole('heading', { name: /check your pay/i })).toBeVisible()

  const layout = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
  expect(consoleErrors).toEqual([])
  if (testInfo.project.name === 'mobile') await page.screenshot({ path: testInfo.outputPath('mobile-home.png'), fullPage: true })
})
