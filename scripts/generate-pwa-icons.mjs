import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const iconUrl = new URL('../public/app-icon.svg', import.meta.url).href
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 512, height: 512 } })

for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size })
  await page.goto(iconUrl)
  await page.screenshot({ path: fileURLToPath(new URL(`../public/app-icon-${size}.png`, import.meta.url)) })
}

await browser.close()
