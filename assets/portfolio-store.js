(() => {
  'use strict';
  const base = new URL('../', document.currentScript.src);
  const categories = ['photo', 'video', 'design'];
  const arts = ['portrait', 'city', 'design', 'space', 'travel', 'ritual'];
  const photoLimit = 100;
  let config = null;
  let current = null;
  let loading = null;

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
      return { id:p.id, name, sub:text(p.sub,160), short:text(p.short,60) || name, description:text(p.description,2000), cat:p.cat, art:arts.includes(p.art) ? p.art : p.cat === 'video' ? 'city' : p.cat === 'design' ? 'design' : 'portrait', image, images, video, featured:p.featured === true, year:String(i + 1).padStart(2,'0') };
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
  async function request(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal:controller.signal, cache:'no-store', referrerPolicy:'no-referrer' });
      if (!response.ok) {
        const error = new Error(response.status === 401 || response.status === 403 ? 'Prijava nema ovlasti za ovu radnju.' : 'Spremište trenutačno nije dostupno.');
        error.status = response.status;
        throw error;
      }
      return response.status === 204 ? null : response.json();
    } finally { clearTimeout(timer); }
  }
  function readCache() {
    try {
      const saved = JSON.parse(localStorage.getItem('leo-portfolio-cache'));
      if (saved?.source === config.url) return { projects:normalizeProjects(saved.projects), revision:saved.revision, remote:true };
    } catch { /* Cached public content is optional. */ }
    return null;
  }
  function saveCache(doc) {
    try { localStorage.setItem('leo-portfolio-cache', JSON.stringify({source:config.url, ...doc})); } catch { /* Storage can be disabled. */ }
  }
  async function readRemote() {
    if (!config) return null;
    const rows = await request(`${config.url}/rest/v1/portfolio?id=eq.main&select=projects,revision`, {headers:{apikey:config.publishableKey}}, 5000);
    if (!Array.isArray(rows) || rows.length !== 1 || !Number.isSafeInteger(rows[0].revision)) throw new Error('Spremište radova nije postavljeno.');
    return { projects:normalizeProjects(rows[0].projects), revision:rows[0].revision, remote:true };
  }
  async function load() {
    if (loading) return loading;
    loading = (async () => {
      const [manifest, settings] = await Promise.all([
        request(new URL('data/portfolio.json',base)),
        request(new URL('data/portfolio-config.json',base)).catch(() => null)
      ]);
      config = validateConfig(settings);
      current = {projects:normalizeProjects(manifest.projects), revision:0, remote:false};
      if (config) {
        current = readCache() || current;
        try { current = await readRemote(); saveCache(current); } catch { /* Keep the last published content available offline. */ }
      }
      return current;
    })();
    return loading;
  }
  function subscribe(callback) {
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
  window.LeoPortfolio = Object.freeze({ load, subscribe, normalizeProjects, mediaURL, imageURL, escapeHTML, request, photoLimit, getConfig:() => config, readRemote });
})();
