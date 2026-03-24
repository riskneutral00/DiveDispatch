import { chromium } from '@playwright/test'

const token = process.argv[2]
;(async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const page = await context.newPage()

  await page.goto(`http://localhost:3000/sign-in#/?__clerk_ticket=${token}`)
  await page.waitForURL('**/dashboard**', { timeout: 60000 })
  console.log('Signed in:', page.url())

  // Navigate via client-side routing (avoids full page load timeout)
  await page.evaluate(() => window.location.href = '/n7rq5j/dive-center/dashboard')
  await page.waitForTimeout(15000)
  await page.screenshot({ path: '/tmp/dd-mobile-dashboard.png', fullPage: false, timeout: 15000 })
  console.log('Screenshot saved to /tmp/dd-mobile-dashboard.png')

  await browser.close()
})()
