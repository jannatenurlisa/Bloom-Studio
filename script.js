/* =====================================================================
   Lisa's Bloom Studio — behaviour
   1. Layout (keeps the house nicely framed on any screen)
   2. Windows & door: hover / tap to open a dialog box
   3. Links (from links.js)
   4. Birds & falling petals (pixel canvas)
   5. Background sound (soft music + wind + birdsong)
   ===================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = false;   // ambient motion is part of the design

  const stage = $('#stage');
  const base = $('#base');
  const SW = 1280, SH = 832;               // the Figma frame

  /* ------------------------------------------------------------------
     1. LAYOUT
     Desktop: the illustration "covers" the screen, focused on the house.
     Phones / portrait: the house fills the width and the empty sky on top
     is used for the dialog boxes.
  ------------------------------------------------------------------ */
  let visL = 320, visR = 640;     // visible part of the bird canvas
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const compact = vw < 820 || vw / vh < 1.05;
    let s, ox, oy;

    if (compact) {
      s = vw / 800;                                   // ~800 design-px visible across
      const W = SW * s, H = SH * s;
      ox = Math.min(0, Math.max(vw - W, vw / 2 - 700 * s));   // keep the house centred
      oy = vh - H;                                      // glued to the bottom, sky above
    } else {
      s = Math.min(vw / SW, vh / SH);                  // whole scene fits: more sky, smaller house
      const W = SW * s, H = SH * s;
      ox = (vw - W) / 2;                                // wide screens: mirrored garden fills the sides
      oy = vh - H;
    }

    stage.style.width = SW * s + 'px';
    stage.style.height = SH * s + 'px';
    stage.style.left = ox + 'px';
    stage.style.top = oy + 'px';
    document.body.classList.toggle('is-compact', compact);
    visL = Math.max(0, (-ox / s + 1280) / 4); visR = Math.min(960, ((vw - ox) / s + 1280) / 4);
  }
  let layoutQueued = false;
  const queueLayout = () => {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => { layoutQueued = false; layout(); });
  };
  window.addEventListener('resize', queueLayout);
  window.addEventListener('orientationchange', queueLayout);
  layout();

  /* ------------------------------------------------------------------
     2. WINDOWS, DOOR & DIALOGS
  ------------------------------------------------------------------ */
  const dialogs = {
    skills: $('#dlg-skills'),
    projects: $('#dlg-projects'),
    connect: $('#dlg-connect')
  };
  const windows = {
    skills: $('.win--ul'),   // upper left window  (above the door)
    projects: $('.win--ur'),   // upper front window (balcony)
    peek: $('.win--lr')    // downstairs window  (just for fun)
  };
  const hotspots = $$('.hot');
  const welcome = $('#dlg-welcome');

  let active = null;
  let closeTimer = null;
  const CLOSE_DELAY = 520;     // grace time so the cursor can travel from the window to the box

  function render() {
    stage.dataset.active = active && active !== 'peek' ? active : '';
    if (!stage.dataset.active) stage.removeAttribute('data-active');
    stage.classList.toggle('is-door', active === 'connect');
    stage.classList.toggle('is-peek', active === 'peek');

    Object.entries(windows).forEach(([k, el]) => el && el.classList.toggle('is-open', active === k));
    Object.entries(dialogs).forEach(([k, el]) => el.classList.toggle('is-open', active === k));
    hotspots.forEach(h => {
      if (h.hasAttribute('aria-controls')) h.setAttribute('aria-expanded', String(active === h.dataset.target));
    });
  }

  function open(name) {
    clearTimeout(closeTimer);
    if (active === name) return;
    active = name;
    hideWelcome();
    render();
    sfx.open();
  }
  function close() {
    clearTimeout(closeTimer);
    if (active === null) return;
    active = null;
    render();
    sfx.close();
  }
  function scheduleClose(delay = CLOSE_DELAY) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, delay);
  }

  // hotspots (windows & door)
  hotspots.forEach(h => {
    const name = h.dataset.target;
    h.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') open(name); });
    h.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') scheduleClose(); });
    h.addEventListener('focus', () => open(name));
    h.addEventListener('blur', e => { if (!e.relatedTarget || !e.relatedTarget.closest('.dialog')) scheduleClose(); });
    h.addEventListener('click', e => {
      if (e.pointerType === 'touch') { active === name ? close() : open(name); }   // tap toggles
      else open(name);
    });
  });

  // dialogs stay open while the pointer / keyboard focus is inside them
  Object.values(dialogs).forEach(d => {
    d.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    d.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') scheduleClose(); });
    d.addEventListener('focusin', () => clearTimeout(closeTimer));
    d.addEventListener('focusout', e => {
      if (!e.relatedTarget || !(e.relatedTarget.closest('.dialog') || e.relatedTarget.closest('.hot'))) scheduleClose();
    });
    $$('[data-close]', d).forEach(b => b.addEventListener('click', close));
  });

  // tap / click anywhere else closes
  document.addEventListener('pointerdown', e => {
    if (!active) return;
    if (e.target.closest('.dialog') || e.target.closest('.hot') || e.target.closest('.hud')) return;
    close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); hideWelcome(); } });

  /* ------------------------------------------------------------------
     Welcome box: types itself out, then waits to be dismissed
  ------------------------------------------------------------------ */
  const typeEl = $('#welcome-type');
  let welcomeHidden = false, welcomeTimer = null;
  function hideWelcome() {
    if (welcomeHidden) return;
    welcomeHidden = true;
    clearTimeout(welcomeTimer);
    welcome.classList.remove('is-open');
  }
  $('#welcome-next').addEventListener('click', hideWelcome);

  function typeWelcome() {
    const full = typeEl.dataset.text || typeEl.textContent;
    if (reduceMotion) { welcome.classList.add('welcome--done'); return; }
    typeEl.textContent = '';
    let i = 0;
    const tick = () => {
      if (welcomeHidden) return;
      typeEl.textContent = full.slice(0, ++i);
      if (i < full.length) setTimeout(tick, 55);
      else welcome.classList.add('welcome--done');
    };
    setTimeout(tick, 700);
  }

  /* ------------------------------------------------------------------
     3. LINKS  (edit them in links.js)
  ------------------------------------------------------------------ */
  const LINKS = window.SITE_LINKS || {};
  const toastEl = $('#toast');
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2200);
  }
  $$('[data-link]').forEach(a => {
    let url = (LINKS[a.dataset.link] || '').trim();
    if (url && a.dataset.link === 'email' && !/^mailto:/i.test(url)) url = 'mailto:' + url;
    if (url) {
      a.href = url;
      if (/^mailto:/i.test(url)) { a.removeAttribute('target'); a.removeAttribute('rel'); }
    } else {
      a.classList.add('is-pending');
      a.addEventListener('click', e => { e.preventDefault(); toast('✿ Link coming soon'); });
    }
  });

  /* ------------------------------------------------------------------
     4. BIRDS & PETALS  (drawn on a tiny 320 × 208 canvas, scaled up = chunky pixels)
  ------------------------------------------------------------------ */
  const fx = $('#fx');
  const ctx = fx.getContext('2d');
  const CW = fx.width, CH = fx.height;   // 960 × 208: three stages wide
  ctx.imageSmoothingEnabled = false;

  // 7 × 3 bird frames: wings up / mid / down
  const BIRD = [
    ['X.....X', '.X...X.', '..XXX..'],
    ['.......', 'XXX.XXX', '...X...'],
    ['.......', '..XXX..', 'XX...XX']
  ];
  const FLAP = [0, 1, 2, 1];
  const BIRD_COLORS = ['#46507a', '#5b6791'];

  const birds = [];
  let nextBird = 4;     // seconds until the first visitor
  function spawnFlock() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const n = 1 + Math.floor(Math.random() * 3);
    const y0 = 40 + Math.random() * 55;
    const speed = 15 + Math.random() * 10;
    for (let i = 0; i < n; i++) {
      birds.push({
        x: dir > 0 ? visL - 10 - i * 11 : visR + 10 + i * 11,
        y: y0 + i * 5 * (Math.random() < .5 ? 1 : -1) + Math.random() * 3,
        dir, speed: speed * (0.92 + Math.random() * 0.16),
        phase: Math.random() * 6.28, flap: Math.random() * 4,
        color: BIRD_COLORS[i % 2]
      });
    }
  }
  function drawBird(b) {
    const f = BIRD[FLAP[Math.floor(b.flap) % 4]];
    ctx.fillStyle = b.color;
    const bx = Math.round(b.x), by = Math.round(b.y + Math.sin(b.phase) * 3);
    f.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) if (row[rx] === 'X') ctx.fillRect(bx + rx, by + ry, 1, 1);
    });
  }

  const petals = [];
  const PETAL_COLORS = ['#f9b6c8', '#ffd9e3', '#f48fb1', '#ffe8ee'];
  let nextPetal = 1;
  function spawnPetal() {
    petals.push({
      x: 596 + Math.random() * 42, y: 116 + Math.random() * 34,
      vx: -(2 + Math.random() * 6), vy: 5 + Math.random() * 5,
      ph: Math.random() * 6.28, w: Math.random() < .5 ? 2 : 1,
      c: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)], life: 0
    });
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, CW, CH);

    nextBird -= dt;
    if (nextBird <= 0) { spawnFlock(); nextBird = 9 + Math.random() * 12; }
    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i];
      b.x += b.dir * b.speed * dt; b.phase += dt * 1.8; b.flap += dt * 6;
      if (b.x < visL - 30 || b.x > visR + 30) { birds.splice(i, 1); continue; }
      drawBird(b);
    }

    nextPetal -= dt;
    if (nextPetal <= 0 && petals.length < 22) { spawnPetal(); nextPetal = 0.5 + Math.random() * 1.0; }
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      p.life += dt; p.ph += dt * 2.2;
      p.x += (p.vx + Math.sin(p.ph) * 4) * dt; p.y += p.vy * dt;
      if (p.y > 198 || p.x < -4) { petals.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.life * 2) * (p.y > 186 ? (198 - p.y) / 12 : 1);
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.w, 1);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  if (!reduceMotion) requestAnimationFrame(frame);

  // pause everything when the tab is hidden (saves battery)
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    document.hidden ? pauseAudio() : resumeAudio();
  });

  /* ------------------------------------------------------------------
     5. SOUND
     assets/audio/ambient.mp3 is a soft loop (music-box, wind, birdsong).
     To replace that file (keep the name) or change the
     src of <audio id="bgm"> in index.html.
     Browsers only allow sound after the visitor clicks / taps something,
     so it starts on the first click. The button toggles it.
  ------------------------------------------------------------------ */
  const bgm = $('#bgm');
  const soundBtn = $('#sound');
  const soundLabel = $('#sound-label');
  const TARGET_VOL = 0.5;
  let wantSound = true;                      // visitor preference
  try { wantSound = localStorage.getItem('lisa-sound') !== 'off'; } catch (e) { }
  let playing = false, fadeTimer = null;

  function setLabel() {
    soundBtn.setAttribute('aria-pressed', String(playing));
    soundLabel.textContent = playing ? 'Sound on' : (wantSound ? 'Click for sound' : 'Sound off');
    soundBtn.classList.toggle('is-nudging', !playing && wantSound);
  }
  function fadeTo(v, ms, done) {
    clearInterval(fadeTimer);
    const from = bgm.volume, steps = 16, dt = ms / steps; let i = 0;
    fadeTimer = setInterval(() => {
      i++; bgm.volume = Math.max(0, Math.min(1, from + (v - from) * (i / steps)));
      if (i >= steps) { clearInterval(fadeTimer); done && done(); }
    }, dt);
  }
  function startAudio() {
    bgm.volume = 0;
    const p = bgm.play();
    if (p && p.then) {
      p.then(() => { playing = true; fadeTo(TARGET_VOL, 1800); setLabel(); })
        .catch(() => { playing = false; setLabel(); });   // blocked until the first click
    }
  }
  function stopAudio() {
    fadeTo(0, 500, () => bgm.pause());
    playing = false; setLabel();
  }
  function pauseAudio() { if (playing) bgm.pause(); }
  function resumeAudio() { if (playing) bgm.play().catch(() => { }); }

  soundBtn.addEventListener('click', () => {
    if (playing) { wantSound = false; stopAudio(); }
    else { wantSound = true; startAudio(); }
    try { localStorage.setItem('lisa-sound', wantSound ? 'on' : 'off'); } catch (e) { }
  });
  // first click / tap / key anywhere starts the sound (unless the visitor muted it before)
  const unlock = e => {
    if (e.target.closest && e.target.closest('#sound')) { cleanup(); return; }
    if (wantSound && !playing) startAudio();
    cleanup();
  };
  const cleanup = () => ['pointerdown', 'keydown', 'touchstart'].forEach(t => window.removeEventListener(t, unlock, true));
  ['pointerdown', 'keydown', 'touchstart'].forEach(t => window.addEventListener(t, unlock, true));
  if (wantSound) startAudio();               // works if the browser allows autoplay
  setLabel();

  /* tiny, soft "shutter" blips (only when sound is on) */
  const sfx = (() => {
    let ac = null;
    function ctxAc() {
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = false; } }
      return ac;
    }
    function blip(f0, f1, dur, vol) {
      if (!playing) return;
      const a = ctxAc(); if (!a) return;
      if (a.state === 'suspended') a.resume();
      const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
    }
    return {
      open() { blip(520, 880, 0.16, 0.05); },
      close() { blip(700, 420, 0.14, 0.035); }
    };
  })();

  /* ------------------------------------------------------------------
     Ready!  (wait for the picture + font so nothing pops)
  ------------------------------------------------------------------ */
  const imgReady = base.complete ? Promise.resolve() : new Promise(r => { base.onload = base.onerror = r; });
  const fontReady = (document.fonts && document.fonts.ready) ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1800))]) : Promise.resolve();
  Promise.all([imgReady, fontReady]).then(() => {
    layout();
    document.body.classList.add('is-ready');
    typeWelcome();
    welcomeTimer = setTimeout(hideWelcome, 16000);
    render();
  });
})();
