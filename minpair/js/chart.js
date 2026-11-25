/* MinPair project page v16: chart.js (from v7, the same drawing, pixel for pixel). v16: the canvas covers only the room of
   the chart (at the same pixel density), not the whole stage, so each redraw clears and composites a fifth of the pixels;
   layout() returns the top and bottom of the drawing, so the titles can stand right above it.
   v7: (from v6, unchanged drawing; the stations are counted from K, the station of the grid).
   The last three stations of the story, drawn on one canvas in the stage. It is redrawn only when P changes.
   One dot is one percent of the template edits of the benchmark, a filled dot is a followed edit.
   K + 1: a field of 100 dots for MinPair. K + 2: the field folds into a row below the three rows of Table 2 that lead to it.
   K + 3: the row stays, one square is the training data of MinPair (30 h), the squares of two larger models grow next to it.
   Every value is read from data/results.json (the values of the paper). */
(function () {
  "use strict";
  const MP = window.MP, doc = document, cv = doc.getElementById("chart");
  const { clamp, sub, ease, mix, tr } = MP.fx;

  const STAIRS = [
    { label: "FrankenMotion captions", key: "v365.res.m2orig.rules", m2m: "std.m2orig.m2m.seq" },
    { label: "MinPair captions", key: "v365.res.ctl.rules", m2m: "std.m2.m2m.seq" },
    { label: "with MinPair training", key: "v365.res.nopair.rules", m2m: "std.nopair.m2m.seq" },
    { label: "with the pair loss", key: "v365.res.MAIN.rules", m2m: "std.MAIN.m2m.seq" },
  ];
  const MODELS = [
    { label: "MinPair", key: "v365.cmp.MAIN.part.rules", hours: "data.hours" },
    { label: "Kimodo", key: "v365.cmp.kimo.sent.rules", hours: "kimo.hours", ratio: "kimo.hoursratio" },
    { label: "HY-Motion 1.0", key: "v365.cmp.hy.sent.rules", hours: "hy.hours", ratio: "hy.hoursratio", more: true },
  ];
  let G = null, D = null, COL = null, last = "", ctx = null;
  const col = () => COL || (COL = { ink: MP.css("ink"), ink2: MP.css("ink-2"), ink3: MP.css("ink-3"), accent: MP.css("accent"), sans: MP.css("sans") });
  const drop = () => { COL = null; last = ""; };
  doc.addEventListener("mp:theme", drop);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drop);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(drop);

  const ready = MP.ready.then(() => {
    const row = (r) => { const s = MP.pv(r.key, 1); return { label: r.label, val: s + "%", n: Math.round(parseFloat(s)), m2m: r.m2m ? MP.pv(r.m2m, 3) : "",
      hours: r.hours ? (r.more ? ">" : "") + MP.pv(r.hours, 0) + " h" : "", sq: r.ratio ? Math.round(MP.pvNum(r.ratio)) : 1 }; };
    D = { stairs: STAIRS.map(row), models: MODELS.map(row) };
    const sr = doc.getElementById("chart-sr");
    if (sr) sr.innerHTML = "<table><caption>Followed edits and sequence M2M (Table 2 of the paper)</caption><tr><th>Setting</th><th>Edits</th><th>M2M</th></tr>" +
      D.stairs.map((r) => "<tr><td>" + r.label + "</td><td>" + r.val + "</td><td>" + r.m2m + "</td></tr>").join("") + "</table>" +
      "<table><caption>Training data and followed edits (Table 1 of the paper)</caption><tr><th>Model</th><th>Motion data</th><th>Edits</th></tr>" +
      D.models.map((r) => "<tr><td>" + r.label + "</td><td>" + r.hours + "</td><td>" + r.val + "</td></tr>").join("") + "</table>";
    last = "";
    return D;
  });

  // geometry of the three states inside the vertical zone [top, bot] of the stage
  function layout(W, H, mob, top, bot) {
    const cw = Math.min(mob ? W - 44 : 640, W - 44), p = cw / 50, x0 = (W - cw) / 2 + p / 2;
    const pf = mob ? 22 : 28, zc = (top + bot) / 2, lh = mob ? 21 : 25, gap = mob ? 16 : 26, rh = lh + 2 * p + gap, head = 20;
    const sTop = zc - (4 * rh - gap + head) / 2 + head;
    const bh = [1, 1, 3].map((rows) => lh + rows * p + 7 + 2 * p), dTop = zc - (bh[0] + bh[1] + bh[2] + 2 * gap) / 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    G = { W, H, mob, cw, p, x0, pf, fx: W / 2 - 4.5 * pf, fy: zc - 4.5 * pf, lh, gap, rh, sTop, bh, dTop,
      bTop: [dTop, dTop + bh[0] + gap, dTop + bh[0] + bh[1] + 2 * gap], fs: mob ? 14 : 16, fs2: mob ? 12.5 : 13.5 };
    // v16: the top and bottom of the three drawings (the field, the rows of the table, the rows of the models), text included
    const capT = (size) => 0.8 * size;
    const yTop = Math.min(G.fy - pf * 0.3, sTop - 8 - capT(G.fs2), G.bTop[0] + lh - 8 - capT(G.fs));
    const yBot = Math.max(G.fy + 9 * pf + pf * 0.3, sTop + 3 * rh + lh + p / 2 + p * 1.34, G.bTop[2] + bh[2]);
    // v16: the canvas covers the chart's room with a margin, at the same density as before (its pixels are the same)
    const m = 24, [cx0, cy0, cx1, cy1] = MP.pxBox((W - cw) / 2 - m, yTop - m, (W + cw) / 2 + m, yBot + m, W, H, dpr);
    const pw = Math.round((cx1 - cx0) * dpr), ph = Math.round((cy1 - cy0) * dpr);
    if (cv.width !== pw) cv.width = pw;
    if (cv.height !== ph) cv.height = ph;
    cv.style.left = cx0 + "px"; cv.style.top = cy0 + "px"; cv.style.width = cx1 - cx0 + "px"; cv.style.height = cy1 - cy0 + "px";
    ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, -cx0 * dpr, -cy0 * dpr);
    G.cx0 = cx0; G.cy0 = cy0; G.cw2 = cx1 - cx0; G.ch2 = cy1 - cy0;
    last = "";
    return { dot0: [G.fx, G.fy], r: pf * 0.3, top: yTop, bot: yBot };
  }

  function dot(x, y, r, on, a) {
    if (a <= 0) return;
    const C = col(); ctx.globalAlpha = a; ctx.beginPath();
    if (on) { ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = C.accent; ctx.fill(); }
    else { ctx.arc(x, y, Math.max(0.6, r - 0.6), 0, 6.2832); ctx.strokeStyle = C.ink3; ctx.lineWidth = 1.1; ctx.stroke(); }
  }
  function text(s, x, y, align, c, a, size) {
    if (a <= 0 || !s) return;
    ctx.globalAlpha = a; ctx.fillStyle = c; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
    ctx.font = "400 " + size + "px " + col().sans; ctx.fillText(s, x, y);
  }
  // a row of 100 dots, two high, shown from the left up to `show`
  function strip(y, n, show) {
    if (show <= 0) return;
    for (let i = 0; i < 100; i++) {
      const c = i >> 1, a = clamp(show * 55 - c, 0, 1); if (a <= 0) break;
      dot(G.x0 + c * G.p, y + (i & 1) * G.p, G.p * 0.34, i < n, a);
    }
  }

  function draw(P, K) {
    if (!G || !D || !ctx) return;
    const key = P <= K + 0.1 ? "off" : P.toFixed(4);
    if (key === last) return; last = key;
    ctx.clearRect(G.cx0, G.cy0, G.cw2, G.ch2);
    if (P <= K + 0.1) return;
    const C = col(), u13 = tr(P, K), u14 = tr(P, K + 1), u15 = tr(P, K + 2), p = G.p, xr = G.x0 - p / 2 + G.cw, xl = G.x0 - p / 2;
    const up = ease(sub(u15, 0.22, 0.58)), M = D.stairs[3];
    const rowY = (k) => G.sTop + k * G.rh, mainTop = mix(rowY(3), G.bTop[0], up), mainStrip = mix(rowY(3) + G.lh + p / 2, G.bTop[0] + G.lh + p + 7 + p / 2, up);
    // the 100 dots of MinPair: field, then row
    for (let i = 0; i < 100; i++) {
      const a = i === 0 ? sub(u13, 0.34, 0.5) : sub(u13, 0.46 + 0.4 * i / 100, 0.56 + 0.4 * i / 100);
      if (a <= 0) break;
      const f = ease(sub(u14, 0.2 * i / 100, 0.2 * i / 100 + 0.36));
      dot(mix(G.fx + (i % 10) * G.pf, G.x0 + (i >> 1) * p, f), mix(G.fy + ((i / 10) | 0) * G.pf, mainStrip + (i & 1) * p, f),
        mix(G.pf * 0.3, p * 0.34, f) * (0.5 + 0.5 * a), i < M.n, a);
    }
    // station 15: the three rows above, their values, M2M beside them
    const out = 1 - sub(u15, 0, 0.28), mIn = sub(u14, 0.5, 0.72), xm = xr - (G.mob ? 62 : 96);
    for (let k = 0; k < 3; k++) {
      const r = D.stairs[k], s = Math.min(sub(u14, 0.42 + 0.13 * k, 0.72 + 0.13 * k), out), y = rowY(k), ta = Math.min(sub(u14, 0.42 + 0.13 * k, 0.56 + 0.13 * k), out);
      strip(y + G.lh + p / 2, r.n, s);
      text(r.label, xl, y + G.lh - 8, "left", C.ink, ta, G.fs); text(r.val, xr, y + G.lh - 8, "right", C.ink, ta, G.fs);
      text(r.m2m, xm, y + G.lh - 8, "right", C.ink2, ta, G.fs2);
    }
    const ha = Math.min(sub(u14, 0.42, 0.56), out);
    text("M2M", xm, rowY(0) - 8, "right", C.ink2, ha, G.fs2); text("edits", xr, rowY(0) - 8, "right", C.ink2, ha, G.fs2);
    text(M.m2m, xm, mainTop + G.lh - 8, "right", C.ink2, Math.min(mIn, out), G.fs2);
    text(M.label, xl, mainTop + G.lh - 8, "left", C.ink, Math.min(mIn, 1 - sub(u15, 0.18, 0.36)), G.fs);
    text(M.val, xr, mainTop + G.lh - 8, "right", C.ink, mIn, G.fs);
    // station 16: one square is the motion data of MinPair
    if (u15 > 0) D.models.forEach((r, b) => {
      const y = G.bTop[b], t0 = 0.46 + 0.07 * b, la = sub(u15, t0, t0 + 0.12), nSq = r.sq * (b ? ease(sub(u15, t0 + 0.06, t0 + (b === 2 ? 0.4 : 0.26))) : sub(u15, 0.5, 0.6));
      text(r.label, xl, y + G.lh - 8, "left", C.ink, b ? la : sub(u15, 0.4, 0.58), G.fs);
      const sz = Math.max(2.5, p - (G.mob ? 2 : 2.5)); ctx.fillStyle = C.ink;
      for (let j = 0; j < Math.ceil(nSq); j++) {
        ctx.globalAlpha = 0.82 * clamp(nSq - j, 0, 1);
        ctx.fillRect(xl + (j % 33) * p, y + G.lh + ((j / 33) | 0) * p, sz, sz);
      }
      text(r.hours, xl + Math.min(r.sq, 33) * p + 6, y + G.lh + Math.max(sz - 1, G.fs2 * 0.72), "left", C.ink2, sub(nSq / r.sq, 0.7, 1), G.fs2);
      if (b) {
        strip(y + G.bh[b] - 2 * p + p / 2, r.n, sub(u15, t0 + 0.14, t0 + 0.4));
        text(r.val, xr, y + G.lh - 8, "right", C.ink, sub(u15, t0 + 0.3, t0 + 0.42), G.fs);
      }
    });
    ctx.globalAlpha = 1;
  }

  MP.chart = { layout, draw, ready };
})();
