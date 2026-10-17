// Run with Playwright and Chromium against the repository's Python HTTP server.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const context = await browser.newContext();
    let projects = JSON.parse(fs.readFileSync(path.join(__dirname,'../data/portfolio.json'),'utf8')).projects;
    projects[0] = {...projects[0],cat:'travel',images:[projects[0].image,projects[4].image]};
    let revision = 1;
    const errors = [];
    context.on('page',page => page.on('pageerror',error => errors.push(error.message)));
    await context.route('https://images.unsplash.com/**',r => r.abort());
    await context.route('https://*.supabase.co/**',r => {
      const req = r.request();const u = new URL(req.url());
      const json = value => r.fulfill({contentType:'application/json',body:JSON.stringify(value)});
      if (u.pathname === '/auth/v1/token') return json({access_token:'test',refresh_token:'test',expires_in:3600,user:{id:'test-owner'}});
      if (u.pathname.endsWith('/rpc/is_portfolio_owner')) return json(true);
      if (req.method() === 'PATCH') { projects = req.postDataJSON().projects;return json([{revision:++revision}]); }
      return json([{projects,revision}]);
    });
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8000';
    const home = await context.newPage();
    await home.goto(`${base}/index.html`);
    await home.locator('.cover-trail').first().waitFor({state:'attached'});
    await home.click('.skip-intro');
    await home.waitForFunction(() => document.querySelectorAll('.cover-trail:not([hidden])').length === 15);
    assert.equal(await home.locator('button.cover').count(),5);
    assert.equal(await home.locator('.cover-trail:not([aria-hidden=true])').count(),0);
    const oldTransform = await home.locator('.cover-trail').first().evaluate(el => el.style.transform);
    await home.waitForFunction(old => document.querySelector('.cover-trail').style.transform !== old,oldTransform);
    await home.click('#pause');
    assert.equal(await home.locator('.cover-trail:visible').count(),0);
    await home.click('#pause');
    await home.waitForFunction(() => document.querySelectorAll('.cover-trail:not([hidden])').length > 0);
    await home.emulateMedia({reducedMotion:'reduce'});
    await home.waitForFunction(() => !document.querySelector('.cover-trail:not([hidden])'));
    await home.click('#next');
    assert.equal(await home.locator('.cover-trail:visible').count(),0);
    await home.setViewportSize({width:390,height:844});
    assert(await home.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('PASS: animated orbit trails, pause/resume, reduced motion, single set of interactive cards, mobile layout');

    const studio = await context.newPage();
    await studio.goto(`${base}/studio/`);
    await studio.locator('#login-form').waitFor({state:'visible'});
    await studio.fill('[name=email]','test@example.com');await studio.fill('[name=password]','mock-password');
    await studio.click('#login-button');
    const first = studio.locator('.editor-card').first();
    await first.waitFor();
    assert.equal(await first.locator('[data-field=cat]').inputValue(),'travel');
    assert.equal(await first.locator('.project-photos').isVisible(),true);
    assert.equal(await first.locator('.photo-item').count(),2);
    await first.locator('[data-field=cat]').selectOption('photo');
    await first.locator('[data-field=cat]').selectOption('travel');
    await studio.locator('#save').evaluate(button => button.click());
    await studio.waitForFunction(() => document.querySelector('#save-status').textContent === 'Sve promjene spremljene i objavljene.');
    assert.equal(projects[0].cat,'travel');assert.equal(projects[0].images.length,2);
    console.log('PASS: travel category editable and saved with existing project photos');

    const gallery = await context.newPage();
    await gallery.goto(`${base}/radovi.html`);
    await gallery.waitForFunction(() => document.querySelectorAll('.project').length === 6);
    await gallery.click('[data-filter=travel]');
    assert.equal(await gallery.locator('.project:visible').count(),1);
    assert.match(await gallery.locator('.project:visible .project-tag').innerText(),/Putopisna fotografija/i);
    await gallery.locator('.project:visible .project-media').click();
    assert.match(await gallery.locator('.dialog-category').innerText(),/Putopisna fotografija/i);
    await gallery.click('#photo-next');
    assert.equal(await gallery.locator('#photo-counter').innerText(),'Fotografija 2 / 2');
    await gallery.keyboard.press('Escape');
    await gallery.setViewportSize({width:390,height:844});
    assert(await gallery.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors,[]);
    console.log('PASS: travel filter, category label, multi-photo preview, mobile layout; no JavaScript errors');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
