// Requires Playwright/Chromium and the local Python HTTP server.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  for(const legacy of [false,true]){
   for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    page.setDefaultTimeout(15000);
    // Isolate link hit-testing from Chromium's cross-document transition races.
    await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
      const style=document.createElement('style');
      style.textContent='@view-transition { navigation: none; }';
      document.head.append(style);
    },{once:true}));
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**/*',route=>route.abort());
    const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000';
    if(legacy){
     let html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
     html=html.replace(/<a class="availability" href="kontakt.html">(.*?)<\/a>/,'<div class="availability">$1</div>');
     assert(html.includes('<div class="availability">'));
     await page.route(`${base}/index.html`,route=>route.fulfill({contentType:'text/html',body:html}));
    }
    await page.goto(`${base}/index.html`);
    await page.evaluate(()=>document.querySelector('.skip-intro')?.click());
    const badge=page.locator('a.availability');
    assert.equal(await badge.getAttribute('href'),'kontakt.html');
    await page.mouse.move(viewport.width/2,viewport.height/2);
    await page.mouse.wheel(0,1000);
    assert(await badge.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
    await Promise.all([page.waitForURL('**/kontakt.html'),badge.click()]);
    await page.evaluate(async()=>{try{await document.activeViewTransition?.finished;}catch{}});
    await page.goto(`${base}/index.html`);
    await page.evaluate(()=>document.querySelector('.skip-intro')?.click());
    await page.locator('a.availability').focus();
    await Promise.all([page.waitForURL('**/kontakt.html'),page.keyboard.press('Enter')]);
    await page.evaluate(async()=>{try{await document.activeViewTransition?.finished;}catch{}});
    assert.deepEqual(errors,[]);
    console.log(`PASS: ${legacy?'legacy badge upgrade':'native link'}, ${viewport.width}px, click and Enter open contact`);
    await page.close();
   }
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
