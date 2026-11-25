/* MinPair project page v17 (from v16): grid.js. v17: the bodies of the grid are video tiles (media.js) inside each row, in
   the place of its tiles; they scroll with the page as ordinary content (v16 drew them into a band canvas of its own). A row near the screen (240 px above or below it, v16's BAND) plays: its clock starts at 0 when it
   comes near, as before, and all its videos follow that one clock (each video one loop of v16's: the clip, then 0.6 s back
   to its start, rows that travel fade out and in). A row far from the screen stands still at its start. With reduced
   motion every row shows the moment v16 showed (60 % of its clip). The videos load after those of the story
   (MP.grid.prepare), or as soon as the grid comes near.
   v11 (from v10): rows that travel (turn, tempo) keep a fixed camera and draw the pelvis path faintly on the floor.
   v10: "Other words work the same way" as ordinary page content below the player. One row per example of
   data/examples.json (list "grid"): its name, one MinPair body per value side by side, the value words under them and below
   those the caption with the word left open, in a line of its own (reserved space: it covers nothing and moves nothing; it
   shows on hover, focus or tap). */
(function () {
  "use strict";
  const MP = window.MP, doc = document, $ = (id) => doc.getElementById(id);
  const host = $("grid");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = { rows: [], clk: 0, last: 0, raf: 0, hold: false, want: false, vis: false };
  const BAND = 240;

  function toneOf(k, n) { return n > 2 ? k : k ? 2 : 0; }

  function build(X) {
    host.querySelectorAll(".row").forEach((e) => e.remove());
    R.rows = X.ex.grid.map((id) => {
      const r = X.ex.examples[id], n = r.values.length, el = doc.createElement("article");
      el.className = "row" + (r.path ? " wide" : ""); el.tabIndex = 0;          // rows that travel take the full width
      const parts = r.caption.split("{}"), pre = parts[0].trim(), post = (parts[1] || "").trim();
      const words = r.values.map((v) => v.word).join(" or ");
      el.innerHTML = '<h3 class="rn">' + esc(r.attribute) + "</h3>" + '<div class="bx"></div>' +
        '<ul class="rv">' + r.values.map((v, k) => '<li class="t' + toneOf(k, n) + '">' + esc(v.word) + "</li>").join("") + "</ul>" +
        '<p class="rc">' + esc(pre) + ' <span class="gap" aria-label="' + esc(words) + '"></span>' + (post ? (/^[.,]/.test(post) ? "" : " ") + esc(post) : "") + "</p>";
      el.addEventListener("click", () => el.classList.toggle("show"));
      host.appendChild(el);
      const bx = el.querySelector(".bx");
      const tiles = r.values.map((_, k) => MP.media.tile(bx, id + "_" + k, X.ex.tiles[id + "_" + k]));
      return { r, el, bx, tiles, views: r.values.map(() => new MP.View(r.view)), dur: Math.min(...r.values.map((v) => v.dur)), enter: 0, near: false };
    });
  }

  // the tiles of each row and their views as in v16 (one scale per row, the median of the rows for those that stay in place)
  function layout() {
    if (!R.rows.length) return;
    let Ss = [];
    const o = (g, k) => ({ mx: 0.14, top: 0.1, bot: 0.08 });
    const ext = (g, k) => (g.r.path ? g.r.values[k].extV : g.r.values[k].extL);   // v16: extent (anchor 0, 0) or extentLocal
    R.rows.forEach((g) => {
      const w = g.bx.offsetWidth, h = g.bx.offsetHeight, n = g.r.values.length, tw = w / 3, x0 = (w - n * tw) / 2;
      g.tilesR = g.r.values.map((_, k) => ({ x: x0 + k * tw, y: 0, w: tw, h }));
      g.el.querySelectorAll(".rv li").forEach((li, k) => { li.style.left = Math.round(x0 + k * tw) + "px"; li.style.width = Math.round(tw) + "px"; });
      let S = Infinity;
      g.views.forEach((v, k) => { v.fit([ext(g, k)], g.tilesR[k], o(g, k)); S = Math.min(S, v.S); });
      g.S = S; Ss.push(S);
    });
    Ss = Ss.sort((a, b) => a - b);
    const Sm = Ss[Math.floor(Ss.length / 2)];
    R.rows.forEach((g) => {
      const S = g.r.path ? g.S : Math.min(g.S, Sm);
      g.views.forEach((v, k) => { v.fit([ext(g, k)], g.tilesR[k], Object.assign(o(g, k), { maxS: S })); v.S = S; g.tiles[k].place(v.rect, v.S, v.hc, v.vc); });
    });
  }

  // one frame: every row near the screen at its clock; the others stand at their start
  function draw() {
    const run = !R.hold && !MP.REDUCED;
    R.rows.forEach((g) => {
      if (!g.near && !R.hold) { g.tiles.forEach((t) => t.set(0, 0, false)); return; }
      const t = MP.REDUCED ? g.dur * 0.6 : R.clk - g.enter;
      g.tiles.forEach((tl) => tl.set(1, t, run));
    });
  }
  function frame(now) {
    R.raf = 0;
    const dt = R.last ? Math.min(0.1, (now - R.last) / 1000) : 0; R.last = now;
    if (!R.hold) R.clk += dt;
    draw();
    if (!MP.REDUCED && !R.hold && R.rows.some((g) => g.near)) R.raf = requestAnimationFrame(frame);
  }
  function wake() { if (!R.raf) { R.last = 0; R.raf = requestAnimationFrame(frame); } }
  function loadAll() { if (R.want) return; R.want = true; R.rows.forEach((g) => g.tiles.forEach((t) => t.load())); }

  MP.grid = {
    // test hooks: setTime(t) draws with every row's clock at t; tick(dt) runs one frame (for a film of scrolling)
    setTime(t) { R.hold = true; R.rows.forEach((g) => { g.near = true; g.enter = 0; }); R.clk = t; draw(); },
    tick(dt) { R.hold = true; R.clk += dt; draw(); },
    release() { R.hold = false; R.rows.forEach((g) => { g.near = false; }); R.obs && R.rows.forEach((g) => { R.obs.unobserve(g.el); R.obs.observe(g.el); }); wake(); },
    relayout() { layout(); },
    // v17: load the grid's videos now (the story calls this once its own videos are in, or when it stands on its last step)
    prepare() { if (R.rows.length) loadAll(); else R.pre = true; },
    rows: () => R.rows,
  };
  MP.grid.built = MP.examples.then((X) => {
    build(X);
    layout();
    if (R.pre) loadAll();
    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { layout(); draw(); }, 150); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { layout(); draw(); });
    // a row near the screen plays from its start; one that leaves stops (v16: the band of the screen and BAND above and below)
    R.obs = new IntersectionObserver((es) => {
      es.forEach((e) => {
        const g = R.rows.find((x) => x.el === e.target); if (!g || R.hold) return;
        if (e.isIntersecting && !g.near) { g.near = true; g.enter = R.clk; loadAll(); }
        else if (!e.isIntersecting && g.near) g.near = false;
      });
      draw(); wake();
    }, { rootMargin: BAND + "px 0px" });
    R.rows.forEach((g) => R.obs.observe(g.el));
    doc.addEventListener("visibilitychange", () => { if (!doc.hidden) { R.last = 0; wake(); } });
  });
})();
