(() => {
  'use strict';
  const $ = (selector,root = document) => root.querySelector(selector);
  const portfolio = window.LeoPortfolio;
  let config;
  let session = null;
  let projects = [];
  let revision = 0;
  let changes = 0;
  let savedChanges = 0;
  let saving = false;
  let conflict = false;
  let timer = null;
  let stopWatching = () => {};
  const previews = new Set();
  const list = $('#project-list');
  const types = new Set(['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm']);
  const dirty = () => changes !== savedChanges;

  function status(message,error = false) {
    $('#save-status').textContent = message;
    $('#save-status').dataset.error = String(error);
    $('#save').disabled = saving || conflict || !dirty();
  }
  function scheduleSave() {
    clearTimeout(timer);
    if (!conflict && !saving && dirty()) timer = setTimeout(save,900);
  }
  function changed() {
    changes++;
    status('Promjene čekaju spremanje.');
    scheduleSave();
  }
  function releasePreviews() {
    previews.forEach(url => URL.revokeObjectURL(url));
    previews.clear();
  }
  function revoke(url) {
    if (url && previews.delete(url)) URL.revokeObjectURL(url);
  }
  async function headers() {
    if (!session) throw new Error('Prijavi se za upravljanje radovima.');
    if (Date.now() >= session.expiresAt - 60000) {
      const refreshed = await portfolio.request(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
        method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})
      });
      session = {...refreshed,expiresAt:Date.now() + refreshed.expires_in * 1000};
    }
    return {apikey:config.publishableKey,Authorization:`Bearer ${session.access_token}`};
  }
  function showConflict() {
    conflict = true;
    clearTimeout(timer);
    $('#conflict').hidden = false;
    list.inert = true;
    $('#files').disabled = true;
    dropzone.setAttribute('aria-disabled','true');
    status('Pronađena je novija verzija radova.',true);
  }
  function render() {
    list.replaceChildren();
    $('#empty-state').hidden = projects.length !== 0;
    projects.forEach((project,index) => {
      const card = $('#project-template').content.firstElementChild.cloneNode(true);
      card.dataset.id = project.id;
      $('.editor-placeholder',card).textContent = project.short || project.name;
      const image = $('img',card);
      image.addEventListener('error',() => { image.hidden = true; });
      image.addEventListener('load',() => { image.hidden = false; });
      const source = project.preview || project.image;
      if (source) image.src = source;
      else image.hidden = true;
      $('.video-label',card).hidden = !project.video && !project.pendingVideo;
      card.querySelectorAll('[data-field]').forEach(input => {
        const field = input.dataset.field;
        if (input.type === 'checkbox') input.checked = project[field];
        else input.value = project[field] || '';
      });
      $('[data-action=up]',card).disabled = index === 0;
      $('[data-action=down]',card).disabled = index === projects.length - 1;
      list.append(card);
    });
  }
  function projectFor(element) {
    const id = element.closest('.editor-card')?.dataset.id;
    return projects.find(project => project.id === id);
  }
  list.addEventListener('input',e => {
    const field = e.target.dataset.field;
    const project = projectFor(e.target);
    if (!field || !project || conflict) return;
    if (field === 'featured' && e.target.checked && projects.filter(p => p.featured).length >= 5) {
      e.target.checked = false;
      $('#upload-status').textContent = 'Na naslovnoj može biti najviše pet radova. Najprije odznači neki od postojećih.';
      return;
    }
    project[field] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    changed();
  });
  list.addEventListener('click',e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const project = projectFor(e.target);
    if (!action || !project || conflict) return;
    const index = projects.indexOf(project);
    if (action === 'delete') {
      if (!confirm(`Ukloniti rad „${project.name}” s weba?`)) return;
      revoke(project.preview);
      projects.splice(index,1);
    } else {
      const target = index + (action === 'up' ? -1 : 1);
      if (target < 0 || target >= projects.length) return;
      [projects[index],projects[target]] = [projects[target],projects[index]];
    }
    changed();
    render();
    const card = list.querySelector(`[data-id="${project.id}"]`);
    if (card && action !== 'delete') $(`[data-action=${action}]`,card).focus();
  });

  let dragging = null;
  list.addEventListener('dragstart',e => {
    const project = projectFor(e.target);
    if (!project || conflict || e.target.closest('input,textarea,select,button,label')) { e.preventDefault(); return; }
    dragging = project.id;
    e.dataTransfer.setData('text/plain',project.id);
    e.dataTransfer.effectAllowed = 'move';
    e.target.closest('.editor-card').classList.add('is-dragging');
  });
  list.addEventListener('dragover',e => {
    if (!dragging || conflict) return;
    e.preventDefault();
    list.querySelectorAll('.is-target').forEach(card => card.classList.remove('is-target'));
    e.target.closest('.editor-card')?.classList.add('is-target');
  });
  list.addEventListener('drop',e => {
    if (!dragging || conflict) return;
    e.preventDefault();
    e.stopPropagation();
    const target = projectFor(e.target);
    const source = projects.find(p => p.id === dragging);
    if (source && target && source !== target) {
      const targetIndex = projects.indexOf(target);
      projects.splice(projects.indexOf(source),1);
      projects.splice(targetIndex,0,source);
      changed();
    }
    dragging = null;
    render();
  });
  list.addEventListener('dragend',() => {
    dragging = null;
    list.querySelectorAll('.is-dragging,.is-target').forEach(card => card.classList.remove('is-dragging','is-target'));
  });

  function validateFile(file) {
    if (!types.has(file.type)) throw new Error(`Datoteka „${file.name}” nema podržan format.`);
    if (file.size > 40 * 1024 * 1024) throw new Error(`Datoteka „${file.name}” je veća od 40 MB.`);
    if (!file.size) throw new Error(`Datoteka „${file.name}” je prazna.`);
  }
  function attachFile(project,file) {
    validateFile(file);
    if (file.type.startsWith('video/')) {
      project.pendingVideo = file;
      project.cat = 'video';
      project.art = 'city';
    } else {
      revoke(project.preview);
      project.pendingImage = file;
      project.preview = URL.createObjectURL(file);
      previews.add(project.preview);
    }
  }
  function addFiles(files) {
    if (!session || conflict) return;
    const errors = [];
    let added = 0;
    for (const file of files) {
      try {
        if (projects.length >= 200) throw new Error('U portfoliju može biti najviše 200 radova.');
        const name = file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim().slice(0,120) || 'Novi rad';
        const project = {id:crypto.randomUUID(),name,short:name.slice(0,60),sub:'',description:'',cat:'photo',art:'portrait',image:'',video:'',featured:projects.filter(p => p.featured).length < 5};
        attachFile(project,file);
        projects.push(project);
        added++;
      } catch (error) { errors.push(error.message); }
    }
    $('#upload-status').textContent = errors.join(' ');
    if (added) { changed(); render(); }
  }
  list.addEventListener('change',e => {
    if (!e.target.matches('[data-replace]') || conflict) return;
    const project = projectFor(e.target);
    const file = e.target.files[0];
    if (!project || !file) return;
    try { attachFile(project,file); changed(); render(); $('#upload-status').textContent = ''; }
    catch (error) { $('#upload-status').textContent = error.message; }
  });
  const dropzone = $('#dropzone');
  dropzone.addEventListener('click',() => { if (!conflict) $('#files').click(); });
  dropzone.addEventListener('keydown',e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!conflict) $('#files').click(); }
  });
  $('#files').addEventListener('change',e => { addFiles(e.target.files); e.target.value = ''; });
  document.addEventListener('dragover',e => {
    if (session && e.dataTransfer.types.includes('Files')) { e.preventDefault(); dropzone.classList.add('is-over'); }
  });
  document.addEventListener('dragleave',e => { if (!e.relatedTarget) dropzone.classList.remove('is-over'); });
  document.addEventListener('drop',e => {
    if (!session || !e.dataTransfer.files.length) return;
    e.preventDefault();
    dropzone.classList.remove('is-over');
    addFiles(e.dataTransfer.files);
  });

  async function prepareImage(file) {
    if (file.type === 'image/gif') return file;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      const ratio = Math.min(1,2400 / Math.max(bitmap.width,bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1,Math.round(bitmap.height * ratio));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
      return await new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Fotografiju nije moguće pripremiti.')),'image/webp',.88));
    } catch { throw new Error(`Fotografiju „${file.name}” nije moguće otvoriti.`); }
    finally { bitmap?.close(); }
  }
  async function upload(project,field,file) {
    const blob = field === 'image' ? await prepareImage(file) : file;
    const extension = {'image/webp':'webp','image/png':'png','image/jpeg':'jpg','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'}[blob.type];
    if (!extension) throw new Error('Datoteku nije moguće pripremiti za objavu.');
    const auth = await headers();
    const path = `${session.user.id}/${project.id}/${crypto.randomUUID()}.${extension}`;
    await portfolio.request(`${config.url}/storage/v1/object/portfolio-media/${path}`, {
      method:'POST',headers:{...auth,'Content-Type':blob.type,'x-upsert':'false','cache-control':'max-age=31536000'},body:blob
    },120000);
    return `${config.url}/storage/v1/object/public/portfolio-media/${path}`;
  }
  async function save() {
    clearTimeout(timer);
    if (!session || saving || conflict || !dirty()) return;
    saving = true;
    status('Spremam radove…');
    const version = changes;
    const snapshot = projects.map(p => ({...p}));
    let successful = false;
    try {
      if (snapshot.some(p => !p.name.trim())) throw new Error('Dodaj naziv svakom radu.');
      for (const project of snapshot) {
        for (const field of ['image','video']) {
          const pending = field === 'image' ? 'pendingImage' : 'pendingVideo';
          if (!project[pending]) continue;
          status(`Spremam: ${project.name}`);
          const url = await upload(project,field,project[pending]);
          project[field] = url;
          const live = projects.find(p => p.id === project.id);
          if (live && live[pending] === project[pending]) {
            live[field] = url;
            live[pending] = null;
            if (field === 'image') {
              revoke(live.preview);
              live.preview = null;
              const image = list.querySelector(`[data-id="${live.id}"] img`);
              if (image) { image.src = url; image.hidden = false; }
            }
          }
        }
      }
      if (version !== changes) {
        successful = true;
        status('Spremam preostale promjene…');
        return;
      }
      const normalized = portfolio.normalizeProjects(snapshot);
      const rows = await portfolio.request(`${config.url}/rest/v1/portfolio?id=eq.main&revision=eq.${revision}&select=revision`, {
        method:'PATCH',headers:{...await headers(),'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({projects:normalized})
      });
      if (!Array.isArray(rows) || rows.length !== 1) { showConflict(); return; }
      revision = rows[0].revision;
      savedChanges = version;
      successful = true;
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('leo-portfolio');
        channel.postMessage({type:'updated'});
        channel.close();
      }
      status(dirty() ? 'Spremam preostale promjene…' : 'Sve promjene spremljene i objavljene.');
    } catch (error) { status(error.message || 'Spremanje nije uspjelo. Pokušaj ponovno.',true); }
    finally {
      saving = false;
      $('#save').disabled = conflict || !dirty();
      if (successful && dirty()) scheduleSave();
    }
  }
  $('#save').addEventListener('click',save);
  $('#reload').addEventListener('click',async () => {
    if (saving || (dirty() && !confirm('Odbaciti nespremljene izmjene i učitati aktualne radove?'))) return;
    try {
      const doc = await portfolio.readRemote();
      releasePreviews();
      projects = doc.projects;
      revision = doc.revision;
      changes = savedChanges = 0;
      conflict = false;
      $('#conflict').hidden = true;
      list.inert = false;
      $('#files').disabled = false;
      dropzone.removeAttribute('aria-disabled');
      render();
      status('Učitana je aktualna verzija radova.');
    } catch (error) { status(error.message,true); }
  });
  $('#login-form').addEventListener('submit',async e => {
    e.preventDefault();
    $('#login-button').disabled = true;
    $('#login-status').textContent = 'Prijavljujem se…';
    try {
      const form = new FormData(e.target);
      const result = await portfolio.request(`${config.url}/auth/v1/token?grant_type=password`, {
        method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:form.get('email'),password:form.get('password')})
      });
      session = {...result,expiresAt:Date.now() + result.expires_in * 1000};
      const owner = await portfolio.request(`${config.url}/rest/v1/rpc/is_portfolio_owner`, {method:'POST',headers:{...await headers(),'Content-Type':'application/json'},body:'{}'});
      if (owner !== true) throw new Error('Ovaj račun nema pristup studiju.');
      const doc = await portfolio.readRemote();
      projects = doc.projects;
      revision = doc.revision;
      changes = savedChanges = 0;
      conflict = false;
      $('#conflict').hidden = true;
      list.inert = false;
      $('#files').disabled = false;
      dropzone.removeAttribute('aria-disabled');
      e.target.reset();
      $('#login-view').hidden = true;
      $('#workspace').hidden = false;
      $('#logout').hidden = false;
      status('Sve promjene spremljene.');
      render();
      stopWatching();
      stopWatching = portfolio.subscribe(doc => {
        if (!session || saving || doc.revision === revision) return;
        if (dirty()) { showConflict(); return; }
        releasePreviews();
        projects = doc.projects;
        revision = doc.revision;
        render();
        status('Učitane su nove promjene.');
      });
    } catch (error) {
      session = null;
      $('#login-status').textContent = error.status === 400 ? 'Provjeri e-mail i lozinku.' : error.message;
    } finally { $('#login-button').disabled = false; }
  });
  $('#logout').addEventListener('click',async () => {
    if (saving || (dirty() && !confirm('Odjaviti se i odbaciti nespremljene izmjene?'))) return;
    clearTimeout(timer);
    stopWatching();
    try { await portfolio.request(`${config.url}/auth/v1/logout?scope=local`, {method:'POST',headers:await headers()},5000); } catch { /* Always clear this tab's session. */ }
    session = null;
    releasePreviews();
    projects = [];
    list.replaceChildren();
    changes = savedChanges = 0;
    $('#workspace').hidden = true;
    $('#logout').hidden = true;
    $('#login-view').hidden = false;
    $('#login-status').textContent = 'Odjavljen si.';
    $('#login-form input').focus();
  });
  addEventListener('beforeunload',e => { if (dirty() || saving) { e.preventDefault(); e.returnValue = ''; } });
  portfolio.load().then(() => {
    config = portfolio.getConfig();
    $('#setup-notice').textContent = config ? 'Prijavi se vlasničkim računom.' : 'Studio je pripremljen. Prijavu i objavu radova treba aktivirati povezivanjem Supabase projekta.';
    $('#login-form').hidden = !config;
  }).catch(() => { $('#setup-notice').textContent = 'Vezu sa spremištem nije moguće provjeriti. Pokušaj osvježiti stranicu.'; });
})();
