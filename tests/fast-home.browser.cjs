// Tests startup against a deliberately blocked backend, with and without cache.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',name),'utf8'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const target of ['index.html','radovi.html']) {
  for(const cached of [false,true]){
   const context=await browser.newContext();context.setDefaultTimeout(5000);
   const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
   const projects=read('portfolio.json').projects,about=read('about.json');
   let release;const gate=new Promise(resolve=>{release=resolve;});
   let requests=0,responded=false;
   if(cached){
    const cache=structuredClone(projects);cache[0].short='Spremljeni rad';cache[0].name='Spremljeni rad';
    await context.addInitScript(({source,projects,about})=>{if(!['http:','https:'].includes(location.protocol))return;localStorage.setItem('leo-portfolio-cache',JSON.stringify({source,projects,about,aboutSupported:true,revision:4}));},{source:read('portfolio-config.json').url,projects:cache,about});
   }
   await context.route('https://images.unsplash.com/**',r=>r.abort());
   await context.route('https://*.supabase.co/**',async r=>{
    requests++;await gate;
    const updated=structuredClone(projects);updated[0].short='Aktualni rad';updated[0].name='Aktualni rad';
    responded=true;
    await r.fulfill({contentType:'application/json',body:JSON.stringify([{projects:updated,about,revision:5}])});
   });
   const page=await context.newPage();
   await page.goto(`${process.env.TEST_BASE_URL||'http://127.0.0.1:8000'}/${target}`,{waitUntil:'domcontentloaded'});
   const home=target==='index.html';
   const selector=home?'button.cover':'.project';
   const title=home?'.cover-label strong':'.project h3';
   await page.waitForFunction(({selector,count})=>document.querySelectorAll(selector).length===count,{selector,count:home?5:6},{timeout:2000});
   const first=page.locator(selector).first();
   if(home){
    const initial=await first.evaluate(el=>el.style.transform);
    await page.waitForFunction(old=>document.querySelector('button.cover').style.transform!==old,initial,{timeout:1000});
   }else{
    assert(await first.isVisible());assert.equal(await page.locator('.shutter').count(),0);
   }
   assert.equal(responded,false,'content must appear before the backend responds');
   assert.equal(requests,1);
   if(cached)assert.equal(await page.locator(title).first().innerText(),'Spremljeni rad');
   release();
   await page.waitForFunction(selector=>document.querySelector(selector)?.textContent==='Aktualni rad',title);
   assert.equal(requests,1,'background refresh should not duplicate the initial request');
   assert.deepEqual(errors,[]);
   console.log(`PASS: ${target}, ${cached?'cached':'cold'} startup shows content before backend response, then applies current data`);
   await context.close();
  }
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
