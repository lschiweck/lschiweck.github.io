/* MinPair project page v17: media.js (in place of v16's gl.js). Every body of the page is a video now, rendered beforehand
   with the page itself (v16's renderer, frame by frame, light and dark, see _scratch/v366_minpair_page/v17); the page ships no
   body model and no motion. A tile is one view of v16: a rectangle of the page (its scissor) with a video inside, placed so
   that one metre of the scene has the page's scale S there (the video holds P pixels per metre around the view's anchor).
   The story and the grid drive each tile with their own clocks, as before they posed the bodies: tile.set(alpha, t, run)
   shows the frame of time t (seconds of its video; loops wrap), plays the video while the clock runs and holds it still
   while the clock stands, seeks only when the video is too far off, and corrects a small drift with the playback rate.
   Videos are opaque (H.264, the page colour as background), one file per theme; a change of theme loads the other file.
   View: the camera bases and the projection of v16 (for the guides and labels next to the bodies), fitted from the extents
   of the motions (data/examples.json, data/story.json) instead of the motions.
   v20: tile.set(alpha, t, run, mode): a pause holds each video on the frame where it stopped (no snap to the clock's frame),
   a finger on the time line lets tiles that come in show as soon as a frame near it is there; tile.cue(t): a tile that a jump
   on the time line will bring in waits at its frame (and closes a small gap with the playback rate instead of a seek). */
