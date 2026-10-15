(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const projects = [
    { name: 'Između svjetla i sjene', sub: 'Portretna fotografija', cat: 'photo', art: 'portrait', img: 'photo-1534528741775-53994a69daeb', short: 'Portraits', year: '01' },
    { name: 'Grad u pokretu', sub: 'Video / ogledni film', cat: 'video', art: 'city', img: 'photo-1519608487953-e999c86e7455', short: 'After hours', year: '02' },
    { name: 'Forma & karakter', sub: 'Vizualni identitet / koncept', cat: 'design', art: 'design', img: 'photo-1634942536790-2539db948f1f', short: 'Objects', year: '03' },
    { name: 'Tišina prostora', sub: 'Arhitektura i interijer', cat: 'photo', art: 'space', img: 'photo-1600210492486-724fe5c67fb0', short: 'Spaces', year: '04' },
    { name: 'Negdje usput', sub: 'Travel fotografija', cat: 'photo', art: 'travel', img: 'photo-1464822759023-fed622ff2c3b', short: 'Elsewhere', year: '05' },
    { name: 'Mali rituali', sub: 'Produkt i lifestyle fotografija', cat: 'photo', art: 'ritual', img: 'photo-1442512595331-e89e73853f31', short: 'Rituals', year: '06' }
  ];
  const categories = { photo: 'Fotografija', video: 'Film & montaža', design: 'Grafički dizajn' };
  const imageURL = (p, width = 1000) => `https://images.unsplash.com/${p.img}?w=${width}&auto=format&fit=crop&q=85`;
  const artHTML = p => `<div class="media-art art-${p.art}" aria-hidden="true"><span class="art-grid"></span><span class="art-index">${p.year}</span></div>`;
  const imageHTML = (p, lazy = true) => `<img class="media-image" src="${imageURL(p)}" alt="${p.sub}" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'}>`;
  function watchImages(root = document) {
    $$('.media-image', root).forEach(img => {
      const loaded = () => { if (img.naturalWidth > 0) img.classList.add('is-loaded'); };
      img.addEventListener('load', loaded, { once: true });
      if (img.complete) loaded();
    });
  }

  let introRunning = !!$('.shutter');
  let restartAutoplay = () => {};
  let syncPauseButton = () => {};
  const gallery = $('.gallery');
  if ($(".covers")) {
  const covers = $('.covers');
  const featured = projects.slice(0, 5);
  const hero = $('.hero');
  let active = 0;
  let userPaused = false;
  let hoverPaused = false;
  let focusPaused = false;
  let autoplay;
  let lastSwipe = 0;
  featured.forEach((p, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cover';
    button.setAttribute('aria-label', `Prikaži ${p.name}, rad ${i + 1} od ${featured.length}`);
    button.innerHTML = `${artHTML(p)}${imageHTML(p, i !== 0)}<span class="cover-topline" aria-hidden="true"><span>LEO / SELECTED WORK</span><span>${p.year} / 05</span></span><span class="cover-label" aria-hidden="true"><span><small>${categories[p.cat]}</small><strong>${p.short}</strong></span><span class="cover-open"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></span></span>`;
    button.addEventListener('click', () => {
      if (performance.now() - lastSwipe < 400) return;
      if (active === i) openProject(i);
      else { active = i; renderDeck(true); restartAutoplay(); }
    });
    covers.append(button);
  });
  function renderDeck(announce = false) {
    [...covers.children].forEach((el, i) => {
      let distance = (i - active + featured.length) % featured.length;
      if (distance > featured.length / 2) distance -= featured.length;
      el.style.setProperty('--distance', distance);
      el.style.setProperty('--depth', Math.abs(distance));
      el.style.zIndex = featured.length - Math.abs(distance);
      el.classList.toggle('is-active', distance === 0);
      el.tabIndex = distance === 0 ? 0 : -1;
      el.setAttribute('aria-current', String(distance === 0));
    });
    $('#counter').textContent = `${String(active + 1).padStart(2, '0')} / ${String(featured.length).padStart(2, '0')}`;
    if (announce) $('#carousel-status').textContent = `${featured[active].name}. Rad ${active + 1} od ${featured.length}.`;
  }
  function stepDeck(direction, announce = true) {
    active = (active + direction + featured.length) % featured.length;
    renderDeck(announce);
  }
  restartAutoplay = function () {
    clearInterval(autoplay);
    if (motion.matches || userPaused || hoverPaused || focusPaused || introRunning || document.hidden || $('#lightbox').open) return;
    autoplay = setInterval(() => stepDeck(1, false), 6000);
  };
  $('#prev').addEventListener('click', () => { stepDeck(-1); restartAutoplay(); });
  $('#next').addEventListener('click', () => { stepDeck(1); restartAutoplay(); });
  const pause = $('#pause');
  syncPauseButton = function () {
    pause.hidden = motion.matches;
    pause.setAttribute('aria-pressed', String(userPaused));
    pause.setAttribute('aria-label', userPaused ? 'Pokreni automatsko listanje' : 'Pauziraj automatsko listanje');
    pause.title = pause.getAttribute('aria-label');
    pause.firstElementChild.innerHTML = userPaused ? '<svg class="ui-icon play-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8 5 11 7-11 7Z"/></svg>' : '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5v14M15 5v14"/></svg>';
  };
  pause.addEventListener('click', () => { userPaused = !userPaused; syncPauseButton(); restartAutoplay(); });
  covers.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hoverPaused = true; restartAutoplay(); } });
  covers.addEventListener('pointerleave', () => { hoverPaused = false; restartAutoplay(); });
  hero.addEventListener('focusin', () => { focusPaused = true; restartAutoplay(); });
  hero.addEventListener('focusout', e => { if (!hero.contains(e.relatedTarget)) { focusPaused = false; restartAutoplay(); } });
  covers.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    stepDeck(e.key === 'ArrowLeft' ? -1 : 1);
    covers.children[active].focus({ preventScroll: true });
    restartAutoplay();
  });
  let pointerStart;
  covers.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') pointerStart = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  covers.addEventListener('pointerup', e => {
    if (!pointerStart || pointerStart.id !== e.pointerId) return;
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      lastSwipe = performance.now();
      stepDeck(dx < 0 ? 1 : -1);
      restartAutoplay();
    }
  });
  covers.addEventListener('pointercancel', () => { pointerStart = null; });
  document.addEventListener('visibilitychange', restartAutoplay);
  renderDeck();
  syncPauseButton();

  }

  if (gallery) {
  projects.forEach((p, i) => {
    const figure = document.createElement('figure');
    figure.className = 'project';
    figure.dataset.category = p.cat;
    figure.dataset.reveal = '';
    figure.style.setProperty('--reveal-delay', `${(i % 2) * 100}ms`);
    figure.innerHTML = `<button type="button" class="project-media" aria-label="Otvori ${p.name}">${artHTML(p)}${imageHTML(p)}<span class="project-tag" aria-hidden="true">${categories[p.cat]}</span>${p.cat === 'video' ? '<span class="play" aria-hidden="true"><span><svg class="ui-icon play-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8 5 11 7-11 7Z"/></svg></span></span>' : ''}<span class="project-open" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button><figcaption><div><h3>${p.name}</h3><p>${p.sub}</p></div><span class="project-number" aria-hidden="true">/${p.year}</span></figcaption>`;
    $('.project-media', figure).addEventListener('click', () => openProject(i));
    gallery.append(figure);
  });
  $$('.filter').forEach(button => button.addEventListener('click', () => {
    if (button.classList.contains('active')) return;
    $$('.filter').forEach(other => {
      other.classList.toggle('active', other === button);
      other.setAttribute('aria-pressed', String(other === button));
    });
    let count = 0;
    $$('.project').forEach(card => {
      card.getAnimations().forEach(animation => animation.cancel());
      card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
      if (!card.hidden) {
        card.classList.add('is-visible');
        if (!motion.matches) card.animate([{ opacity: .15, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 450, delay: count * 45, easing: 'cubic-bezier(.22,1,.36,1)' });
        count++;
      }
    });
    $('.project-count').textContent = `${String(count).padStart(2, '0')} / RADOVA`;
  }));

  }

  const dialog = $('#lightbox');
  let openIndex = 0;
  function renderLightbox() {
    const p = projects[openIndex];
    $('.dialog-category').textContent = `${p.year} / ${categories[p.cat]}`;
    $('#lightbox-title').textContent = p.name;
    $('#lightbox-description').textContent = p.cat === 'video' ? 'Ogledni video za demonstraciju reprodukcije.' : 'Ogledni vizual za prikaz dizajna portfolija.';
    const content = $('#lightbox-content');
    content.innerHTML = p.cat === 'video'
      ? '<div class="dialog-media"><video controls autoplay playsinline aria-label="Ogledni video, cvijet na vjetru" src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"></video></div><p class="video-status" role="status"></p>'
      : `<div class="dialog-media">${artHTML(p)}<img class="media-image" src="${imageURL(p, 1600)}" alt="${p.sub}"></div>`;
    watchImages(content);
    const video = $('video', content);
    if (video) video.addEventListener('error', () => { $('.video-status', content).textContent = 'Ogledni video trenutačno nije dostupan. Možeš nastaviti pregledavati ostale radove.'; }, { once: true });
  }
  function openProject(index) {
    if (!dialog) return;
    openIndex = index;
    renderLightbox();
    dialog.showModal();
    document.body.classList.add('modal-open');
    restartAutoplay();
  }
  function stepLightbox(direction) {
    openIndex = (openIndex + direction + projects.length) % projects.length;
    renderLightbox();
  }
  $('.dialog-close')?.addEventListener('click', () => dialog.close());
  $('#lightbox-prev')?.addEventListener('click', () => stepLightbox(-1));
  $('#lightbox-next')?.addEventListener('click', () => stepLightbox(1));
  dialog?.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog?.addEventListener('keydown', e => {
    if (e.target.closest('video')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(e.key === 'ArrowLeft' ? -1 : 1); }
  });
  dialog?.addEventListener('close', () => {
    $('#lightbox-content').replaceChildren();
    document.body.classList.remove('modal-open');
    restartAutoplay();
  });

  const menu = $('.menu-button');
  const navigation = $('.nav');
  function setMenu(open) {
    navigation.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    $('.menu-label').textContent = open ? 'Zatvori' : 'Meni';
  }
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  $$('.nav a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', e => { if (!e.target.closest('.site-header')) setMenu(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); }
  });
  matchMedia('(min-width:801px)').addEventListener('change', () => setMenu(false));
  let scrollQueued = false;
  function syncHeader() {
    $('.site-header').classList.toggle('scrolled', scrollY > 25);
    scrollQueued = false;
  }
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(syncHeader); } }, { passive: true });
  syncHeader();

  const revealElements = $$('[data-reveal]');
  let revealObserver;
  if ('IntersectionObserver' in window && !motion.matches) {
    revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
    }), { threshold: .08, rootMargin: '0px 0px -25px 0px' });
    revealElements.forEach(el => { el.classList.add('reveal-ready'); revealObserver.observe(el); });
  }
  watchImages();

  $('#inquiry')?.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(e.target);
    const text = `UPIT ZA SURADNJU — LEO CAHUNEK\n\nIme: ${data.get('name')}\nE-mail: ${data.get('email')}\nUsluga: ${data.get('service')}\nBudžet: ${data.get('budget')}\nRok: ${data.get('deadline') || 'Po dogovoru'}\n\n${data.get('message')}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Leo-Cahunek-upit.txt';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('.form-status').textContent = 'Upit je pripremljen za preuzimanje. Nije poslan — e-mail adresa studija još nije povezana.';
  });

  // Six physical blades, with the original 650ms pause and 2900ms opening.
  const shutter = $('.shutter');
  const bladesGroup = $('#aperture-blades');
  const introContent = $$('.site-header, main, .site-footer');
  let frame;
  let introStart;
  const blades = Array.from({ length: shutter ? 6 : 0 }, () => {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    bladesGroup.append(polygon);
    return polygon;
  });
  function finishIntro() {
    if (!introRunning) return;
    introRunning = false;
    cancelAnimationFrame(frame);
    const returnFocus = shutter.contains(document.activeElement);
    document.documentElement.classList.remove('intro-running');
    document.documentElement.classList.add('intro-done');
    document.documentElement.style.overflow = '';
    introContent.forEach(el => { el.inert = false; });
    shutter.remove();
    if (returnFocus) $('.site-header .brand').focus({ preventScroll: true });
    restartAutoplay();
  }
  function drawBlades(progress) {
    const eased = progress * progress * (3 - 2 * progress);
    const radius = 240 * eased;
    const twist = (1 - eased) * .65;
    const point = (r, angle) => [r * Math.cos(angle), r * Math.sin(angle)].join(',');
    blades.forEach((blade, i) => {
      const a = i * Math.PI / 3;
      const b = (i + 1) * Math.PI / 3;
      blade.setAttribute('points', [point(430, a), point(430, b), point(radius, b + twist), point(radius, a + twist)].join(' '));
    });
    bladesGroup.setAttribute('transform', `rotate(${eased * 24})`);
    $('.shutter-caption').style.opacity = progress > .15 ? '0' : '1';
  }
  $('.skip-intro')?.addEventListener('click', finishIntro);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && introRunning) finishIntro(); });
  if (!shutter || motion.matches) finishIntro();
  else {
    introContent.forEach(el => { el.inert = true; });
    document.documentElement.style.overflow = 'hidden';
    drawBlades(0);
    function tick(now) {
      if (introStart === undefined) introStart = now;
      const progress = Math.max(0, Math.min(1, (now - introStart - 650) / 2900));
      drawBlades(progress);
      if (progress < 1) frame = requestAnimationFrame(tick); else finishIntro();
    }
    frame = requestAnimationFrame(tick);
  }
  motion.addEventListener('change', () => {
    if (motion.matches) {
      finishIntro();
      revealObserver?.disconnect();
      revealElements.forEach(el => el.classList.add('is-visible'));
      $$('.project').forEach(card => card.getAnimations().forEach(animation => animation.cancel()));
    }
    syncPauseButton();
    restartAutoplay();
  });
})();
