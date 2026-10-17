// Tests startup against a deliberately blocked backend, with and without cache.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',name),'utf8'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const cached of [false,true]){
   const context=await browser.newContext();context.setDefaultTimeout(5000);
   const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
   const projects=read('portfolio.json').projects,about=read('about.json');
   let release;const gate=new Promise(resolve=>{release=resolve;});
   let requests=0,responded=false;
   if(cached){
    const cache=structuredClone(projects);cache[0].short='Spremljeni rad';
    await context.addInitScript(({source,projects,about})=>{if(!['http:','https:'].includes(location.protocol))return;localStorage.setItem('leo-portfolio-cache',JSON.stringify({source,projects,about,aboutSupported:true,revision:4}));},{source:read('portfolio-config.json').url,projects:cache,about});
   }
   await context.route('https://images.unsplash.com/**',r=>r.abort());
   await context.route('https://*.supabase.co/**',async r=>{
    requests++;await gate;
    const updated=structuredClone(projects);updated[0].short='Aktualni rad';
    responded=true;
    await r.fulfill({contentType:'application/json',body:JSON.stringify([{projects:updated,about,revision:5}])});
   });
   const page=await context.newPage();
   await page.goto(`${process.env.TEST_BASE_URL||'http://127.0.0.1:8000'}/index.html`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelectorAll('button.cover').length===5,null,{timeout:2000});
   const first=page.locator('button.cover').first();
   const initial=await first.evaluate(el=>el.style.transform);
   await page.waitForFunction(old=>document.querySelector('button.cover').style.transform!==old,initial,{timeout:1000});
   assert.equal(responded,false,'orbit must move before the backend responds');
   assert.equal(requests,1);
   if(cached)assert.equal(await first.locator('.cover-label strong').innerText(),'Spremljeni rad');
   release();
   await page.waitForFunction(()=>document.querySelector('.cover-label strong')?.textContent==='Aktualni rad');
   assert.equal(requests,1,'background refresh should not duplicate the initial request');
   assert.deepEqual(errors,[]);
   console.log(`PASS: ${cached?'cached':'cold'} startup rotates before backend response, then applies current data`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
