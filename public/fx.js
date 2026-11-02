/* Local Link — FX layer
   3D scene, screen transitions, tilt, ripples, reveal-on-scroll, counters.
   Pure vanilla JS + Canvas 2D with a hand-rolled 3D projection — no dependencies.
   Everything is additive: it watches the DOM the app renders and decorates it. */
(() => {
  'use strict';
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(pointer: fine)').matches;
  const doc = document.documentElement;
  doc.classList.add('fx-on');
  if (RM) doc.classList.add('fx-reduced');

  /* ------------------------------------------------------------------ *
   * 1. 3D "Local Network" scene — a rotating globe of glowing nodes,
   *    connection arcs and floating location pins, with mouse parallax.
   * ------------------------------------------------------------------ */
  const PAL = {
    navy: [60, 70, 160], blue: [91, 124, 250], sky: [140, 160, 255], amber: [233, 75, 75], gold: [255, 231, 163],
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function isDark() {
    const th = doc.getAttribute('data-theme');
    if (th) return th === 'dark' || document.body.classList.contains('cdark');
    return window.matchMedia('(prefers-color-scheme: dark)').matches || document.body.classList.contains('cdark');
  }
  function makeScene(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const o = Object.assign({ nodes: 220, pins: 7, radius: 0.36, speed: 1, dark: true, links: 2, cx: 0.5, cy: 0.5, stars: 90 }, opts);
    let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    let rotY = 0, rotX = -0.35, tx = 0, ty = 0, mx = 0, my = 0, t0 = performance.now(), alive = true, visible = true;

    // fibonacci sphere → evenly spread "places"
    const pts = [];
    for (let i = 0; i < o.nodes; i++) {
      const y = 1 - (i / (o.nodes - 1)) * 2, r = Math.sqrt(1 - y * y), th = Math.PI * (3 - Math.sqrt(5)) * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, hot: Math.random() < 0.12, ph: Math.random() * 6.28 });
    }
    // links between near neighbours (the "local links")
    const links = [];
    pts.forEach((p, i) => {
      if (!p.hot) return;
      const near = pts.map((q, j) => [j, (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2]).filter(a => a[0] !== i).sort((a, b) => a[1] - b[1]).slice(0, o.links);
      near.forEach(([j]) => links.push([i, j, Math.random() * 6.28]));
    });
    // long arcs between random hot nodes (signals travelling)
    const hot = pts.filter(p => p.hot);
    const arcs = Array.from({ length: Math.min(9, hot.length >> 1) }, () => ({ a: hot[Math.random() * hot.length | 0], b: hot[Math.random() * hot.length | 0], t: Math.random(), sp: 0.12 + Math.random() * 0.18 }));
    // floating pins orbiting the globe
    const pins = Array.from({ length: o.pins }, (_, i) => ({ ang: (i / o.pins) * 6.28, el: (Math.random() - 0.5) * 1.1, d: 1.35 + Math.random() * 0.35, bob: Math.random() * 6.28, s: 0.8 + Math.random() * 0.5, c: i % 3 === 0 ? PAL.amber : PAL.sky }));
    const stars = Array.from({ length: o.stars }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), tw: Math.random() * 6.28 }));

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    ro ? ro.observe(canvas) : window.addEventListener('resize', resize);
    resize();

    function project(x, y, z, R, cx, cy) {
      // rotate Y then X
      const cy_ = Math.cos(rotY), sy = Math.sin(rotY), cx_ = Math.cos(rotX), sx = Math.sin(rotX);
      let X = x * cy_ - z * sy, Z = x * sy + z * cy_;
      let Y = y * cx_ - Z * sx; Z = y * sx + Z * cx_;
      const f = 2.6 / (2.6 + Z);         // perspective
      return { x: cx + X * R * f, y: cy + Y * R * f, z: Z, f };
    }

    function pinPath(x, y, s) { // map-pin glyph
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - 9 * s, y - 11 * s, x - 11 * s, y - 17 * s, x - 11 * s, y - 22 * s);
      ctx.arc(x, y - 22 * s, 11 * s, Math.PI, 0);
      ctx.bezierCurveTo(x + 11 * s, y - 17 * s, x + 9 * s, y - 11 * s, x, y);
      ctx.closePath();
    }

    function frame(now) {
      if (!alive) return;
      requestAnimationFrame(frame);
      if (!visible) return;
      const t = (now - t0) / 1000;
      tx += (mx - tx) * 0.04; ty += (my - ty) * 0.04;
      rotY = t * 0.12 * o.speed + tx * 0.6;
      rotX = -0.35 + ty * 0.35;
      ctx.clearRect(0, 0, W, H);
      if (o.auto) o.dark = isDark();
      const cx = W * o.cx + tx * 18, cy = H * o.cy + ty * 14, R = Math.min(W, H) * o.radius;

      // stars (parallax depth)
      for (const s of stars) {
        const a = (0.25 + 0.35 * Math.sin(t * 1.3 + s.tw)) * (o.dark ? 1 : 0.5);
        ctx.fillStyle = rgba(o.dark ? PAL.sky : PAL.blue, a * s.z);
        const sx = (s.x * W - tx * 30 * s.z + W) % W, sy = (s.y * H - ty * 20 * s.z + H) % H;
        ctx.fillRect(sx, sy, 1.4 * s.z + 0.4, 1.4 * s.z + 0.4);
      }

      // atmospheric halo
      const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.6);
      g.addColorStop(0, rgba(PAL.blue, o.dark ? 0.22 : 0.12));
      g.addColorStop(0.55, rgba(PAL.navy, o.dark ? 0.10 : 0.05));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, 6.29); ctx.fill();

      // orbit rings (tilted ellipses)
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = rgba(k === 1 ? PAL.amber : PAL.sky, o.dark ? 0.16 : 0.22);
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * (1.25 + k * 0.17), R * (0.32 + k * 0.05), -0.35 + k * 0.28 + Math.sin(t * 0.2 + k) * 0.05, 0, 6.29);
        ctx.stroke();
      }

      const P = pts.map(p => project(p.x, p.y, p.z, R, cx, cy));

      // links
      for (const [i, j, ph] of links) {
        const a = P[i], b = P[j];
        const depth = (2 - (a.z + b.z) / 2) / 3;
        ctx.strokeStyle = rgba(o.dark ? PAL.sky : PAL.blue, (o.dark ? 1 : 0.8) * (0.08 + 0.18 * depth) * (0.6 + 0.4 * Math.sin(t * 2 + ph)));
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // arcs with travelling signal
      for (const arc of arcs) {
        arc.t += arc.sp * 0.016 * (RM ? 0 : 1);
        if (arc.t > 1) { arc.t = 0; arc.a = hot[Math.random() * hot.length | 0]; arc.b = hot[Math.random() * hot.length | 0]; }
        const steps = 26; let prev = null, head = null;
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          let x = arc.a.x + (arc.b.x - arc.a.x) * u, y = arc.a.y + (arc.b.y - arc.a.y) * u, z = arc.a.z + (arc.b.z - arc.a.z) * u;
          const len = Math.hypot(x, y, z) || 1, lift = 1 + Math.sin(u * Math.PI) * 0.35;
          const q = project(x / len * lift, y / len * lift, z / len * lift, R, cx, cy);
          if (prev) {
            const near = Math.abs(u - arc.t) < 0.12;
            ctx.strokeStyle = rgba(near ? PAL.gold : PAL.amber, near ? 0.9 : (q.z < 0 ? 0.22 : 0.08));
            ctx.lineWidth = near ? 2 : 1;
            ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
          if (Math.abs(u - arc.t) < 1 / steps) head = q;
          prev = q;
        }
        if (head) { ctx.fillStyle = rgba(PAL.gold, 0.95); ctx.beginPath(); ctx.arc(head.x, head.y, 2.6, 0, 6.29); ctx.fill(); }
      }
      ctx.lineWidth = 1;

      // nodes (back to front)
      const order = P.map((p, i) => i).sort((a, b) => P[b].z - P[a].z);
      for (const i of order) {
        const p = P[i], src = pts[i], front = p.z < 0;
        const a = front ? 0.95 : 0.25;
        if (src.hot) {
          const pulse = 1 + 0.6 * Math.sin(t * 3 + src.ph);
          ctx.fillStyle = rgba(PAL.amber, a * 0.18); ctx.beginPath(); ctx.arc(p.x, p.y, 6 * pulse * p.f, 0, 6.29); ctx.fill();
          ctx.fillStyle = rgba(PAL.gold, a); ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 * p.f, 0, 6.29); ctx.fill();
        } else {
          ctx.fillStyle = rgba(o.dark ? PAL.sky : PAL.blue, a * 0.75); ctx.beginPath(); ctx.arc(p.x, p.y, 1.3 * p.f, 0, 6.29); ctx.fill();
        }
      }

      // floating 3D pins
      const pz = pins.map(pn => {
        const ang = pn.ang + t * 0.25 * o.speed;
        const x = Math.cos(ang) * pn.d, z = Math.sin(ang) * pn.d, y = pn.el + Math.sin(t * 1.4 + pn.bob) * 0.06;
        return { pn, q: project(x, y, z, R, cx, cy) };
      }).sort((a, b) => b.q.z - a.q.z);
      for (const { pn, q } of pz) {
        const s = pn.s * q.f * (R / 260), front = q.z < 0, a = front ? 1 : 0.35;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.shadowColor = rgba(pn.c, 0.8); ctx.shadowBlur = 18 * s;
        const lg = ctx.createLinearGradient(q.x - 11 * s, q.y - 33 * s, q.x + 11 * s, q.y);
        lg.addColorStop(0, rgba(pn.c === PAL.amber ? PAL.gold : PAL.sky, 1)); lg.addColorStop(1, rgba(pn.c === PAL.amber ? PAL.amber : PAL.blue, 1));
        ctx.fillStyle = lg; pinPath(q.x, q.y, s); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = rgba(PAL.navy, 0.9); ctx.beginPath(); ctx.arc(q.x, q.y - 22 * s, 4.2 * s, 0, 6.29); ctx.fill();
        // ground ripple
        ctx.strokeStyle = rgba(pn.c, 0.35 * a); ctx.beginPath(); ctx.ellipse(q.x, q.y + 2, 9 * s * (1 + (t * 0.8 + pn.bob) % 1), 3 * s * (1 + (t * 0.8 + pn.bob) % 1), 0, 0, 6.29); ctx.stroke();
        ctx.restore();
      }
    }

    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting && !document.hidden; }) : null;
    io && io.observe(canvas);
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
    const onMove = e => { mx = (e.clientX / innerWidth - 0.5) * 2; my = (e.clientY / innerHeight - 0.5) * 2; };
    if (!RM) window.addEventListener('pointermove', onMove, { passive: true });
    if (RM) { t0 = performance.now() - 4000; frame(performance.now()); alive = false; } else requestAnimationFrame(frame);
    return { destroy() { alive = false; ro && ro.disconnect(); io && io.disconnect(); window.removeEventListener('pointermove', onMove); } };
  }

  /* global background scene */
  const bg = document.createElement('canvas');
  bg.id = 'fx3d'; bg.setAttribute('aria-hidden', 'true');
  const aurora = document.createElement('div'); aurora.className = 'fx-aurora'; aurora.setAttribute('aria-hidden', 'true');
  aurora.innerHTML = '<i></i><i></i><i></i>';
  const grain = document.createElement('div'); grain.className = 'fx-grain'; grain.setAttribute('aria-hidden', 'true');
  document.body.prepend(grain); document.body.prepend(bg); document.body.prepend(aurora);
  const _launcher = () => document.body.classList.toggle('fx-launch', !!document.querySelector('.launcher'));
  makeScene(bg, { nodes: 260, radius: 0.34, cx: 0.5, cy: 0.52, pins: 8, auto: true });

  /* scoped scenes inside hero panels (admin login brand, launcher, splash) */
  function mountLocal(host, opts) {
    if (!host || host.__fx3d) return;
    const c = document.createElement('canvas'); c.className = 'fx3d-local'; c.setAttribute('aria-hidden', 'true');
    host.prepend(c); host.__fx3d = makeScene(c, opts);
  }

  /* ------------------------------------------------------------------ *
   * 2. Cursor spotlight + progress bar
   * ------------------------------------------------------------------ */
  if (FINE && !RM) {
    const spot = document.createElement('div'); spot.className = 'fx-spot'; document.body.appendChild(spot);
    let sx = innerWidth / 2, sy = innerHeight / 2, cx = sx, cy = sy;
    window.addEventListener('pointermove', e => { sx = e.clientX; sy = e.clientY; }, { passive: true });
    (function loop() { cx += (sx - cx) * 0.15; cy += (sy - cy) * 0.15; spot.style.transform = `translate3d(${cx}px,${cy}px,0)`; requestAnimationFrame(loop); })();
  }
  const bar = document.createElement('div'); bar.className = 'fx-progress'; document.body.appendChild(bar);
  let pending = 0, barT;
  const _fetch = window.fetch.bind(window);
  window.fetch = function (...a) {
    const isApi = String(a[0] && a[0].url || a[0]).includes('/api/');
    if (isApi) { pending++; clearTimeout(barT); bar.classList.add('on'); }
    return _fetch(...a).finally(() => { if (isApi && --pending <= 0) { pending = 0; barT = setTimeout(() => bar.classList.remove('on'), 180); } });
  };

  /* ------------------------------------------------------------------ *
   * 3. Ripple + magnetic press on every button
   * ------------------------------------------------------------------ */
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('button, .btn, .chip, a.lc-link, .side a');
    if (!b || RM) return;
    const r = b.getBoundingClientRect(); const d = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement('span'); s.className = 'fx-ripple';
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.classList.add('fx-clip'); b.appendChild(s); setTimeout(() => s.remove(), 650);
  }, { passive: true });

  /* heart: pop + particle burst when saving */
  document.addEventListener('click', e => {
    const f = e.target.closest('[data-fav]'); if (!f || RM) return;
    const r = f.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    setTimeout(() => {
      const el = document.querySelector(`[data-fav][data-ftype="${f.dataset.ftype}"][data-fid="${f.dataset.fid}"]`) || f;
      el.classList.remove('fx-pop'); void el.offsetWidth; el.classList.add('fx-pop');
      if (!el.classList.contains('on')) return;
      for (let i = 0; i < 10; i++) {
        const p = document.createElement('i'); p.className = 'fx-burst'; const a = (i / 10) * 6.283, d = 22 + Math.random() * 14;
        p.style.cssText = `left:${cx - 3}px;top:${cy - 3}px;--bx:${Math.cos(a) * d}px;--by:${Math.sin(a) * d}px;background:${i % 2 ? 'var(--accent)' : 'var(--primary-light)'}`;
        document.body.appendChild(p); setTimeout(() => p.remove(), 750);
      }
    }, 30);
  });

  /* ------------------------------------------------------------------ *
   * 4. 3D tilt + glare on cards
   * ------------------------------------------------------------------ */
  const TILT = '.launch-card, .card, .cat, .ocard, .ncard, .ecard, .brow, .stat, .offcard, .promo, .bcard, .pcard';
  let tiltEl = null;
  if (FINE && !RM) {
    document.addEventListener('pointermove', e => {
      const el = e.target.closest(TILT);
      if (tiltEl && tiltEl !== el) { tiltEl.style.transform = ''; tiltEl.classList.remove('fx-tilting'); tiltEl = null; }
      if (!el || el.closest('.side, table, .sheet, .modal')) return;
      const r = el.getBoundingClientRect(); if (r.width > 720 || r.height > 520) return;
      tiltEl = el; el.classList.add('fx-tilt', 'fx-tilting');
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const k = r.width > 300 ? 5 : 9;
      el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * k}deg) rotateY(${(px - 0.5) * k}deg) translateZ(6px)`;
      el.style.setProperty('--gx', (px * 100) + '%'); el.style.setProperty('--gy', (py * 100) + '%');
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (tiltEl) { tiltEl.style.transform = ''; tiltEl = null; } });
  }

  /* sidebar: glow follows the cursor */
  document.addEventListener('pointermove', e => { const a = e.target.closest && e.target.closest('.side a'); if (a) { const r = a.getBoundingClientRect(); a.style.setProperty('--mx', (e.clientX - r.left) + 'px'); } }, { passive: true });
  /* admin: '/' focuses search */
  document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { const i = document.querySelector('.desk .searchbar input'); if (i) { e.preventDefault(); i.focus(); } } });

  /* ------------------------------------------------------------------ *
   * 5. Screen transitions + staggered reveal
   * ------------------------------------------------------------------ */
  const REVEAL = [
    '.sec-head', '.nsec', '.card', '.cat', '.pcard', '.bcard', '.ocard', '.ncard', '.ecard', '.brow', '.stat', '.offcard', '.promo', '.hero',
    '.launch-card', '.panel', '.field', '.btn.block', '.bill', '.chat', '.dealrow', '.plist > *', '.empty', '.ncat', '.tile',
    'table tbody tr', '.addrbar', '.vbar', '.countdown', '.ostack', '.intro', '.auth-hero'
  ].join(',');
  // one observer, viewport root: browsers clip by scrolling ancestors (#screen) automatically
  const revealIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('fx-in'); revealIO.unobserve(en.target); }
  }), { threshold: 0.04 }) : null;
  function decorate(root) {
    if (RM || !root) return;
    const io = revealIO; if (!io) return;
    let i = 0;
    root.querySelectorAll(REVEAL).forEach(el => {
      if (el.classList.contains('fx-rv')) return;
      if (el.closest('.sheet, .toast, .bnav')) return;
      if (el.offsetHeight > 420) { el.classList.add('fx-tall'); return; } // big blocks: no 3D tilt reveal (it can push them off-screen)
      el.classList.add('fx-rv', 'fx-in');
      el.style.setProperty('--fx-d', Math.min(i++, 14) * 45 + 'ms');
      io.observe(el);
      // safety net: never leave content hidden if the observer misses it
      setTimeout(() => { const r = el.getBoundingClientRect(); if (r.top < innerHeight + 200 && r.bottom > -200) el.classList.add('fx-in'); }, 900 + Math.min(i, 14) * 45);
    });
    countUp(root);
    // admin tables: avatar initials in the first column (pure decoration)
    root.querySelectorAll('.desk td.tbn').forEach(td => {
      if (td.__fxa) return; td.__fxa = 1;
      const w = document.createElement('div'); w.className = 'fx-acts'; while (td.firstChild) w.appendChild(td.firstChild); td.appendChild(w);
    });
    root.querySelectorAll('.desk table tbody tr').forEach(tr => {
      const td = tr.firstElementChild; if (!td || td.__fxav || td.colSpan > 1) return; td.__fxav = 1;
      const th = tr.closest('table').querySelector('thead th');
      if (!th || !/name|business|title|user|plan|question|label/i.test(th.textContent)) return;
      const txt = (td.textContent || '').trim(); if (!txt || /^[\d₹#]/.test(txt) || td.querySelector('img,.badge')) return;
      const ini = txt.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
      let hsh = 0; for (const ch of txt) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
      const av = document.createElement('span'); av.className = 'fx-av'; av.textContent = ini; av.style.setProperty('--h', 150 + (hsh % 7) * 28);
      const wrap = document.createElement('span'); wrap.className = 'fx-cell'; while (td.firstChild) wrap.appendChild(td.firstChild);
      td.appendChild(wrap); wrap.prepend(av);
    });
  }
  function enter(el, dir) {
    if (RM || !el) return;
    el.classList.remove('fx-enter', 'fx-enter-back'); void el.offsetWidth;
    el.classList.add(dir === 'back' ? 'fx-enter-back' : 'fx-enter');
  }

  /* number counters for stat tiles */
  function countUp(root) {
    root.querySelectorAll('.stat .num, .stat b, .stat strong, .kpi b, .panel > .ph > h3').forEach(el => {
      if (el.__fxc) return; el.__fxc = 1;
      const raw = el.textContent.trim(); const m = raw.match(/^([^\d-]*)([\d,]+(?:\.\d+)?)(.*)$/);
      if (!m) return; const target = parseFloat(m[2].replace(/,/g, '')); if (!isFinite(target) || target === 0) return;
      const dec = (m[2].split('.')[1] || '').length, t0 = performance.now(), dur = 1100;
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        el.textContent = m[1] + (target * e).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3];
        if (p < 1) requestAnimationFrame(tick); else el.textContent = raw;
      })(t0);
    });
  }

  /* watch the app's render targets */
  let lastDepth = 0, lastMain = null, decoQ = new Set(), decoT = 0;
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type !== 'childList' || !m.addedNodes.length) continue;
      const t = m.target;
      // a real screen swap = the app replaced #screen's (or #stage's) direct children
      if (t.id === 'screen') {
        const depth = document.querySelectorAll('#__back').length;
        enter(t, depth < lastDepth ? 'back' : 'fwd'); lastDepth = depth;
      } else if (t.id === 'stage') enter(t.firstElementChild, 'fwd');
      if (t.id === 'rotsq' || (t.classList && t.classList.contains('sq'))) { t.classList.remove('fx-swap'); void t.offsetWidth; t.classList.add('fx-swap'); continue; }
      decoQ.add(t);
    }
    // desktop admin: animate the main pane when its content block is replaced
    const main = document.querySelector('.desk > :not(.side)');
    const first = main && main.querySelector(':scope > :last-child');
    if (first && first !== lastMain) { lastMain = first; enter(first, 'fwd'); }
    _launcher(); placeNav(); enhanceLogin(document); partnerSplit(); heroFx(); setTimeout(autoRows, 1200); depthScroll(); innerScenes(); cancelAnimationFrame(decoT);
    decoT = requestAnimationFrame(() => {
      decoQ.forEach(t => t.isConnected && decorate(t)); decoQ.clear();
      mountLocal(document.querySelector('.crm-brand'), { nodes: 200, radius: 0.32, cx: 0.62, cy: 0.62, pins: 6 });
      mountLocal(document.querySelector('.launch-hero'), { nodes: 150, radius: 0.36, cx: 0.5, cy: 0.5, pins: 6, stars: 0 });
      mountLocal(document.querySelector('.splash'), { nodes: 180, radius: 0.36, cx: 0.5, cy: 0.42, pins: 6, stars: 60 });
    });
  });
  /* sliding indicators: remember last spot so a re-render glides from it */
  let lastTab = null, lastSide = null;
  function placeNav() {
    const nav = document.querySelector('.bnav');
    if (nav) {
      const on = nav.querySelector('button.on');
      let ind = nav.querySelector(':scope > .fx-ind');
      if (!on) { if (ind) ind.style.opacity = 0; }
      else {
        const fresh = !ind;
        if (fresh) { ind = document.createElement('span'); ind.className = 'fx-ind'; nav.prepend(ind); if (lastTab) nav.classList.add('fx-settled'); }
        const r = on.getBoundingClientRect(), n = nav.getBoundingClientRect();
        const target = { left: r.left - n.left + 4, width: r.width - 8 };
        if (fresh && lastTab) { ind.style.transition = 'none'; ind.style.left = lastTab.left + 'px'; ind.style.width = lastTab.width + 'px'; void ind.offsetWidth; ind.style.transition = ''; }
        if (!lastTab || ind.style.left !== target.left + 'px') { ind.style.left = target.left + 'px'; ind.style.width = target.width + 'px'; }
        ind.style.opacity = 1; lastTab = target;
      }
    }
    const side = document.querySelector('.side');
    if (side) {
      const on = side.querySelector('a.on'); let si = side.querySelector(':scope > .fx-sind');
      if (on) {
        const fresh = !si;
        if (fresh) { si = document.createElement('span'); si.className = 'fx-sind'; side.prepend(si); side.classList.add('fx-has-ind'); }
        const target = { top: on.offsetTop, height: on.offsetHeight };
        if (fresh && lastSide) { si.style.transition = 'none'; si.style.top = lastSide.top + 'px'; si.style.height = lastSide.height + 'px'; void si.offsetWidth; si.style.transition = ''; }
        si.style.top = target.top + 'px'; si.style.height = target.height + 'px'; lastSide = target;
      }
    }
  }
  window.addEventListener('resize', () => { lastTab = null; placeNav(); });
  document.addEventListener('click', e => { if (e.target.closest('.bnav button, .side a')) requestAnimationFrame(placeNav); });


  /* ------------------------------------------------------------------ *
   * 6. Bottom nav indicator, badges, notifications, login UX
   * ------------------------------------------------------------------ */
  let lastBadge = {};
  document.addEventListener('click', e => {
    const b = e.target.closest('.bnav button'); if (!b) return;
    b.classList.remove('fx-tap'); void b.offsetWidth; b.classList.add('fx-tap');
  }, true);

  function note(icon, html, onClick) {
    const n = document.createElement('div'); n.className = 'fx-note'; n.innerHTML = `<i>${icon}</i><span>${html}</span>`;
    document.body.appendChild(n); requestAnimationFrame(() => n.classList.add('on'));
    n.onclick = () => { onClick && onClick(); n.classList.remove('on'); };
    setTimeout(() => { n.classList.remove('on'); setTimeout(() => n.remove(), 700); }, 4200);
  }
  function watchBadges() {
    document.querySelectorAll('.bnav .cartbadge').forEach(b => {
      const key = b.classList.contains('pchatbadge') ? 'chat' : 'cart';
      const n = b.hidden ? 0 : parseInt(b.textContent, 10) || 0;
      let seenMax = 0; try { seenMax = +(sessionStorage.getItem('ll_seen_' + key) || 0); } catch (e) {}
      if (n > seenMax) { try { sessionStorage.setItem('ll_seen_' + key, n); } catch (e) {} }
      if (key === 'chat' && n > seenMax && seenMax > 0 && !document.querySelector('.fx-note')) {
        note('💬', `<b>${n}</b> unread chat${n > 1 ? 's' : ''} from customers`, () => { const t = document.querySelector('[data-tabnav="p_chats"]'); t && t.click(); });
      }
      if (lastBadge[key] != null && n > lastBadge[key]) {
        b.classList.remove('fx-bump'); void b.offsetWidth; b.classList.add('fx-bump');
      }
      lastBadge[key] = n;
    });
  }
  setInterval(watchBadges, 700);

  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function enhanceLogin(root) {
    root.querySelectorAll('input[type=password]').forEach(inp => {
      if (inp.__fxeye) return; inp.__fxeye = 1;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'fx-eye'; b.innerHTML = EYE; b.setAttribute('aria-label', 'Show password');
      b.onclick = () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.innerHTML = show ? EYE_OFF : EYE; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); };
      inp.after(b);
    });
    const hero = root.querySelector('.auth-hero'); if (hero) mountLocal(hero, { nodes: 120, radius: 0.42, cx: 0.5, cy: 0.42, pins: 4, stars: 0, auto: true });
    root.querySelectorAll('.demo-pill [data-d]').forEach(d => { if (d.__fxd) return; d.__fxd = 1; d.addEventListener('click', () => {
      root.querySelectorAll('.demo-pill [data-d]').forEach(x => x.classList.toggle('fx-picked', x === d));
      const i = root.querySelector('#lid'); if (i) { i.closest('.input').classList.remove('fx-shake'); void i.offsetWidth; i.closest('.input').classList.add('fx-shake'); } }); });
    ['#lsubmit', '#al_go'].forEach(sel => { const b = root.querySelector(sel); if (!b || b.__fxl) return; b.__fxl = 1;
      b.addEventListener('click', () => { b.classList.add('fx-loading'); setTimeout(() => { if (b.isConnected) { b.classList.remove('fx-loading'); const card = b.closest('.auth-wrap, .crm-card'); card && (card.classList.remove('fx-shake'), void card.offsetWidth, card.classList.add('fx-shake')); } }, 1600); }); });
    root.querySelectorAll('#lid, #lpw, #al_id, #al_pw').forEach(i => { if (i.__fxk) return; i.__fxk = 1; i.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = root.querySelector('#lsubmit, #al_go'); b && b.click(); } }); });
  }


  /* partner login: desktop split-screen brand panel + kicker labels */
  const IC = {
    bag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4V5Z"/></svg>',
    tag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="8" cy="9" r="1.5"/></svg>',
    store:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l1.5-5h13L20 9M4 9h16v11H4V9Z"/><path d="M4 13h16"/></svg>',
    chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h16M7 16v-4M12 16V8M17 16v-7"/></svg>'
  };
  const fxLogo = (sz) => `<svg class="llogo" width="${sz}" height="${sz}" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <defs><linearGradient id="fxlg" x1="8" y1="2" x2="40" y2="46" gradientUnits="userSpaceOnUse"><stop stop-color="#C45BB0"/><stop offset="1" stop-color="#2B2A4A"/></linearGradient></defs>
    <path class="ll-pin" d="M24 3.5c9 0 16 7 16 16 0 11.2-11.4 21.6-16 25.5C19.4 41.1 8 30.7 8 19.5c0-9 7-16 16-16Z" fill="url(#fxlg)" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>
    <g class="ll-rings" stroke-width="3.6" stroke-linecap="round">
      <rect class="ll-r1" x="13.2" y="12.8" width="13" height="8.4" rx="4.2" transform="rotate(42 19.7 17)" stroke="#fff"/>
      <rect class="ll-r2" x="21.8" y="17.8" width="13" height="8.4" rx="4.2" transform="rotate(42 28.3 22)" stroke="#FFBA08"/></g></svg>`;
  function partnerSplit() {
    const wrap = document.querySelector('body[data-app="partner"] .appwrap');
    const on = !!(wrap && wrap.querySelector('.auth-wrap'));
    document.body.classList.toggle('fx-plogin', on);
    if (!wrap) return;
    let sp = wrap.querySelector('.fx-split');
    if (on && !sp) {
      sp = document.createElement('section'); sp.className = 'fx-split';
      sp.innerHTML = `<div class="eyebrow"><i></i>LOCAL LINK · PARTNER</div>
        <div class="sp-hero"><div class="fx-arch">${window.logoMark ? window.logoMark(150) : ''}
          <span class="fx-chipf c1">${IC.bag}</span><span class="fx-chipf c2">${IC.chat}</span><span class="fx-chipf c3">${IC.tag}</span><span class="fx-chipf c4">${IC.store}</span></div>
          <div><h1>Your shop.<br>Every pocket<br><em>nearby.</em></h1><div class="sub">Grow your store, locally.</div></div></div>
        <div class="fx-feats">
          <div><b><span>${IC.store}</span>Your digital storefront</b><p>List products, services and offers your neighbourhood can find.</p></div>
          <div><b><span>${IC.bag}</span>Orders in real time</b><p>Get notified the moment a customer orders or sends an enquiry.</p></div>
          <div><b><span>${IC.chart}</span>See what's working</b><p>Simple analytics on views, orders and your best sellers.</p></div></div>`;
      wrap.prepend(sp); mountLocal(sp, { nodes: 160, radius: 0.42, cx: 0.75, cy: 0.35, pins: 5, stars: 40 });
    } else if (!on && sp) { sp.__fx3d && sp.__fx3d.destroy(); sp.remove(); }
    document.querySelectorAll('.auth-hero').forEach(h => { if (!h.dataset.kicker) h.dataset.kicker = document.body.dataset.app === 'partner' ? 'PARTNER' : 'WELCOME'; });
  }


  /* hero carousel: centre card in focus, amber progress line instead of dots */
  function heroFx() {
    const h = document.getElementById('hero'); if (!h || h.__fxh || !h.querySelector('.hcard')) return; h.__fxh = 1;
    const mark = () => { const c = h.getBoundingClientRect(); const mid = c.left + c.width / 2;
      h.querySelectorAll('.hcard').forEach(k => { const r = k.getBoundingClientRect(); const on = Math.abs(r.left + r.width / 2 - mid) < r.width / 2;
        k.classList.toggle('fx-off', !on);
        let p = k.querySelector('.fx-prog'); if (on && !p) { p = document.createElement('span'); p.className = 'fx-prog'; p.innerHTML = '<i></i>'; k.appendChild(p); }
        if (!on && p) p.remove(); }); };
    h.addEventListener('scroll', () => { cancelAnimationFrame(h.__raf); h.__raf = requestAnimationFrame(mark); }, { passive: true });
    mark();
  }


  /* every horizontal row: auto-advance + manual swipe/drag (pauses on interaction) */
  function autoRows() {
    document.querySelectorAll('.phone :is(.hero,.dealrow,.promorow,.hscroll,.vb-moods,.fc-list)').forEach(row => {
      if (row.__fxAuto || row.scrollWidth <= row.clientWidth + 20) return; row.__fxAuto = 1;
      let paused = false, rt = null, down = false, sx = 0, sl = 0, moved = false;
      const pause = () => { paused = true; clearTimeout(rt); rt = setTimeout(() => paused = false, 6000); };
      ['pointerdown', 'touchstart', 'wheel'].forEach(ev => row.addEventListener(ev, pause, { passive: true }));
      row.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = row.scrollLeft; row.style.scrollSnapType = 'none'; row.style.cursor = 'grabbing'; });
      window.addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; row.scrollLeft = sl - dx; });
      window.addEventListener('pointerup', () => { if (!down) return; down = false; row.style.scrollSnapType = ''; row.style.cursor = ''; });
      row.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
      const first = row.firstElementChild;
      const t = setInterval(() => {
        if (!document.body.contains(row)) { clearInterval(t); return; }
        if (paused || down || document.hidden) return;
        const r = row.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
        const step = (first ? first.getBoundingClientRect().width : row.clientWidth * .8) + 12;
        const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 10;
        row.scrollTo({ left: atEnd ? 0 : row.scrollLeft + step, behavior: 'smooth' });
      }, row.id === 'hero' ? 4500 : 3400);
    });
  }
  /* 3D scroll-depth: cards tilt in from depth as they enter the viewport while scrolling */
  function depthScroll() {
    const sc = document.getElementById('screen'); if (!sc || sc.__fxDepth) return; sc.__fxDepth = 1;
    const tick = () => { const H = sc.clientHeight, top = sc.getBoundingClientRect().top;
      sc.querySelectorAll('.pcard,.bcard,.brow,.ostack,.dl-hero,.hcard,.vb-greet,.ncat').forEach(el => {
        const r = el.getBoundingClientRect(); const p = (r.top - top) / H;
        if (p > .78) { const k = Math.min(1, (p - .78) / .3); el.style.setProperty('--dz', k); } else el.style.setProperty('--dz', 0); }); };
    sc.addEventListener('scroll', () => requestAnimationFrame(tick), { passive: true }); setTimeout(tick, 300);
  }


  /* flowing 3D pin-network inside each app surface */
  function innerScenes() {
    const ph = document.querySelector('.phone'); if (ph && !ph.querySelector(':scope > .fx3d-in')) {
      const c = document.createElement('canvas'); c.className = 'fx3d-local fx3d-in'; c.setAttribute('aria-hidden', 'true'); ph.prepend(c);
      ph.__fxIn = makeScene(c, { nodes: 140, radius: 0.42, cx: 0.55, cy: 0.45, pins: 6, stars: 40, speed: .8, auto: true }); }
    const dk = document.querySelector('.desk'); if (dk && !dk.querySelector(':scope > .fx3d-in')) {
      const c = document.createElement('canvas'); c.className = 'fx3d-local fx3d-in fx3d-desk'; c.setAttribute('aria-hidden', 'true'); dk.appendChild(c);
      dk.__fxIn = makeScene(c, { nodes: 220, radius: 0.38, cx: 0.7, cy: 0.5, pins: 8, stars: 60, speed: .7, auto: true }); }
  }

  const start = () => {
    mo.observe(document.getElementById('stage'), { childList: true, subtree: true });
    decorate(document.getElementById('stage')); placeNav(); enhanceLogin(document); partnerSplit(); heroFx(); setTimeout(autoRows, 1200); depthScroll(); innerScenes();
    const intro = document.getElementById('fx-intro');
    if (intro) setTimeout(() => { intro.classList.add('out'); setTimeout(() => intro.remove(), 900); }, RM ? 0 : 900);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* toasts slide in with spring (they're appended to #toast-host) */
  const th = document.getElementById('toast-host');
  if (th) new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.classList && n.classList.add('fx-toast')))).observe(th, { childList: true });

  window.LocalLinkFX = { makeScene };
})();
