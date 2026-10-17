// Intercepts FormSubmit: no real emails are sent by this test.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({reducedMotion:'reduce'});
  let mode='pending',requests=[],release,started;
  const gate=new Promise(resolve=>{release=resolve;});
  const requestStarted=new Promise(resolve=>{started=resolve;});
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Accept','Access-Control-Allow-Methods':'POST,OPTIONS'};
  await context.route('https://formsubmit.co/**',async route=>{
   const request=route.request();
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
   requests.push({url:request.url(),method:request.method(),data:request.postDataJSON()});
   if(mode==='pending'){started();await gate;}
   if(mode==='network')return route.abort();
   if(mode==='bad-json')return route.fulfill({contentType:'text/html',headers:cors,body:'Invalid response'});
   const body=mode==='activation'?{success:'false',message:'You need to activate this form'}:mode==='rejected'?{success:false,message:'Request rejected'}:{success:mode==='boolean'?true:'true',message:'The form was submitted successfully.'};
   return route.fulfill({status:mode==='server'?500:200,headers:cors,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();const errors=[];let downloads=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('download',()=>downloads++);
  const url=`${process.env.TEST_BASE_URL||'http://127.0.0.1:8000'}/kontakt.html`;
  await page.goto(url);
  await page.click('#inquiry button.submit');assert.equal(requests.length,0);
  const fill=async()=>{
   await page.fill('[name=name]','Probni Posjetitelj');await page.fill('[name=email]','posjetitelj@example.com');
   await page.selectOption('[name=service]',{label:'Snimanje i montaža'});
   await page.selectOption('[name=budget]',{index:2});await page.fill('[name=deadline]','2026-12-01');
   await page.fill('[name=message]','Želim snimanje događaja.\nLokacija: Varaždin.');
  };
  await fill();await page.click('#inquiry button.submit');await requestStarted;
  assert(await page.locator('#inquiry button.submit').isDisabled());
  assert.equal(await page.locator('#inquiry-success').isVisible(),false);
  await page.locator('#inquiry').evaluate(form=>form.requestSubmit());assert.equal(requests.length,1);
  const sent=requests[0];assert.equal(sent.url,'https://formsubmit.co/ajax/cahunekleo@gmail.com');assert.equal(sent.method,'POST');
  assert.equal(sent.data.email,'posjetitelj@example.com');assert.equal(sent.data.name,'Probni Posjetitelj');
  assert.equal(sent.data.service,'Snimanje i montaža');assert.equal(sent.data.deadline,'2026-12-01');
  assert.match(sent.data.message,/Varaždin/);assert.equal(sent.data._captcha,'false');assert.equal(sent.data._honey,'');
  release();await page.locator('#inquiry-success').waitFor({state:'visible'});
  assert.equal(page.url(),url);assert.equal(await page.locator('[name=name]').inputValue(),'');
  assert.equal(await page.locator('#inquiry-success-title').innerText(),'Zahtjev poslan');
  for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.click('#inquiry-success-close');
  assert.equal(await page.locator('#inquiry-success').isVisible(),false);
  console.log('PASS: async submission has CAPTCHA disabled, prevents duplicates and shows popup only after acceptance, with no navigation');
  await fill();
  for(const failure of ['server','rejected','activation','network','bad-json']){
   mode=failure;await page.click('#inquiry button.submit');
   await page.waitForFunction(()=>!document.querySelector('#inquiry button.submit').disabled&&!!document.querySelector('.form-status').textContent);
   assert.equal(await page.locator('#inquiry-success').isVisible(),false);
   assert.equal(await page.locator('[name=name]').inputValue(),'Probni Posjetitelj');assert.equal(page.url(),url);
   if(failure==='activation')assert.match(await page.locator('.form-status').innerText(),/nije aktiviran/);
  }
  mode='boolean';await page.click('#inquiry button.submit');await page.locator('#inquiry-success').waitFor({state:'visible'});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#inquiry-success').isVisible(),false);
  assert.deepEqual(errors,[]);assert.equal(downloads,0);
  console.log('PASS: HTTP, service, activation, network and malformed-response errors retain text without false success; retry works');
  await context.close();
  const fallback=await browser.newContext({javaScriptEnabled:false});
  let native;
  await fallback.route('https://formsubmit.co/**',route=>{
   native={url:route.request().url(),body:new URLSearchParams(route.request().postData())};
   return route.fulfill({contentType:'text/html',body:'<h1>Testna potvrda</h1>'});
  });
  const plain=await fallback.newPage();await plain.goto(url);
  await plain.fill('[name=name]','Bez JavaScripta');await plain.fill('[name=email]','test@example.com');
  await plain.selectOption('[name=service]',{index:1});await plain.fill('[name=message]','Test');
  await Promise.all([plain.waitForURL('https://formsubmit.co/**'),plain.click('#inquiry button.submit')]);
  assert.equal(native.url,'https://formsubmit.co/cahunekleo@gmail.com');assert.equal(native.body.get('_captcha'),'false');
  console.log('PASS: native no-JavaScript fallback remains available without CAPTCHA');
  await fallback.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