(function () {
  "use strict";
  const MP = window.MP, doc = document;
  const D2R = Math.PI / 180;

  // ---------------------------------------------------------------- camera bases (c = from the body to the camera), as v16
  function basis(az, el) {
    const c = [Math.sin(az * D2R) * Math.cos(el * D2R), Math.cos(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R)];
    const rn = Math.hypot(c[1], c[0]), r = [-c[1] / rn, c[0] / rn, 0];
    const u = [c[1] * r[2] - c[2] * r[1], c[2] * r[0] - c[0] * r[2], c[0] * r[1] - c[1] * r[0]];
    return { c, r, u, h: [c[0] / rn, c[1] / rn, 0] };
  }
  const BASES = { front: basis(-22, 7), frontR: basis(22, 7), side: basis(68, 8), sideL: basis(-68, 8), high: basis(35, 38),
    q34L: basis(-48, 9), q34R: basis(48, 9), profL: basis(-90, 7), profR: basis(90, 7),
    tq: basis(35, 12), tqL: basis(-35, 12), tqH: basis(35, 22) };
  MP.BASES = BASES;

  // ---------------------------------------------------------------- views: a rectangle of the stage and its scale
  function View(type) { this.B = BASES[type] || BASES.front; this.rect = { x: 0, y: 0, w: 1, h: 1 }; this.S = 100; this.hc = 0; this.vc = 0; this.anc = [0, 0]; }
  View.prototype.setType = function (type) { this.B = BASES[type] || BASES.front; return this; };
  // v16 View.fit, from the extents of the motions ({h0, h1, v0, v1} in metres in this view's basis) instead of the motions
  View.prototype.fit = function (exts, rect, o) {
    o = o || {};
    this.rect = rect; this.anc = o.anc || [0, 0];
    const ex = { h0: Infinity, h1: -Infinity, v0: Infinity, v1: -Infinity };
    exts.forEach((e) => { ex.h0 = Math.min(ex.h0, e.h0); ex.h1 = Math.max(ex.h1, e.h1); ex.v0 = Math.min(ex.v0, e.v0); ex.v1 = Math.max(ex.v1, e.v1); });
    const mx = o.mx == null ? 0.3 : o.mx, top = o.top == null ? 0.15 : o.top, bot = o.bot == null ? 0.12 : o.bot;
    const w = Math.max(0.6, ex.h1 - ex.h0 + 2 * mx), h = Math.max(1.0, ex.v1 - ex.v0 + top + bot);
    this.S = Math.min(rect.w / w, rect.h / h, o.maxS || 1e9);
    this.hc = (ex.h0 + ex.h1) / 2; this.vc = (ex.v0 - bot + ex.v1 + top) / 2;
    if (o.valign === "bottom") this.vc = ex.v0 - bot + rect.h / (2 * this.S);
    return this;
  };
  View.prototype.project = function (p, out) {
    const B = this.B, dx = p[0] - this.anc[0], dy = p[1] - this.anc[1];
    const h = dx * B.r[0] + dy * B.r[1], v = dx * B.u[0] + dy * B.u[1] + p[2] * B.u[2];
    out = out || [0, 0];
    out[0] = this.rect.x + this.rect.w / 2 + (h - this.hc) * this.S;
    out[1] = this.rect.y + this.rect.h / 2 - (v - this.vc) * this.S;
    return out;
  };
  View.prototype.yOf = function (z, at) { return this.project([at ? at[0] : this.anc[0], at ? at[1] : this.anc[1], z])[1]; };
  MP.View = View;

  // ---------------------------------------------------------------- video tiles
  const QS = new URLSearchParams(location.search);
  const DIR = "media/v/";
  const ALL = [];
  const M = { FPS: 60, scrub: false, theme: MP.isDark() ? "dark" : "light" };
  const r3 = (v) => Math.round(v * 1000) / 1000;

  function Tile(host, id, meta, o) {
    o = o || {};
    this.id = id; this.file = o.file || id; this.m = meta; this.loop = !!meta.loop; this.len = meta.len; this.F = meta.fps || M.FPS;
    this.n = Math.round(this.len * this.F);
    const el = (this.el = doc.createElement("div"));
    el.className = "tile"; el.setAttribute("aria-hidden", "true");
    const v = (this.v = doc.createElement("video"));
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = this.loop;
    ["muted", "playsinline", "webkit-playsinline", "disablepictureinpicture", "disableremoteplayback"].forEach((a) => v.setAttribute(a, ""));
    v.setAttribute("x-webkit-airplay", "deny"); v.setAttribute("tabindex", "-1"); v.setAttribute("aria-hidden", "true");
    v.preload = "none";
    el.appendChild(v); host.appendChild(el);
    Object.assign(this, { op: null, vis: null, theme: null, wait: false, want: 0, run: false, rate: 1, on: false, park: 0, lastA: 0, lastT: 0,
      lead: 0.12, jumped: false, seekT: 0, shown: false });
    // a frame that arrives (first frame, end of a seek) is shown at once, also while no clock asks (a held film, a still page)
    const again = () => { if (this.on) this.set(this.lastA, this.lastT, this.run, this.mode); };
    v.addEventListener("loadedmetadata", again);
    v.addEventListener("loadeddata", again);
    // how long a seek takes here: a running video jumps that far ahead of its clock, so it does not arrive behind it
    v.addEventListener("seeked", () => { if (this.seekT) { const d = (performance.now() - this.seekT) / 1000; this.lead = Math.min(0.4, Math.max(0.03, 0.5 * this.lead + 0.5 * d)); this.seekT = 0; } this.got = true; again(); });
    v.addEventListener("error", () => console.warn("MinPair page: a video did not load (" + (v.currentSrc || v.src) + ")"));
    ALL.push(this);
    if (o.load) this.load();
  }
  // start loading the file of the page's theme (once; again after a change of theme)
  Tile.prototype.load = function () {
    if (this.theme === M.theme) return;
    const v = this.v;
    this.theme = M.theme; this.shown = false; v.preload = "auto"; v.src = DIR + this.file + "." + M.theme + ".mp4"; v.load();
  };
  // a promise for the first frame of the video (or the time limit)
  Tile.prototype.ready = function (ms) {
    const v = this.v;
    this.load();
    if (v.readyState >= 2) return Promise.resolve(true);
    return new Promise((res) => {
      let tm = 0, pr = 0;
      const on = () => done(true);
      const done = (ok) => { clearTimeout(tm); clearTimeout(pr); v.removeEventListener("loadeddata", on); res(ok); };
      v.addEventListener("loadeddata", on);
      tm = setTimeout(() => done(false), ms || 8000);
      pr = setTimeout(() => this.prime(), 400);
    });
  };
  // a promise for the whole video in the buffer (or the time limit): the next videos load only after it (staged loading)
  Tile.prototype.full = function (ms) {
    const v = this.v;
    this.load();
    const done = () => v.readyState >= 4 || (v.buffered.length > 0 && v.duration > 0 && v.buffered.end(v.buffered.length - 1) >= v.duration - 0.05);
    if (done()) return Promise.resolve(true);
    return new Promise((res) => {
      let tm = 0, pr = 0;
      const EV = ["canplaythrough", "progress", "loadeddata"];
      const chk = () => { if (done()) fin(true); };
      const fin = (ok) => { clearTimeout(tm); clearTimeout(pr); EV.forEach((e) => v.removeEventListener(e, chk)); res(ok); };
      EV.forEach((e) => v.addEventListener(e, chk));
      tm = setTimeout(() => fin(false), ms || 8000);
      pr = setTimeout(() => this.prime(), 400);
    });
  };
  // a browser that holds back the data of a video until it plays (iOS Safari): play it muted for a moment, out of sight, and
  // put it back to its start once its first frame is there
  Tile.prototype.prime = function () {
    const v = this.v;
    if (v.readyState >= 2 || this.on || M.scrub || !v.paused) return;
    const back = () => { if (!this.on) { v.pause(); if (v.currentTime > 0.5 / this.F) v.currentTime = 0; } };
    const p = v.play();
    if (p && p.then) p.then(back, () => {}); else back();
  };
  // the rectangle of the tile in its host (CSS px) and the view drawn there (scale S, centre hc, vc): the wrapper is the
  // view's scissor (rounded as v16 rounded it), the video sits so that its window has the page's scale
  Tile.prototype.place = function (R, S, hc, vc) {
    const m = this.m, x = Math.round(R.x), y = Math.round(R.y), w = Math.max(0, Math.round(R.w)), h = Math.max(0, Math.round(R.h));
    const es = this.el.style, vs = this.v.style;
    es.left = x + "px"; es.top = y + "px"; es.width = w + "px"; es.height = h + "px";
    const k = S / m.P;
    const vx = R.x + R.w / 2 - x + (m.hc - m.W / (2 * m.P) - hc) * S, vy = R.y + R.h / 2 - y - (m.vc + m.H / (2 * m.P) - vc) * S;
    vs.width = r3(m.W * k) + "px"; vs.height = r3(m.H * k) + "px"; vs.left = r3(vx) + "px"; vs.top = r3(vy) + "px";
  };
  // the time of the video for time t of its clock: loops wrap, a clip that plays once holds its last frame
  Tile.prototype.target = function (t) {
    const L = this.len;
    if (this.loop) return ((t % L) + L) % L;
    return Math.min(Math.max(t, 0), L - 0.5 / this.F);
  };
  // a still frame: the frame nearest to the time (a quarter frame into it, so the browser shows that one)
  Tile.prototype.still = function (tt) {
    let i = Math.round(tt * this.F);
    if (this.loop) i = ((i % this.n) + this.n) % this.n; else i = Math.min(this.n - 1, Math.max(0, i));
    return (i + 0.25) / this.F;
  };
  function setStyle(t, k, v) { if (t[k] !== v) { t[k] = v; t.el.style[k === "op" ? "opacity" : "visibility"] = v; } }
  // alpha (0 hides it), t (seconds of its clock), run (the clock runs: the video plays; otherwise it stands at t).
  // v20: mode "hold": the visitor paused the clock, a video that was playing stops on the frame where it is (no seek while the
  // clock stays there, unless it is more than 0.25 s off); mode "scrub": the clock follows a finger on the time line, a tile
  // that comes in shows once a seek has brought a frame (or its frame is within 0.25 s), so no body is missing while it moves
  Tile.prototype.set = function (alpha, t, run, mode) {
    const v = this.v, on = alpha > 0.004;
    this.lastA = alpha; this.lastT = t; this.mode = mode;
    if (!on) {
      if (this.on) { this.on = false; this.wait = false; setStyle(this, "vis", "hidden"); if (!v.paused) v.pause(); this.parkAt(this.cueT != null ? this.cueT : 0); }
      return;
    }
    this.load();
    if (!this.on) { this.on = true; this.wait = true; this.jumped = false; this.got = false; this.cued = this.cueT != null; this.cueT = null; }
    const tt = this.target(t);
    if (mode === "hold") { if (this.holdT == null && this.run) this.holdT = tt; } else this.holdT = null;
    this.run = run && !M.scrub;
    this.want = this.run ? tt : this.still(tt);
    const ready = v.readyState >= 2 && this.theme === M.theme;
    if (ready) this.sync(tt);
    else if (v.readyState >= 1 && !v.seeking) {
      // its frame is not there yet: ask for it (a browser may hold back the data of a video until it plays or seeks)
      if (this.run) { if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } }
      else if (Math.abs(v.currentTime - this.want) > 0.5 / this.F) v.currentTime = this.want;
    }
    // visible once its frame is there (a fresh tile, a seek to its start, a change of theme)
    // (v20: while a finger scrubs, the next seek starts as soon as one ends: a tile shows once a seek since it came in has
    // brought a frame, a little behind the finger rather than missing)
    if (this.wait && ready && ((mode === "scrub" && this.got) || (!v.seeking && Math.abs(this.err(this.want)) <= (this.run || mode === "scrub" ? 0.25 : 0.6 / this.F)))) this.wait = false;
    // once its frame was there, a tile stays (a video that waits for data stands on its last frame, the body does not vanish)
    if (ready && !this.wait) this.shown = true;
    setStyle(this, "vis", (ready || this.shown) && !this.wait ? "visible" : "hidden");
    setStyle(this, "op", String(alpha > 0.996 ? 1 : Math.round(alpha * 1000) / 1000));
  };
  Tile.prototype.err = function (tt) {
    let e = this.v.currentTime - tt;
    if (this.loop) { const L = this.len; if (e > L / 2) e -= L; else if (e < -L / 2) e += L; }
    return e;
  };
  // v20: how far a standing video may be from its frame: one held by a pause keeps its frame while the clock stays where it stopped
  Tile.prototype.tol = function (tt) { return this.holdT != null && !this.wait && Math.abs(tt - this.holdT) < 1e-3 ? 0.25 : 0.6 / this.F; };
  Tile.prototype.rateTo = function (r) { if (Math.abs(r - this.rate) > 0.004) { this.rate = r; this.v.playbackRate = r; } };
  Tile.prototype.sync = function (tt) {
    const v = this.v, F = this.F;
    const end = !this.loop && tt >= this.len - 0.6 / F;
    if (!this.run || end) {
      // the clock stands (or the clip holds its last frame, or the browser does not let videos play): the exact frame
      if (!v.paused) v.pause();
      this.rateTo(1);
      const s = this.still(tt);
      if (Math.abs(this.err(s)) > this.tol(tt) && !v.seeking && !(end && v.ended)) v.currentTime = s;
      return;
    }
    const e = this.err(tt), ae = Math.abs(e);
    // a tile not shown yet (fresh, or a new file after a change of theme) jumps to its frame once; one on screen jumps only when
    // far off; a jump lands ahead of the clock by the time a seek takes; small errors close with the playback rate
    if (ae > (this.wait && !this.jumped && !this.cued ? 1.5 / F : 0.25)) {
      if (!v.seeking) { this.jumped = true; this.seekT = performance.now(); v.currentTime = this.target(tt + this.lead); this.rateTo(1); }
    }
    else if (ae > 0.04) this.rateTo(Math.max(0.75, Math.min(1.25, Math.round((1 - 2 * e) * 20) / 20)));
    else if (ae < 0.015) this.rateTo(1);
    if (v.paused && !v.seeking && !v.ended) {
      const p = v.play();
      if (p && p.catch) p.catch((err) => { if (err && err.name === "NotAllowedError" && !M.scrub) { M.scrub = true; console.warn("MinPair page: videos may not play here, they follow the clock frame by frame."); } });
    }
  };
  // v20: a tile that will come in at a time of its video (a jump on the time line) waits at that frame, so it shows at once
  Tile.prototype.cue = function (t) { this.cueT = this.target(t); if (!this.on) this.parkAt(this.cueT); };
  // a tile that goes out waits at the start of its video (every clock of the page starts its bodies at 0)
  Tile.prototype.parkAt = function (t) { const v = this.v; this.park = t; if (v.readyState >= 1 && Math.abs(v.currentTime - t) > 0.5 / this.F && !v.seeking) v.currentTime = t; };
  Tile.prototype.pause = function () { if (!this.v.paused) this.v.pause(); };
  // the frame of the video stands where the clock wants it (for the test films and screenshots)
  Tile.prototype.settled = function () {
    const v = this.v;
    if (!this.on) return true;
    return v.readyState >= 2 && !v.seeking && !this.wait && this.theme === M.theme && (this.run || Math.abs(this.err(this.want)) <= this.tol(this.target(this.lastT)));
  };

  // ---------------------------------------------------------------- theme: the other file, the tile hidden until its frame is in
  doc.addEventListener("mp:theme", () => {
    const th = MP.isDark() ? "dark" : "light";
    if (th === M.theme) return;
    M.theme = th;
    ALL.forEach((t) => {
      if (!t.theme) return;                                         // not loaded yet: it takes the new file when it starts
      t.wait = true; t.jumped = false; setStyle(t, "vis", "hidden");
      t.load();
    });
  });

  MP.media = {
    M, Tile, all: ALL,
    tile: (host, id, meta, o) => new Tile(host, id, meta, o),
    // resolves once every tile that shows has its frame where its clock wants it, and two frames have been drawn since
    settled(limit) {
      const t0 = performance.now(), lim = limit || 10000;
      return new Promise((res) => {
        const f = () => {
          const ok = ALL.every((t) => t.settled());
          if (ok || performance.now() - t0 > lim) {
            // after a seek a video shows its new frame with one of the next frames of the page
            requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => res(ok), 40)));
          } else setTimeout(f, 25);
        };
        f();
      });
    },
    pauseAll(list) { (list || ALL).forEach((t) => t.pause()); },
  };
  if (QS.get("scrub") === "1") M.scrub = true;
  // a hidden tab: every video stops (the clocks of the page stop with their frames anyway); they go on with the next frame
  doc.addEventListener("visibilitychange", () => { if (doc.hidden) ALL.forEach((t) => t.pause()); });
})();
