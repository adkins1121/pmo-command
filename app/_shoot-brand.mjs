import { chromium } from 'playwright-core'
const OUT = '/tmp/claude-0/-home-user-pmo-command/07460773-9bcd-5fa2-aba0-3a70df5d16c4/scratchpad'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await b.newPage({ viewport: { width: 1500, height: 950 } })
const errs = []; page.on('pageerror', e => errs.push(String(e)))
await page.goto('http://localhost:8055/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.click('button[title="Menu"]'); await page.waitForTimeout(250)
await page.click('text=Admin'); await page.waitForTimeout(500)
// set primary + accent hex
const hexes = page.locator('input[placeholder="#000000"]')
await hexes.nth(0).fill('#0E7C7B')   // primary
await hexes.nth(1).fill('#E08A1E')   // accent
await page.waitForTimeout(200)
await page.screenshot({ path: OUT + '/b1-admin-branding.png' })
await page.click('button:has-text("Save changes")'); await page.waitForTimeout(400)
// open nav to show themed brand + active item
await page.click('button[title="Menu"]'); await page.waitForTimeout(300)
await page.screenshot({ path: OUT + '/b2-nav-themed.png' })
console.log('ERRORS:' + JSON.stringify(errs))
await b.close()
