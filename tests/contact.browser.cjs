// Intercepts the email service request: this test never sends real email.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const javaScriptEnabled of [true,false]){
   const context=await browser.newContext({javaScriptEnabled,reducedMotion:'reduce'});
   let submission=null,downloads=0;
   await context.route('https://formsubmit.co/**',async route=>{
    const request=route.request();
    submission={url:request.url(),method:request.method(),body:new URLSearchParams(request.postData()),contentType:request.headers()['content-type']};
    await route.fulfill({contentType:'text/html',body:'<!doctype html><title>Testna potvrda</title><h1>Zahtjev presretnut u testu</h1>'});
   });
   const page=await context.newPage();page.on('download',()=>downloads++);
   await page.goto(`${process.env.TEST_BASE_URL||'http://127.0.0.1:8000'}/kontakt.html`);
   assert.equal(await page.locator('#inquiry').getAttribute('method'),'post');
   await page.click('button.submit');
   assert.equal(submission,null,'required-field validation must prevent empty submission');
   await page.fill('[name=name]','Probni Posjetitelj');
   await page.fill('[name=email]','posjetitelj@example.com');
   await page.selectOption('[name=service]',{label:'Snimanje i montaža'});
   await page.selectOption('[name=budget]',{index:2});
   await page.fill('[name=deadline]','2026-12-01');
   await page.fill('[name=message]','Želim snimanje događaja.\nLokacija: Varaždin.');
   await Promise.all([page.waitForURL('https://formsubmit.co/**'),page.click('button.submit')]);
   assert.equal(submission.url,'https://formsubmit.co/cahunekleo@gmail.com');
   assert.equal(submission.method,'POST');
   assert.match(submission.contentType,/application\/x-www-form-urlencoded/);
   assert.equal(submission.body.get('email'),'posjetitelj@example.com');
   assert.equal(submission.body.get('name'),'Probni Posjetitelj');
   assert.equal(submission.body.get('service'),'Snimanje i montaža');
   assert.equal(submission.body.get('deadline'),'2026-12-01');
   assert.match(submission.body.get('message'),/Varaždin/);
   assert.match(submission.body.get('_subject'),/Novi upit/);
   assert.equal(submission.body.get('_template'),'table');
   assert.equal(submission.body.get('_honey'),'');
   assert.notEqual(submission.body.get('_captcha'),'false');
   assert.equal(downloads,0);
   console.log(`PASS: ${javaScriptEnabled?'with':'without'} JavaScript, required fields validated and full inquiry POSTed to configured recipient (intercepted, no email sent)`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
