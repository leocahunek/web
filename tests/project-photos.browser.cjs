// Requires Playwright and Chromium; run against the documented local HTTP server.
// node tests/project-photos.browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGOsCFjAQAgwEVQxqmgAFAEAhBIBgHuVj+EAAAAASUVORK5CYII=', 'base64');
const sampleVideo = fs.readFileSync(path.join(__dirname,'fixtures/video.mp4'));
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8000';
const fixture = name => ({ name, mimeType:'image/png', buffer:png });
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
  try {
    const context = await browser.newContext({reducedMotion:'reduce'});
    context.setDefaultTimeout(15000);
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    let doc = {projects:JSON.parse(fs.readFileSync(path.join(__dirname,'../data/portfolio.json'),'utf8')).projects, revision:1};
    let uploads = 0;
    let failUpload = false;
    let holdUpload;
    await context.route('https://images.unsplash.com/**', route => route.fulfill({contentType:'image/png', body:png}));
    await context.route('https://*.supabase.co/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const json = data => route.fulfill({contentType:'application/json', body:JSON.stringify(data)});
      if (url.pathname === '/auth/v1/token') return json({access_token:'test-only',refresh_token:'test-only',expires_in:3600,user:{id:'test-owner'}});
      if (url.pathname === '/rest/v1/rpc/is_portfolio_owner') return json(true);
      if (url.pathname.startsWith('/storage/v1/object/public/')) return url.pathname.endsWith('.mp4') ? route.fulfill({contentType:'video/mp4',body:sampleVideo}) : route.fulfill({contentType:'image/png',body:png});
      if (url.pathname.endsWith('/reject-size')) return route.fulfill({status:413,contentType:'application/json',body:JSON.stringify({message:'The object exceeded the maximum allowed size'})});
      if (url.pathname.endsWith('/reject-type')) return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'mime type video/quicktime is not supported'})});
      if (url.pathname.startsWith('/storage/v1/object/')) {
        if (failUpload) { failUpload = false; return route.fulfill({status:500,body:'{}'}); }
        if (url.pathname.endsWith('.mov')) assert.equal(request.headers()['content-type'],'video/quicktime');
        uploads++;
        if (holdUpload) await holdUpload();
        return json({Key:'uploaded'});
      }
      if (url.pathname === '/rest/v1/portfolio') {
        if (request.method() === 'PATCH') {
          if (url.searchParams.get('revision') !== `eq.${doc.revision}`) return json([]);
          doc = {projects:request.postDataJSON().projects,revision:doc.revision + 1};
          return json([{revision:doc.revision}]);
        }
        return json([doc]);
      }
      if (url.pathname === '/auth/v1/logout') return json({});
      throw new Error(`Unhandled mock request: ${request.method()} ${url.pathname}`);
    });
    const studio = await context.newPage();
    studio.on('dialog', dialog => dialog.accept());
    const login = async () => {
      await studio.goto(`${base}/studio/`);
      await studio.locator('#login-form').waitFor({state:'visible'});
      await studio.fill('[name=email]', 'owner@example.com');
      await studio.fill('[name=password]', 'mock-password');
      await studio.click('#login-button');
      await studio.locator('#workspace').waitFor({state:'visible'});
    };
    await login();
    const card = studio.locator('.editor-card').first();
    const save = async () => {
      await studio.locator('#save').evaluate(button => button.click());
      await studio.waitForFunction(() => { const el = document.querySelector('#save-status'); return el.textContent === 'Sve promjene spremljene i objavljene.' || el.dataset.error === 'true'; }, null, {timeout:15000});
      assert.equal(await studio.locator('#save-status').getAttribute('data-error'), 'false', await studio.locator('#save-status').innerText());
    };
    assert.equal(await card.locator('.photo-item').count(), 1);
    await card.locator('[data-add-photos]').setInputFiles([fixture('two.png'), fixture('three.png')]);
    assert.equal(await card.locator('.photo-item').count(), 3);
    await save();
    assert.equal(doc.projects[0].images.length, 3);
    assert.equal(doc.projects[0].image, doc.projects[0].images[0]);
    assert.equal(uploads, 2);
    assert(!JSON.stringify(doc).includes('blob:'));
    assert(!JSON.stringify(doc).includes('pending'));
    console.log('PASS: append multiple photos, prepare/upload, save one project with three photos');

    const cover = doc.projects[0].images[2];
    await card.locator('[data-photo-action=cover]').nth(2).click();
    await save();
    assert.equal(doc.projects[0].image, cover);
    const order = [...doc.projects[0].images];
    await card.locator('[data-photo-action=down]').first().click();
    await save();
    assert.deepEqual(doc.projects[0].images, [order[1],order[0],order[2]]);
    await card.locator('[data-photo-action=up]').nth(1).click();
    await save();
    assert.deepEqual(doc.projects[0].images, order);
    await login();
    assert.equal(await card.locator('.photo-item').count(), 3);
    assert.equal(await card.locator('.editor-cover img').getAttribute('src'), cover);
    console.log('PASS: cover, ordering, and persistence after reloading Studio');

    const gallery = await context.newPage();
    await gallery.goto(`${base}/radovi.html`);
    await gallery.waitForFunction(() => document.querySelectorAll('.project').length === 6);
    await gallery.waitForFunction(() => document.querySelector('.project-tag')?.textContent.includes('3 fotografija'));
    assert.match(await gallery.locator('.project-tag').first().innerText(), /3 fotografija/);
    await gallery.locator('.project-media').first().click();
    assert.equal(await gallery.locator('#photo-counter').innerText(),'Fotografija 1 / 3');
    await gallery.click('#photo-next');
    assert.equal(await gallery.locator('#photo-counter').innerText(),'Fotografija 2 / 3');
    assert.equal((await gallery.locator('#lightbox-content img').getAttribute('src')).split('?')[0],doc.projects[0].images[1]);
    await gallery.keyboard.press('ArrowRight');
    assert.equal(await gallery.locator('#photo-counter').innerText(),'Fotografija 3 / 3');
    await gallery.keyboard.press('ArrowRight');
    assert.equal(await gallery.locator('#photo-counter').innerText(),'Fotografija 1 / 3');
    await gallery.click('#lightbox-next');
    assert.equal(await gallery.locator('.photo-navigation').isVisible(),false);
    assert.equal(await gallery.locator('#lightbox-content video').count(),1);
    await gallery.click('#lightbox-prev');
    assert.equal(await gallery.locator('#photo-counter').innerText(),'Fotografija 1 / 3');
    await gallery.locator('#lightbox-content').evaluate(el => {
      const start = new Touch({identifier:1,target:el,clientX:250,clientY:100});
      const end = new Touch({identifier:1,target:el,clientX:80,clientY:110});
      el.dispatchEvent(new TouchEvent('touchstart',{touches:[start],bubbles:true}));
      el.dispatchEvent(new TouchEvent('touchend',{touches:[],changedTouches:[end],bubbles:true}));
    });
    assert.equal(await gallery.locator('#photo-counter').innerText(),'Fotografija 2 / 3');
    await gallery.keyboard.press('Escape');
    for (const width of [320,390,768,1440]) {
      await gallery.setViewportSize({width,height:900});
      await studio.setViewportSize({width,height:900});
      assert(await gallery.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `gallery overflow at ${width}`);
      assert(await studio.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `studio overflow at ${width}`);
    }
    console.log('PASS: public gallery, photo arrows/keyboard/swipe, project navigation, video, responsive layouts');

    await card.locator('[data-add-photos]').setInputFiles({name:'bad.mp4',mimeType:'video/mp4',buffer:Buffer.from('invalid')});
    assert.equal(await card.locator('.photo-item').count(),3);
    assert.match(await studio.locator('#upload-status').innerText(),/samo fotografije/);
    failUpload = true;
    await card.locator('[data-add-photos]').setInputFiles(fixture('retry.png'));
    await studio.waitForFunction(() => document.querySelector('#save-status').dataset.error === 'true');
    assert.equal(doc.projects[0].images.length,3);
    await save();
    assert.equal(doc.projects[0].images.length,4);
    console.log('PASS: invalid format rejected; failed upload can be retried without losing photos');

    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let started;
    const startedPromise = new Promise(resolve => { started = resolve; });
    holdUpload = async () => { started(); await gate; };
    const uploadsBefore = uploads;
    await card.locator('[data-add-photos]').setInputFiles(fixture('slow.png'));
    await startedPromise;
    await card.locator('[data-field=name]').fill('Promjena tijekom prijenosa');
    holdUpload = null;
    release();
    await studio.waitForFunction(() => { const el = document.querySelector('#save-status'); return el.textContent === 'Sve promjene spremljene i objavljene.' || el.dataset.error === 'true'; }, null, {timeout:15000});
      assert.equal(await studio.locator('#save-status').getAttribute('data-error'), 'false', await studio.locator('#save-status').innerText());
    assert.equal(doc.projects[0].name,'Promjena tijekom prijenosa');
    assert.equal(doc.projects[0].images.length,5);
    assert.equal(uploads,uploadsBefore + 1);
    console.log('PASS: edits during upload persist and do not upload the same photo twice');

    await card.locator('[data-field=cat]').selectOption('design');
    assert(await card.locator('.project-photos').isVisible());
    await save();
    assert.equal(doc.projects[0].cat,'design');
    const oldPhotos = [...doc.projects[0].images];
    await card.locator('[data-replace]').setInputFiles(fixture('replacement.png'));
    await save();
    assert.equal(doc.projects[0].images.length,oldPhotos.length);
    assert.notEqual(doc.projects[0].image,oldPhotos[0]);
    assert.deepEqual(doc.projects[0].images.slice(1),oldPhotos.slice(1));
    const projectCountBeforeDrop = doc.projects.length;
    await card.evaluate((el,bytes) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)],'dropped.png',{type:'image/png'}));
      el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    },[...png]);
    await save();
    assert.equal(doc.projects.length,projectCountBeforeDrop);
    assert.equal(doc.projects[0].images.length,oldPhotos.length + 1);
    await gallery.reload();
    await gallery.waitForFunction(() => document.querySelectorAll('.project').length === 6);
    await gallery.waitForFunction(() => document.querySelectorAll('.project[data-category=design]').length === 2);
    await gallery.click('[data-filter=design]');
    assert.equal(await gallery.locator('.project:visible').count(),2);
    await gallery.locator('.project:visible .project-media').first().click();
    assert.equal(await gallery.locator('#photo-counter').innerText(),`Fotografija 1 / ${oldPhotos.length + 1}`);
    await gallery.click('#photo-next');
    assert.equal(await gallery.locator('#photo-counter').innerText(),`Fotografija 2 / ${oldPhotos.length + 1}`);
    await gallery.keyboard.press('Escape');
    console.log('PASS: graphic design supports cover replacement, photo drop, persistence, filtering and multi-image preview');

    while (await card.locator('.photo-item').count() > 1) {
      await card.locator('[data-photo-action=delete]').last().click();
    }
    assert.equal(await card.locator('[data-photo-action=delete]').first().isDisabled(),true);
    await save();
    assert.equal(doc.projects[0].images.length,1);
    const countBefore = doc.projects.length;
    await studio.locator('#files').setInputFiles(fixture('new-project.png'));
    await save();
    assert.equal(doc.projects.length,countBefore + 1);
    assert.equal(doc.projects.at(-1).images.length,1);
    console.log('PASS: remove individual photos, protect last photo, and create new projects');

    // Simulate reported File sizes without allocating or sending 150 MB.
    const addSizedVideo = size => studio.evaluate(bytes => {
      const input = document.querySelector('#files');
      const transfer = new DataTransfer();
      transfer.items.add(new File(['mock video'],'size-limit.mp4',{type:'video/mp4'}));
      input.files = transfer.files;
      Object.defineProperty(input.files[0],'size',{value:bytes});
      input.dispatchEvent(new Event('change',{bubbles:true}));
    },size);
    const countBeforeLimit = doc.projects.length;
    await addSizedVideo(150 * 1024 * 1024 + 1);
    assert.equal(await studio.locator('.editor-card').count(),countBeforeLimit);
    assert.match(await studio.locator('#upload-status').innerText(),/veća od 150 MB/);
    await addSizedVideo(150 * 1024 * 1024);
    assert.equal(await studio.locator('.editor-card').count(),countBeforeLimit + 1);
    await save();
    assert.equal(doc.projects.at(-1).cat,'video');
    console.log('PASS: client accepts exactly 150 MB and rejects larger files (simulated sizes)');

    for (const mimeType of ['video/mp4','application/octet-stream','','application/mp4','video/x-m4v']) {
      const choosing = studio.waitForEvent('filechooser');
      await studio.click('#add-video');
      const chooser = await choosing;
      await chooser.setFiles({name:'camera.MP4',mimeType,buffer:sampleVideo});
      const videoCard = studio.locator('.editor-card').last();
      await videoCard.locator('video').waitFor({state:'visible'});
      await studio.waitForFunction(() => [...document.querySelectorAll('.editor-card')].at(-1).querySelector('video').readyState >= 2);
      await videoCard.locator('video').evaluate(async video => {video.muted=true;await video.play();});
      await studio.waitForFunction(() => [...document.querySelectorAll('.editor-card')].at(-1).querySelector('video').currentTime > 0);
      await videoCard.locator('video').evaluate(video => video.pause());
      await save();
      assert(doc.projects.at(-1).video.endsWith('.mp4'));
    }
    await login();
    await studio.waitForFunction(() => [...document.querySelectorAll('.editor-card')].at(-1).querySelector('video').readyState >= 2);
    assert((await studio.locator('.editor-card').last().locator('video').getAttribute('src')).startsWith('https://'));
    console.log('PASS: genuine H.264 MP4 previews and plays locally and after saved reload; missing/alias MIME types accepted');
    const storageErrors = await studio.evaluate(async () => {
      const config=LeoPortfolio.getConfig();
      const result=[];
      for(const path of ['reject-size','reject-type']) {
        try {await LeoPortfolio.request(`${config.url}/storage/v1/object/portfolio-media/${path}`,{method:'POST',body:'test'});}
        catch(error){result.push({status:error.status,message:error.message});}
      }
      return result;
    });
    assert.equal(storageErrors[0].status,413);assert.match(storageErrors[0].message,/150 MB/);
    assert.match(storageErrors[1].message,/video\/quicktime/);
    console.log('PASS: storage size/type rejection is reported with actionable messages');

    for (const mimeType of ['video/quicktime','application/octet-stream','']) {
      await studio.locator('#files').setInputFiles({name:'camera.MOV',mimeType,buffer:Buffer.from('mock MOV upload')});
      await save();
      assert.equal(doc.projects.at(-1).cat,'video');
      assert(doc.projects.at(-1).video.endsWith('.mov'));
    }
    console.log('PASS: MOV upload with QuickTime, generic and missing MIME types (not codec playback)');

    // A stale editor must retain conflict protection for galleries as well.
    await card.locator('[data-field=sub]').fill('Concurrent change test');
    doc.revision++;
    await studio.locator('#save').evaluate(button => button.click());
    await studio.locator('#conflict').waitFor({state:'visible'});
    assert.equal(await studio.locator('#save').isDisabled(),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: revision conflict protection; no browser JavaScript errors');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
