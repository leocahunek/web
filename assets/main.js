(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  // Upgrade the old noninteractive badge when cached HTML loads the new script.
  const availability = $('.availability');
  if (availability && availability.tagName !== 'A') {
    const link = document.createElement('a');
    link.className = availability.className;
    link.href = 'kontakt.html';
    link.append(...availability.childNodes);
    availability.replaceWith(link);
  }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motion.matches;
  let projects = [];
  const portfolio = window.LeoPortfolio;
  const esc = portfolio.escapeHTML;
  const categories = { photo: 'Fotografija', video: 'Film & montaža', design: 'Grafički dizajn', travel: 'Putopisna fotografija' };
  const imageURL = portfolio.imageURL;
  const artHTML = p => `<div class="media-art art-${p.art}" aria-hidden="true"><span class="art-grid"></span><span class="art-index">${p.year}</span></div>`;
  const imageHTML = (p, lazy = true) => p.image ? `<img class="media-image" src="${esc(imageURL(p))}" alt="${esc(p.sub)}" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'}>` : '';
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
  let disposeDeck = () => {};
  let savedDeck = { paused:false, selectedId:null, focused:false,position:0,ids:'' };
  const gallery = $('.gallery');
  function mountDeck() {
    const covers = $('.covers');
    if (!covers) return;
    covers.replaceChildren();
    const featured = projects.filter(p => p.featured).slice(0,5);
    const total = featured.length;
    restartAutoplay = () => {};
    syncPauseButton = () => {};
    $('#prev').disabled = $('#next').disabled = total < 2;
    $('#pause').hidden = total < 2;
    covers.setAttribute('aria-busy','false');
    if (!total) {
      const empty = document.createElement('p');
      empty.className = 'portfolio-empty';
      empty.textContent = 'Novi radovi uskoro.';
      covers.append(empty);
      $('#counter').textContent = '00 / 00';
      $('.hero-footnote').textContent = 'ODABRANI RADOVI';
      disposeDeck = () => {};
      return;
    }
    const events = new AbortController();
    const on = (target,type,handler,options = {}) => target.addEventListener(type,handler,{...options,signal:events.signal});
    const fullTurn = Math.PI * 2;
    const unitsPerMs = total / 30000;
    const featuredIds = featured.map(p => p.id).join(',');
    let position = savedDeck.ids === featuredIds ? savedDeck.position : Math.max(0,featured.findIndex(p => p.id === savedDeck.selectedId));
    let selected = -1;
    let userPaused = savedDeck.paused;
    let focusPaused = false;
    let offscreen = false;
    let frame = null;
    let previousTime = null;
    let manualMove = null;
    let lastSwipe = -Infinity;
    let scrollBoost = 0;
    let geometry = { radiusX: 0, radiusY: 0, depthY: 0 };

    featured.forEach((p, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cover';
      button.setAttribute('aria-label', `Prikaži ${p.name}, rad ${i + 1} od ${total}`);
      button.innerHTML = `${artHTML(p)}${imageHTML(p, i !== 0)}<span class="cover-topline" aria-hidden="true"><span>LEO / SELECTED WORK</span><span>${String(i + 1).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span></span><span class="cover-label" aria-hidden="true"><span><small>${categories[p.cat]}</small><strong>${esc(p.short)}</strong></span><span class="cover-open"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></span></span>`;
      on(button,'click', () => {
        if (performance.now() - lastSwipe < 400) return;
        if (selected === i) openProject(projects.indexOf(p));
        else {
          const distance = ((i - position + total * 1.5) % total + total) % total - total / 2;
          moveTo(position + distance);
        }
      });
      covers.append(button);
    });
    const cards = [...covers.children];

    function measureOrbit() {
      const width = covers.clientWidth;
      const cardWidth = cards[0].offsetWidth;
      const sideBySide = innerHeight <= 500 && innerWidth >= 600;
      geometry.radiusX = width * (width <= 560 && !sideBySide ? .64 : .34);
      if (sideBySide) geometry.radiusX = Math.min(geometry.radiusX, Math.max(0, (width - cardWidth) / 2));
      geometry.radiusY = Math.min(geometry.radiusX * (width <= 560 ? .54 : .4), covers.clientHeight * .1);
      geometry.depthY = cardWidth * .15;
      renderOrbit();
    }
    function renderOrbit(announce = false) {
      // The front half travels right/up to left/down; the return passes behind it.
      cards.forEach((card, i) => {
        const angle = total === 1 ? Math.PI / 2 : (position - i) * fullTurn / total + Math.PI / 2;
        const depth = (Math.sin(angle) + 1) / 2;
        const x = Math.cos(angle) * geometry.radiusX;
        const y = -Math.cos(angle) * geometry.radiusY + Math.sin(angle) * geometry.depthY;
        const scale = .58 + depth * .42;
        const yaw = -Math.cos(angle) * 14;
        const tilt = -8 + depth * 5;
        card.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) rotateY(${yaw.toFixed(3)}deg) rotateZ(${tilt.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
        card.style.zIndex = String(Math.round(depth * 100));
        card.style.filter = `brightness(${(.38 + depth * .62).toFixed(3)})`;
        card.style.opacity = String((.4 + depth * .6).toFixed(3));

      });
      const next = ((Math.round(position) % total) + total) % total;
      if (next !== selected) {
        selected = next;
        cards.forEach((card, i) => {
          card.classList.toggle('is-active', i === selected);
          card.tabIndex = i === selected ? 0 : -1;
          card.setAttribute('aria-current', String(i === selected));
        });
        $('#counter').textContent = `${String(selected + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
      }
      if (announce) $('#carousel-status').textContent = `${featured[selected].name}. Rad ${selected + 1} od ${total}.`;
    }
    function mayRun() {
      return total > 1 && !reducedMotion && !userPaused && !focusPaused && !offscreen && !document.hidden && !$('#lightbox').open;
    }
    function tick(now) {
      frame = null;
      const elapsed = previousTime === null ? 0 : Math.min(80, now - previousTime);
      if (manualMove) {
        if (manualMove.started === null) manualMove.started = now;
        const progress = Math.min(1, (now - manualMove.started) / 850);
        const eased = progress * progress * (3 - 2 * progress);
        position = manualMove.from + (manualMove.to - manualMove.from) * eased;
        if (progress === 1) {
          manualMove = null;
          renderOrbit(true);
        }
      } else if (mayRun() && previousTime !== null) {
        position += elapsed * unitsPerMs * (1 + scrollBoost);
        // Keep phase bounded after long-running visits without changing the orbit.
        position = ((position % total) + total) % total;
      }
      scrollBoost *= Math.exp(-elapsed / 650);
      renderOrbit();
      previousTime = now;
      if (manualMove || mayRun()) frame = requestAnimationFrame(tick);
      else previousTime = null;
    }
    restartAutoplay = function () {
      if (reducedMotion && manualMove) {
        position = manualMove.to;
        manualMove = null;
        renderOrbit(true);
      }
      const blocked = document.hidden || $('#lightbox').open || offscreen;
      if (!mayRun()) scrollBoost = 0;
      if (blocked || (!manualMove && !mayRun())) {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        previousTime = null;
      } else if (frame === null) {
        previousTime = null;
        frame = requestAnimationFrame(tick);
      }
    };
    function moveTo(target) {
      if (reducedMotion) {
        position = target;
        renderOrbit(true);
      } else manualMove = { from: position, to: target, started: null };
      restartAutoplay();
    }
    function stepDeck(direction) { moveTo(Math.round(manualMove?.to ?? position) + direction); }
    on($('#prev'),'click', () => stepDeck(-1));
    on($('#next'),'click', () => stepDeck(1));
    const pause = $('#pause');
    syncPauseButton = function () {
      pause.hidden = reducedMotion || total < 2;
      pause.setAttribute('aria-pressed', String(userPaused));
      pause.setAttribute('aria-label', userPaused ? 'Pokreni kruženje radova' : 'Pauziraj kruženje radova');
      pause.title = pause.getAttribute('aria-label');
      pause.firstElementChild.innerHTML = userPaused ? '<svg class="ui-icon play-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8 5 11 7-11 7Z"/></svg>' : '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5v14M15 5v14"/></svg>';
    };
    on(pause,'click', () => {
      userPaused = !userPaused;
      if (userPaused) manualMove = null;
      syncPauseButton();
      restartAutoplay();
    });
    on(covers,'focusin', () => { focusPaused = true; restartAutoplay(); });
    on(covers,'focusout', e => {
      if (!covers.contains(e.relatedTarget)) { focusPaused = false; restartAutoplay(); }
    });
    on(covers,'keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const target = Math.round(manualMove?.to ?? position) + (e.key === 'ArrowLeft' ? -1 : 1);
      moveTo(target);
      cards[((target % total) + total) % total].focus({ preventScroll: true });
    });
    let pointerStart;
    on(covers,'pointerdown', e => {
      if (e.pointerType !== 'mouse') pointerStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    on(covers,'pointerup', e => {
      if (!pointerStart || pointerStart.id !== e.pointerId) return;
      const dx = e.clientX - pointerStart.x;
      const dy = e.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        lastSwipe = performance.now();
        stepDeck(dx < 0 ? 1 : -1);
      }
    });
    on(covers,'pointercancel', () => { pointerStart = null; });
    // Wheel and vertical touch gestures add speed, then coast back to the base orbit.
    const hero = covers.closest('.hero');
    function boostOrbit(delta) {
      if (!mayRun() || manualMove) return;
      scrollBoost = Math.min(7, scrollBoost + Math.min(240, Math.abs(delta)) * .018);
      restartAutoplay();
    }
    on(hero,'wheel', e => {
      if (e.ctrlKey) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? hero.clientHeight : 1;
      boostOrbit(e.deltaY * unit);
    }, { passive: true });
    let scrollTouch = null;
    on(hero,'pointerdown', e => {
      if (e.pointerType === 'touch' && e.isPrimary) scrollTouch = { id: e.pointerId, x: e.clientX, y: e.clientY, previousY: e.clientY };
    });
    on(hero,'pointermove', e => {
      if (!scrollTouch || scrollTouch.id !== e.pointerId) return;
      const dx = e.clientX - scrollTouch.x;
      const dy = e.clientY - scrollTouch.y;
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        lastSwipe = performance.now();
        boostOrbit((e.clientY - scrollTouch.previousY) * 3);
      }
      scrollTouch.previousY = e.clientY;
    });
    on(hero,'pointerup', () => { scrollTouch = null; });
    on(hero,'pointercancel', () => { scrollTouch = null; });
    on(document,'visibilitychange', restartAutoplay);
    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(measureOrbit) : null;
    if (resizeObserver) resizeObserver.observe(covers);
    else on(window,'resize', measureOrbit);
    const orbitObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      offscreen = !entries[0].isIntersecting;
      restartAutoplay();
    }, { threshold: .01 }) : null;
    orbitObserver?.observe(covers);
    disposeDeck = () => {
      savedDeck = { paused:userPaused, selectedId:featured[selected]?.id, focused:covers.contains(document.activeElement),position,ids:featuredIds };
      events.abort();
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      orbitObserver?.disconnect();
    };
    measureOrbit();
    syncPauseButton();
    $('.hero-footnote').textContent = `ODABRANI RADOVI / 01 — ${String(total).padStart(2,'0')}`;
    watchImages(covers);
    if (savedDeck.focused) cards[selected].focus({preventScroll:true});
    restartAutoplay();
  }

  function mountGallery() {
  if (!gallery) return;
  gallery.replaceChildren();
  const activeFilter = $('.filter.active').dataset.filter;
  projects.forEach((p, i) => {
    const figure = document.createElement('figure');
    figure.className = 'project';
    figure.dataset.category = p.cat;
    figure.dataset.reveal = '';
    figure.style.setProperty('--reveal-delay', `${(i % 2) * 100}ms`);
    figure.innerHTML = `<button type="button" class="project-media" aria-label="Otvori ${esc(p.name)}">${artHTML(p)}${imageHTML(p)}<span class="project-tag" aria-hidden="true">${categories[p.cat]}${!p.video && p.images.length > 1 ? ` · ${p.images.length} fotografija` : ''}</span>${p.video ? '<span class="play" aria-hidden="true"><span><svg class="ui-icon play-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8 5 11 7-11 7Z"/></svg></span></span>' : ''}<span class="project-open" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button><figcaption><div><h3>${esc(p.name)}</h3><p>${esc(p.sub)}</p></div><span class="project-number" aria-hidden="true">/${p.year}</span></figcaption>`;
    figure.hidden = activeFilter !== 'all' && activeFilter !== p.cat;
    $('.project-media', figure).addEventListener('click', () => openProject(i));
    gallery.append(figure);
  });
  $('.project-count').textContent = `${String($$('.project:not([hidden])').length).padStart(2,'0')} / RADOVA`;
  $('.demo-note').hidden = !projects.some(p => p.id.startsWith('demo-'));
  if (!projects.length) {
    const empty = document.createElement('p');
    empty.className = 'portfolio-empty';
    empty.textContent = 'Novi radovi uskoro.';
    gallery.append(empty);
  }
  watchImages(gallery);
  }

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
        if (!reducedMotion) card.animate([{ opacity: .15, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 450, delay: count * 45, easing: 'cubic-bezier(.22,1,.36,1)' });
        count++;
      }
    });
    $('.project-count').textContent = `${String(count).padStart(2, '0')} / RADOVA`;
  }));

  const dialog = $('#lightbox');
  let openIndex = 0;
  let photoIndex = 0;
  function renderLightbox() {
    const p = projects[openIndex];
    photoIndex = Math.max(0,Math.min(photoIndex,p.images.length - 1));
    const selectedImage = {...p,image:p.images[photoIndex] || p.image};
    $('.dialog-category').textContent = `${p.year} / ${categories[p.cat]}`;
    $('#lightbox-title').textContent = p.name;
    $('#lightbox-description').textContent = p.description || p.sub;
    const content = $('#lightbox-content');
    content.innerHTML = p.video
      ? `<div class="dialog-media"><video controls autoplay playsinline aria-label="${esc(p.name)}" src="${esc(p.video)}" ${p.image ? `poster="${esc(imageURL(p,1600))}"` : ''}></video></div><p class="video-status" role="status"></p>`
      : `<div class="dialog-media"><img class="media-image" src="${esc(imageURL(selectedImage,1600))}" alt="${esc(p.name)}${p.images.length > 1 ? ` — fotografija ${photoIndex + 1} od ${p.images.length}` : ''}"></div>`;
    $('.photo-navigation').hidden = !!p.video || p.images.length < 2;
    $('#photo-counter').textContent = `Fotografija ${photoIndex + 1} / ${p.images.length}`;
    watchImages(content);
    const video = $('video', content);
    const videoStatus = $('.video-status', content);
    if (video) video.addEventListener('error', () => { videoStatus.textContent = 'Video trenutačno nije dostupan. Možeš nastaviti pregledavati ostale radove.'; }, { once: true });
  }
  function openProject(index) {
    if (!dialog || !projects[index]) return;
    openIndex = index;
    photoIndex = 0;
    renderLightbox();
    dialog.showModal();
    document.body.classList.add('modal-open');
    restartAutoplay();
  }
  function stepLightbox(direction) {
    openIndex = (openIndex + direction + projects.length) % projects.length;
    photoIndex = 0;
    renderLightbox();
  }
  function stepPhoto(direction) {
    const p = projects[openIndex];
    if (!p || p.video || p.images.length < 2) return;
    photoIndex = (photoIndex + direction + p.images.length) % p.images.length;
    renderLightbox();
  }
  $('#photo-prev')?.addEventListener('click',() => stepPhoto(-1));
  $('#photo-next')?.addEventListener('click',() => stepPhoto(1));
  $('.dialog-close')?.addEventListener('click', () => dialog.close());
  $('#lightbox-prev')?.addEventListener('click', () => stepLightbox(-1));
  $('#lightbox-next')?.addEventListener('click', () => stepLightbox(1));
  dialog?.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog?.addEventListener('keydown', e => {
    if (e.target.closest('video')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      const p = projects[openIndex];
      if (!p.video && p.images.length > 1) stepPhoto(direction);
      else stepLightbox(direction);
    }
  });
  let touchStart = null;
  $('#lightbox-content')?.addEventListener('touchstart',e => {
    touchStart = e.touches.length === 1 ? {x:e.touches[0].clientX,y:e.touches[0].clientY} : null;
  },{passive:true});
  $('#lightbox-content')?.addEventListener('touchend',e => {
    if (!touchStart || e.touches.length || !e.changedTouches.length) { touchStart = null; return; }
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) stepPhoto(dx > 0 ? -1 : 1);
  },{passive:true});
  $('#lightbox-content')?.addEventListener('touchcancel',() => { touchStart = null; });
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
  if ('IntersectionObserver' in window && !reducedMotion) {
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

  // Open the blades immediately while the portfolio orbit is already running.
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
  if (!shutter || reducedMotion) finishIntro();
  else {
    introContent.forEach(el => { el.inert = true; });
    document.documentElement.style.overflow = 'hidden';
    drawBlades(0);
    function tick(now) {
      if (introStart === undefined) introStart = now;
      const progress = Math.max(0, Math.min(1, (now - introStart) / 4000));
      drawBlades(progress);
      if (progress < 1) frame = requestAnimationFrame(tick); else finishIntro();
    }
    frame = requestAnimationFrame(tick);
  }
  motion.addEventListener('change', event => {
    reducedMotion = event.matches;
    if (reducedMotion) {
      finishIntro();
      revealObserver?.disconnect();
      revealElements.forEach(el => el.classList.add('is-visible'));
      $$('.project').forEach(card => card.getAnimations().forEach(animation => animation.cancel()));
    }
    syncPauseButton();
    restartAutoplay();
  });

  function applyProjects(next) {
    const openId = projects[openIndex]?.id;
    disposeDeck();
    projects = next;
    mountDeck();
    mountGallery();
    if (dialog?.open) {
      openIndex = projects.findIndex(p => p.id === openId);
      if (openIndex < 0) dialog.close();
      else renderLightbox();
    }
  }
  function applyAbout(about) {
    if (!$('#about-body')) return;
    const root = $('#about');
    $('.eyebrow',root).textContent = about.eyebrow;
    const heading = $('#about-title');
    heading.replaceChildren();
    const lines = about.title.split('\n');
    lines.forEach((line,index) => {
      if (index) heading.append(document.createElement('br'));
      if (index === lines.length - 1) {
        const emphasis = document.createElement('em');
        emphasis.textContent = line;
        heading.append(emphasis);
      } else heading.append(document.createTextNode(line));
    });
    $('.role',root).textContent = about.role;
    const body = $('#about-body');
    body.replaceChildren();
    about.body.split(/\n\s*\n/).filter(text => text.trim()).forEach(text => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      body.append(paragraph);
    });
    const services = $('.services',root);
    services.replaceChildren();
    about.services.forEach(text => {
      const span = document.createElement('span');
      span.textContent = text;
      services.append(span);
    });
    $('#about-link-text').textContent = about.linkText;
    $('.arrow-link',root).hidden = !about.linkText;
    const image = $('.portrait img',root);
    image.alt = about.imageAlt;
    image.hidden = !about.image;
    if (about.image && image.getAttribute('src') !== about.image) {
      image.classList.remove('is-loaded');
      image.src = about.image;
      watchImages($('.portrait',root));
    }
    $('.portrait small',root).textContent = about.imageCaption;
    $('.portrait small',root).hidden = !about.imageCaption;
    $('.portrait-coordinate',root).textContent = about.coordinate;
  }
  if ($('.covers') || gallery || $('#about-body')) {
    const immediateOrbit = !!$('.covers');
    portfolio.load({waitForRemote:!immediateOrbit}).then(doc => {
      applyProjects(doc.projects);
      applyAbout(doc.about);
      portfolio.subscribe(next => { applyProjects(next.projects); applyAbout(next.about); },{refreshImmediately:immediateOrbit});
    }).catch(() => {
      applyProjects([]);
      const empty = $('.portfolio-empty');
      if (empty) empty.textContent = 'Radove trenutačno nije moguće učitati. Pokušaj osvježiti stranicu.';
    });
  }
})();
