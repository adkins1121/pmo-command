import { chromium } from 'playwright-core'
const OUT='/tmp/claude-0/-home-user-pmo-command/07460773-9bcd-5fa2-aba0-3a70df5d16c4/scratchpad'
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'})
const p=await b.newPage({viewport:{width:1400,height:900}})
const errs=[];p.on('pageerror',e=>errs.push(String(e)))
await p.goto('http://localhost:8044/',{waitUntil:'networkidle'});await p.waitForTimeout(500)
await p.click('text=Ask AI');await p.waitForTimeout(400)
await p.fill('textarea','Where does Paperless document management live and what depends on it?')
await p.click('button:has-text("Search all information")')
await p.waitForTimeout(1400)
await p.screenshot({path:OUT+'/ai-search.png'})
console.log('ERRORS:'+JSON.stringify(errs))
await b.close()
