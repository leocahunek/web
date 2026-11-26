(() => {
  'use strict';
  const portfolio = window.LeoPortfolio;
  const { repository, branch, manifest, mediaDirectory, videoLimit } = portfolio.github;
  const api = `https://api.github.com/repos/${repository}`;
  const maxMediaBytes = 450 * 1024 * 1024;
  const assetPath = new RegExp(`^${mediaDirectory}[a-f0-9]{64}\\.(?:webp|png|jpg|gif|mp4|webm|mov)$`);
  const owner = repository.split('/')[0];

  function open(token) {
    if (!/^github_pat_[a-zA-Z0-9_]+$/.test(token)) throw new Error('Koristi fine-grained token za ovaj repozitorij.');
    const staged = new Map();
    async function request(url, method = 'GET', payload, signal) {
      const response = await fetch(url, {
        method, signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(120000)]) : AbortSignal.timeout(15000),
        cache:'no-store', redirect:'error', referrerPolicy:'no-referrer',
        headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},
        body:payload === undefined ? undefined : JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = new Error(response.status === 401 || response.status === 403
          ? 'GitHub je odbio pristup. Provjeri rok tokena i ovlast Contents: Read and write.'
          : `GitHub nije dovršio zahtjev (HTTP ${response.status}).`);
        error.status = response.status;
        throw error;
      }
      return response.json();
    }
    const repo = (path, method, payload, signal) => request(path ? `${api}/${path}` : api,method,payload,signal);
    const branchRef = `git/ref/heads/${branch}`;
    async function atCommit(commit) {
      let file;
      try { file = await repo(`contents/${manifest}?ref=${commit}`); }
      catch (error) { if (error.status === 404) return null; throw error; }
      const bytes = Uint8Array.from(atob(file.content),character => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }
    async function read() {
      const {object} = await repo(branchRef);
      const published = await atCommit(object.sha);
      if (published) return portfolio.normalizePublished(published);
      const old = await portfolio.readSupabase().catch(() => portfolio.readSupabaseCache());
      return {projects:old?.projects || [],about:old?.about || portfolio.normalizeAbout(),aboutSupported:true,revision:null};
    }
    async function authorize() {
      const [user, info] = await Promise.all([request('https://api.github.com/user'),repo('')]);
      if (user.login.toLowerCase() !== owner || !info.permissions?.push) throw new Error('Prijavi se GitHub računom vlasnika portfolija.');
      return read();
    }
    async function stage(blob,extension) {
      const bytes = await blob.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256',bytes);
      const id = Array.from(new Uint8Array(digest),value => value.toString(16).padStart(2,'0')).join('');
      const path = `${mediaDirectory}${id}.${extension}`;
      staged.set(path,blob);
      return portfolio.mediaURL(path);
    }
    function localPath(value) {
      const url = new URL(value);
      const base = new URL(portfolio.mediaURL(mediaDirectory));
      const path = mediaDirectory + url.pathname.slice(base.pathname.length);
      return url.origin === base.origin && url.pathname.startsWith(base.pathname) && assetPath.test(path) ? path : null;
    }
    async function upload(blob,signal) {
      const data = await new Promise((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      return repo('git/blobs','POST',{content:data,encoding:'base64'},signal);
    }
    async function save(payload, expectedRevision, report, signal) {
      const {object} = await repo(branchRef);
      const [head,published] = await Promise.all([repo(`git/commits/${object.sha}`),atCommit(object.sha)]);
      if ((published?.revision ?? null) !== expectedRevision) return null;
      const paths = new Set(payload.projects.flatMap(project => [...project.images,project.video]).concat(payload.about.image).filter(Boolean).map(localPath).filter(Boolean));
      const previous = published?.media || {};
      const media = {};
      for (const path of paths) {
        const size = staged.get(path)?.size ?? previous[path];
        if (!Number.isSafeInteger(size) || size <= 0) throw new Error('Fotografija nedostaje u spremištu. Ponovno dodaj datoteku u Studio.');
        media[path] = size;
      }
      if (Object.values(media).reduce((total,size) => total + size,0) > maxMediaBytes) {
        throw new Error('Portfolio je dosegao 450 MB. Oslobodi prostor uklanjanjem većih videa ili zamijeni datoteke manjim kopijama.');
      }

      const publishedURL = value => value ? localPath(value) || value : '';
      const projects = payload.projects.map(project => ({
        ...project, image:publishedURL(project.image), images:project.images.map(publishedURL), video:publishedURL(project.video)
      }));
      const about = {...payload.about,image:publishedURL(payload.about.image)};
      const document = {projects,about,revision:(expectedRevision ?? 0) + 1,media};
      const content = JSON.stringify(document,null,2) + '\n';
      if (new TextEncoder().encode(content).byteLength > 900 * 1024) {
        throw new Error('Popis radova je prevelik. Skrati opise ili podijeli najopsežnije galerije.');
      }
      const edits = [{path:manifest,mode:'100644',type:'blob',content}];
      for (const path of Object.keys(previous)) {
        if (assetPath.test(path) && !paths.has(path)) edits.push({path,mode:'100644',type:'blob',sha:null});
      }
      const newPaths = [...paths].filter(path => !Object.hasOwn(previous,path));
      for (const [index,path] of newPaths.entries()) {
        report(`Prenosim datoteke na GitHub (${index + 1}/${newPaths.length})…`);
        const {sha} = await upload(staged.get(path),signal);
        edits.push({path,mode:'100644',type:'blob',sha});
      }
      signal.throwIfAborted();
      report('Spremam promjene na GitHub…');
      const {sha:tree} = await repo('git/trees','POST',{base_tree:head.tree.sha,tree:edits});
      const {sha:commit} = await repo('git/commits','POST',{message:'Ažuriraj portfolio iz Studija',tree,parents:[object.sha]});
      try {
        await repo(`git/refs/heads/${branch}`,'PATCH',{sha:commit,force:false});
      } catch (error) {
        const latest = await repo(branchRef).catch(() => null);
        if (latest?.object.sha !== commit) {
          if (latest && latest.object.sha !== object.sha) return null;
          throw error;
        }
      }
      staged.clear();
      return document.revision;
    }
    return {authorize,read,stage,save};
  }
  window.LeoGithubStorage = Object.freeze({open,videoLimit});
})();
