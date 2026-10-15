(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motion.matches;
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
  if ($('.covers')) {
    const covers = $('.covers');
    const featured = projects.slice(0, 5);
    const total = featured.length;
    const fullTurn = Math.PI * 2;
    const unitsPerMs = total / 30000;
    let position = 0;
    let selected = -1;
    let userPaused = false;
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
      button.innerHTML = `${artHTML(p)}${imageHTML(p, i !== 0)}<span class="cover-topline" aria-hidden="true"><span>LEO / SELECTED WORK</span><span>${p.year} / 05</span></span><span class="cover-label" aria-hidden="true"><span><small>${categories[p.cat]}</small><strong>${p.short}</strong></span><span class="cover-open"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></span></span>`;
      button.addEventListener('click', () => {
        if (performance.now() - lastSwipe < 400) return;
        if (selected === i) openProject(i);
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
        const angle = (position - i) * fullTurn / total + Math.PI / 2;
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
      return !reducedMotion && !userPaused && !focusPaused && !offscreen && !introRunning && !document.hidden && !$('#lightbox').open;
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
      const blocked = introRunning || document.hidden || $('#lightbox').open || offscreen;
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
    $('#prev').addEventListener('click', () => stepDeck(-1));
    $('#next').addEventListener('click', () => stepDeck(1));
    const pause = $('#pause');
    syncPauseButton = function () {
      pause.hidden = reducedMotion;
      pause.setAttribute('aria-pressed', String(userPaused));
      pause.setAttribute('aria-label', userPaused ? 'Pokreni kruženje radova' : 'Pauziraj kruženje radova');
      pause.title = pause.getAttribute('aria-label');
      pause.firstElementChild.innerHTML = userPaused ? '<svg class="ui-icon play-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8 5 11 7-11 7Z"/></svg>' : '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5v14M15 5v14"/></svg>';
    };
    pause.addEventListener('click', () => {
      userPaused = !userPaused;
      if (userPaused) manualMove = null;
      syncPauseButton();
      restartAutoplay();
    });
    covers.addEventListener('focusin', () => { focusPaused = true; restartAutoplay(); });
    covers.addEventListener('focusout', e => {
      if (!covers.contains(e.relatedTarget)) { focusPaused = false; restartAutoplay(); }
    });
    covers.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const target = Math.round(manualMove?.to ?? position) + (e.key === 'ArrowLeft' ? -1 : 1);
      moveTo(target);
      cards[((target % total) + total) % total].focus({ preventScroll: true });
    });
    let pointerStart;
    covers.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') pointerStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    covers.addEventListener('pointerup', e => {
      if (!pointerStart || pointerStart.id !== e.pointerId) return;
      const dx = e.clientX - pointerStart.x;
      const dy = e.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        lastSwipe = performance.now();
        stepDeck(dx < 0 ? 1 : -1);
      }
    });
    covers.addEventListener('pointercancel', () => { pointerStart = null; });
    // Wheel and vertical touch gestures add speed, then coast back to the base orbit.
    const hero = covers.closest('.hero');
    function boostOrbit(delta) {
      if (!mayRun() || manualMove) return;
      scrollBoost = Math.min(7, scrollBoost + Math.min(240, Math.abs(delta)) * .018);
      restartAutoplay();
    }
    hero.addEventListener('wheel', e => {
      if (e.ctrlKey) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? hero.clientHeight : 1;
      boostOrbit(e.deltaY * unit);
    }, { passive: true });
    let scrollTouch = null;
    hero.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' && e.isPrimary) scrollTouch = { id: e.pointerId, x: e.clientX, y: e.clientY, previousY: e.clientY };
    });
    hero.addEventListener('pointermove', e => {
      if (!scrollTouch || scrollTouch.id !== e.pointerId) return;
      const dx = e.clientX - scrollTouch.x;
      const dy = e.clientY - scrollTouch.y;
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        lastSwipe = performance.now();
        boostOrbit((e.clientY - scrollTouch.previousY) * 3);
      }
      scrollTouch.previousY = e.clientY;
    });
    hero.addEventListener('pointerup', () => { scrollTouch = null; });
    hero.addEventListener('pointercancel', () => { scrollTouch = null; });
    document.addEventListener('visibilitychange', restartAutoplay);
    if ('ResizeObserver' in window) new ResizeObserver(measureOrbit).observe(covers);
    else addEventListener('resize', measureOrbit);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      offscreen = !entries[0].isIntersecting;
      restartAutoplay();
    }, { threshold: .01 }).observe(covers);
    measureOrbit();
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
        if (!reducedMotion) card.animate([{ opacity: .15, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 450, delay: count * 45, easing: 'cubic-bezier(.22,1,.36,1)' });
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
  if (!shutter || reducedMotion) finishIntro();
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
})();
