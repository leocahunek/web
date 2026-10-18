(() => {
  'use strict';
  const base = new URL('../', document.currentScript.src);
  const categories = ['photo', 'video', 'design', 'travel'];
  const arts = ['portrait', 'city', 'design', 'space', 'travel', 'ritual'];
  const photoLimit = 100;
  let config = null;
  let current = null;
  let loading = null;
  let aboutDefaults = {};

  function normalizeAbout(value) {
    if (value == null) value = aboutDefaults;
    if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Neispravan sadržaj stranice O meni.');
    const text = (key,limit) => {
      const input = value[key] ?? aboutDefaults[key] ?? '';
      if (typeof input !== 'string' || input.length > limit) throw new Error('Provjeri duljinu i sadržaj polja O meni.');
      return input.trim();
    };
    const services = value.services ?? aboutDefaults.services ?? [];
    if (!Array.isArray(services) || services.length > 12 || services.some(item => typeof item !== 'string' || item.length > 80)) throw new Error('Dodaj najviše 12 usluga, svaku do 80 znakova.');
    const title = text('title',300);
    if (!title) throw new Error('Dodaj naslov stranice O meni.');
    return {eyebrow:text('eyebrow',120),title,role:text('role',160),body:text('body',10000),services:services.map(item => item.trim()).filter(Boolean),linkText:text('linkText',120),image:mediaURL(value.image ?? aboutDefaults.image),imageAlt:text('imageAlt',300),imageCaption:text('imageCaption',300),coordinate:text('coordinate',120)};
  }

  function mediaURL(value) {
    if (!value) return '';
    if (typeof value !== 'string' || value.length > 3000) throw new Error('Neispravna adresa datoteke.');
    const url = new URL(value, base);
    if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.origin === base.origin))) throw new Error('Datoteke trebaju sigurnu HTTPS adresu.');
    return url.href;
  }
  function normalizeProjects(value) {
    if (!Array.isArray(value) || value.length > 200) throw new Error('Popis može sadržavati najviše 200 radova.');
    const ids = new Set();
    const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
    const projects = value.map((p, i) => {
      if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !/^[\w-]{1,80}$/.test(p.id) || ids.has(p.id)) throw new Error('Radovi trebaju jedinstvene oznake.');
      ids.add(p.id);
      const name = text(p.name, 120);
      if (!name || !categories.includes(p.cat)) throw new Error('Dodaj naziv i kategoriju svakom radu.');
      if (p.images !== undefined && (!Array.isArray(p.images) || p.images.length > photoLimit || p.images.some(url => typeof url !== 'string' || !url))) throw new Error(`Projekt može sadržavati najviše ${photoLimit} fotografija s valjanim adresama.`);
      const images = p.images?.length ? p.images.map(mediaURL) : p.image ? [mediaURL(p.image)] : [];
      const image = images[0] || '';
      const video = mediaURL(p.video);
      if (!image && !video) throw new Error('Svakom radu dodaj fotografiju ili video.');
      return { id:p.id, name, sub:text(p.sub,160), short:text(p.short,60) || name, description:text(p.description,2000), cat:p.cat, art:arts.includes(p.art) ? p.art : p.cat === 'video' ? 'city' : p.cat === 'design' ? 'design' : p.cat === 'travel' ? 'travel' : 'portrait', image, images, video, featured:p.featured === true, year:String(i + 1).padStart(2,'0') };
    });
    if (projects.filter(p => p.featured).length > 5) throw new Error('Na naslovnoj odaberi najviše pet radova.');
    return projects;
  }
  function validateConfig(value) {
    if (!value?.url || !value?.publishableKey) return null;
    const url = new URL(value.url);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.endsWith('.supabase.co') || url.pathname !== '/') throw new Error('Neispravna adresa Supabase projekta.');
    const key = value.publishableKey;
    if (typeof key !== 'string' || key.length > 3000) throw new Error('Neispravan javni ključ.');
    if (!key.startsWith('sb_publishable_')) {
      let claims;
      try { claims = JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); } catch { throw new Error('Koristi isključivo javni publishable ili anon ključ.'); }
      if (claims.role !== 'anon') throw new Error('Privatni servisni ključevi ne smiju biti dio weba.');
    }
    return { url:url.origin, publishableKey:key };
  }
  function requestError(status,details = {},storage = false) {
    let message = status === 401 || status === 403 ? 'Prijava nema ovlasti za ovu radnju.' : `Spremište trenutačno nije dostupno (HTTP ${status}).`;
    if (storage) {
      details = details || {};
      const reason = [details.code,details.error,details.message].filter(value => typeof value === 'string').join(' ');
      if (status === 507 || /quota|insufficient.*storage|storage.*full|disk.*full/i.test(reason)) message = 'Supabase spremište je doseglo ograničenje prostora. Provjeri Storage potrošnju u Supabaseu.';
      else if (status === 413 || /entity.?too.?large|maximum allowed size|exceed.*size|size.*exceed/i.test(reason)) message = 'Supabase odbija veličinu datoteke. Provjeri globalni i bucket limit; primjenjuje se niži limit.';
      else if (status === 415 || /mime|content.?type|file.?type/i.test(reason)) message = 'Supabase odbija format datoteke. Provjeri dopuštene formate bucketa portfolio-media.';
    }
    const error = new Error(message);
    error.status = status;
    return error;
  }
  async function request(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal:controller.signal, cache:'no-store', referrerPolicy:'no-referrer' });
      if (!response.ok) throw requestError(response.status,await response.json().catch(() => ({})),String(url).includes('/storage/v1/'));
      return response.status === 204 ? null : response.json();
    } finally { clearTimeout(timer); }
  }
  function readCache() {
    try {
      const saved = JSON.parse(localStorage.getItem('leo-portfolio-cache'));
      if (saved?.source === config.url) return { projects:normalizeProjects(saved.projects), about:normalizeAbout(saved.about), aboutSupported:saved.aboutSupported === true, revision:saved.revision, remote:true };
    } catch { /* Cached public content is optional. */ }
    return null;
  }
  function saveCache(doc) {
    try { localStorage.setItem('leo-portfolio-cache', JSON.stringify({source:config.url, ...doc})); } catch { /* Storage can be disabled. */ }
  }
  async function readRemote() {
    if (!config) return null;
    let rows;
    try {
      rows = await request(`${config.url}/rest/v1/portfolio?id=eq.main&select=projects,revision,about`, {headers:{apikey:config.publishableKey}}, 5000);
    } catch (error) {
      if (error.status !== 400) throw error;
      rows = await request(`${config.url}/rest/v1/portfolio?id=eq.main&select=projects,revision`, {headers:{apikey:config.publishableKey}}, 5000);
    }
    if (!Array.isArray(rows) || rows.length !== 1 || !Number.isSafeInteger(rows[0].revision)) throw new Error('Spremište radova nije postavljeno.');
    return { projects:normalizeProjects(rows[0].projects), about:normalizeAbout(rows[0].about), aboutSupported:Object.hasOwn(rows[0],'about'), revision:rows[0].revision, remote:true };
  }
  async function load({waitForRemote = true} = {}) {
    if (loading) return loading;
    loading = (async () => {
      const [manifest, settings, about] = await Promise.all([
        request(new URL('data/portfolio.json',base)),
        request(new URL('data/portfolio-config.json',base)).catch(() => null),
        request(new URL('data/about.json',base))
      ]);
      config = validateConfig(settings);
      aboutDefaults = normalizeAbout(about);
      current = {projects:normalizeProjects(manifest.projects), about:aboutDefaults, aboutSupported:false, revision:0, remote:false};
      if (config) {
        current = readCache() || current;
        if (waitForRemote) {
          try { current = await readRemote(); saveCache(current); } catch { /* Keep the last published content available offline. */ }
        }
      }
      return current;
    })();
    return loading;
  }
  function subscribe(callback,{refreshImmediately = false} = {}) {
    if (!config) return () => {};
    let busy = false;
    let stopped = false;
    const refresh = async () => {
      if (busy || stopped || document.hidden) return;
      busy = true;
      try {
        const next = await readRemote();
        if (!stopped && (!current?.remote || next.revision !== current.revision)) {
          current = next;
          saveCache(next);
          callback(next);
        }
      } catch { /* Retry when the connection returns. */ }
      finally { busy = false; }
    };
    const interval = setInterval(refresh,5000);
    document.addEventListener('visibilitychange',refresh);
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('leo-portfolio') : null;
    if (channel) channel.onmessage = refresh;
    if (refreshImmediately) refresh();
    return () => { stopped = true; clearInterval(interval); document.removeEventListener('visibilitychange',refresh); channel?.close(); };
  }
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function imageURL(project, width = 1000) {
    if (!project.image) return '';
    const url = new URL(project.image);
    if (url.hostname === 'images.unsplash.com') {
      Object.entries({w:String(width),auto:'format',fit:'crop',q:'85'}).forEach(([key,value]) => url.searchParams.set(key,value));
    }
    return url.href;
  }
  window.LeoPortfolio = Object.freeze({ load, subscribe, normalizeProjects, normalizeAbout, mediaURL, imageURL, escapeHTML, request, requestError, photoLimit, getConfig:() => config, readRemote });
})();
