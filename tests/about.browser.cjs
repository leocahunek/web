// Requires Playwright and Chromium; uses isolated API mocks, never live content.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGOsCFjAQAgwEVQxqmgAFAEAhBIBgHuVj+EAAAAASUVORK5CYII=','base64');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const context = await browser.newContext({reducedMotion:'reduce'});
  context.setDefaultTimeout(15000);
  const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  let schemaReady=false,uploads=0,failUpload=false;
  let doc={projects:JSON.parse(fs.readFileSync(path.join(__dirname,'../data/portfolio.json'),'utf8')).projects,revision:1,about:null};
  const originalProjects=JSON.stringify(doc.projects);
  await context.route('https://images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:png}));
  await context.route('https://*.supabase.co/**',r=>{
   const req=r.request(),url=new URL(req.url());
   const json=value=>r.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   if(url.pathname==='/auth/v1/token')return json({access_token:'mock',refresh_token:'mock',expires_in:3600,user:{id:'owner'}});
   if(url.pathname.endsWith('/rpc/is_portfolio_owner'))return json(true);
   if(url.pathname.startsWith('/storage/v1/object/public/'))return r.fulfill({contentType:'image/png',body:png});
   if(url.pathname.startsWith('/storage/v1/object/')){
    if(failUpload){failUpload=false;return r.fulfill({status:500,body:'{}'});}
    uploads++;return json({Key:'uploaded'});
   }
   if(req.method()==='PATCH'){
    if(url.searchParams.get('revision')!==`eq.${doc.revision}`)return json([]);
    doc={...doc,...req.postDataJSON(),revision:doc.revision+1};return json([{revision:doc.revision}]);
   }
   if(!schemaReady){
    if(url.searchParams.get('select')?.includes('about'))return r.fulfill({status:400,body:'{}'});
    return json([{projects:doc.projects,revision:doc.revision}]);
   }
   return json([doc]);
  });
  const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:8000';
  const studio=await context.newPage();studio.on('dialog',d=>d.accept());
  const login=async()=>{
   await studio.goto(`${base}/studio/`);await studio.locator('#login-form').waitFor({state:'visible'});
   await studio.fill('[name=email]','owner@example.com');await studio.fill('[name=password]','mock-password');await studio.click('#login-button');await studio.locator('#workspace').waitFor({state:'visible'});
   await studio.locator('.about-editor-panel').evaluate(el=>{el.open=true;});
  };
  const save=async()=>{
   await studio.locator('#save').evaluate(b=>b.click());
   await studio.waitForFunction(()=>{const el=document.querySelector('#save-status');return el.textContent==='Sve promjene spremljene i objavljene.'||el.dataset.error==='true';});
   assert.equal(await studio.locator('#save-status').getAttribute('data-error'),'false',await studio.locator('#save-status').innerText());
  };
  await login();
  assert(await studio.locator('[data-about=title]').isDisabled());
  assert(await studio.locator('#about-setup-notice').isVisible());
  assert.equal(await studio.locator('.editor-card').count(),6);
  const viewer=await context.newPage();await viewer.goto(`${base}/o-meni.html`);
  await viewer.waitForFunction(()=>document.querySelector('#about-body p')?.textContent.includes('Student'));
  console.log('PASS: old schema keeps public about content and project editing; about activation notice shown');
  schemaReady=true;await login();
  assert.equal(await studio.locator('[data-about=title]').isDisabled(),false);
  await studio.fill('[data-about=title]','Moja priča.\nNa putu.');
  await studio.fill('[data-about=body]','Prvi odlomak.\nDrugi red.\n\n<img src=x onerror=alert(1)>');
  await studio.fill('[data-about=role]','Leo / Fotograf');
  await studio.fill('[data-about=services]','Putopisna fotografija\nVideo');
  await studio.fill('[data-about=imageAlt]','Moj portret');
  await studio.fill('[data-about=imageCaption]','Na putovanju');
  await studio.locator('#about-image').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:png});
  await save();
  assert.equal(uploads,1);assert.equal(doc.about.title,'Moja priča.\nNa putu.');
  assert(doc.about.image.includes('/owner/about/'));assert.equal(doc.projects.length,JSON.parse(originalProjects).length);
  assert.equal(doc.projects[0].id,JSON.parse(originalProjects)[0].id);
  assert(!JSON.stringify(doc.about).includes('blob:'));assert(!JSON.stringify(doc.about).includes('pendingImage'));
  await viewer.reload();await viewer.waitForFunction(()=>document.querySelector('#about-title em')?.textContent==='Na putu.');
  assert.equal(await viewer.locator('#about-body p').count(),2);
  assert.equal(await viewer.locator('#about-body img').count(),0);
  assert.match(await viewer.locator('#about-body').innerText(),/<img src=x onerror=alert\(1\)>/);
  assert.equal(await viewer.locator('.portrait img').getAttribute('src'),doc.about.image);
  assert.equal(await viewer.locator('.portrait img').getAttribute('alt'),'Moj portret');
  assert.equal(await viewer.locator('.services span').count(),2);
  await login();assert.equal(await studio.locator('[data-about=title]').inputValue(),'Moja priča.\nNa putu.');
  console.log('PASS: edit text and portrait, upload, save, persist across reloads, safe public rendering');
  failUpload=true;await studio.locator('#about-image').setInputFiles({name:'retry.png',mimeType:'image/png',buffer:png});
  await studio.waitForFunction(()=>document.querySelector('#save-status').dataset.error==='true');
  const previous=doc.about.image;await save();assert.notEqual(doc.about.image,previous);
  console.log('PASS: failed portrait upload can be retried');
  for(const width of [320,390,768,1440]){
   await viewer.setViewportSize({width,height:900});await studio.setViewportSize({width,height:900});
   assert(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`about overflow ${width}`);
   assert(await studio.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`studio overflow ${width}`);
  }
  await studio.fill('[data-about=body]','Nespremljeni tekst');doc.revision++;
  await studio.locator('#save').evaluate(b=>b.click());await studio.locator('#conflict').waitFor({state:'visible'});
  assert(await studio.locator('#about-editor').evaluate(el=>el.inert));
  assert.notEqual(doc.about.body,'Nespremljeni tekst');assert.deepEqual(errors,[]);
  console.log('PASS: mobile/desktop layout, shared revision conflicts, no JavaScript errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
