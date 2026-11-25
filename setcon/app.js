/* SetCon project page v5. Everything shown is precomputed; the browser places the devices on the animated MHR body, draws
   the stored signals and projects the stored embeddings. One WebGL canvas (the hero), paused off-screen; every other figure
   is a 2-D canvas or SVG redrawn only when something changes. The theme switch, the top bar, the link bar and the BibTeX
   belong to the frame (frame/frame.js); this script only follows the theme. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  // ?hero=b: the body sits beside the plots inside the figure panel; the stage node moves there before anything binds to it
  if (document.documentElement.dataset.hero === "b") { const st = $("stage"), fan = $("fanWrap"); if (st && fan) fan.parentNode.insertBefore(st, fan); }
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const DEG = Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PERF = /perf=1/.test(location.search);
  const perf = { dt: [], js: [], static: [], fan: [], fan3: [], map: [], wrist: [], cam: [], vis: [] };   // fan: one canvas draw; fan3: the three strip canvases per frame
  window.__perf = perf;
  const api = {};
  window.__app = api;
  const NBSP = " ";
  const pct = (v, d = 0) => `${v.toFixed(d)}${NBSP}%`;
  const num = (v) => v.toLocaleString("en");

  // ------------------------------------------------------------------ theme: the system's, or the frame's switch (html[data-theme]); the figures redraw on every change
  const themeCb = [];
  const isDark = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const fireTheme = () => themeCb.forEach((f) => f());
  new MutationObserver(fireTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!document.documentElement.dataset.theme) fireTheme(); });
  const onTheme = (f) => themeCb.push(f);
  const SANS = css("--sans");
  const FONT = (w = 500, px = 12) => `${w} ${px}px ${SANS}`;
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

  // ------------------------------------------------------------------ canvas helpers
  function fit(canvas) {
    const r = canvas.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { W: r.width, H: r.height, dpr };
  }
  function haloText(ctx, s, x, y, color, align = "left", font = null) {
    ctx.font = font || FONT(); ctx.textAlign = align; ctx.textBaseline = "middle";
    ctx.lineWidth = 3.5; ctx.strokeStyle = css("--bg-2"); ctx.lineJoin = "round"; ctx.strokeText(s, x, y);
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  function animate(ms, step, done) {
    if (REDUCED || ms <= 0) { step(1); if (done) done(); return; }
    const t0 = performance.now();
    const go = (now) => { const t = Math.min(1, (now - t0) / ms); step(ease(t)); if (t < 1) requestAnimationFrame(go); else if (done) done(); };
    requestAnimationFrame(go);
  }

  const PULSE_S = 1.2, pulsePhase = (t) => ((t % PULSE_S) + PULSE_S) % PULSE_S / PULSE_S;   // 0 -> 1 over each pulse, on the clip clock

  // ------------------------------------------------------------------ trace strip: columns of rows, a fan of wearings and the watch on top
  // cols: [[{label, lim, axis}, ...], ...] groups of rows, each with a .title; side by side when wide enough (>= minColW per group), else
  // stacked in one column with a title line per group; value(i, k, s) for wearing i, row k (global index), sample s; NaN = no data yet
  function strip(canvas, cols, n, dur, value, { cursor = false, minColW = 420, span = null, left = 34, titleX = null } = {}) {
    const ctx = canvas.getContext("2d"), off = document.createElement("canvas"), octx = off.getContext("2d");
    const st = { N: 1, hl: -1, dirty: true, size: null, lastT: null, pal: null, lastX: -1e9, tapes: [] };
    let rowsFlat = cols.flat();
    const palette = () => { const d = isDark(); st.pal = { accent: css("--accent"), ink: css("--ink"), ink2: css("--ink-2"), ink3: css("--ink-3"), grid: css("--line"), grid2: css("--line-2"), line: d ? ["#ff9a6e", "#4fe0ad", "#7fb4ff", "#c4bbff"] : ["#b9481c", "#0f8a5c", "#1f5fae", "#4a3bc6"], band: d ? ["#ff8a5c", "#3fd39f", "#6ea8ff", "#a79dff"] : ["#eb6834", "#1baf7a", "#2a78d6", "#6250d6"], bandA: d ? 0.30 : 0.20 }; };
    function resize() { const s = fit(canvas); if (!s) return; st.size = s; off.width = canvas.width; off.height = canvas.height; st.dirty = true; }
    function layout() {                                    // from the cached size only: no layout reads per frame
      const { W, H } = st.size, side = cols.length > 1 && W >= (cols.minColW || minColW) * cols.length;
      const nc = side ? cols.length : 1, L = left, R = 14, T = 26, B = 24, gap = 44;   // v8: R 30 -> 14, the scale is printed once per group
      const colW = (W - (nc - 1) * gap) / nc;
      const blocks = [];
      if (side) {
        cols.forEach((rows, c) => { const x0 = c * (colW + gap) + L, x1 = c * (colW + gap) + colW - R, rh = (H - T - B) / rows.length; let k0 = cols.slice(0, c).reduce((a, r) => a + r.length, 0); blocks.push({ x0, x1, title: rows.title, grp: rows, rows: rows.map((row, j) => ({ k: k0 + j, yc: T + rh * (j + 0.5), rh })) }); });
      } else {                                             // stacked: a title line above each group, equal row heights throughout
        const top = 6, titleH = 20, rh = (H - top - B - cols.length * titleH) / rowsFlat.length, rows = [], titles = []; let y = top, k = 0;
        cols.forEach((g) => { titles.push({ y: y + titleH / 2 - 1, text: g.title, grp: g }); y += titleH; g.forEach(() => { rows.push({ k, yc: y + rh / 2, rh }); k++; y += rh; }); });
        blocks.push({ x0: L, x1: W - R, rows, titles });
      }
      return blocks;
    }
    // the traces of one block over samples s0 .. s0+count-1 onto a context whose x axis runs from xa to xb (CSS px): for each row the
    // other wearings as thin lines in the axis colour, then the reference device as one crisp line
    function traces(o, b, s0, count, xa, xb, wrap = false) {   // wrap: sample k sits at k/count of the width and the loop is closed with sample s0 again
      const pts = wrap ? count + 1 : count, dx = (xb - xa) / (wrap ? count : count - 1), P = st.pal, m = st.N - 1;
      if (!b.rows.length || !Number.isFinite(value(0, b.rows[0].k, 0))) return;     // the data of this canvas has not arrived yet
      for (const r of b.rows) {
        const row = rowsFlat[r.k], yc = r.yc, sc = (r.rh * 0.42) / row.lim, ax = row.axis;
        if (m >= 1) {                                                          // the other wearings: thin lines in the axis colour
          o.strokeStyle = P.band[ax]; o.lineWidth = 1; o.globalAlpha = clamp(0.9 / Math.sqrt(m), 0.3, 0.45); o.beginPath();
          for (let i = 1; i <= m; i++) for (let k = 0; k < pts; k++) { const s = (s0 + k + n) % n, y = yc - clamp(value(i, r.k, s), -row.lim, row.lim) * sc; if (k) o.lineTo(xa + dx * k, y); else o.moveTo(xa, y); }
          o.stroke(); o.globalAlpha = 1;
        }
        o.strokeStyle = P.line[ax]; o.lineWidth = 1.8; o.lineJoin = "round"; o.beginPath();
        for (let k = 0; k < pts; k++) { const s = (s0 + k + n) % n, y = yc - clamp(value(0, r.k, s), -row.lim, row.lim) * sc; if (k) o.lineTo(xa + dx * k, y); else o.moveTo(xa, y); }
        o.stroke();
        if (st.hl > 0 && st.hl < st.N) {
          o.strokeStyle = P.line[ax]; o.lineWidth = 1; o.globalAlpha = 0.7; o.beginPath();
          for (let k = 0; k < pts; k++) { const s = (s0 + k + n) % n, y = yc - clamp(value(st.hl, r.k, s), -row.lim, row.lim) * sc; if (k) o.lineTo(xa + dx * k, y); else o.moveTo(xa, y); }
          o.stroke(); o.globalAlpha = 1;
        }
      }
    }
    // windowed mode: one offscreen tape per block holds the whole clip at the window's pixel density (400 samples over ~2600 device px,
    // so well under one point per pixel); it is rendered only when N, the data, the theme or the size change
    function renderTapes(blocks) {
      const { H, dpr } = st.size; st.tapes0 = st.tapes; st.tapes = [];
      blocks.forEach((b, i) => {
        const winCss = b.x1 - b.x0, tapeCss = winCss * dur / span, cv = (st.tapes0 && st.tapes0[i] && st.tapes0[i].cv) || document.createElement("canvas");
        const cw = Math.round(tapeCss * dpr), chh = Math.round(H * dpr); if (cv.width !== cw) cv.width = cw; if (cv.height !== chh) cv.height = chh;
        const o = cv.getContext("2d"); o.setTransform(dpr, 0, 0, dpr, 0, 0); o.clearRect(0, 0, tapeCss, H);
        traces(o, b, 0, n, 0, tapeCss, true);
        st.tapes[i] = { cv, winDev: Math.round(winCss * dpr), tapeDev: cv.width, hDev: cv.height, xDev: Math.round(b.x0 * dpr) };
      });
    }
    function renderStatic() {                              // axes and labels (and, without a window, the whole traces), cached
      if (!st.pal) palette();
      const { W, H, dpr } = st.size, o = octx, t0 = performance.now(), P = st.pal;
      o.setTransform(dpr, 0, 0, dpr, 0, 0); o.clearRect(0, 0, W, H);
      o.textBaseline = "middle";
      const blocks = layout(), ph = W < 520;               // v7: phones, the group titles and the time axis one pixel larger
      blocks.forEach((b) => {
        // v8: one title per group (the longest of its variants that fits) and, at the right end of the same line, the group's scale once
        // ("±19 m/s²": each row of the group runs from -19 to 19), instead of the two numbers at every row
        const title = (grp, text, x, y, font, color) => {
          const sc = grp && grp.unit ? `±${grp[0].lim}${NBSP}${grp.unit}` : "";
          o.font = FONT(400, ph ? 12 : 11); const sw = sc ? o.measureText(sc).width + 12 : 0;
          if (sc) { o.fillStyle = P.ink3; o.textAlign = "right"; o.fillText(sc, b.x1, y); }
          o.font = font; o.fillStyle = color; o.textAlign = "left";
          const vs = Array.isArray(text) ? text : [text], room = b.x1 - x - sw;
          o.fillText(vs.find((v) => o.measureText(v).width <= room) || vs[vs.length - 1], x, y);
        };
        const tx = titleX == null ? b.x0 : titleX;
        if (b.title) title(b.grp, b.title, tx, 10, FONT(540, 13), P.ink);
        if (b.titles) for (const t of b.titles) title(t.grp, t.text, tx, t.y, FONT(540, ph ? 13.5 : 12.5), P.ink2);
        for (const r of b.rows) {
          const row = rowsFlat[r.k], yc = r.yc, half = r.rh * 0.42;
          o.strokeStyle = P.grid2; o.lineWidth = 1; o.beginPath(); o.moveTo(b.x0, yc - half + 0.5); o.lineTo(b.x1, yc - half + 0.5); o.moveTo(b.x0, yc + half + 0.5); o.lineTo(b.x1, yc + half + 0.5); o.stroke();
          o.strokeStyle = P.grid; o.beginPath(); o.moveTo(b.x0, yc + 0.5); o.lineTo(b.x1, yc + 0.5); o.stroke();
          o.font = FONT(600, 14); o.fillStyle = P.line[row.axis]; o.textAlign = "right"; o.fillText(row.label, b.x0 - 12, yc);
        }
        if (!span) traces(o, b, 0, n, b.x0, b.x1);
        o.font = FONT(400, ph ? 12 : 11); o.fillStyle = P.ink3; o.textAlign = "center";
        if (span) { o.textAlign = "right"; o.fillText("now", b.x1, H - 9); o.textAlign = "left"; o.fillText(`−${span}${NBSP}s`, b.x0, H - 9); }   // v8: the two ends only
        else for (let s = 0; s <= dur; s += 5) { const x = b.x0 + (b.x1 - b.x0) * s / dur; o.fillText(s === dur ? `${s}${NBSP}s` : `${s}`, x, H - 9); }
      });
      if (span) renderTapes(blocks);
      st.dirty = false; st.lastX = -1e9;
      if (PERF) perf.static.push(performance.now() - t0);
    }
    function draw(t) {
      if (!st.size) { resize(); if (!st.size) return; }
      const t0 = performance.now();
      if (span) {                                          // blit the last `span` seconds of each tape, then the playhead dots
        const tt = t == null ? 0 : t, first = st.tapes[0];
        const xHead = first ? (tt / dur) * first.tapeDev : 0;
        if (!st.dirty && Math.abs(xHead - st.lastX) < 1) return;   // the playhead has not moved a device pixel
        if (st.dirty) renderStatic();
        st.lastX = xHead;
        const { dpr } = st.size, blocks = layout();
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(off, 0, 0);
        blocks.forEach((b, i) => {
          const tp = st.tapes[i]; if (!tp) return;
          const head = Math.round((tt / dur) * tp.tapeDev), sx = head - tp.winDev;
          if (sx >= 0) ctx.drawImage(tp.cv, sx, 0, tp.winDev, tp.hDev, tp.xDev, 0, tp.winDev, tp.hDev);
          else {                                           // the window runs over the loop point: the clip's tail, then its head
            const a = -sx;
            if (a > 0) ctx.drawImage(tp.cv, tp.tapeDev - a, 0, a, tp.hDev, tp.xDev, 0, a, tp.hDev);
            if (head > 0) ctx.drawImage(tp.cv, 0, 0, head, tp.hDev, tp.xDev + a, 0, head, tp.hDev);
          }
        });
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // the "now" dot: the value interpolated between the two samples around the playhead (the body is interpolated the same way),
        // behind it the accent pulse that the device on the body carries too
        const sp = tt / dur * n, sa = Math.floor(sp) % n, sb = (sa + 1) % n, sf = sp - Math.floor(sp), pp = pulsePhase(tt), hr = 3.5 + 7 * pp, ha = 0.5 * (1 - pp) * (1 - pp);
        for (const b of blocks) for (const r of b.rows) {
          const row = rowsFlat[r.k], sc = (r.rh * 0.42) / row.lim, va = value(0, r.k, sa), vb = value(0, r.k, sb); if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
          const y = r.yc - clamp(va + (vb - va) * sf, -row.lim, row.lim) * sc;
          ctx.globalAlpha = ha; ctx.fillStyle = st.pal.accent; ctx.beginPath(); ctx.arc(b.x1, y, hr, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = st.pal.line[row.axis]; ctx.beginPath(); ctx.arc(b.x1, y, 3, 0, 7); ctx.fill();
        }
      } else {
        if (st.dirty) renderStatic();
        const { H, dpr } = st.size;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(off, 0, 0);
        if (cursor && t != null) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const s = clamp(Math.round(t / dur * n), 0, n - 1);
          for (const b of layout()) {
            const x = b.x0 + (b.x1 - b.x0) * t / dur;
            ctx.strokeStyle = st.pal.ink3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, H - 20); ctx.stroke();
            for (const r of b.rows) { const row = rowsFlat[r.k], sc = (r.rh * 0.42) / row.lim; ctx.fillStyle = st.pal.line[row.axis]; ctx.beginPath(); ctx.arc(x, r.yc - clamp(value(0, r.k, s), -row.lim, row.lim) * sc, 3, 0, 7); ctx.fill(); }
          }
        }
      }
      if (PERF) { perf.fan.push(performance.now() - t0); if (perf.fan.length > 4000) perf.fan.shift(); }
    }
    new ResizeObserver(() => { resize(); draw(st.lastT); }).observe(canvas);
    onTheme(() => { palette(); st.dirty = true; draw(st.lastT); });
    fontsReady.then(() => { st.dirty = true; draw(st.lastT); });
    return { setN(N) { st.N = N; st.dirty = true; }, setHL(i) { st.hl = i; st.dirty = true; }, invalidate() { st.dirty = true; }, draw(t) { st.lastT = t; draw(t); } };
  }

  // ------------------------------------------------------------------ segmented controls: the sliding pill behind the pressed button
  function segIndicator(seg) {
    const ind = seg.querySelector(".ind");
    const move = () => { const b = seg.querySelector('[aria-pressed="true"]'); if (!b) return; ind.style.left = `${b.offsetLeft}px`; ind.style.width = `${b.offsetWidth}px`; };
    new ResizeObserver(move).observe(seg); fontsReady.then(move); return move;
  }
  const segs = [...document.querySelectorAll(".seg")].map((s) => ({ seg: s, move: segIndicator(s) }));
  const press = (sel, attr, val) => { document.querySelectorAll(sel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === val))); segs.forEach((s) => s.move()); };

  // ------------------------------------------------------------------ data
  const J = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });
  const F32 = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.arrayBuffer(); });
  const AX = ["#eb6834", "#1baf7a", "#2a78d6"];                                   // the film's x / y / z

  J("data/hero.json").then(hero).catch((e) => { $("status").textContent = "The page data could not load."; console.error(e); });
  J("data/postures.json").then((P) => { postures(P); results(P); headline(P); }).catch((e) => console.error(e));

  // ================================================================== hero: one body, one body part, N mountings, the fan
  function hero(H) {
    const NW = H.n, NS = H.samples, DUR = H.seconds;
    const acts = H.activities, sites = H.sites;
    const parts = []; for (const st of sites) if (!parts.some((p) => p.id === st.part)) parts.push({ id: st.part, label: st.label });
    const S = { act: acts[0], part: parts[0].id, side: "L", site: null, auto: true, N: REDUCED ? 12 : 1 };   // v8: the side is the menu's, it no longer changes by itself
    const resolveSite = () => sites.find((s) => s.part === S.part && (s.side === S.side || s.side === "C")) || sites[0];
    S.site = resolveSite();
    const sig = new Map();
    const sigKey = () => `${S.act.id}_${S.site.id}`;
    const loadSig = (key) => sig.has(key) ? Promise.resolve(sig.get(key)) : F32(`data/sig/${key}.f32`).then((buf) => { const f = new Float32Array(buf); sig.set(key, f); return f; });
    let raw = null;
    const rowsAcc = [{ label: "x", lim: 1, axis: 0 }, { label: "y", lim: 1, axis: 1 }, { label: "z", lim: 1, axis: 2 }]; rowsAcc.title = "Acceleration"; rowsAcc.unit = "m/s²";
    const rowsGyr = [{ label: "x", lim: 1, axis: 0 }, { label: "y", lim: 1, axis: 1 }, { label: "z", lim: 1, axis: 2 }]; rowsGyr.title = "Rotation rate"; rowsGyr.unit = "rad/s";
    const rowsAccC = [{ label: "x", lim: 1, axis: 0 }, { label: "y", lim: 1, axis: 1 }, { label: "z", lim: 1, axis: 2 }]; rowsAccC.title = "Gravity-aligned acceleration"; rowsAccC.unit = "m/s²";
    const rowsGyrC = [{ label: "x", lim: 1, axis: 0 }, { label: "y", lim: 1, axis: 1 }, { label: "z", lim: 1, axis: 2 }]; rowsGyrC.title = "Gravity-aligned rotation rate"; rowsGyrC.unit = "rad/s";
    const rowsRef = [{ label: "right", lim: 1.2, axis: 3 }, { label: "up", lim: 1.2, axis: 3 }, { label: "fwd", lim: 1.2, axis: 3 }]; rowsRef.title = ["Reference channels, gravity in the segment frame", "Reference, gravity in the segment frame", "Reference channels"];   // v8: the longest that fits
    const COLS_DEV = [rowsAcc, rowsGyr], COLS_ENC = [rowsAccC, rowsGyrC], COLS_REF = [rowsRef];
    const x9s = new Map(); let x9 = null, zeroRef = false;
    const loadX9 = (key) => x9s.has(key) ? Promise.resolve(x9s.get(key)) : F32(`data/x9/${key}.f32`).then((buf) => { const f = new Float32Array(buf); x9s.set(key, f); return f; });
    // three canvases, one clock: the device channels, the six channels the encoder reads (rotated so that gravity points up) and the reference channels
    const scopes = [
      strip($("scopeDev"), COLS_DEV, NS, DUR, (i, k, s) => raw ? raw[(i * NS + s) * 6 + k] : NaN, { minColW: 380, span: 5 }),
      strip($("scopeEnc"), COLS_ENC, NS, DUR, (i, k, s) => x9 ? x9[(i * NS + s) * 9 + k] : NaN, { minColW: 380, span: 5 }),
      strip($("scopeRef"), COLS_REF, NS, DUR, (i, k, s) => zeroRef ? 0 : x9 ? x9[(i * NS + s) * 9 + 6 + k] : NaN, { minColW: 380, span: 5, left: 58, titleX: 34 })];
    const scope = { setN: (N) => scopes.forEach((s) => s.setN(N)), invalidate: () => scopes.forEach((s) => s.invalidate()),
                    draw: (t) => { const f0 = performance.now(); for (const s of scopes) s.draw(t); if (PERF) { perf.fan3.push(performance.now() - f0); if (perf.fan3.length > 4000) perf.fan3.shift(); } } };
    const range = $("nwear");
    const paint = () => { range.value = S.N; range.style.setProperty("--p", `${(S.N - 1) / (NW - 1) * 100}%`); };
    const words = () => { const a = S.act.label; return a.charAt(0).toLowerCase() + a.slice(1); };
    const sideWord = () => S.site.side === "R" ? "right " : S.site.side === "L" ? "left " : "";
    const payoff = () => { $("payoff").textContent = S.N === 1 ? "Same movement, one mounting" : `Same movement, ${S.N} mountings`; };   // v8: the one line of the figure, the label of the slider
    let curWin = 0;                                                            // the clip's 10-s window (kept for the clock below)
    const tag = () => { payoff(); };
    const legend = () => { $("legOthersWrap").hidden = S.N < 2; $("legOthers").textContent = S.N > 2 ? `the other ${S.N - 1}` : "the other one"; };
    const applySig = () => { const key = sigKey(), L = H.limits[key]; raw = sig.get(key); x9 = x9s.get(key) || null; [rowsAcc, rowsAccC].forEach((rows) => rows.forEach((r) => { r.lim = L.acc; })); [rowsGyr, rowsGyrC].forEach((rows) => rows.forEach((r) => { r.lim = L.gyr; })); scope.invalidate(); scope.draw(clock.t); if (!x9) { const my = key; loadX9(key).then(() => { if (sigKey() === my) applySig(); }).catch((e) => { console.error(e); const en = $("encNote"); en.hidden = false; en.textContent = "The encoder input for this activity and body site is not available."; }); } };
    $("zeroEncSwitch").addEventListener("change", (e) => { zeroRef = e.target.checked; scope.invalidate(); scope.draw(clock.t); });
    api.setZeroRef = (z) => { zeroRef = z; $("zeroEncSwitch").checked = z; scope.invalidate(); scope.draw(clock.t); };
    // v8: two menus in the look of the map's dataset menu; the body-site menu holds the side ("Left wrist", "Chest")
    const actSel = $("actSel"), siteSel = $("siteSel");
    const siteName = (st) => st.side === "C" ? st.label : `${st.side === "R" ? "Right" : "Left"} ${st.label.toLowerCase()}`;
    actSel.innerHTML = acts.map((a) => `<option value="${a.id}">${a.label}</option>`).join("");
    siteSel.innerHTML = sites.map((st) => `<option value="${st.id}">${siteName(st)}</option>`).join("");
    const syncMenus = () => { actSel.value = S.act.id; siteSel.value = S.site.id; };     // also after a reload, which may restore another choice
    syncMenus();
    paint(); tag(); legend();

    if (!window.THREE || !THREE.GLTFLoader) { $("status").textContent = "The 3D viewer could not load."; return; }
    const host = $("stage");
    let B = null, raf = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement; canvas.style.touchAction = "pan-y"; host.prepend(canvas);
    const sc3 = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);
    camera.up.set(0, 1, 0);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8782, 0.55); sc3.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -1.4; key.shadow.camera.right = key.shadow.camera.top = 1.4; key.shadow.camera.near = 0.2; key.shadow.camera.far = 9;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.015; key.shadow.radius = 3; sc3.add(key); sc3.add(key.target);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(-2.5, 1.2, -1.5); sc3.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.45); rim.position.set(0.5, 2.0, -3); sc3.add(rim);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe6e3dd, roughness: 0.92, metalness: 0 });
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x4a4740, roughness: 0.96, metalness: 0 });   // stair treads: matte; under the stage's lights this renders as a light grey, a shade below the studio floor
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x6b675f, transparent: true, opacity: 0.6 });     // a thin nosing line on every tread edge, so the steps read
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.28 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc3.add(floor);
    // 19.11.: the floor of the MinPair page (site_v15 gl.js floorMat / circleTex): a fine 0.5-m grid, fixed in the world so that the body
    // walks over it, fading out 1.6 m around the body (MinPair: 2.4 m, seen from further away), and a soft contact disc under the body; one small plane each, no texture lookups
    const gridMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uC: { value: new THREE.Vector2() }, uR: { value: 1.6 }, uCol: { value: new THREE.Color(0x7b7c85) }, uA: { value: 0.24 } },
      vertexShader: "varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: "uniform vec2 uC; uniform float uR; uniform vec3 uCol; uniform float uA; varying vec2 vW;" +
        "void main(){ vec2 g = abs(fract(vW / 0.5 - 0.5) - 0.5) / fwidth(vW / 0.5); float l = 1.0 - min(min(g.x, g.y), 1.0);" +
        "float d = length(vW - uC) / uR; float f = 1.0 - smoothstep(0.35, 1.0, d); gl_FragColor = vec4(uCol, l * f * uA); }",
      extensions: { derivatives: true },
    });
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), gridMat); grid.rotation.x = -Math.PI / 2; grid.renderOrder = -2; sc3.add(grid);
    const discTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.45, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ color: 0x000000, map: discTex, transparent: true, depthWrite: false, opacity: 0.2 }));
    disc.rotation.x = -Math.PI / 2; disc.renderOrder = -1; sc3.add(disc);
    function resize() { const r = host.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); if (B && !raf) renderViews(); }
    new ResizeObserver(resize).observe(host); resize();
    const theme3 = () => { const d = isDark(); bodyMat.color.set(d ? 0x8a8d95 : 0xe6e3dd); stepMat.color.set(d ? 0x1c1d24 : 0x4a4740); edgeMat.color.set(d ? 0x62636e : 0x6b675f); floor.material.opacity = d ? 0.55 : 0.28; hemi.groundColor.set(d ? 0x303238 : 0x8a8782); hemi.intensity = d ? 0.5 : 0.55;
      gridMat.uniforms.uCol.value.set(css("--ink-3")); gridMat.uniforms.uA.value = d ? 0.3 : 0.24; disc.material.opacity = d ? 0.42 : 0.2; };
    theme3(); onTheme(theme3);

    // ---- the devices of the v292 film: watch case 38 x 44 x 10.5 mm (dark, screen, band, axes with letters), pods 36 x 30 x 10 mm (violet, short axes)
    const CASE = 0x333336, SCREEN = 0x0d0d0f, BANDC = 0x4d4d4f, POD = 0x6250d6, PODTOP = 0xb3a8f2;
    function superPrism(a, b, z0, z1, m = 40, nn = 4) {
      const pts = []; for (let i = 0; i < m; i++) { const th = 2 * Math.PI * i / m, c = Math.cos(th), s = Math.sin(th); pts.push([a * Math.sign(c) * Math.pow(Math.abs(c), 2 / nn), b * Math.sign(s) * Math.pow(Math.abs(s), 2 / nn)]); }
      const pos = []; const tri = (p, q, r) => pos.push(...p, ...q, ...r);
      for (let i = 0; i < m; i++) { const j = (i + 1) % m, [ui, vi] = pts[i], [uj, vj] = pts[j];
        tri([ui, vi, z0], [uj, vj, z0], [uj, vj, z1]); tri([ui, vi, z0], [uj, vj, z1], [ui, vi, z1]); tri([0, 0, z0], [uj, vj, z0], [ui, vi, z0]); tri([0, 0, z1], [ui, vi, z1], [uj, vj, z1]); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
    }
    const letters = [];
    function letterSprite(ch) {
      const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
      const draw = () => { x.clearRect(0, 0, 64, 64); x.font = `600 42px ${css("--sans")}`; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 6; x.strokeStyle = isDark() ? "#15171a" : "#ffffff"; x.strokeText(ch, 32, 34); x.fillStyle = isDark() ? "#f0f0ee" : "#1f1f1e"; x.fillText(ch, 32, 34); };
      draw(); const tex = new THREE.CanvasTexture(c); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      letters.push(() => { draw(); tex.needsUpdate = true; }); return sp;
    }
    onTheme(() => letters.forEach((f) => f()));
    const axisQuat = (d) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d));
    function triad(L, top, r, withLetters) {
      const g = new THREE.Group();
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((d, i) => {
        const q = axisQuat(d), m = new THREE.MeshBasicMaterial({ color: AX[i] }), Ls = L - 0.006;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Ls, 8), m); shaft.quaternion.copy(q); shaft.position.set(d[0] * Ls / 2, d[1] * Ls / 2, top + d[2] * Ls / 2);
        const head = new THREE.Mesh(new THREE.ConeGeometry(r * 3.2, 0.006, 10), m); head.quaternion.copy(q); head.position.set(d[0] * (L - 0.003), d[1] * (L - 0.003), top + d[2] * (L - 0.003));
        g.add(shaft, head);
        if (withLetters) { const sp = letterSprite("xyz"[i]); sp.position.set(d[0] * (L + 0.009), d[1] * (L + 0.009), top + d[2] * (L + 0.009)); sp.scale.set(0.012, 0.012, 1); g.add(sp); }
      });
      return g;
    }
    const watch = new THREE.Group();                                          // device 0 at the wrist: the watch
    {
      const z0 = 0.0035;
      const caseM = new THREE.Mesh(superPrism(0.019, 0.022, z0, z0 + 0.0105, 56), new THREE.MeshStandardMaterial({ color: CASE, roughness: 0.45 })); caseM.castShadow = true;
      watch.add(caseM);
      watch.add(new THREE.Mesh(superPrism(0.0165, 0.0195, z0 + 0.0105, z0 + 0.0112, 56), new THREE.MeshStandardMaterial({ color: SCREEN, roughness: 0.18 })));
      watch.add(triad(0.046, z0 + 0.0112, 0.0009, true));
      sc3.add(watch);
    }
    const first = new THREE.Group();                                          // device 0 elsewhere: the pod shape in the dark colour, with the lettered axes
    {
      const m = new THREE.Mesh(superPrism(0.018, 0.015, 0, 0.0095), new THREE.MeshStandardMaterial({ color: CASE, roughness: 0.45 })); m.castShadow = true;
      first.add(m, new THREE.Mesh(superPrism(0.0145, 0.0118, 0.0095, 0.0103), new THREE.MeshStandardMaterial({ color: SCREEN, roughness: 0.3 })), triad(0.042, 0.0103, 0.0009, true));
      first.visible = false; sc3.add(first);
    }
    // the pulse on device 0: a soft ring sprite in the accent, the same phase as the "now" dots of the plots
    const haloTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); const g = x.createRadialGradient(64, 64, 46, 64, 64, 62); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.45, "rgba(255,255,255,0.95)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const halos = [watch, first].map((g) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: css("--accent"), transparent: true, depthTest: false, depthWrite: false, opacity: 0 })); sp.position.set(0, 0, 0.012); sp.renderOrder = 3; g.add(sp); return sp; });
    onTheme(() => halos.forEach((h) => h.material.color.set(css("--accent"))));
    function pulse(t) { const p = pulsePhase(t), sz = 0.055 + 0.06 * p; for (const h of halos) { h.scale.set(sz, sz, 1); h.material.opacity = 0.5 * (1 - p) * (1 - p); } }
    const NP = NW - 1;
    const podBody = new THREE.InstancedMesh(superPrism(0.018, 0.015, 0, 0.0095), new THREE.MeshStandardMaterial({ color: POD, roughness: 0.45 }), NP); podBody.castShadow = true;
    const podTop = new THREE.InstancedMesh(superPrism(0.0145, 0.0118, 0.0095, 0.0103), new THREE.MeshStandardMaterial({ color: PODTOP, roughness: 0.3 }), NP);
    const podAx = [];
    {
      const L = 0.022, top = 0.0103, r = 0.0005, Ls = L - 0.005;
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((d, i) => {
        const m = new THREE.MeshBasicMaterial({ color: AX[i], transparent: true, opacity: 0.6 }), q = axisQuat(d);
        const shaft = new THREE.InstancedMesh(new THREE.CylinderGeometry(r, r, Ls, 6), m, NP);
        const head = new THREE.InstancedMesh(new THREE.ConeGeometry(r * 3.2, 0.005, 8), m, NP);
        podAx.push({ mesh: shaft, local: new THREE.Matrix4().compose(new THREE.Vector3(d[0] * Ls / 2, d[1] * Ls / 2, top + d[2] * Ls / 2), q, new THREE.Vector3(1, 1, 1)) });
        podAx.push({ mesh: head, local: new THREE.Matrix4().compose(new THREE.Vector3(d[0] * (L - 0.0025), d[1] * (L - 0.0025), top + d[2] * (L - 0.0025)), q, new THREE.Vector3(1, 1, 1)) });
      });
    }
    [podBody, podTop, ...podAx.map((a) => a.mesh)].forEach((m) => { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); sc3.add(m); });
    const setCount = () => { [podBody, podTop, ...podAx.map((a) => a.mesh)].forEach((m) => { m.count = S.N - 1; m.visible = S.N > 1; }); };
    setCount();
    for (const st of sites) { st.V = st.wearings.map((w) => new THREE.Vector3(...w.v)); st.Q = st.wearings.map((w) => new THREE.Quaternion(...w.q)); }

    // ---- the band: the forearm's skin cross-section through the watch, in the bind frame of its bone (film.py _watch_rest)
    function makeBand(skinned, bones, byName, st) {
      const def = st.band, bi = byName[st.band_bone]; if (bi == null || !def) return null;
      const g = skinned.geometry, pos = g.attributes.position;
      const inv = skinned.skeleton.boneInverses[bi].clone().multiply(skinned.bindMatrix);
      const ez = new THREE.Vector3().fromArray(def.normal).normalize(), t = new THREE.Vector3().fromArray(def.tangent);
      const ex = t.addScaledVector(ez, -t.dot(ez)).normalize(), ey = new THREE.Vector3().crossVectors(ez, ex), c = new THREE.Vector3().fromArray(def.offset);
      const q = [], v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(inv).sub(c); if (Math.abs(v.dot(ex)) < 0.008 && v.length() < 0.075) q.push([v.dot(ey), v.dot(ez)]); }
      if (q.length < 24) return null;
      const mn = [Math.min(...q.map((p) => p[0])), Math.min(...q.map((p) => p[1]))], mx = [Math.max(...q.map((p) => p[0])), Math.max(...q.map((p) => p[1]))], q0 = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2];
      const nb = 48, rr = new Array(nb).fill(NaN);
      for (const p of q) { const a = Math.atan2(p[1] - q0[1], p[0] - q0[0]), r = Math.hypot(p[0] - q0[0], p[1] - q0[1]), b = Math.floor((a + Math.PI) / (2 * Math.PI) * nb) % nb; if (!(rr[b] >= r)) rr[b] = r; }
      for (let b = 0; b < nb; b++) if (Number.isNaN(rr[b])) { let k = 1; while (Number.isNaN(rr[(b + k) % nb]) || Number.isNaN(rr[(b - k + nb) % nb])) k++; rr[b] = (rr[(b + k) % nb] + rr[(b - k + nb) % nb]) / 2; }
      const sm = rr.map((_, b) => { let s = 0, w = 0; for (let k = -4; k <= 4; k++) { const wk = Math.exp(-k * k / 2.88); s += wk * rr[(b + k + nb) % nb]; w += wk; } return s / w; });
      const m = 96, th = Array.from({ length: m }, (_, i) => -Math.PI + 2 * Math.PI * i / m), rf = th.map((a) => { const x = (a + Math.PI) / (2 * Math.PI) * nb - 0.5, i0 = Math.floor(x), f = x - i0; return sm[(i0 % nb + nb) % nb] * (1 - f) + sm[((i0 + 1) % nb + nb) % nb] * f; });
      const cen = c.clone().addScaledVector(ey, q0[0]).addScaledVector(ez, q0[1]), rings = [[0.002, -0.011], [0.0045, -0.011], [0.0045, 0.011], [0.002, 0.011]];
      const P = rings.map(([ro, wo]) => th.map((a, i) => cen.clone().addScaledVector(ex, wo).addScaledVector(ey, (rf[i] + ro) * Math.cos(a)).addScaledVector(ez, (rf[i] + ro) * Math.sin(a))));
      const arr = [];
      for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; for (let i = 0; i < m; i++) { const j = (i + 1) % m, a0 = P[k][i], a1 = P[k][j], b0 = P[k2][i], b1 = P[k2][j]; arr.push(...a0.toArray(), ...b0.toArray(), ...b1.toArray(), ...a0.toArray(), ...b1.toArray(), ...a1.toArray()); } }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: BANDC, roughness: 0.7, side: THREE.DoubleSide })); mesh.castShadow = true; bones[bi].add(mesh); return mesh;
    }

    // ---- two views in one WebGL context. Main view: the whole person from the left-front, the camera fixed in the body's smoothed frame
    //      (pelvis with velocity feed-forward, smoothed heading, world up, no roll). Inset: a close-up of the chosen body part from the same
    //      outside direction (the left arm and leg stay on the person's left, so this sees the outside of the limb without chasing its
    //      rotation), looking at the heavily smoothed device position; if the torso would block the line of sight the inset camera swings
    //      further to the front, smoothly. The inset is rendered into a corner of the WebGL canvas and copied to a small 2-D canvas.
    const TAU = { root: 0.45, arm: 0.08, glide: 0.7, vel: 0.5, heading: 1.0, dodge: 0.8, side: 0.45, view: 0.45, back: 1.6, user: 0.12 };
    const LIM = { yaw: 0.44, pitch: 0.2, mainDist: 3.0, insetDist: 1.1, speedMin: 0.25, jump: 0.6, torsoR: 0.17, dodgeMax: 0.8, dodgeHold: 1500 };
    const VIEW = { wrist: { f: 0.45, l: 0.80, u: 0.40, d: 1.0 }, uparm: { f: 0.30, l: 0.90, u: 0.30, d: 1.0 }, chest: { f: 0.85, l: 0.45, u: 0.25, d: 1.05 }, thigh: { f: 0.45, l: 0.85, u: 0.25, d: 1.05 }, shin: { f: 0.45, l: 0.85, u: 0.10, d: 1.0 } };
    const cam = { heading: 0, headT: 0, root: new THREE.Vector3(), neck: new THREE.Vector3(), arm: new THREE.Vector3(), vel: new THREE.Vector3(), dodge: 0, sideMix: 1, viewT: 0, viewMix: 0, viewFrom: 0, viewAt: -1e9, wholeFrom: 0, yaw: 0, pitch: 0, yawT: 0, pitchT: 0, drag: null, lastInput: -1e9, init: false, glideUntil: 0 };
    const sm = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));
    const smV = (v, tx, ty, tz, dt, tau) => { const a = 1 - Math.exp(-dt / tau); v.x += (tx - v.x) * a; v.y += (ty - v.y) * a; v.z += (tz - v.z) * a; };
    const smAngle = (cur, target, dt, tau) => { let d = target - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); return cur + d * (1 - Math.exp(-dt / tau)); };
    const rootW = new THREE.Vector3(), neckW = new THREE.Vector3(), rootPrev = new THREE.Vector3(), d0 = new THREE.Vector3(), d0q = new THREE.Quaternion(), tgt = new THREE.Vector3(), off = new THREE.Vector3(), ndc = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0), nrmW = new THREE.Vector3(), look = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
    const insetCam = new THREE.PerspectiveCamera(28, 4 / 3, 0.03, 40); insetCam.up.set(0, 1, 0);
    const viewPos = { body: new THREE.Vector3(), close: new THREE.Vector3() }, viewLook = { body: new THREE.Vector3(), close: new THREE.Vector3() };
    const syncAspect = () => { insetCam.aspect = camera.aspect; insetCam.updateProjectionMatrix(); };
    new ResizeObserver(syncAspect).observe(host); syncAspect();
    // the shortest distance between the segment a-b and the segment c-d (torso axis), for the line-of-sight test
    function segSegDist(a, b, c, d) {
      const u = tmpA.subVectors(b, a), v = tmpB.subVectors(d, c), w0 = tmpC.subVectors(a, c);
      const A = u.dot(u), Bv = u.dot(v), C = v.dot(v), D = u.dot(w0), E = v.dot(w0), den = A * C - Bv * Bv;
      let s = den > 1e-9 ? clamp((Bv * E - C * D) / den, 0, 1) : 0; let t = clamp((Bv * s + E) / Math.max(C, 1e-9), 0, 1); s = clamp((Bv * t - D) / Math.max(A, 1e-9), 0, 1);
      const px = a.x + u.x * s - (c.x + v.x * t), py = a.y + u.y * s - (c.y + v.y * t), pz = a.z + u.z * s - (c.z + v.z * t);
      return Math.sqrt(px * px + py * py + pz * pz);
    }
    const vis = { centre: false, facing: false, free: true };
    function camUpdate(dt, now) {
      B.root.getWorldPosition(rootW); if (B.neck) B.neck.getWorldPosition(neckW); else neckW.copy(rootW).add(UP.clone().multiplyScalar(0.5));
      if (cam.init && rootW.distanceTo(rootPrev) > LIM.jump) cam.init = false;        // the clip looped or the body changed: cut
      const sideSign = S.site.side === "R" ? -1 : 1;
      if (!cam.init) { cam.root.copy(rootW); cam.neck.copy(neckW); cam.arm.copy(d0).sub(rootW); cam.heading = cam.headT = B.head0; cam.vel.copy(B.vel0); cam.dodge = 0; cam.sideMix = sideSign; cam.viewMix = cam.viewFrom = cam.viewT; cam.viewAt = -1e9; rootPrev.copy(rootW); cam.init = true; dt = 0; }
      cam.sideMix = sm(cam.sideMix, sideSign, dt, TAU.side);                 // the camera is on the devices' side; a side change passes in front of the person
      if (dt > 0) {
        const vx = (rootW.x - rootPrev.x) / dt, vy = (rootW.y - rootPrev.y) / dt, vz = (rootW.z - rootPrev.z) / dt;
        smV(cam.vel, vx, vy, vz, dt, TAU.vel);
        if (Math.hypot(cam.vel.x, cam.vel.z) > LIM.speedMin) cam.headT = Math.atan2(cam.vel.x, cam.vel.z);
        for (const v of [cam.root, cam.neck]) { v.x += cam.vel.x * dt; v.y += cam.vel.y * dt; v.z += cam.vel.z * dt; }
      }
      rootPrev.copy(rootW);
      cam.heading = smAngle(cam.heading, cam.headT, dt, TAU.heading);
      smV(cam.root, rootW.x, rootW.y, rootW.z, dt, TAU.root); smV(cam.neck, neckW.x, neckW.y, neckW.z, dt, TAU.root);
      smV(cam.arm, d0.x - rootW.x, d0.y - rootW.y, d0.z - rootW.z, dt, now < cam.glideUntil ? TAU.glide : TAU.arm);
      if (!cam.drag && now - cam.lastInput > 900) { cam.yawT = sm(cam.yawT, 0, dt, TAU.back); cam.pitchT = sm(cam.pitchT, 0, dt, TAU.back); }
      cam.yaw = sm(cam.yaw, cam.yawT, dt, TAU.user); cam.pitch = sm(cam.pitch, cam.pitchT, dt, TAU.user);
      // the body frame: fwd = heading, left = up x fwd
      const h = cam.heading, fx = Math.sin(h), fz = Math.cos(h), lx = Math.cos(h), lz = -Math.sin(h);
      // main view: the whole person from the left-front, a small user yaw/pitch on top
      const hm = h + cam.yaw, fxm = Math.sin(hm), fzm = Math.cos(hm), lxm = Math.cos(hm), lzm = -Math.sin(hm);
      const wide = Math.max(1, 1.2 / camera.aspect);
      off.set(fxm * 0.70 + lxm * 0.62 * cam.sideMix, 0.33 + cam.pitch, fzm * 0.70 + lzm * 0.62 * cam.sideMix).normalize().multiplyScalar(LIM.mainDist * Math.sqrt(wide));
      viewLook.body.set(cam.root.x, cam.root.y + 0.05, cam.root.z);
      viewPos.body.set(viewLook.body.x + off.x, viewLook.body.y + 0.12 + off.y, viewLook.body.z + off.z);
      // inset: the smoothed device position from the site's outside direction, swung to the front while the torso blocks the view
      tgt.set(cam.root.x + cam.arm.x, cam.root.y + cam.arm.y, cam.root.z + cam.arm.z);
      const V = VIEW[S.site.part] || VIEW.wrist, ang = cam.dodge, Ls = V.l * cam.sideMix, sg = Math.sign(cam.sideMix) || 1;
      const f = V.f * Math.cos(ang) + Math.abs(Ls) * Math.sin(ang), l = Ls * Math.cos(ang) - sg * V.f * Math.sin(ang);   // rotate the offset toward the front
      off.set(fx * f + lx * l, V.u, fz * f + lz * l).normalize().multiplyScalar(LIM.insetDist * V.d);
      insetCam.position.set(tgt.x + off.x, tgt.y + off.y, tgt.z + off.z); insetCam.lookAt(tgt);
      viewPos.close.copy(insetCam.position); viewLook.close.copy(tgt);
      const zu = clamp(((((clock.t - cam.viewAt) % B.dur) + B.dur) % B.dur) / ZOOM_S, 0, 1), ze = 1 - Math.pow(1 - zu, 3);   // one ease-out zoom on the clip clock, no overshoot
      cam.viewMix = cam.viewFrom + (cam.viewT - cam.viewFrom) * ze; const vm = cam.viewMix;
      camera.position.lerpVectors(viewPos.body, viewPos.close, vm); look.lerpVectors(viewLook.body, viewLook.close, vm); camera.lookAt(look);
      // line of sight from the inset camera to a point 0.22 m short of the device (the device itself may sit on the torso or hip)
      tmpC.subVectors(tgt, insetCam.position); const ld = tmpC.length(); tmpC.multiplyScalar(Math.max(0, ld - 0.22) / Math.max(ld, 1e-6)).add(insetCam.position);
      const blocked = segSegDist(insetCam.position, tmpC, cam.root, cam.neck) < LIM.torsoR;
      if (blocked) cam.dodgeHold = now + LIM.dodgeHold;                              // swing to the front and stay there a while: no toggling
      cam.dodge = sm(cam.dodge, (blocked || now < (cam.dodgeHold || 0)) ? LIM.dodgeMax : 0, dt, TAU.dodge);
      // visibility of the first device in the inset: inside the centre half, its face toward the camera, torso not in the way
      ndc.copy(d0).project(insetCam); nrmW.set(0, 0, 1).applyQuaternion(d0q); tmpA.subVectors(insetCam.position, d0).normalize();
      vis.centre = Math.abs(ndc.x) <= 0.5 && Math.abs(ndc.y) <= 0.5; vis.facing = nrmW.dot(tmpA) > 0.05; vis.free = !blocked;
      if (PERF && dt > 0) {
        perf.wrist.push([+ndc.x.toFixed(3), +ndc.y.toFixed(3), +clock.t.toFixed(2)]); if (perf.wrist.length > 3000) perf.wrist.shift();
        perf.vis.push((vis.centre ? 1 : 0) + (vis.facing ? 2 : 0) + (vis.free ? 4 : 0)); if (perf.vis.length > 4000) perf.vis.shift();
        off.normalize(); perf.cam.push([+clock.t.toFixed(3), +off.x.toFixed(4), +off.y.toFixed(4), +off.z.toFixed(4), +dt.toFixed(4)]); if (perf.cam.length > 4000) perf.cam.shift();
      }
    }
    function renderViews() { renderer.render(sc3, camera); }
    canvas.addEventListener("pointerdown", (e) => { cam.drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; host.classList.add("touched"); canvas.setPointerCapture(e.pointerId); cam.lastInput = performance.now(); setAuto(false); });
    const WHOLE_S = 2.0, ZOOM_S = 0.7;                                       // seconds of whole body, then the zoom's length
    const setViewT = (v) => { if (v === cam.viewT) return; cam.viewFrom = cam.viewMix; cam.viewT = v; cam.viewAt = clock.t; };
    const autoView = () => ((((clock.t - cam.wholeFrom) % B.dur) + B.dur) % B.dur >= (S.act.whole || WHOLE_S) ? 1 : 0);
    const setAuto = (on) => { S.auto = on; $("autoView").hidden = on; $("viewSeg").hidden = on; if (on) setViewT(autoView()); };
    const setView = (v) => { setAuto(false); setViewT(v === "close" ? 1 : 0); press("[data-view]", "view", v); };
    $("autoView").addEventListener("click", () => setAuto(true));
    document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    canvas.addEventListener("pointermove", (e) => { if (!cam.drag || e.pointerId !== cam.drag.id) return; cam.yawT = clamp(cam.yawT - (e.clientX - cam.drag.x) * 0.004, -LIM.yaw, LIM.yaw); cam.pitchT = clamp(cam.pitchT + (e.clientY - cam.drag.y) * 0.003, -LIM.pitch, LIM.pitch); cam.drag.x = e.clientX; cam.drag.y = e.clientY; cam.lastInput = performance.now(); });
    const endDrag = () => { cam.drag = null; cam.lastInput = performance.now(); };
    canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);
    const setZoom = () => {};                                                // both views are always shown; kept for the check harness

    // ---- the bodies: one glTF per activity, loaded on demand and kept
    const bodies = new Map(), loader = new THREE.GLTFLoader();
    function loadBody(act) {
      if (bodies.has(act.id)) return Promise.resolve(bodies.get(act.id));
      return new Promise((res, rej) => loader.load(act.file, (gltf) => {
        const body = gltf.scene; let skinned = null;
        body.traverse((o) => { if (o.isSkinnedMesh) { skinned = o; o.material = bodyMat; o.frustumCulled = false; o.castShadow = true; } });
        const clip = gltf.animations[0]; clip.tracks.forEach((t) => { if (t.setInterpolation) t.setInterpolation(THREE.InterpolateLinear); });
        const mixer = new THREE.AnimationMixer(body); mixer.clipAction(clip).play();
        const bones = skinned.skeleton.bones, byName = {}; bones.forEach((b, i) => { byName[b.name] = i; });
        const root = bones[byName.root] || bones[0], feet = bones.filter((b) => /foot|toe|ball/.test(b.name));
        // the lowest foot per frame; the support height = its minimum over +-0.3 s, then a +-0.25-s mean, so the shadow floor glides and never jumps
        let floorY = Infinity; const tmp = new THREE.Vector3(), footY = new Float32Array(400), supY = new Float32Array(400), winY = new Float32Array(400);
        for (let f = 0; f < 400; f++) { mixer.setTime(f / 20); body.updateMatrixWorld(true); let m = Infinity; for (const b of feet) m = Math.min(m, b.getWorldPosition(tmp).y); footY[f] = m; floorY = Math.min(floorY, m); }
        for (let f = 0; f < 400; f++) { let m = Infinity; for (let k = Math.max(0, f - 6); k <= Math.min(399, f + 6); k++) m = Math.min(m, footY[k]); winY[f] = m; }
        for (let f = 0; f < 400; f++) { let a = 0, n = 0; for (let k = Math.max(0, f - 5); k <= Math.min(399, f + 5); k++) { a += winY[k]; n++; } supY[f] = a / n; }
        let steps = null;                                                      // stair treads (hero.json activities[].steps: boxes in this frame, metres)
        if (act.steps && act.steps.length) { steps = new THREE.Group(); for (const q of act.steps) { const g = new THREE.BoxGeometry(q.sx, q.sy, q.sz), m = new THREE.Mesh(g, stepMat); m.position.set(q.cx, q.cy, q.cz); m.rotation.y = q.yaw; m.receiveShadow = true; m.castShadow = true; steps.add(m); const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat); e.position.copy(m.position); e.rotation.y = q.yaw; steps.add(e); } }
        mixer.setTime(0); body.updateMatrixWorld(true); const r0 = root.getWorldPosition(new THREE.Vector3());
        mixer.setTime(0.5); body.updateMatrixWorld(true); const r1 = root.getWorldPosition(new THREE.Vector3());
        const vel0 = new THREE.Vector3((r1.x - r0.x) / 0.5, 0, (r1.z - r0.z) / 0.5);
        // the initial heading: the walking direction if the body moves, else the direction the pelvis faces (its local +z, in the horizontal plane)
        let head0 = Math.atan2(vel0.x, vel0.z);
        if (vel0.length() < LIM.speedMin) { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())); head0 = Math.atan2(f.x, f.z); }
        mixer.setTime(0); body.updateMatrixWorld(true);
        const Bn = { id: act.id, body, mixer, skinned, bones, byName, root, neck: bones[byName.c_neck] || bones[byName.c_spine3] || null, dur: clip.duration, floorY, supY, footY, steps, whole: act.whole || null, head0, vel0, band: null };
        const wrist = sites.find((s) => s.id === "wrist"); if (wrist) { Bn.band = makeBand(skinned, bones, byName, wrist); }
        bodies.set(act.id, Bn); res(Bn);
      }, undefined, rej));
    }
    function showBody(Bn) {
      if (B) { sc3.remove(B.body); if (B.steps) sc3.remove(B.steps); }
      B = Bn; sc3.add(B.body); if (B.steps) sc3.add(B.steps); clock.t = S.act.start || 0; cam.wholeFrom = clock.t; clock.smp = -1; cam.init = false;
      B.mixer.setTime(0); B.body.updateMatrixWorld(true); placeFloor(true, 0); placeDevices(); camUpdate(0, performance.now());
    }

    // ---- the shadow floor follows the body: x/z under the root, y at the smoothed support-foot height of this instant (every scene)
    const floorPos = new THREE.Vector3(); let floorYs = 0;
    function placeFloor(snap, dt) {
      B.root.getWorldPosition(floorPos);
      const f = clock.t * 20, i0 = clamp(Math.floor(f), 0, 399), i1 = Math.min(399, i0 + 1), fr = f - Math.floor(f);
      const target = B.supY[i0] + (B.supY[i1] - B.supY[i0]) * fr - 0.004;
      floorYs = snap ? target : sm(floorYs, target, dt, 0.12);
      floor.position.set(floorPos.x, floorYs, floorPos.z);
      // the grid lies on the ground (on the stairs: at the foot of the stairs, under the treads), the disc under the support foot
      const gy = B.steps ? B.floorY - 0.004 : floorYs;
      grid.position.set(floorPos.x, gy - 0.001, floorPos.z); gridMat.uniforms.uC.value.set(floorPos.x, floorPos.z);
      disc.position.set(floorPos.x, floorYs + 0.001, floorPos.z);
    }

    // ---- placing the devices of the current site on the current body
    const clock = { t: 0, last: 0, smp: -1, win: -1 }, qJ = new THREE.Quaternion(), pJ = new THREE.Vector3(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), m4 = new THREE.Matrix4(), m4b = new THREE.Matrix4();
    function placeDevices() {
      const st = S.site, jp = B.bones[B.byName[st.pos_joint]], jr = B.bones[B.byName[st.rot_joint]];
      jr.getWorldQuaternion(qJ); jp.getWorldPosition(pJ);
      const dev0 = st.id === "wrist" ? watch : first;
      watch.visible = st.id === "wrist"; first.visible = !watch.visible; if (B.band) B.band.visible = watch.visible;
      for (let i = 0; i < S.N; i++) {
        pos.copy(st.V[i]).applyQuaternion(qJ).add(pJ); quat.copy(qJ).multiply(st.Q[i]);
        if (i === 0) { dev0.position.copy(pos); dev0.quaternion.copy(quat); d0.copy(pos); d0q.copy(quat); continue; }
        const k = i - 1; m4.compose(pos, quat, one); podBody.setMatrixAt(k, m4); podTop.setMatrixAt(k, m4);
        for (const a of podAx) { m4b.multiplyMatrices(m4, a.local); a.mesh.setMatrixAt(k, m4b); }
      }
      if (S.N > 1) { podBody.instanceMatrix.needsUpdate = podTop.instanceMatrix.needsUpdate = true; for (const a of podAx) a.mesh.instanceMatrix.needsUpdate = true; }
    }

    // ---- the loop (only while the stage is on screen and the tab is visible); the clip runs at real time, dt capped at 100 ms
    let visible = false, paused = false;
    function frame(now) {
      raf = 0;
      if (!visible || document.hidden || !B || paused) return;
      raf = requestAnimationFrame(frame);
      step(now);
    }
    function step(now) {
      const t0 = performance.now();
      const dt = clamp((now - clock.last) / 1000, 0, 0.1); clock.last = now;
      const start = S.act.start || 0, ph = (t) => (((t - start) % B.dur) + B.dur) % B.dur;              // clip time since the scene's loop start
      const tNew = (clock.t + dt) % B.dur; const looped = ph(tNew) < ph(clock.t), wrapped = tNew < clock.t; clock.t = tNew;
      if (looped) { cam.wholeFrom = start; cam.viewT = cam.viewFrom = cam.viewMix = 0; cam.viewAt = -1e9; }   // loop start: cut to the whole body
      const win = clock.t >= 10 ? 1 : 0; if (win !== curWin) { curWin = win; tag(); }                   // the narration describes 10-s windows
      if (S.auto !== false) setViewT(autoView());                                                        // 2 s whole body, then the zoom
      B.mixer.setTime(clock.t); B.body.updateMatrixWorld(true);
      placeFloor(looped || wrapped, dt); placeDevices(); pulse(clock.t);
      camUpdate(dt, now);
      key.position.set(cam.root.x + 1.6, cam.root.y + 3.2, cam.root.z + 1.9); key.target.position.copy(cam.root);
      renderViews();
      scope.draw(clock.t);
      if (PERF) { perf.js.push(performance.now() - t0); perf.dt.push(dt * 1000); if (perf.js.length > 4000) { perf.js.shift(); perf.dt.shift(); } }
    }
    function start() { if (!raf && visible && !document.hidden && B) { clock.last = performance.now(); raf = requestAnimationFrame(frame); } }
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); }, { rootMargin: "80px" }).observe(host);
    document.addEventListener("visibilitychange", start);

    // ---- the three controls
    let pending = false;
    const setN = (n) => { S.N = clamp(Math.round(n), 1, NW); paint(); setCount(); tag(); legend(); scope.setN(S.N); if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; scope.draw(clock.t); }); } };
    range.addEventListener("input", (e) => setN(+e.target.value));
    let gen = 0;
    function setAct(id) {
      const act = acts.find((a) => a.id === id); if (!act || act === S.act) return;
      S.act = act; syncMenus(); tag(); const my = ++gen;
      host.classList.add("switching");
      Promise.all([loadBody(act), loadSig(sigKey()), loadX9(sigKey()).catch(() => null)]).then(([Bn]) => { if (my !== gen) return; showBody(Bn); applySig(); host.classList.remove("switching"); start(); }).catch((e) => { host.classList.remove("switching"); console.error(e); });
    }
    function applySite(glide) {
      S.site = resolveSite(); syncMenus(); tag(); legend(); const my = ++gen;
      cam.wholeFrom = clock.t; if (S.auto !== false) setViewT(0);              // a new site: the whole body again for 2 s, then the zoom
      if (glide) cam.glideUntil = performance.now() + 1500;
      Promise.all([loadSig(sigKey()), loadX9(sigKey()).catch(() => null)]).then(() => { if (my === gen) applySig(); }).catch((e) => console.error(e));
      if (B) placeDevices();
    }
    function setPart(id) { if (!parts.some((p) => p.id === id) || id === S.part) return; S.part = id; applySite(true); }
    function setSide(side) { if ((side !== "L" && side !== "R") || side === S.side) return; S.side = side; applySite(true); }
    // v8: one site from the menu sets body part and side together (Left wrist -> Right wrist is a change of side only)
    function setSiteId(id) {
      const st = sites.find((x) => x.id === id); if (!st || st === S.site) return;
      S.part = st.part; if (st.side !== "C") S.side = st.side; applySite(true);
    }
    actSel.addEventListener("change", () => setAct(actSel.value));
    siteSel.addEventListener("change", () => setSiteId(siteSel.value));

    // ---- first load: the default activity, then the entrance (the first device alone, the other wearings one after another)
    Promise.all([loadBody(S.act), loadSig(sigKey()), loadX9(sigKey()).catch((e) => { console.error(e); return null; })]).then(([Bn]) => {
      showBody(Bn); applySig(); scope.setN(S.N); scope.draw(0);
      $("status").hidden = true; host.classList.add("ready"); start();
      setTimeout(() => animate(1700, (t) => setN(1 + Math.round(t * 11))), REDUCED ? 0 : 700);
    }).catch((e) => { $("status").textContent = "The body could not load."; console.error(e); });

    api.pause = (p) => { paused = !!p; if (!paused) start(); return paused; };
    api.seek = (t, dt = 0.1) => { if (!B) return null; const now = performance.now(); clock.t = (((t - dt) % B.dur) + B.dur) % B.dur; clock.last = now - dt * 1000; step(now); ndc.copy(d0).project(camera); return { t: clock.t, viewT: cam.viewT, viewMix: +cam.viewMix.toFixed(3), side: S.side, site: S.site.id, ndc: [+ndc.x.toFixed(3), +ndc.y.toFixed(3)], floorY: +floor.position.y.toFixed(3), footY: +B.footY[clamp(Math.round(clock.t * 20), 0, 399)].toFixed(3), whole: S.act.whole || WHOLE_S }; };
    api.probeDevice = () => { if (!B) return null; const out = []; const tSave = clock.t; for (let k = 0; k < NS; k++) { B.mixer.setTime(k / H.fps); B.body.updateMatrixWorld(true); placeDevices(); out.push(+d0q.x.toFixed(6), +d0q.y.toFixed(6), +d0q.z.toFixed(6), +d0q.w.toFixed(6)); } B.mixer.setTime(tSave); B.body.updateMatrixWorld(true); placeDevices(); return { key: sigKey(), dur: B.dur, fps: H.fps, q: out }; };
    api.ready = () => !!B && B.id === S.act.id && sig.has(sigKey());
    api.stepMat = stepMat; api.edgeMat = edgeMat;
    api.setN = setN; api.setZoom = setZoom; api.setAct = setAct; api.setSite = setSiteId; api.setPart = setPart; api.setSide = setSide; api.setView = setView; api.setAuto = setAuto; api.cam = cam; api.camLimits = { TAU, LIM }; api.state = S;
    api.visStats = () => { const v = perf.vis; if (!v.length) return null; const n = v.length; const c = v.filter((b) => b & 1).length, f = v.filter((b) => b & 2).length, o = v.filter((b) => b & 4).length, all = v.filter((b) => b === 7).length; return { n, centre: +(c / n).toFixed(3), facing: +(f / n).toFixed(3), free: +(o / n).toFixed(3), visible: +(all / n).toFixed(3) }; }; api.resetStats = () => { perf.vis.length = 0; perf.wrist.length = 0; perf.cam.length = 0; };
    api.debug = () => ({ ndc: d0.clone().project(insetCam).toArray().slice(0, 2), camDist: insetCam.position.distanceTo(d0), lookErr: tgt.distanceTo(d0), dur: B && B.dur, act: S.act.id, site: S.site.id, heading: cam.heading, headT: cam.headT, dodge: cam.dodge, vis: { ...vis }, t: clock.t });
    api.camStats = () => {
      const w = perf.wrist, C = perf.cam, out = {};
      if (w.length) { const ax = w.map((p) => Math.abs(p[0])).sort((a, b) => a - b), ay = w.map((p) => Math.abs(p[1])).sort((a, b) => a - b); Object.assign(out, { n: w.length, maxAbsX: ax[ax.length - 1], maxAbsY: ay[ay.length - 1], p95AbsX: ax[Math.floor(w.length * 0.95)], p95AbsY: ay[Math.floor(w.length * 0.95)] }); }
      if (C.length > 2) { const v = []; for (let i = 1; i < C.length; i++) { const p = C[i - 1], q = C[i]; v.push(Math.acos(clamp(p[1] * q[1] + p[2] * q[2] + p[3] * q[3], -1, 1)) / Math.max(q[4], 1e-3) / DEG); } const s = [...v].sort((a, b) => a - b); out.angVelDegPerS = { n: v.length, max: +s[s.length - 1].toFixed(2), p95: +s[Math.floor(v.length * 0.95)].toFixed(2), mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) }; }
      return Object.keys(out).length ? out : null;
    };
  }

  // ================================================================== 1: postures, (c) one 3 x 3 table per model and under it one share (v6_text/build_postures_v6.py):
  //                                                                    UniMTS 76 % standing, AnyMo 56 % sitting (paper Sec. 1), SetCon with its estimated
  //                                                                    reference, mean of three seeds: the mean of the diagonal, "predicted correctly"
  function postures(P) {
    const post = P.postures, short = ["sit", "stand", "lie"];
    const hex = (v) => { const m = v.replace("#", ""); return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16)); };
    const build = () => {                                                       // tints from the theme's ink
      const ink = hex(css("--ink")), bgc = hex(css("--bg"));
      // v7: the number of a cell in the ink or the page colour, whichever stands out more against the cell (was: page colour
      // from 55 % on, 3.5:1 on a 56-% cell); cells near the middle of the scale stay near 4:1 in either colour
      const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]), lin = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
      const con = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05), Li = lum(ink), Lb = lum(bgc);
      const light = (v) => { const a = 0.05 + 0.85 * v / 100, Lc = lum(ink.map((c, j) => c * a + bgc[j] * (1 - a))); return con(Lb, Lc) > con(Li, Lc); };
      $("cms").innerHTML = P.tables.map((t, ti) => {
        const rows = t.matrix.map((row, i) => `<tr><th scope="row">${post[i]}</th>` + row.map((v, k) => { const a = 0.05 + 0.85 * v / 100; return `<td class="${light(v) ? "hi" : ""}${i === k ? " dg" : ""}" style="background:rgba(${ink[0]},${ink[1]},${ink[2]},${a.toFixed(3)})" title="${t.title}, ${t.sub}. ${v.toFixed(1)} % of the ${post[i]} windows are predicted as ${post[k]}.">${Math.round(v)}</td>`; }).join("") + `</tr>`).join("");
        return `<div class="cm ${t.k}${ti === 0 ? " rl" : ""}"><h4>${t.title}<span>${t.sub}</span></h4><table class="cmt" aria-label="${t.title}, ${t.sub}. Percent of the sitting, standing and lying windows predicted as sitting, standing or lying"><thead><tr><th scope="col" class="corner"></th>${short.map((x) => `<th scope="col">${x}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table><div class="acc">${Math.round(t.share)}${NBSP}%<span>${t.label || `predicted as ${t.word}`}</span></div></div>`;
      }).join("");
    };
    build(); onTheme(build);
  }

  // ================================================================== 4: results, mean over 13 datasets
  function results(P) {
    const R = P.reference, v = (k, q) => R[k][q], sd = (k, q) => R[k]["sd_" + q];
    const pm = (k, q) => `${v(k, q).toFixed(1)}${sd(k, q) != null ? ` ± ${sd(k, q).toFixed(1)}` : ""}`;
    const rows = [{ k: "unimts", lab: "UniMTS", sub: "released weights" }, { k: "anymo", lab: "AnyMo", sub: "released weights" },
                  { k: "zero", lab: "SetCon, reference zeroed", sub: "six random context windows", cls: "sub" },
                  { k: "wo", lab: "SetCon, trained without a reference", sub: "six random context windows", cls: "sub" },
                  { k: "setcon", lab: "SetCon", sub: "six of twelve context windows", cls: "ours" }];
    // v7: below 560 px of width (phones) the chart is drawn at its own width with each row's label above its dumbbell, so that
    // its text keeps its size; the 680-unit chart scaled to a phone made it 7 to 8 px. Wider screens: the chart of v6, unchanged
    const chart = $("chart");
    let compact = null;
    const draw = () => {
      const cw = chart.clientWidth, c = cw > 0 && cw < 560;
      if (c === compact) return;
      compact = c; chart.classList.toggle("compact", c);
      const x0 = 35, x1 = 70, W = c ? Math.max(280, Math.round(cw)) : 680, L = c ? 20 : 264, Rm = c ? 48 : 16, rh = c ? 76 : 58, T = 34;
      const H = T + rows.length * rh + (c ? 30 : 26);
      const X = (val) => L + (W - L - Rm) * (val - x0) / (x1 - x0);
      let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mean accuracy on 13 real datasets per model, with class names and with anchors">`;
      const lx = c ? 0 : L;
      svg += `<circle cx="${lx + 6}" cy="12" r="5" fill="none" stroke="var(--ink)" stroke-width="2"></circle><text class="leg" x="${lx + 18}" y="16">class names</text>`;
      svg += `<circle cx="${lx + 126}" cy="12" r="5.5" fill="var(--accent)"></circle><text class="leg" x="${lx + 138}" y="16">anchors</text>`;
      for (let g = 40; g <= 70; g += 10) svg += `<line class="grid" x1="${X(g)}" x2="${X(g)}" y1="${T}" y2="${H - 24}"></line><text class="tick" x="${X(g)}" y="${H - 6}">${g}${NBSP}%</text>`;
      rows.forEach((r, i) => {
        const y = c ? T + rh * i + 56 : T + rh * i + rh / 2, a = v(r.k, "names"), b = v(r.k, "anchors");
        const ly = c ? T + rh * i + 16 : y - 3, sy = c ? T + rh * i + 34 : y + 14;
        svg += `<g class="row ${r.cls || ""}"><title>${r.lab}, ${r.sub}. Class names ${pm(r.k, "names")}, anchors ${pm(r.k, "anchors")}.</title>`;
        svg += `<text class="lab" x="0" y="${ly}">${r.lab}</text><text class="sub" x="0" y="${sy}">${r.sub}</text>`;
        svg += `<line class="link" x1="${X(a)}" x2="${X(b)}" y1="${y}" y2="${y}"></line>`;
        svg += `<circle cx="${X(a)}" cy="${y}" r="6" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"></circle><circle cx="${X(b)}" cy="${y}" r="6.5" fill="var(--accent)"></circle>`;
        svg += `<text class="val" x="${X(a) - 12}" y="${y + 4}" text-anchor="end">${a.toFixed(1)}</text><text class="val a" x="${X(b) + 12}" y="${y + 4}">${b.toFixed(1)}</text></g>`;
      });
      svg += `</svg>`;
      chart.innerHTML = svg;
    };
    draw();
    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 120); });
    $("tbl").querySelector("tbody").innerHTML = rows.map((r) => `<tr class="${r.cls || ""}"><td>${r.lab}, ${r.sub}</td><td class="n num">${pm(r.k, "names")}</td><td class="n num">${pm(r.k, "anchors")}</td></tr>`).join("");
  }

  // ================================================================== the headline in the hero: the values of the paper's abstract and Fig. 1, one setting
  //                                                                    for all three models (six of twelve unlabeled context windows, the same scored windows)
  function headline(P) {
    const R = P.reference, v = (k, q) => R[k][q], r1 = (x) => Math.round(x * 10) / 10, f1 = (x) => x.toFixed(1);
    const rows = [{ k: "setcon", lab: "SetCon", cls: "ours", note: ", mean of three seeds" }, { k: "anymo", lab: "AnyMo", note: ", released weights" }, { k: "unimts", lab: "UniMTS", note: ", released weights" }];
    const top = 70, shown = {};
    $("hlRows").innerHTML = rows.map((r) => {
      const a = r1(v(r.k, "names")), b = r1(v(r.k, "anchors")); shown[r.lab] = [a, b];
      const solid = `<i class="${r.cls ? "hp-ours" : "hp-base"}" style="width:${(100 * a / top).toFixed(2)}%" title="${r.lab} reaches ${f1(a)} % with class names${r.note}.">${f1(a)}</i>`;
      const hatch = `<i class="${r.cls ? "hp-anch-ours" : "hp-anch-base"}" style="width:${(100 * (b - a) / top).toFixed(2)}%" title="${r.lab} reaches ${f1(b)} % with anchors${r.note}."></i>`;
      return `<div class="hl-row ${r.cls || ""}"><span class="hl-lab">${r.lab}</span><span class="hl-bar" role="img" aria-label="${r.lab}, ${f1(a)} percent with class names and ${f1(b)} percent with anchors">${solid}${hatch}</span><span class="hl-total num">${f1(b)}</span></div>`;
    }).join("");
    $("hlLegend").innerHTML = `<span><i class="hp-ours"></i><i class="hp-base"></i>class names</span><span title="An anchor averages the text embeddings of the class name and of activity descriptions and needs no labeled window."><i class="hp-anch-ours"></i><i class="hp-anch-base"></i>with anchors</span>`;
    api.headline = shown;
  }

  // ================================================================== 3: the embedding map, one test dataset at a time (UCI-HAR = the data of the paper's Fig. 3)
  //   data/maps/<slug>.json (v6_text/build_dataset_maps.py): per model the panel coordinates of the scored windows of context draw 0 (first
  //   two principal components, each axis 0..1 over the figure's limits); a window that a model does not score has null there and fades in
  //   or out on a model switch. A dataset loads when it is chosen; the map fades out and the new dataset fades in (other windows, no glide).
  //   "Postures": sitting, standing and lying in colour, the rest grey (v5, unchanged). "All classes": every class its own colour in the
  //   fixed order --c1..--c7 (the six colours of the paper's Fig. 3, then wine); above seven classes the colour is the class's motion group
  //   of the paper's Tab. 3, and a class stands out on hover or tap of its legend entry or of one of its dots.
  const PVAR = { sit: "--sit", stand: "--stand", lie: "--back" };
  const CVAR = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6", "--c7", "--c8"];
  const GVAR = { locomotion: "--c1", "hand/arm": "--c2", "other whole-body": "--c3", transition: "--c4", dirlr: "--c5", posture: "--c6", dirvert: "--c7" };
  const GORDER = ["posture", "dirvert", "dirlr", "locomotion", "hand/arm", "other whole-body", "transition"];     // the rows of Tab. 3
  const MAX_INDIVIDUAL = 8;
  const MANY = ["#0072B2", "#009E73", "#E69F00", "#CC79A7", "#D55E00", "#56B4E9", "#33DD99", "#AA3366", "#776600", "#8855BB", "#CCAAFF", "#88AA00", "#FF9999", "#8888EE", "#007766", "#998844", "#AA4411", "#AACC44", "#0099BB", "#996688", "#33BBAA", "#448800", "#CC8866", "#CC5566", "#FF88CC", "#BB55AA", "#AAAA66"];                                                                                      // colours told apart in a scatter (all pairs)
  const dsSel = $("mapDsSel");
  dsSel.value = "ucihar";                                                                                        // the paper's figure, also after a reload
  const DSCACHE = {};
  const shuffled = (a, s0) => { let seed = s0; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  function prepMap(D) {
    const n = D.label.length, K = D.classes.length;
    const arr = (a) => Float32Array.from(a, (v) => (v == null ? NaN : v));
    const R = {}; for (const r of D.readings) R[r] = { x: arr(D.coords[r].u), y: arr(D.coords[r].v) };
    const lab = Uint8Array.from(D.label);
    const isPost = D.posture.map((p) => p != null);
    // the posture windows are drawn in one fixed shuffled order, so that no posture is painted over the others as a block (v5);
    // in "All classes" every window is, in the same way
    const others = [], posts = [];
    D.label.forEach((c, i) => (isPost[c] ? posts : others).push(i));
    shuffled(posts, 20261113);
    const all = shuffled(Array.from({ length: n }, (_, i) => i), 20261113);
    const present = D.count.map((c) => c > 0);
    const byGroup = present.filter(Boolean).length > MAX_INDIVIDUAL;
    let s = 0; const slot = present.map((p) => (p ? s++ : -1));
    // above eight classes: every class its own colour from MANY (27 colours, farthest apart in OKLab after the six of Fig. 3,
    // mid lightness for both themes; _scratch/v433_hf_card/palette27.py), handed out in the order of the groups of Tab. 3
    const order = GORDER.flatMap((g) => D.classes.map((_, k) => k).filter((k) => present[k] && D.group[k] === g));
    D.classes.forEach((_, k) => { if (present[k] && !order.includes(k)) order.push(k); });
    const many = {}; order.forEach((k, i) => { many[k] = MANY[i % MANY.length]; });
    const cvar = D.classes.map((_, k) => (!present[k] ? null : byGroup ? many[k] : CVAR[slot[k]]));
    const pvar = D.posture.map((p) => (p ? PVAR[p] : "--map-rest"));
    return { D, n, K, R, lab, others, posts, all, present, byGroup, cvar, pvar, hasPost: isPost.some((p, k) => p && present[k]) };
  }
  const loadMap = (slug) => DSCACHE[slug] || (DSCACHE[slug] = J(`data/maps/${slug}.json`).then(prepMap).catch((e) => { delete DSCACHE[slug]; throw e; }));
  new IntersectionObserver((es, io) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); loadMap(dsSel.value).then(evidence).catch((e) => { $("mapLoad").textContent = "The embeddings could not load."; console.error(e); }); } }, { rootMargin: "900px" }).observe($("evidence"));

  function evidence(P0) {
    $("mapLoad").hidden = true;
    const mapC = $("map"), ctx = mapC.getContext("2d"), fadeC = $("mapFade"), fctx = fadeC.getContext("2d");
    const keyEl = $("mapKey"), clsEl = $("mapCls"), tip = $("mapTip"), wrapEl = $("mapWrap");
    const keyEls = [keyEl, clsEl];
    let P = null, mode = "post", userMode = null;
    const state = { model: "mix", from: "mix", to: "mix", t: 1 };
    let cur = new Float32Array(0), cuy = cur, al = cur;
    const COLS = {}; const col = (v) => COLS[v] || (COLS[v] = v.startsWith("#") ? v : css(v));
    onTheme(() => { for (const k in COLS) delete COLS[k]; });
    // ---------------------------------------------------------------- coordinates between two models
    function lerpCoords() {
      const a = ease(state.t), F = P.R[state.from], T = P.R[state.to], n = P.n;
      for (let i = 0; i < n; i++) {
        const fx = F.x[i], tx = T.x[i], hf = fx === fx, ht = tx === tx;
        if (hf && ht) { cur[i] = fx * (1 - a) + tx * a; cuy[i] = F.y[i] * (1 - a) + T.y[i] * a; al[i] = 1; }
        else if (ht) { cur[i] = tx; cuy[i] = T.y[i]; al[i] = a; }
        else if (hf) { cur[i] = fx; cuy[i] = F.y[i]; al[i] = 1 - a; }
        else al[i] = 0;
      }
    }
    function frameOf() {
      const s = fit(mapC); if (!s) return null;
      const kb = keyEl.parentNode === wrapEl && keyEl.offsetHeight > 30 ? keyEl.offsetTop + keyEl.offsetHeight + 10 : 0;   // a legend of one line stays above the dots
      const padX = s.W < 520 ? 14 : 30, top = Math.max(s.W < 520 ? 36 : 44, kb), bot = s.W < 520 ? 14 : 26;
      return { ...s, X: (u) => padX + u * (s.W - 2 * padX), Y: (v) => s.H - bot - v * (s.H - top - bot) };
    }
    // ---------------------------------------------------------------- highlight: hover (legend or dot) over a pinned choice (tap / click)
    const hl = { set: null, f: 0, key: null };
    let hoverK = null, pinK = null;
    // ---------------------------------------------------------------- one frame clock for the model move and the highlight
    let raf = 0, last = null;
    const tw = { move: null, hl: null };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    function frame(now) {
      raf = 0; let more = false;
      if (tw.move) { const p = clamp((now - tw.move.t0) / tw.move.ms, 0, 1); state.t = ease(p); if (p < 1) more = true; else tw.move = null; }   // eased here and in lerpCoords, as v5 (animate + lerpCoords)
      if (tw.hl) { const p = clamp((now - tw.hl.t0) / 200, 0, 1); hl.f = lerp(tw.hl.a, tw.hl.b, ease(p)); if (p < 1) more = true; else { tw.hl = null; if (hl.f <= 0) hl.set = null; } }
      lerpCoords(); drawMap();
      if (more) kick();
    }
    function drawMap() {
      const g = frameOf(); if (!g) return; last = g;
      const t0 = performance.now(), small = g.W < 520, r0 = small ? 1.7 : 2.2, r1 = small ? 2.6 : 3.4;
      ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0); ctx.clearRect(0, 0, g.W, g.H);
      const lab = P.lab, H = hl.f > 0 && hl.set ? hl.set : null, dimA = 1 - 0.84 * hl.f;
      if (mode === "post" && !H) {
        // v5, unchanged: the rest in one grey path, then the posture windows one by one
        ctx.fillStyle = col("--map-rest"); ctx.globalAlpha = 0.6; ctx.beginPath();
        for (const i of P.others) { if (al[i] < 1) continue; const x = g.X(cur[i]), y = g.Y(cuy[i]); ctx.moveTo(x + r0, y); ctx.arc(x, y, r0, 0, 7); }
        ctx.fill();
        for (const i of P.others) { if (al[i] <= 0 || al[i] >= 1) continue; ctx.globalAlpha = 0.6 * al[i]; ctx.beginPath(); ctx.arc(g.X(cur[i]), g.Y(cuy[i]), r0, 0, 7); ctx.fill(); }
        const pc = P.pvar.map(col);
        for (const i of P.posts) {
          const a = al[i]; if (a <= 0) continue;
          ctx.globalAlpha = 0.5 * a; ctx.fillStyle = pc[lab[i]]; ctx.beginPath(); ctx.arc(g.X(cur[i]), g.Y(cuy[i]), r1, 0, 7); ctx.fill();
        }
      } else if (mode === "post") {
        // a class picked: the others dimmed first, the picked one on top
        const pc = P.pvar.map(col), rest = col("--map-rest");
        for (const pass of [0, 1]) {
          ctx.fillStyle = rest;
          for (const i of P.others) { const a = al[i]; if (a <= 0 || H[lab[i]] !== pass) continue; ctx.globalAlpha = 0.6 * a * (pass ? 1 : dimA); ctx.beginPath(); ctx.arc(g.X(cur[i]), g.Y(cuy[i]), r0, 0, 7); ctx.fill(); }
          for (const i of P.posts) { const a = al[i]; if (a <= 0 || H[lab[i]] !== pass) continue; ctx.globalAlpha = 0.5 * a * (pass ? 1 : dimA); ctx.fillStyle = pc[lab[i]]; ctx.beginPath(); ctx.arc(g.X(cur[i]), g.Y(cuy[i]), r1, 0, 7); ctx.fill(); }
        }
      } else {
        const cc = P.cvar.map((v) => (v ? col(v) : "#000")), r = r1;
        for (const pass of H ? [0, 1] : [1]) {
          let fs = null;
          for (const i of P.all) {
            const a = al[i]; if (a <= 0) continue;
            const c = lab[i]; if (H && H[c] !== pass) continue;
            ctx.globalAlpha = 0.5 * a * (H && !pass ? dimA : 1);
            if (cc[c] !== fs) { fs = cc[c]; ctx.fillStyle = fs; }
            ctx.beginPath(); ctx.arc(g.X(cur[i]), g.Y(cuy[i]), r, 0, 7); ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (PERF) perf.map.push(performance.now() - t0);
    }
    function drawAll() { lerpCoords(); drawMap(); }
    // ---------------------------------------------------------------- the legend
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const bgOf = (v) => (v.startsWith("#") ? v : `var(${v})`);
    const item = (ks, label, v, extra = "") => `<button type="button" class="ki${extra}" data-k="${ks.join(",")}" aria-pressed="false">${v ? `<i style="background:${bgOf(v)}"></i>` : ""}${label}</button>`;
    function renderKey() {
      const D = P.D, ks = (f) => D.classes.map((_, k) => k).filter((k) => P.present[k] && f(k));
      let h = "", c = "";
      if (mode === "post") {
        for (const p of ["sit", "stand", "lie"]) { const k = ks((x) => D.posture[x] === p); if (k.length) h += item(k, k.map((x, j) => (j ? D.classes[x].toLowerCase() : D.classes[x])).join(", "), PVAR[p]); }
        const o = ks((x) => !D.posture[x]);
        if (o.length) h += item(o, o.length <= 3 ? o.map((x) => D.classes[x]).join(", ") : `${o.length} other classes`, "--map-rest");
      } else if (!P.byGroup) {
        h = ks(() => true).map((k) => item([k], D.classes[k], P.cvar[k])).join("");
      } else {
        // the groups in the head band (a tap marks the whole group), the classes of each group with their colours under the map
        for (const gk of GORDER) {
          const k = ks((x) => D.group[x] === gk); if (!k.length) continue;
          h += item(k, D.group_names[gk], null);
          c += `<div class="kg">${item(k, D.group_names[gk], null, " kgh")}<span class="kcs">${k.map((x) => item([x], D.classes[x], P.cvar[x], " kc")).join("")}</span></div>`;
        }
      }
      keyEl.innerHTML = h; clsEl.innerHTML = c; clsEl.hidden = !c; keyEl.classList.toggle("gm", !!c);   // phone: the class list carries the groups
      markKey();
    }
    function markKey() {
      const on = hoverK || pinK, set = on ? on.split(",") : [];
      for (const el of keyEls) {
        el.classList.toggle("hl", !!on);
        el.querySelectorAll(".ki").forEach((b) => {
          const ks = b.dataset.k;
          b.classList.toggle("on", !!on && ks.split(",").every((k) => set.includes(k))); b.setAttribute("aria-pressed", String(ks === pinK));
        });
      }
    }
    function applyHL() {
      const on = hoverK || pinK;
      if (on === hl.key) return;
      hl.key = on; markKey();
      if (on) { const m = new Uint8Array(P.K); on.split(",").forEach((k) => { m[+k] = 1; }); hl.set = m; }
      if (REDUCED) { hl.f = on ? 1 : 0; if (!on) hl.set = null; drawAll(); return; }
      tw.hl = { t0: performance.now(), a: hl.f, b: on ? 1 : 0 }; kick();
    }
    const kOf = (e) => { const b = e.target.closest && e.target.closest(".ki"); return b ? b.dataset.k : null; };
    for (const el of keyEls) {
      el.addEventListener("pointerover", (e) => { const k = kOf(e); if (k && e.pointerType === "mouse") { hoverK = k; applyHL(); } });
      el.addEventListener("pointerleave", () => { hoverK = null; applyHL(); });
      el.addEventListener("focusin", (e) => { hoverK = kOf(e); applyHL(); });
      el.addEventListener("focusout", () => { hoverK = null; applyHL(); });
      el.addEventListener("click", (e) => { const k = kOf(e); if (!k) return; pinK = pinK === k ? null : k; hoverK = null; tip.hidden = true; applyHL(); });
    }
    // on a phone the legend goes under the map (the head band is too narrow there)
    const phone = matchMedia("(max-width: 760px)");
    const placeKey = () => { if (phone.matches) { if (keyEl.parentNode === wrapEl) wrapEl.after(keyEl); } else if (keyEl.parentNode !== wrapEl) wrapEl.insertBefore(keyEl, tip); };
    placeKey(); phone.addEventListener("change", () => { placeKey(); if (P) drawAll(); });
    // ---------------------------------------------------------------- a dot under the pointer: its class stands out, its name beside it
    function nearest(px, py, rad) {
      const g = last; if (!g) return -1;
      let best = -1, bd = rad * rad;
      for (let i = 0; i < P.n; i++) { if (al[i] < 0.5) continue; const dx = g.X(cur[i]) - px, dy = g.Y(cuy[i]) - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
      return best;
    }
    function showTip(i, px, py) {
      tip.textContent = P.D.classes[P.lab[i]]; tip.hidden = false;
      const w = tip.offsetWidth, W = last ? last.W : 0;
      tip.style.transform = `translate(${Math.round(clamp(px - w / 2, 8, Math.max(8, W - w - 8)))}px, ${Math.round(Math.max(4, py - 34))}px)`;
    }
    function pointAt(e, rad) {
      const r = mapC.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, i = nearest(px, py, rad);
      return { i, px, py };
    }
    mapC.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const { i, px, py } = pointAt(e, 10);
      if (i < 0) { tip.hidden = true; if (hoverK) { hoverK = null; applyHL(); } return; }
      showTip(i, px, py); const k = String(P.lab[i]); if (hoverK !== k) { hoverK = k; applyHL(); }
    });
    mapC.addEventListener("pointerleave", () => { tip.hidden = true; if (hoverK) { hoverK = null; applyHL(); } });
    mapC.addEventListener("click", (e) => {
      if (e.pointerType === "mouse") return;
      const { i, px, py } = pointAt(e, 18);
      if (i < 0) { pinK = null; tip.hidden = true; applyHL(); return; }
      pinK = String(P.lab[i]); showTip(i, px, py); applyHL();
    });
    // ---------------------------------------------------------------- model
    function regroup() { $("mapCorner").innerHTML = `<b>${P.D.titles[state.model]}</b>`; }
    function setModel(mo) {
      if (!P.R[mo]) return; state.model = mo; press("[data-model]", "model", mo); regroup();
      if (mo === state.to) { drawAll(); return; }
      lerpCoords();
      const fx = Float32Array.from(cur), fy = Float32Array.from(cuy); for (let i = 0; i < P.n; i++) if (al[i] < 0.02) fx[i] = NaN;
      P.R.__from = { x: fx, y: fy }; state.from = "__from"; state.to = mo; state.t = 0;
      if (REDUCED) { state.t = 1; drawAll(); return; }
      tw.move = { t0: performance.now(), ms: 700 }; kick();
    }
    document.querySelectorAll("[data-model]").forEach((b) => b.addEventListener("click", () => setModel(b.dataset.model)));
    // ---------------------------------------------------------------- classes: Postures or All classes, cross-faded
    const postBtn = document.querySelector('[data-cls="post"]');
    function crossfade(change) {
      if (REDUCED || !last) { change(); return; }
      fadeC.width = mapC.width; fadeC.height = mapC.height; fctx.drawImage(mapC, 0, 0);
      fadeC.style.transition = mapC.style.transition = "none"; fadeC.style.opacity = "1"; mapC.style.opacity = "0";
      change();
      fadeC.getBoundingClientRect();
      requestAnimationFrame(() => { fadeC.style.transition = mapC.style.transition = ""; fadeC.style.opacity = "0"; mapC.style.opacity = "1"; });
    }
    function setMode(m, user) {
      if (m === "post" && !P.hasPost) m = "all";
      if (user) userMode = m;
      press("[data-cls]", "cls", m);
      if (m === mode) return;
      crossfade(() => { mode = m; hoverK = pinK = null; hl.key = null; hl.f = 0; hl.set = null; tw.hl = null; tip.hidden = true; renderKey(); drawAll(); });
    }
    document.querySelectorAll("[data-cls]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.cls, true)));
    // ---------------------------------------------------------------- dataset: fade out, load, fade in
    let swapTok = 0, cycle = null;
    function swap(Q) {
      P = Q; tw.move = null; delete P.R.__from;
      if (!P.R[state.model]) state.model = P.D.readings[P.D.readings.length - 1];
      state.from = state.to = state.model; state.t = 1;
      if (cur.length < P.n) { cur = new Float32Array(P.n); cuy = new Float32Array(P.n); al = new Float32Array(P.n); }
      hoverK = pinK = null; hl.key = null; hl.f = 0; hl.set = null; tw.hl = null; tip.hidden = true;
      mode = !P.hasPost ? "all" : userMode || (P.D.postures_default ? "post" : "all");   // 19.11. (user): Postures by default where the dataset has postures
      postBtn.disabled = !P.hasPost; press("[data-cls]", "cls", mode);
      $("mapDsName").textContent = P.D.dataset;
      mapC.setAttribute("aria-label", `The windows of ${P.D.dataset} in the first two principal components of the selected model's embeddings`);
      press("[data-model]", "model", state.model); regroup(); renderKey(); drawAll();
    }
    function setDataset(slug) {
      if (!slug) return;
      const tok = ++swapTok; dsSel.value = slug;
      if (slug === P.slug) {                     // back to the dataset on show while another one was loading: that one is dropped
        mapC.style.opacity = "1"; for (const el of keyEls) el.style.opacity = "1"; $("mapLoad").hidden = true; if (cycle) cycle.rearm(); return;
      }
      if (cycle) cycle.hold();
      const slow = setTimeout(() => { if (tok === swapTok) { $("mapLoad").textContent = "Loading the embeddings…"; $("mapLoad").hidden = false; } }, 600);
      const done = (Q) => { clearTimeout(slow); if (tok !== swapTok) return; $("mapLoad").hidden = true; Q.slug = slug; swap(Q); if (cycle) cycle.rearm(); };
      const fail = (e) => { clearTimeout(slow); if (tok !== swapTok) return; $("mapLoad").textContent = "The embeddings could not load."; $("mapLoad").hidden = false; console.error(e); };
      if (REDUCED) { loadMap(slug).then(done, fail); return; }
      mapC.style.transition = ""; mapC.style.opacity = "0"; fadeC.style.opacity = "0"; for (const el of keyEls) el.style.opacity = "0";
      Promise.all([loadMap(slug), new Promise((r) => setTimeout(r, 260))]).then(([Q]) => {
        done(Q); if (tok !== swapTok) return;
        requestAnimationFrame(() => { mapC.style.opacity = "1"; for (const el of keyEls) el.style.opacity = "1"; });
      }, fail);
    }
    dsSel.addEventListener("change", () => setDataset(dsSel.value));
    // 19.11.: the models take turns on their own, 2.5 s each after the 0.7 s move, while the map is in view;
    // a click on a model stops the cycle, a dataset switch does not (the new dataset first stays on the current model for the full turn);
    // reduced motion keeps the static map
    cycle = (() => {
      const ORDER = ["unimts", "anymo", "mix"];   // 19.11.: "SetCon, no reference" only on click, not in the cycle
      let vis = false, stopped = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches), tm = 0;
      // 19.11.: each model stays 2 s after its 0.7 s move; a thin line in the active button fills until the next switch (the indicator)
      const TURN = 2700, mseg = document.querySelector('.seg[aria-label="Model"]'), bar = document.createElement("i");
      bar.className = "cyc"; if (mseg) mseg.appendChild(bar);
      const showBar = (on) => {
        const b = mseg && mseg.querySelector('[aria-pressed="true"]');
        if (!on || !b) { bar.style.opacity = "0"; return; }
        bar.style.transition = "none"; bar.style.left = (b.offsetLeft + 14) + "px"; bar.style.width = Math.max(0, b.offsetWidth - 28) + "px";
        bar.style.transform = "scaleX(0)"; bar.style.opacity = "1"; void bar.offsetWidth;
        bar.style.transition = `transform ${TURN}ms linear, opacity .2s`; bar.style.transform = "scaleX(1)";
      };
      const arm = () => { if (!tm && !stopped && vis && !document.hidden) { tm = setTimeout(next, TURN); showBar(true); } else if (!tm) showBar(false); };
      function next() { tm = 0; if (stopped || !vis || document.hidden) return; const i = ORDER.indexOf(state.model); setModel(ORDER[(i + 1) % ORDER.length]); arm(); }
      new IntersectionObserver((es) => { vis = es[es.length - 1].isIntersecting; if (vis) arm(); else { clearTimeout(tm); tm = 0; showBar(false); } }, { threshold: 0.35 }).observe(mapC);
      document.addEventListener("visibilitychange", () => { if (document.hidden) { clearTimeout(tm); tm = 0; showBar(false); } else arm(); });
      document.querySelectorAll("[data-model]").forEach((b) => b.addEventListener("click", (e) => { if (e.isTrusted) { stopped = true; clearTimeout(tm); tm = 0; showBar(false); } }));   // 19.11.: a click keeps the chosen model; the cycle stops
      return { hold() { clearTimeout(tm); tm = 0; showBar(false); }, rearm() { clearTimeout(tm); tm = 0; arm(); }, get stopped() { return stopped; }, get armed() { return !!tm; } };
    })();
    new ResizeObserver(() => { if (!tw.move) drawAll(); }).observe(mapC);
    onTheme(drawAll); fontsReady.then(drawAll);
    P0.slug = dsSel.value; swap(P0);
    Object.assign(api, { setModel, setDataset, setMode: (m) => setMode(m, true), map: { get n() { return P.n; }, state, get readings() { return P.D.readings; }, get dataset() { return P.D.dataset; }, get slug() { return P.slug; }, get mode() { return mode; }, get cycle() { return cycle; }, get busy() { return !!(tw.move || tw.hl); }, highlight: (k) => { pinK = k == null ? null : String(k); applyHL(); } } });
  }

  // ------------------------------------------------------------------ the method figure: a lightbox at 2,000 px for its small labels
  {
    const dlg = $("lightbox"), open = () => { if (!dlg.showModal) return; dlg.showModal(); $("lbClose").focus({ preventScroll: true }); };
    $("methodOpen").addEventListener("click", open); $("methodEnlarge").addEventListener("click", open);
    $("lbClose").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });     // a click on the backdrop
  }

})();
