/* MinPair project page v17 (from v16): story.js. v17: every body is a video tile (media.js) that this file drives with the
   same clocks, weights and hand-overs that posed the bodies of v16 (tile.set(alpha, time, running)); the views are fitted from
   the extents of the motions (data/examples.json, data/story.json). Where two movements of the opening cross-fade in the same
   tiles, the opaque video below shows at w / (1 - w of the one above), so each body alone keeps its v16 weight. The story
   starts once the opening's videos have their first frame; the other videos load after them, the grid's last.
   v14 (from v13): v14: in the opening the picture stands about 1.3 s after each movement has
   ended (each movement gets its own length from its clips, before it was 3.6 s for every one); the other steps keep their v13
   lengths. At the end the autoplay stops on the last step as before (the hint shows the way on). Scrolling no longer stops
   the autoplay, it drives it: one gesture (wheel, trackpad swipe with its coasting, touch swipe, arrow or page key) is one
   step, down starts the autoplay or skips a step (on the last step: on to the examples), up goes one step back; only the
   pause button pauses. Inside the story the page is moved by the story, outside it scrolls as usual. A slim top bar (as on
   the SetCon page) from the second step on, the story keeps its top 48 px free for it.
   v11 (from v10): the values of an example stand side by side (same size, one floor
   line, each with its word), never on top of each other; three-quarter front cameras.
   v10 text:  Steps that follow the native scroll position, each with its own clock.

   The story section is as tall as one screen per step; its stage sticks to the top while the page scrolls through it.
   The scroll position picks the step (with hysteresis, one step per hand-over, so a long trackpad flick runs through the
   steps instead of skipping them); scrolling never scrubs an animation. A step plays its own animation on its own
   clock. After the last step the page scrolls on to the grid. Nothing is intercepted: no wheel handler that prevents,
   no scroll snapping. Autoplay moves to the next step and scrolls the page there with one smooth scroll; any input of the
   visitor (wheel, touch, key, mouse) stops it at once. The checkpoints and the arrows go to a step and scroll there.

   Continuity as in v9: every visible quantity is the weighted mix of the active steps; a hand-over takes 0.6 s (the old
   step fades in the first 60 %, the new one in the last 60 %); a jump into the group of bodies already on screen fades
   out, restarts the group's clock and fades in; every motion starts at its first frame; loops ease back.

   The examples of the opening, the generation step and the grid come from data/examples.json.
   Test hooks: MP.story.setTime(tau) draws the autoplay film at tau; MP.story.test(true) stops the frame loop and
   MP.story.tick(dt) runs one frame of dt seconds (scroll handling included), for a film of scrolling. */
/* v20 (from v19): the player is a time line of the whole story, and the pause button pauses.
   - Pause stops everything at once: the story clock stands, each video stops on the frame where it is (media.js "hold"), the
     bar stands. Play goes on from the same place and the autoplay moves on again. While paused, gestures, keys, the arrows and
     the checkpoints still move a step on or back; that step plays once and stands at its end, the autoplay stays off until Play.
     Without a pause everything is as in v19 (scrolling starts or drives the autoplay, one gesture one step).
   - The bar is the story's time: its fill follows the clock (each step as long as it lasts), the checkpoints stand at the moment
     their step is in (start + hand-over). A click goes to that moment (a short fade into the film there), dragging (mouse or
     touch) scrubs through the film frame by frame (filmAt: the autoplay from the top as one time line, with the steps' own
     fades), letting go plays on from there, or stands when paused. A grip shows on hover and while dragging, the tip names
     the step under the pointer; the grip is a slider for the keyboard (arrows 5 s, Home, End).
   - The checkpoints stay the anchors: a gesture, an arrow or a key goes to the next or previous checkpoint; from a time between
     two (after a click or a drag) back goes to the start of the step on screen first.
   - The page scrolls to a step in one smooth movement of its own (ease in and out, as long as the hand-over), while the fill
     glides with the same curve; wheel events during it are spent. */
(function () {
  "use strict";
  const MP = window.MP, doc = document, $ = (id) => doc.getElementById(id);
  const { clamp, ease, mix } = MP.fx;
  const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const ramp = (L, a, d) => sm((L - a) / d);
  const stage = $("stage"), story = $("story"), NAV = $("topnav");
  const QS = new URLSearchParams(location.search);
  const TIN = 0.6, MOV = 3.6, XF = 0.8, LOOP_REST = 0.5;
  // v16: in the opening the picture stands at most this long after a movement (user: at most about 1.5 s of stillness). A
  // movement whose bodies only creep at its end counts that slow end as stillness too: its rest is shortened by it (below)
  const REST = 0.7, REST_MIN = 0.1, STILL = 1.3, LAG = 0.16;
  const NAVH = 48;                                           // v14: the top bar, from the second step on
  // v14: one gesture is one step: a wheel stream with a pause longer than W_GAP ends a gesture, nothing acts again within LOCK
  const W_GAP = 250, W_MIN = 4, T_MIN = 28, LOCK = 700;
  // 19.11.: the labels of the step "loss" that take two lines on a phone: [index in E.labs, one line, two lines]
  const LAB2 = [[5, "✓ true caption", "✓ true<br>caption"], [8, "✗ negative caption", "✗ negative<br>caption"],
    [6, "pair loss: ✗ must be larger", "pair loss:<br>✗ must be larger"]];
  const RED = { open: 1.3, gen: 1.3, train: 0.25 };      // reduced motion: every group holds the moment its words are read
  const CAP = QS.get("fps") === "30" ? 32 : 0;
  const XPLAIN = QS.get("xfade") === "plain";                // v17: the other rule for the opening's cross-fades (draw)

  // ---------------------------------------------------------------- the steps (opening one calm cycle, then about 21 s)
  const BEATS = [
    { id: "open", grp: "open", tin: 0, hold: 3 * MOV, title: "Change one word and the motion follows", short: "One word" },
    { id: "pair", grp: "train", tin: TIN, hold: 3.0, title: "Training swaps one word of a real caption", short: "A minimal pair" },
    { id: "recon", grp: "train", tin: TIN, hold: 3.0, title: "One denoiser rebuilds the noisy clip from each caption", short: "Two captions" },
    { id: "loss", grp: "train", tin: TIN, hold: 2.8, title: "The true caption must rebuild the clip better", short: "The pair loss" },
    { id: "gen", grp: "gen", tin: TIN, hold: 2.8, title: "Same noise, one other word", short: "Generation" },
    { id: "r1", grp: "res", tin: TIN, hold: 1.6, title: "It follows 60% of the edits", short: "60% of edits" },
    { id: "r2", grp: "res", tin: TIN, hold: 2.0, title: "The pair loss lifts edits from 11% to 60%", short: "Edits 11% to 60%" },
    { id: "r3", grp: "res", tin: TIN, hold: 2.0, title: "Others trained on up to 99 times more data", short: "Up to 99 times more data" },
  ];
  // v16: every title stands long enough to be read once it is fully in: 1 s and 0.3 s per word, at least 2.5 s. A step is
  // lengthened only where its hold is shorter than that (the steps of the results, the three of the training a little)
  const READ = (s) => Math.round(100 * Math.max(2.5, 1 + 0.3 * s.trim().split(/\s+/).length)) / 100;
  BEATS.forEach((b) => { b.hold = Math.max(b.hold, READ(b.title)); });
  // v14: the time line; the opening's length is set again from its clips once they have loaded (build)
  let TOTAL = 0;
  function timeline() { let t0 = 0; BEATS.forEach((b) => { b.start = t0; t0 += b.tin + b.hold; b.end = t0; b.dur = b.tin + b.hold; b.at = b.start + b.tin; }); TOTAL = t0; }
  timeline();
  // v20: a step whose group is on screen before it (the training steps) comes in as the autoplay brings it: the group fades out
  // and in again and its clock starts anew (go(): dip). The film does the same, so a time on the bar is what the autoplay shows
  BEATS.forEach((b, i) => { b.dip = i > 0 && b.grp === BEATS[i - 1].grp && b.grp !== "res"; });
  // the moment a step's bodies come in, after its start: when its weight passes 0.0005 (draw() starts the group clock there)
  const ENTER = (i) => (i === 0 ? 0 : BEATS[i].start + (BEATS[i].dip ? 0.525 : 0.4) * BEATS[i].tin);
  // the movements of the opening: start and length of each (v14: its clip, then REST; the crossfade begins at its end)
  let SL = [0, 1, 2].map((m) => ({ s: m * MOV, d: MOV })), PER = 3 * MOV;
  const NB = BEATS.length, GROUPS = ["open", "train", "gen"];
  const IDX = {}; BEATS.forEach((b, i) => { IDX[b.id] = i; });

  // ---------------------------------------------------------------- DOM writes only on change
  const memo = new WeakMap();
  const mem = (el) => memo.get(el) || (memo.set(el, {}), memo.get(el));
  function st(el, k, v) { const c = mem(el); if (c[k] !== v) { c[k] = v; el.style[k] = v; } }
  const f1 = (v) => (Math.round(v * 10) / 10).toString();
  function place(el, x, y, a) {
    a = a < 0.004 ? 0 : a > 0.996 ? 1 : Math.round(a * 100) / 100;
    st(el, "opacity", String(a)); st(el, "visibility", a ? "visible" : "hidden");
    if (a) st(el, "transform", "translate3d(" + f1(x) + "px," + f1(y) + "px,0)");
  }
  function hline(el, x1, x2, y, a) {
    a = a < 0.004 ? 0 : Math.round(a * 100) / 100;
    st(el, "opacity", String(a)); st(el, "visibility", a ? "visible" : "hidden");
    if (a) st(el, "transform", "translate3d(" + f1(Math.min(x1, x2)) + "px," + f1(y) + "px,0) scaleX(" + (Math.abs(x2 - x1) / 100).toFixed(3) + ")");
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const mk = (tag, cls, parent, html) => { const e = doc.createElement(tag); e.className = cls; if (html != null) e.innerHTML = html; (parent || stage).appendChild(e); return e; };

  // captions of one example as aligned lines: the shared words in the same place, the one word that differs emphasised
  function lines(host, caps, tones, marks) {
    const Wd = caps.map((c) => c.split(" "));
    let i = 0; while (Wd.every((w) => i < w.length - 1 && w[i] === Wd[0][i])) i++;
    let j = 0; while (Wd.every((w) => j < w.length - i - 1 && w[w.length - 1 - j] === Wd[0][Wd[0].length - 1 - j])) j++;
    host.innerHTML = caps.map((c, k) => {
      const w = Wd[k], pre = w.slice(0, i).join(" "), word = w.slice(i, w.length - j).join(" "), post = w.slice(w.length - j).join(" ");
      const m = word.match(/^(.*?)([.,]?)$/);
      return '<p class="l">' + (marks ? '<span class="mk" aria-label="' + (k ? "negative caption" : "true caption") + '">' + marks[k] + "</span>" : "") +
        esc(pre) + (pre ? " " : "") + '<span class="w t' + tones[k] + '">' + esc(m[1]) + "</span>" + esc(m[2]) + (post ? " " + esc(post) : "") + "</p>";
    }).join("");
    return Array.from(host.children);
  }
  const capsOf = (ex) => ex.values.map((v) => ex.caption.replace("{}", v.slot));

  // ---------------------------------------------------------------- elements
  const E = { hd: $("hd"), fig: $("fig"), chart: $("chart"), gl: $("gl") };
  E.titles = BEATS.map((b) => mk("h2", "beat", stage, esc(b.title)));
  E.titles.forEach((t, i) => { t.setAttribute("aria-hidden", i ? "true" : "false"); });
  const live = $("beat-live");

  // ---------------------------------------------------------------- state
  const S = { D: null, X: null, Lo: null, now: 0, tau: 0, k: 0, stepT0: 0, hand: null, natural: false, hold: false, test: false,
    visible: false, auto: false, touched: false, ended: false, prog: null, enter: { open: 0, train: -1e9, gen: -1e9 },
    gw: { open: 0, train: 0, gen: 0 }, lastBeat: -1, top0: 0, stepH: 1,
    openCap: Infinity, hdW: 1, lock: 0, acts: 0, wallT: -1e9,
    // v20: paused by the button (step by step until Play), the clock stands, a finger on the bar (its time), a jump to a time
    // of the bar, a time between two checkpoints (set by the bar), the wall clock of the jumps
    paused: false, frozen: false, drag: false, dragTau: 0, jmp: null, free: false, wall: 0 };
  const V = {}, A = {}, LN = {}, GD = [], GDG = [], LBL = {};
  let OPEN = [], GEN = null;

  function toneOf(k, n) { return n > 2 ? k : k ? 2 : 0; }
  // v17: the video tiles of an example (one per value; their files are named after the example and the value)
  function tiles(id, X, pre) {
    const TL = X.ex.tiles;
    return X.ex.examples[id].values.map((_, k) => { const f = id + "_" + k; return MP.media.tile(E.gl, (pre || "") + f, TL[f], { file: f }); });
  }

  function build(D, X) {
    S.D = D; S.X = X;
    OPEN = X.ex.opening.map((id) => X.ex.examples[id]);
    GEN = X.ex.examples[X.ex.generation];
    A.open = X.ex.opening.map((id) => tiles(id, X));
    const words = (ex) => ex.values.map((v, k) => mk("span", "vw t" + toneOf(k, ex.values.length), stage, esc(v.word)));
    LBL.open = OPEN.map(words);
    LN.open = OPEN.map((ex) => { const h = mk("div", "lines", stage); return { el: h, ls: lines(h, capsOf(ex), ex.values.map((_, k) => toneOf(k, ex.values.length))) }; });
    OPEN.forEach((ex, m) => {
      GD[m] = ex.values.map((v, k) => (v.guide ? { ln: mk("div", "gd t" + toneOf(k, ex.values.length) + "b", stage), lab: mk("span", "gll", stage, esc(v.guide.label)), z: v.guide.z } : null));
    });
    A.gen = tiles(X.ex.generation, X, "gen_"); LBL.gen = words(GEN);
    GDG.push(...GEN.values.map((v, k) => (v.guide ? { ln: mk("div", "gd t" + toneOf(k, GEN.values.length) + "b", stage), lab: mk("span", "gll", stage, esc(v.guide.label)), z: v.guide.z } : null)));
    const gi = X.ex.opening.indexOf(X.ex.generation);
    S.genLines = gi >= 0 ? gi : -1;
    if (gi < 0) { const h = mk("div", "lines", stage); LN.gen = { el: h, ls: lines(h, capsOf(GEN), GEN.values.map((_, k) => toneOf(k, GEN.values.length))) }; }
    const man = D.man;
    A.train = [MP.media.tile(E.gl, "train", X.ex.tiles.train)];
    // v12: the partner whose wrist hangs at hip height (where the negative word comes from), and the wrist heights drawn on
    // the bodies: shoulder in ink like the true word, hip in the accent like the negative word
    A.partner = MP.media.tile(E.gl, "partner", X.ex.tiles.partner);
    E.hl = { clipS: mk("div", "gd tib", stage), clipH: mk("div", "gd tab", stage), partH: mk("div", "gd tab", stage),
      lS: mk("span", "gll", stage, "shoulder"), lH: mk("span", "gll", stage, "hip"), lP: mk("span", "gll", stage, "hip"),
      lClip: mk("span", "fl", stage, "clip"), lPart: mk("span", "fl", stage, "partner") };
    LN.pair = (() => { const h = mk("div", "lines pair", stage); return { el: h, ls: lines(h, [man.train.true, man.train.neg], ["i", "a"], ["✓", "✗"]) }; })();
    E.winLab = mk("span", "fl", stage, "left arm, 0.0–0.5 s");
    // 19.11. (with the user): over the two bars of the step "loss" the words of the curves before them (each bar is the error
    // inside the window under that caption, not a loss), at the bracket what the pair loss asks for; no "denoising loss" here
    // (that one covers the whole clip). Index 5: over the bar of the true caption, 8: over that of the negative one, 6: at the
    // bracket, 7: under the bars. On a phone 5, 6 and 8 take two lines (LAB2, set in layout)
    E.labs = ["clip", "✓ true caption", "✗ negative caption", "shoulder", "hip", "✓ true caption", "pair loss: ✗ must be larger", "error inside the window", "✗ negative caption"]
      .map((t) => mk("span", "fl", stage, esc(t)));
    // v14: each movement of the opening as long as its longest clip and its rest; the opening ends that rest after its last clip.
    // v16: the rest is REST, less the slow end of the movement (see slowEnd), so that slow end, the rest and the first tenth of
    // the crossfade (LAG) stay within STILL; never shorter than REST_MIN, nothing of a clip is cut
    let s0 = 0;
    SL = OPEN.map((ex) => {
      const c = Math.max(...ex.values.map((v) => v.dur)), slow = ex.slow || 0, rest = clamp(STILL - slow - LAG, REST_MIN, REST);
      const r = { s: s0, d: c + rest, clip: c, slow, rest }; s0 += r.d; return r;
    });
    PER = s0; BEATS[0].hold = Math.max(PER, READ(BEATS[0].title)); timeline();
  }
  // v16 slowEnd (how long a movement of the opening only creeps at its end) needs the motions; v17 reads its value from
  // data/examples.json ("slow", computed with v16's function when the videos were rendered)

  // ---------------------------------------------------------------- layout (on resize only)
  function layout() {
    const D = S.D, X = S.X, W = stage.clientWidth, H = stage.clientHeight; if (!D || !W || !H) return;
    // one screen of scrolling per step; the stage sticks while the section scrolls by
    S.stepH = H; story.style.height = Math.round(NB * H) + "px"; S.top0 = story.offsetTop;
    const mob = W < 720;
    const barH = mob ? 70 : 62, bot = H - barH - (mob ? 10 : 14);
    const cw = Math.round(Math.min(mob ? W - 32 : 760, W - 40));
    const lineBlock = (b) => {
      b.el.style.width = "auto"; b.el.classList.add("nw");
      const nat = b.el.scrollWidth; b.el.classList.remove("nw");
      b.w = Math.min(cw, nat + 2); b.el.style.width = b.w + "px"; b.h = b.el.offsetHeight; return b;
    };
    LN.open.forEach(lineBlock); lineBlock(LN.pair); if (LN.gen) lineBlock(LN.gen);
    let th = 0; E.titles.forEach((t) => { t.style.width = W + "px"; th = Math.max(th, t.offsetHeight); });
    const top = (NAV ? NAVH : 0) + (mob ? 14 : 22);                 // v14: the top bar is in from the second step on
    const hdH = E.hd.offsetHeight, hdY = mob ? 14 : Math.max(18, H * 0.035);
    const t0y = hdY + hdH + (mob ? 10 : 16);
    const oLinesY = t0y + E.titles[0].offsetHeight + (mob ? 8 : 12);
    const oLinesH = Math.max(...LN.open.map((b) => b.h));
    const oTop = oLinesY + oLinesH + (mob ? 6 : 10);
    const tY = top, linesY = top + th + (mob ? 10 : 14);
    const fit = (v, ms, r, type, o) => v.setType(type).fit(ms, r, Object.assign({ mx: 0.18, top: 0.12, bot: 0.08 }, o || {}));
    // the values of an example side by side: one row of tiles, one scale and one floor line for every example
    const labH = mob ? 24 : 30, rowW = mob ? W - 8 : Math.min(1040, W * 0.8);
    const tiles = (ex, y, h) => { const n = ex.values.length, tw = rowW / 3, x0 = (W - n * tw) / 2; return ex.values.map((_, k) => ({ x: x0 + k * tw, y, w: tw, h })); };
    const gl = LN.gen || LN.open[S.genLines];
    const gTop = linesY + gl.h + (mob ? 10 : 18);
    const oR = OPEN.map((ex) => tiles(ex, oTop, Math.max(120, bot - oTop - labH)));
    const gR = tiles(GEN, gTop, Math.max(120, bot - gTop - labH));
    const rows = OPEN.map((ex, m) => ({ ex, rects: oR[m] })).concat([{ ex: GEN, rects: gR }]);
    S.Lo = Object.assign(S.Lo || {}, { mob });
    const fitted = fitRows(rows);
    V.open = fitted.slice(0, OPEN.length); V.gen = fitted[OPEN.length];
    if (S.genLines >= 0) { const Sa = V.open[S.genLines][0].S * 1.1; V.gen.forEach((v) => { if (v.S > Sa) { v.vc += 0; v.S = Sa; } }); }   // the same size as in the opening
    S.labY = { open: oTop + oR[0][0].h + 2, gen: gTop + gR[0].h + 2 };      // the words under the tiles, in the room kept for them
    const pTop = linesY + LN.pair.h + (mob ? 12 : 22);
    let bodyR, figR, partR;
    if (mob) {
      const bh = Math.min(170, (bot - pTop) * 0.36);
      bodyR = { x: 0, y: pTop, w: W * 0.42, h: bh }; partR = { x: W * 0.46, y: pTop, w: W * 0.42, h: bh };
      figR = { x: 16, y: pTop + bh + 18, w: W - 16 - 112, h: Math.max(140, bot - pTop - bh - 54) };
    } else {
      const zw = Math.min(1000, W - 80), zx = (W - zw) / 2, zh = bot - pTop;
      bodyR = { x: zx, y: pTop, w: zw * 0.22, h: zh * 0.86 }; partR = { x: zx + zw * 0.2, y: pTop, w: zw * 0.22, h: zh * 0.86 };
      figR = { x: zx + zw * 0.44 + 34, y: pTop + zh * 0.08, w: zw * 0.56 - 34 - 96, h: Math.min(zh * 0.74, 380) };
    }
    // the cameras follow each pelvis (both clips are fitted around their own pelvis)
    V.train = fit(V.train || new MP.View(), [D.man.bodies.clip.extL], bodyR, "tqL", { mx: 0.16 });
    V.partner = fit(V.partner || new MP.View(), [D.man.bodies.partner.extL], partR, "tqL", { mx: 0.16 });
    V.partner.S = V.train.S = Math.min(V.train.S, V.partner.S);
    figCanvas(W, H, mob, figR);
    // v16: every title stands at its drawing: the opening's under the head block, those of the training and the generation
    // right above their captions (as before), those of the results right above the chart, their last lines on one line;
    // title and chart are centred together in the room between the top bar and the player
    const RI = [IDX.r1, IDX.r2, IDX.r3], rth = Math.max(...RI.map((i) => E.titles[i].offsetHeight)), rgap = mob ? 16 : 24;
    let ce = MP.chart.layout(W, H, mob, top, bot);
    const c0 = top + Math.max(0, (bot - top - (rth + rgap + ce.bot - ce.top)) / 2) + rth + rgap;
    if (Math.abs(c0 - ce.top) > 0.5) { const d = c0 - ce.top; ce = MP.chart.layout(W, H, mob, top + d, bot + d); }
    const ty = BEATS.map((b, i) => (i === 0 ? t0y : b.grp === "res" ? Math.round(ce.top - rgap - E.titles[i].offsetHeight) : tY));
    S.Lo = { W, H, mob, bot, top, tY, t0y, ty, flow: mob ? 10 : 12, hdY, linesY, oLinesY, figR, cw };
    LAB2.forEach(([i, one, two]) => { E.labs[i].innerHTML = mob ? two : one; });
    S.labW = E.labs.map((l) => l.offsetWidth);
    LBL.open.flat().concat(LBL.gen).forEach((l) => { l.__w = l.offsetWidth; });
    GD.concat([GDG]).forEach((G) => G.forEach((g) => { if (g) g.labW = g.lab.offsetWidth; }));
    // v17: each video tile in the rectangle of its view, at its scale
    const put = (t, v) => t.place(v.rect, v.S, v.hc, v.vc);
    A.open.forEach((ts, m) => ts.forEach((t, k) => put(t, V.open[m][k])));
    A.gen.forEach((t, k) => put(t, V.gen[k]));
    put(A.train[0], V.train); put(A.partner, V.partner);
    player.size();                                                // v20: the checkpoints by time, the bar's width for the grip
    S.force = true;
  }

  // v16: the canvas of the training figure covers the figure with a margin (its words are page elements, not drawn), at the
  // same density as before, instead of the whole stage: each frame clears and composites a fraction of the pixels
  function figCanvas(W, H, mob, R) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const [x0, y0, x1, y1] = MP.pxBox(R.x - 24, R.y - 40, R.x + R.w + 100, R.y + R.h + 40, W, H, dpr);
    const pw = Math.round((x1 - x0) * dpr), ph = Math.round((y1 - y0) * dpr);
    if (E.fig.width !== pw) E.fig.width = pw;
    if (E.fig.height !== ph) E.fig.height = ph;
    E.fig.style.left = x0 + "px"; E.fig.style.top = y0 + "px"; E.fig.style.width = x1 - x0 + "px"; E.fig.style.height = y1 - y0 + "px";
    S.fctx = E.fig.getContext("2d"); S.fctx.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
    S.fbox = [x0, y0, x1 - x0, y1 - y0]; S.figOn = false; S.fkey = "";
  }

  // ---------------------------------------------------------------- which steps are active
  const wOut = (p) => 1 - sm(p / 0.6), wIn = (p) => sm((p - 0.4) / 0.6);
  function beatAt(tau) { for (let i = NB - 1; i >= 0; i--) if (tau >= BEATS[i].start) return i; return 0; }
  // the autoplay film: step after step on one time line (test hook and the reference for the timing)
  function naturalEntries(tau) {
    const i = beatAt(tau), b = BEATS[i], L = tau - b.start;
    if (i > 0 && L < b.tin) {
      const p = L / b.tin, La = tau - BEATS[i - 1].start;
      // v20: as the autoplay (go): into the same group the old step fades out first, then the new one in
      if (b.dip) return p < 0.5 ? [{ b: i - 1, w: 1 - ease(p * 2), L: La, out: true }] : [{ b: i, w: ease(p * 2 - 1), L }];
      return [{ b: i - 1, w: wOut(p), L: La, out: true }, { b: i, w: wIn(p), L }];
    }
    return [{ b: i, w: 1, L }];
  }
  // v20: a jump to a time of the bar fades what is on screen out and the film at that time in (one weight over all)
  function jmpU() { return S.jmp ? clamp((S.wall - S.jmp.t0) / TIN, 0, 1) : 1; }
  function jmpMul() {
    const J = S.jmp; if (!J) return 1;
    const u = jmpU();
    return J.ph2 ? ease(clamp(2 * u - 1, 0, 1)) : J.m0 * (1 - ease(Math.min(1, 2 * u)));
  }
  function entries() {
    const E = entries0();
    if (!S.jmp) return E;
    const m = jmpMul();
    return E.map((e) => Object.assign({}, e, { w: e.w * m }));
  }
  function entries0() {
    if (S.natural) return naturalEntries(S.tau);
    const J = S.hand;
    if (!J) return [{ b: S.k, w: 1, L: S.now - S.stepT0 }];
    const u = clamp((S.now - J.t0) / J.dur, 0, 1), tb = BEATS[J.k], dt = S.now - J.t0;
    if (J.dip) {
      if (u < 0.5) return J.src.map((e) => ({ b: e.b, w: e.w * (1 - ease(u * 2)), L: e.L + dt, out: true }));
      return [{ b: J.k, w: ease(u * 2 - 1), L: tb.tin - J.dur * (1 - u) }];
    }
    return J.src.map((e) => ({ b: e.b, w: e.w * wOut(u), L: e.L + dt, out: true })).concat([{ b: J.k, w: wIn(u), L: tb.tin - J.dur * (1 - u) }]);
  }
  // go to step k: a hand-over from whatever is on screen now (instant with reduced motion)
  // v20: again = the step on screen from its start (back from a time between two checkpoints): it fades out and in again
  function go(k, again) {
    k = clamp(k, 0, NB - 1);
    if (k === S.k && !S.hand && !S.jmp && !S.natural && !again) return;
    const ft = shownTau(), src = entries();                        // v20: what is on screen now (a jump's fade included)
    if (S.natural) toEngine(S.tau);                                // v20: from the film back to the steps, its clocks kept
    S.jmp = null; S.drag = false;
    S.frozen = false; S.free = false;                              // v20: the step plays (paused: once, then it stands)
    // v14: leaving the opening, its clock stands still while it fades (so the loop does not begin a new movement under the
    // hand-over); back at the opening it runs again
    if (k !== 0 && S.k === 0 && !S.natural) S.openCap = Math.max(0, S.now - S.enter.open - 1e-3);
    if (k === 0) S.openCap = Infinity;
    S.natural = false;
    if (MP.REDUCED) { S.k = k; S.hand = null; S.stepT0 = S.now - BEATS[k].tin; S.force = true; return; }
    const g = BEATS[k].grp, dip = !!again || (src.some((e) => BEATS[e.b].grp === g && e.w > 0.01) && g !== "res");
    const from = src.reduce((a, e) => (e.w > a.w ? e : a), src[0]).b;
    S.hand = { src: src.map((e) => ({ b: e.b, w: e.w, L: e.L })), k, t0: S.now, dur: TIN, dip, restarted: false, back: k < from, ft, again: !!again };
    S.k = k; S.ended = false;
  }

  // ---------------------------------------------------------------- v20: the film and the time on the bar
  // the film at tau (the autoplay from the top as one time line, with the fades of go()): every clock as the autoplay has it
  // there. The test films (setTime), the finger on the bar and the second half of a jump draw it
  function filmAt(tau) {
    S.natural = true; S.hand = null;
    S.tau = clamp(tau, 0, TOTAL); S.now = S.tau;
    const ents = naturalEntries(S.tau);
    GROUPS.forEach((g) => {
      let w = 0, e = null;
      ents.forEach((x) => { if (BEATS[x.b].grp === g) { w += x.w; e = x; } });
      S.enter[g] = ENTER(e ? e.b : BEATS.findIndex((x) => x.grp === g)); S.gw[g] = w;
    });
  }
  // from the film at tau back to the steps: the step, its clock and, inside a hand-over, the rest of it as the film has it;
  // the group clocks stay as filmAt set them
  function toEngine(tau) {
    tau = clamp(tau, 0, TOTAL);
    const k = beatAt(tau), b = BEATS[k], L = tau - b.start;
    S.natural = false; S.k = k; S.stepT0 = b.start; S.now = tau;
    S.openCap = k ? PER - 1e-3 : Infinity;                         // the opening stands at its end while it fades (as the film)
    S.hand = k > 0 && L < b.tin ? { src: [{ b: k - 1, w: 1, L: BEATS[k - 1].dur }], k, t0: tau - L, dur: b.tin, dip: b.dip,
      restarted: false, back: false, ft: tau, auto: true } : null;
  }
  // the time the bar shows: the film's, a jump's or a hand-over's glide (ease in and out; the autoplay's own hand-over at the
  // pace of the clock), else the step's start and how far it has played
  function shownTau() {
    if (S.drag) return S.dragTau;
    if (S.jmp) return mix(S.jmp.ft, S.jmp.tgt, ease(jmpU()));
    if (S.natural) return S.tau;
    const b = BEATS[S.k], J = S.hand;
    if (J) {
      if (J.auto) return clamp(b.start + (S.now - J.t0), b.start, b.at);
      return mix(J.ft, b.at, ease(clamp((S.now - J.t0) / J.dur, 0, 1)));
    }
    return b.start + clamp(S.now - S.stepT0, 0, b.dur);
  }
  // the last checkpoint at or before tau
  function anchorAt(tau) { let j = 0; for (let i = 1; i < NB; i++) if (BEATS[i].at <= tau + 1e-3) j = i; return j; }
  // the checkpoint a gesture leads to: the next one, or back the previous one; from a time between two (set on the bar) back
  // is the start of the step on screen first
  function nextAnchor() { return S.free && shownTau() < BEATS[S.k].at - 0.05 ? S.k : S.k + 1; }
  function prevAnchor() { return S.free && shownTau() > BEATS[S.k].at + 0.05 ? S.k : S.k - 1; }
  // a jump to a time of the bar: what is on screen fades out, the film at that time fades in (playing into it, or standing
  // there when paused); then the steps go on from there
  function jumpTo(tau) {
    tau = clamp(tau, 0, TOTAL);
    if (!S.paused) { S.auto = !MP.REDUCED; S.ended = false; S.frozen = false; }
    if (MP.REDUCED || S.test) {
      filmAt(tau); toEngine(tau); S.jmp = null; S.free = true; player.state(); scrollTo(scrollStep(S.k)); S.force = true; wake(); return;
    }
    const ft = shownTau(), m0 = jmpMul();
    if (S.natural) toEngine(S.tau);
    S.drag = false;
    S.jmp = { t0: S.wall, tgt: tau, ft, m0, ph2: false, run: !S.paused };
    cueAt(S.jmp.run ? tau - 0.5 * TIN : tau);
    player.state();
    const k = beatAt(tau);
    scrollTo(scrollStep(k), true);
    wake();
  }
  // the bodies the film shows at tau wait at their frames while the jump's first half fades the old picture out (as draw()
  // poses them: the opening's movements on its clock, the generation, the training clip and its partner)
  function cueAt(tau) {
    tau = clamp(tau, 0, TOTAL);
    const ents = naturalEntries(tau), last = {};
    ents.forEach((e) => { if (e.w > 0.004) last[BEATS[e.b].grp] = e; });
    const clk = (g) => tau - ENTER(last[g].b);
    if (last.open) OPEN.forEach((ex, m) => {
      const ph = clk("open") - SL[m].s;
      if (ph >= 0 && ramp(ph, 0, XF) * (m === OPEN.length - 1 ? 1 : 1 - ramp(ph, SL[m].d, XF)) > 0.004) A.open[m].forEach((t) => t.cue(ph));
    });
    if (last.gen) A.gen.forEach((t) => t.cue(Math.max(0, clk("gen"))));
    if (last.train) {
      A.train[0].cue(Math.max(0, clk("train")));
      if (ents.some((e) => e.b === IDX.pair && e.w > 0.004)) A.partner.cue(Math.max(0, clk("train")));
    }
  }
  // one frame of a jump (step): its first half fades the steps out (they go on below), the second half is the film
  function jumpStep() {
    const J = S.jmp, u = jmpU();
    if (u < 0.5) return false;
    // the old picture is out: from here on the step on screen is that of the new time (a gesture now counts from there)
    if (!J.ph2) { J.ph2 = true; S.k = beatAt(J.tgt); S.free = true; }
    filmAt(J.tgt - (J.run ? (1 - u) * TIN : 0));
    if (u >= 1) {
      toEngine(J.tgt); S.jmp = null; S.free = true;
      if (S.paused) S.frozen = true;
    }
    return true;
  }
  // a finger (or the mouse) on the bar: the film follows it; let go, the steps play on from there (paused: it stands)
  function dragStart(tau) {
    S.jmp = null; S.drag = true; S.dragTau = clamp(tau, 0, TOTAL); filmAt(S.dragTau); S.force = true; wake();
  }
  function dragMove(tau) { S.dragTau = clamp(tau, 0, TOTAL); wake(); }
  function dragEnd() {
    if (!S.drag) return;
    S.drag = false;
    filmAt(S.dragTau); toEngine(S.dragTau); S.free = true;
    if (S.paused) S.frozen = true;
    else { S.frozen = false; S.auto = !MP.REDUCED; S.ended = false; }
    player.state();
    scrollTo(scrollStep(S.k), true);
    S.force = true; wake();
  }

  // ---------------------------------------------------------------- the page position follows the step
  const scrollStep = (k) => S.top0 + k * S.stepH;
  const pinEnd = () => S.top0 + (NB - 1) * S.stepH;              // the last position at which the stage still fills the screen
  const inStory = () => !!S.Lo && window.scrollY >= S.top0 - 2 && window.scrollY <= pinEnd() + 2;
  // v16: the frame reads the page position from the last scroll event (SY) instead of asking the page, so a frame never forces
  // a style recalc for it (scroll events come before the frame callbacks)
  let SY = window.scrollY;
  const inStoryAt = (y) => !!S.Lo && y >= S.top0 - 2 && y <= pinEnd() + 2;
  // v20: anim: the page's own scroll to a step inside the story, one movement (ease in and out) as long as the hand-over, in a
  // frame loop of its own on the wall clock (it also runs while the story is paused or its frames stop); from or to the page
  // below the story (the links, back to the top) it scrolls as before
  const SA = { raf: 0 };
  function stopAnim() { if (SA.raf) { cancelAnimationFrame(SA.raf); SA.raf = 0; } }
  function scrollTo(y, anim) {
    const max = Math.max(0, doc.documentElement.scrollHeight - window.innerHeight);
    y = Math.round(clamp(y, 0, max));
    stopAnim();
    S.prog = { y, t: performance.now() };
    if (MP.REDUCED || S.test) { window.scrollTo({ top: y, behavior: "auto" }); SY = window.scrollY; return; }
    const y0 = window.scrollY;
    if (anim && inStoryAt(y0) && inStoryAt(y)) {
      if (Math.abs(y - y0) < 1) return;                           // already there (progDone lets it go)
      const p = S.prog; p.anim = true;
      let t0 = -1;
      const f = (t) => {
        if (t0 < 0) t0 = t;
        const u = clamp((t - t0) / (TIN * 1000), 0, 1);
        window.scrollTo({ top: Math.round(mix(y0, y, ease(u))), behavior: "auto" });
        if (u < 1) SA.raf = requestAnimationFrame(f);
        else { SA.raf = 0; SY = window.scrollY; if (S.prog === p) S.prog = null; }
      };
      SA.raf = requestAnimationFrame(f);
      return;
    }
    window.scrollTo({ top: y, behavior: "smooth" });
  }
  // a programmatic scroll has arrived (or has stopped elsewhere: no scroll for 1 s, or it is given up after 8 s)
  function progDone() {
    const p = S.prog;
    if (p) {
      const now = performance.now();
      if (Math.abs(SY - p.y) <= 3 || now - p.t > 8000 || (now - p.t > 1000 && now - (p.last || p.t) > 1000)) S.prog = null;
    }
    return !S.prog;
  }
  // a page moved some other way (scroll bar, a link, the coasting of a touch swipe): the step follows, one per hand-over
  function fromScroll() {
    if (S.drag || S.jmp || S.natural) return;                     // v20: the bar has the story (a finger, a jump)
    if (!progDone()) return;                                      // on its way: the step was already chosen
    if (S.hand) return;                                           // one step per hand-over
    const x = (SY - S.top0) / S.stepH;
    if (x < -0.5 || x > NB - 0.5) return;                        // the page above or below the story
    if (Math.abs(x - S.k) > 0.62) go(S.k + Math.sign(Math.round(clamp(x, 0, NB - 1)) - S.k));
  }
  // v14: back to the page position of the step on screen (or of the nearest step, if the page is far from it)
  function snapNear() {
    if (S.prog && !progDone()) return;                            // v20: the page is on its way to a step already
    const x = (window.scrollY - S.top0) / S.stepH;
    let k = S.k;
    if (Math.abs(x - S.k) > 0.62) { k = clamp(Math.round(x), 0, NB - 1); go(k); }
    const y = Math.round(scrollStep(k));
    if (Math.abs(window.scrollY - y) > 3 && !(S.prog && S.prog.y === y)) scrollTo(y, true);
  }
  // v14: from the last step on to the examples (a gesture down, the player's forward button, the hint)
  function toOthers() {
    const el = $("others");
    S.auto = false; S.ended = true; player.state();
    if (el) scrollTo(el.getBoundingClientRect().top + window.scrollY);
    wake();
  }
  // v14: one gesture, one step. Down starts the autoplay when it is off and otherwise skips to the next step (after the last
  // step: the examples); up goes one step back. The autoplay plays on after every gesture (reduced motion: no autoplay, the
  // gesture only changes the step). Nothing acts again within LOCK (the hand-over and the page scroll of a step); t is the time
  // the input was made (its event's timeStamp), so a busy frame that delays the events does not change what counts.
  // v20: paused, a gesture only moves a step (the autoplay stays off until Play); the steps are the checkpoints of the bar (from a
  // time between two, set on the bar, back goes to the start of the step on screen first)
  function act(dir, t) {
    t = t || performance.now();
    if ((t < S.lock && t > S.lock - 2 * LOCK) || S.hold || S.test || S.drag) return false;
    S.lock = t + LOCK; S.acts++;
    if (dir > 0) {
      const j = nextAnchor();
      if (j > NB - 1) toOthers();
      else if (!S.auto && !MP.REDUCED && !S.paused) { S.auto = true; S.ended = false; player.state(); snapNear(); wake(); }
      else toStep(j);
    } else {
      const j = prevAnchor();
      if (j >= 0) toStep(j, j === S.k);
      else { if (!MP.REDUCED && !S.paused) { S.auto = true; S.ended = false; player.state(); } snapNear(); wake(); }
    }
    return true;
  }

  // wheel and trackpad: events in one direction without a pause longer than W_GAP are one gesture. Inside the story every event
  // is the story's (the page does not scroll by itself); the first acts, the rest (a trackpad coasting) is spent, unless a new
  // push begins in it after the lock. A gesture that began outside the story scrolls the page up to the story's edge, no
  // further. After the last step a gesture down leads to the examples; from there on the page scrolls as usual.
  // a new push: the speed of the wheel (px per ms, so it does not matter how many events the browser merged into one) rises
  // clearly above the slowest speed just before it
  const WH = { t: -1e9, dir: 0, mode: "", sum: 0, h: [], tf: 0 };
  const pushing = (h) => {
    const n = h.length; if (n < 4) return false;
    const a = (h[n - 1] + h[n - 2]) / 2, b = Math.min(...h.slice(0, n - 2));
    return h[n - 1] > h[n - 2] && a > Math.max(0.9, 2.2 * b + 0.25);
  };
  window.addEventListener("wheel", (e) => {
    if (e.ctrlKey || !S.Lo || S.hold || S.test) return;           // pinch zoom on a trackpad, no story, or a test film
    const f = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1, dy = e.deltaY * f, dx = e.deltaX * f;
    if (!dy || Math.abs(dy) <= Math.abs(dx)) return;              // sideways: not a step
    // the time the input was made, not the time it is handled: a busy frame must not split one gesture into two
    const now = e.timeStamp || performance.now(), dir = dy > 0 ? 1 : -1, inside = inStory();
    const gap = now - WH.t;
    if (gap > W_GAP || gap < 0 || dir !== WH.dir) { WH.dir = dir; WH.mode = inside ? "arm" : "out"; WH.sum = 0; WH.h.length = 0; }
    WH.sum += Math.abs(dy); WH.h.push(Math.abs(dy) / Math.max(8, WH.h.length && gap > 0 ? gap : 16)); if (WH.h.length > 8) WH.h.shift();
    WH.t = now;
    if (SA.raf) e.preventDefault();                               // v20: the page's own scroll to a step runs: the wheel does not fight it
    if (WH.mode === "free") return;
    if (WH.mode === "out") {
      if (!inside) { if (!SA.raf) S.prog = null; return; }        // outside the story: the page scrolls as usual
      e.preventDefault(); if (!SA.raf) snapNear(); return;        // at the story's edge: no further
    }
    e.preventDefault();
    if (WH.mode === "arm") { if (WH.sum >= W_MIN) { WH.mode = "done"; WH.tf = now; act(dir, now); } return; }
    if (now - WH.tf > LOCK && pushing(WH.h)) {                    // a new push while the old one still coasts
      WH.tf = now; WH.h.length = 0;
      if (inStory()) act(dir, now); else { WH.mode = "free"; S.prog = null; }
    }
  }, { passive: false });

  // touch: one swipe, one step, by the same rules; a swipe that began outside the story scrolls the page as usual (and stops
  // at the story's last step, see the scroll handler)
  const TC = { id: null, x0: 0, y0: 0, fired: false, out: false, end: -1e9 };
  window.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { TC.id = null; return; }
    // v20: a finger on the bar scrubs the film (the bar's pointer events), it is no swipe of the story
    if (e.target && e.target.closest && e.target.closest("#pl-track")) { TC.id = null; return; }
    const t = e.touches[0];
    TC.id = t.identifier; TC.x0 = t.clientX; TC.y0 = t.clientY; TC.fired = false; TC.out = !inStory();
    if (TC.out) { S.prog = null; stopAnim(); }
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (TC.id === null || TC.out || !S.Lo) return;
    if (e.touches.length !== 1) { TC.id = null; return; }       // a pinch is the browser's
    if (!inStory() && !TC.fired) return;
    if (e.cancelable) e.preventDefault();
    if (TC.fired) return;
    const t = e.touches[0], dy = TC.y0 - t.clientY, dx = TC.x0 - t.clientX;
    if (Math.abs(dy) >= T_MIN && Math.abs(dy) > Math.abs(dx)) { TC.fired = true; act(dy > 0 ? 1 : -1, e.timeStamp); }
  }, { passive: false });
  const touchEnd = () => { TC.id = null; TC.end = performance.now(); };
  window.addEventListener("touchend", touchEnd, { passive: true });
  window.addEventListener("touchcancel", touchEnd, { passive: true });

  // keys: inside the story the arrow and page keys (and space on the page) are scroll gestures; Home goes to the top
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !S.Lo || S.hold || S.test) return;
    const tg = e.target, tag = (tg && tg.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (tg && tg.isContentEditable)) return;
    const page = tg === doc.body || tg === doc.documentElement || tg === stage;
    if (e.key === "Home" && page) { e.preventDefault(); toTop(); return; }
    if (!inStory() || !(page || stage.contains(tg))) return;
    let dir = 0;
    if (e.key === "ArrowDown" || e.key === "PageDown") dir = 1;
    else if (e.key === "ArrowUp" || e.key === "PageUp") dir = -1;
    else if (e.key === " " && tg !== stage && page) dir = e.shiftKey ? -1 : 1;
    if (!dir) return;
    e.preventDefault();
    if (!e.repeat) act(dir, e.timeStamp);
  });

  // the page scrolled: the step follows (in the frame loop), a scroll from below stops at the story's edge, leaving the story
  // downwards ends the autoplay, the top bar, and after a pause the page settles at the position of its step
  let lastY = window.scrollY, settleT = 0, ptr = false;
  window.addEventListener("pointerdown", () => { ptr = true; }, { passive: true });
  ["pointerup", "pointercancel", "blur"].forEach((ev) => window.addEventListener(ev, () => { ptr = false; }, { passive: true }));
  window.addEventListener("scroll", () => {
    SY = window.scrollY;
    S.scrolled = true; wake();
    navSync(SY);
    if (!S.Lo || S.hold || S.test) return;
    let y = window.scrollY; const pe = pinEnd(), mine = !!S.prog;
    if (S.prog) S.prog.last = performance.now();
    progDone();
    // the page scrolled on its own from below into the story (wheel, touch coasting, keys): it stops at the story's last step
    // (never a scroll of the page itself, also not one that arrived at once); for a moment the edge stays guarded. The
    // coasting of a touch swipe goes on by itself: for two frames the page cannot scroll, which ends it (touch only, so a
    // desktop scroll bar never blinks).
    const now = performance.now(), guard = now - S.wallT < 700;
    if (!mine && !ptr && y < pe - 2 && (lastY > pe + 2 || (guard && lastY >= pe - 2))) {
      if (TC.id !== null || now - TC.end < 1500) {
        const html = doc.documentElement;
        html.style.overflow = "hidden";
        requestAnimationFrame(() => requestAnimationFrame(() => { html.style.overflow = ""; }));
      }
      window.scrollTo({ top: pe, behavior: "auto" }); y = pe; SY = window.scrollY; S.wallT = now;
      if (S.k !== NB - 1) go(NB - 1);
    }
    lastY = y;
    if (S.auto && !S.prog && y > pe + 0.3 * S.stepH) { S.auto = false; player.state(); }
    clearTimeout(settleT); settleT = setTimeout(settle, 160);
  }, { passive: true });
  function settle() { if (S.Lo && !S.prog && TC.id === null && !ptr && !S.hold && !S.test && !S.drag && !S.jmp && inStory()) snapNear(); }

  // v14: the top bar, in once the head of the story has gone (from the second step on, and below the story)
  let navOn = false;
  function navSync(y) {
    if (!NAV) return;
    const on = (y == null ? window.scrollY : y) > pinEnd() + 8 || S.hdW < 0.5;
    if (on !== navOn) { navOn = on; NAV.classList.toggle("on", on); }
  }

  // ---------------------------------------------------------------- one frame
  function loopT(t, dur, rest) {
    const cyc = dur + rest, p = ((t % cyc) + cyc) % cyc;
    if (p < dur) return [p, p, 0];
    return [dur - 1e-3, 0, sm((p - dur) / rest)];
  }

  // v13: the signal that the page goes on below, after the last step has played
  const HINT = $("more-hint");
  if (HINT) HINT.addEventListener("click", (e) => { e.preventDefault(); toOthers(); });
  let hintOn = false;
  function hintUpdate(ents) {
    if (!HINT) return;
    const e = ents.find((x) => x.b === NB - 1 && x.w > 0.99);
    const on = !!e && (MP.REDUCED || S.ended || e.L >= BEATS[NB - 1].dur - 0.05);
    if (on !== hintOn) { hintOn = on; HINT.classList.toggle("on", on); HINT.setAttribute("aria-hidden", on ? "false" : "true");
      HINT.tabIndex = on ? 0 : -1; }
  }

  const W8 = new Float64Array(NB), LB = new Float64Array(NB), TO = new Int8Array(NB);
  function draw() {
    const D = S.D, Lo = S.Lo; if (!D || !Lo) return;
    const sy = SY;                                                // v16: the position of the last scroll event (no forced recalc)
    const ents = entries();
    hintUpdate(ents);
    W8.fill(0); LB.fill(0); TO.fill(0);
    ents.forEach((e) => { W8[e.b] += e.w; LB[e.b] = e.L; if (!e.out) TO[e.b] = 1; else if (!TO[e.b]) TO[e.b] = -1; });
    if (!S.natural) GROUPS.forEach((g) => {                         // v20: the film sets its group clocks itself (filmAt)
      let w = 0; ents.forEach((e) => { if (BEATS[e.b].grp === g) w += e.w; });
      if (w > 0.0005 && S.gw[g] <= 0.0005) S.enter[g] = S.now;
      S.gw[g] = w;
    });
    const gt = (g) => (MP.REDUCED ? RED[g] : S.now - S.enter[g]);
    // v17: the videos play while the clock runs by itself (not while a test film holds or steps it, nor with reduced motion).
    // v20: nor while paused (each video holds its frame) or while a finger on the bar sets the time (they follow it frame by frame)
    const RUN = S.visible && !S.hold && !S.test && !MP.REDUCED && !S.frozen && !S.drag && !(S.jmp && S.jmp.ph2 && !S.jmp.run);
    const MODE = S.drag ? "scrub" : S.frozen ? "hold" : undefined;
    place(E.hd, 0, Lo.hdY - (1 - W8[0]) * 10, W8[0]);
    st(E.hd, "pointerEvents", W8[0] > 0.5 ? "auto" : "none");
    // v16: a title flows in with its step and out with it: the step that comes in rises from a little below, the one that goes
    // rises on and out (going back, the other way round)
    const back = !S.natural && S.hand && S.hand.back ? -1 : 1;
    E.titles.forEach((t, i) => place(t, 0, Lo.ty[i] + (1 - W8[i]) * Lo.flow * (TO[i] < 0 ? -1 : 1) * back, W8[i]));

    // the opening: the movements one after the other in a loop, each an overlay of its values with guides
    const wo = W8[0], go_ = MP.REDUCED || S.natural ? gt("open") : Math.min(gt("open"), S.openCap);
    const wGen = W8[IDX.gen];
    // v20: the top bar follows the opening as it is without a jump's fade, and stays off while the opening starts again
    S.hdW = S.hand && S.hand.again && S.hand.k === 0 ? 1 : S.jmp ? entries0().reduce((a, e) => a + (e.b === 0 ? e.w : 0), 0) : wo;
    navSync(sy);
    const OW = [], OPH = [];
    OPEN.forEach((ex, m) => {
      // phase of movement m since it began to fade in; the film plays one cycle, the page loops (v14: each movement its own length)
      let ph = go_ - SL[m].s, wm;
      if (ph < 0) wm = 0;
      else if (S.natural) wm = ramp(ph, 0, XF) * (m === OPEN.length - 1 ? 1 : 1 - ramp(ph, SL[m].d, XF));
      else { ph = ph % PER; wm = ramp(ph, 0, XF) * (1 - ramp(ph, SL[m].d, XF)); }
      OW[m] = wo * wm; OPH[m] = ph;
    });
    // v17: the opacity of each movement's videos: v16 drew a later movement over an earlier one in the same tiles, each at its
    // weight; an opaque video above covers the one below by its opacity, so the one below shows at w / (what is left of it)
    // (?xfade=plain: each at its own weight, which keeps v16's look where both bodies overlap but lets the earlier one fade
    // faster where it is alone)
    let cover = 1; const OOP = OW.slice();
    if (!XPLAIN) for (let m = OPEN.length - 1; m >= 0; m--) { if (OW[m] <= 0.004) continue; OOP[m] = Math.min(1, OW[m] / Math.max(1e-3, cover)); cover *= 1 - OOP[m]; }
    const runO = RUN && !(MP.REDUCED || S.natural ? false : gt("open") > S.openCap);
    OPEN.forEach((ex, m) => {
      const w = OW[m], ph = OPH[m];
      row(V.open[m], A.open[m], LBL.open[m], w, ph, S.labY.open, OOP[m], runO, MODE);
      const lb = LN.open[m], wg = m === S.genLines ? wGen : 0, ww = w + wg;
      place(lb.el, (Lo.W - lb.w) / 2, ww > 0 ? (w * Lo.oLinesY + wg * Lo.linesY) / ww : Lo.oLinesY, ww);
      guides(GD[m], V.open[m], w);
    });
    if (LN.gen) place(LN.gen.el, (Lo.W - LN.gen.w) / 2, Lo.linesY, wGen);

    // generation: the example again, side by side, its clock starts when the step comes in
    row(V.gen, A.gen, LBL.gen, wGen, gt("gen"), S.labY.gen, wGen, RUN, MODE);
    guides(GDG, V.gen, wGen);

    // training: the clip body, the pair of captions, the curves
    const wtr = W8[IDX.pair] + W8[IDX.recon] + W8[IDX.loss];
    // v17: the clip's video is one loop of v16's (2.2 s of the clip, 0.5 s back to its start), the camera on its pelvis
    const tc = loopT(Math.max(0, gt("train")), 2.2, 0.5);
    A.train[0].set(wtr, Math.max(0, gt("train")), RUN, MODE);
    // the partner in the step of the minimal pair, on the same clock; the wrist heights on both bodies
    const wp = W8[IDX.pair];
    A.partner.set(wp, Math.max(0, gt("train")), RUN, MODE);
    const LM = S.D.man.train.landmarks, wh = W8[IDX.recon] + W8[IDX.loss];
    const hl = (el, lab, v, z, a) => {
      const y = v.project([v.anc[0], v.anc[1], z], [0, 0])[1], x0 = v.rect.x + v.rect.w * 0.18, x1 = v.rect.x + v.rect.w * 0.82;
      hline(el, x0, x1, y, a * 0.85); place(lab, x1 + 4, y - 9, a);
    };
    hl(E.hl.clipS, E.hl.lS, V.train, LM["00844"].shoulder, wtr);
    hl(E.hl.clipH, E.hl.lH, V.train, LM["00844"].hip, wh);
    hl(E.hl.partH, E.hl.lP, V.partner, LM["02158"].hip, wp);
    const fy = (v) => (Lo.mob ? v.rect.y - 4 : v.project([v.anc[0], v.anc[1], 0], [0, 0])[1] + 0.2 * v.S);      // under the feet (phone: above the head)
    place(E.hl.lClip, V.train.rect.x + V.train.rect.w / 2 - 12, fy(V.train), wp); place(E.hl.lPart, V.partner.rect.x + V.partner.rect.w / 2 - 22, fy(V.partner), wp);
    const pl = LN.pair;
    place(pl.el, (Lo.W - pl.w) / 2, Lo.linesY, wtr);
    const neg = W8[IDX.pair] * ramp(LB[IDX.pair], 1.1, 0.5) + W8[IDX.recon] + W8[IDX.loss];
    const nn = clamp(neg / Math.max(wtr, 1e-4), 0, 1);
    st(pl.ls[1], "opacity", String(Math.round(nn * 100) / 100));
    st(pl.ls[1], "transform", "translate3d(0," + f1((1 - nn) * -10) + "px,0)");
    figure(W8, LB, wtr, tc);

    // results: the same drawings as before, built up about twice as fast, right after the hand-over
    const i1 = IDX.r1, wr = W8[i1] + W8[i1 + 1] + W8[i1 + 2];
    if (wr > 0.002) {
      const Pk = (W8[i1] * ramp(LB[i1], 0.2, 1.1) + W8[i1 + 1] * (1 + ramp(LB[i1 + 1], 0.15, 1.6)) + W8[i1 + 2] * (2 + ramp(LB[i1 + 2], 0.15, 1.6))) / wr;
      MP.chart.draw(Pk, 0);
    } else MP.chart.draw(0, 0);
    st(E.chart, "opacity", String(Math.round(clamp(wr, 0, 1) * 100) / 100));

    const bi = ents.reduce((a, e) => (e.w > a.w ? e : a), ents[0]).b;
    if (bi !== S.lastBeat) { S.lastBeat = bi; if (live) live.textContent = BEATS[bi].title; E.titles.forEach((t, i) => t.setAttribute("aria-hidden", i === bi ? "false" : "true")); }
    player.show(shownTau());
  }

  // thin guides at the named landmark of each body (its standing knee, hip, shoulder, head), in the tone of its word
  // (one guide per body, across its own tile, the landmark word small above the line at the tile's right end)
  function guides(G, vs, w) {
    G.forEach((g, k) => {
      if (!g) return;
      if (w <= 0.004) { hline(g.ln, 0, 1, 0, 0); place(g.lab, 0, 0, 0); return; }
      const v = vs[k], y = v.project([0, 0, g.z], [0, 0])[1], x0 = v.rect.x + v.rect.w * 0.1, x1 = v.rect.x + v.rect.w * 0.9;
      hline(g.ln, x0, x1, y, w * 0.8);
      place(g.lab, x1 - (g.labW || 40), y - 17, w);
    });
  }
  // one row of bodies, each in its own tile, with its word under it (v17: op, the opacity of the videos, may differ from w)
  function row(vs, ts, labs, w, t, labY, op, run, mode) {
    ts.forEach((tl, k) => {
      const v = vs[k];
      // a row plays its clip once and then holds the last frame (no fast blend back to the start inside a movement)
      tl.set(w > 0.004 ? op : 0, t, run, mode);
      const lw = labs[k].__w || 0, fy = v.rect.y + v.rect.h / 2 - (v.__v0 - v.vc) * v.S + 4;   // under the lowest point the feet reach in the clip
      place(labs[k], clamp(v.rect.x + v.rect.w / 2 - lw / 2, 4, S.Lo.W - lw - 4), Math.min(labY, fy), w);
    });
  }
  // fit rows of tiles: one scale for all, one floor line, each body centred in its tile
  function fitRows(rows) {
    // one scale per example (so a wide kick does not shrink the others), one floor line per row; on a phone a body may
    // reach a little into the next tile, its reach is short in time
    const o = { mx: 0.1, top: 0.1, bot: 0.06 }, spread = S.Lo && S.Lo.mob ? 1.25 : 1;
    return rows.map((r) => {
      const exs = r.ex.values.map((v) => v.ext);                  // v17: the extents of v16's motion.extent(B, [0, 0])
      let Sc = Infinity, v0 = Infinity, v1 = -Infinity;
      exs.forEach((e, k) => { Sc = Math.min(Sc, r.rects[k].w * spread / Math.max(0.5, e.h1 - e.h0 + 2 * o.mx)); v0 = Math.min(v0, e.v0); v1 = Math.max(v1, e.v1); });
      Sc = Math.min(Sc, r.rects[0].h / Math.max(1.0, v1 - v0 + o.top + o.bot));
      return r.rects.map((rc, k) => {
        const v = new MP.View(r.ex.view); v.rect = rc; v.anc = [0, 0]; v.S = Sc; v.__v0 = v0;
        v.hc = (exs[k].h0 + exs[k].h1) / 2; v.vc = (v0 - o.bot + v1 + o.top) / 2; v.floorR = 1.6; return v;
      });
    });
  }

  // the training step as curves (Fig. 2 of the paper): left wrist height over the first 2.2 s of the clip
  function figure(W8, LB, wtr, tc) {
    const ctx = S.fctx, Lo = S.Lo, R = Lo.figR, Tn = S.D.man.train, wr = Tn.wrist, C = MP.col();
    const labs = E.labs;
    if (wtr <= 0.004) {
      if (S.figOn) { ctx.clearRect(0, 0, Lo.W, Lo.H); S.figOn = false; }
      st(E.fig, "visibility", "hidden"); labs.forEach((l) => place(l, 0, 0, 0)); place(E.winLab, 0, 0, 0); return;
    }
    st(E.fig, "visibility", "visible"); S.figOn = true;
    ctx.clearRect(0, 0, Lo.W, Lo.H);
    const P1 = IDX.pair, P2 = IDX.recon, P3 = IDX.loss;
    const p = (f) => { let s = 0, ws = 0; for (let b = P1; b <= P3; b++) if (W8[b] > 0) { s += W8[b] * f(b, LB[b]); ws += W8[b]; } return ws ? s / ws : 0; };
    const draw_ = p((b, L) => (b === P1 ? ramp(L, 0.1, 0.9) : 1));
    const noise = p((b, L) => (b === P1 ? 0 : b === P2 ? ramp(L, 0.1, 0.6) : 1));
    const rec = p((b, L) => (b === P1 ? 0 : b === P2 ? ramp(L, 0.8, 0.9) : 1));
    const gap = p((b, L) => (b === P1 ? 0 : b === P2 ? ramp(L, 1.8, 0.5) : 1));
    const bar = p((b, L) => (b < P3 ? 0 : ramp(L, 0.1, 1.4)));
    const tag = p((b, L) => (b < P3 ? 0 : ramp(L, 1.4, 0.5)));
    // on a phone the curves give a little more room to the bars, so the labels of the bars and the bracket fit beside them
    const n = 44, wf = Tn.window_frames, plotW = R.w * mix(1, Lo.mob ? 0.52 : 0.56, bar);
    const X = (i) => R.x + (i / (n - 1)) * plotW, Y = (z) => R.y + R.h - ((z - 0.6) / (1.9 - 0.6)) * R.h;
    const A_ = wtr;
    ctx.globalAlpha = A_; ctx.fillStyle = C.bg3; ctx.fillRect(X(wf[0]), R.y - 4, X(wf[1] + 1) - X(wf[0]), R.h + 8);
    ctx.strokeStyle = C.ink3; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
    [Tn.guides.shoulder, Tn.guides.hip].forEach((z) => { ctx.beginPath(); ctx.moveTo(R.x, Y(z)); ctx.lineTo(R.x + plotW, Y(z)); ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.globalAlpha = A_ * 0.6; ctx.beginPath(); ctx.moveTo(R.x, R.y + R.h + 4); ctx.lineTo(R.x + plotW, R.y + R.h + 4); ctx.strokeStyle = C.line; ctx.stroke();
    const path = (f, upto) => { ctx.beginPath(); const m_ = Math.max(1, Math.round(upto * (n - 1))); for (let i = 0; i <= m_; i++) { const z = f(i); i ? ctx.lineTo(X(i), Y(z)) : ctx.moveTo(X(i), Y(z)); } };
    const fx = (i) => mix(wr.x[i], wr.noisy[i], noise * (1 - rec));
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.globalAlpha = A_; ctx.strokeStyle = C.ink3; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    if (noise > 0) { ctx.globalAlpha = A_ * noise; path((i) => wr.x[i], 1); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.globalAlpha = A_ * (1 - 0.75 * rec); ctx.strokeStyle = noise > 0 ? C.ink2 : C.ink; ctx.lineWidth = noise > 0 ? 1.4 : 2.2;
    path(fx, draw_); ctx.stroke();
    if (rec > 0) {
      ctx.globalAlpha = A_ * Math.min(1, rec * 1.6); ctx.lineWidth = 2.2;
      ctx.strokeStyle = C.ink; path((i) => mix(wr.noisy[i], wr.true[i], rec), 1); ctx.stroke();
      ctx.strokeStyle = C.accent; path((i) => mix(wr.noisy[i], wr.neg[i], rec), 1); ctx.stroke();
    }
    const poly = (a, b) => { const pts = []; for (let i = wf[0]; i <= wf[1]; i++) pts.push([X(i), Y(a[i])]); for (let i = wf[1]; i >= wf[0]; i--) pts.push([X(i), Y(b[i])]); return pts; };
    const bx0 = R.x + R.w * (Lo.mob ? 0.6 : 0.66), bw = Math.min(46, R.w * 0.11), base = R.y + R.h, hmax = R.h * 0.78, em = Math.max(Tn.e_true, Tn.e_neg);
    const rectPts = (x, h, cnt) => { const pts = [], hc = cnt / 2; for (let i = 0; i < hc; i++) pts.push([x + (i / (hc - 1)) * bw, base - h]); for (let i = hc - 1; i >= 0; i--) pts.push([x + (i / (hc - 1)) * bw, base]); return pts; };
    const sets = [[wr.true, Tn.e_true, C.ink, 0.16, bx0], [wr.neg, Tn.e_neg, C.accent, 0.24, bx0 + bw * 2.2]];
    if (gap > 0) sets.forEach(([cur, e, col, fa, bx]) => {
      const pa = poly(cur, wr.x), pb = rectPts(bx, (e / em) * hmax, pa.length), k = ease(bar);
      ctx.fillStyle = col; ctx.globalAlpha = A_ * gap * mix(fa * 2.2, 0.9, k);
      ctx.beginPath(); pa.forEach((q, i) => { const x = mix(q[0], pb[i][0], k), y = mix(q[1], pb[i][1], k); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill();
    });
    const hT = (Tn.e_true / em) * hmax, hN = (Tn.e_neg / em) * hmax, bxN = bx0 + bw * 2.2;
    if (tag > 0) {
      ctx.globalAlpha = A_ * tag; ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.2;
      const xb = bxN + bw + 12;
      ctx.beginPath(); ctx.moveTo(bx0 + bw + 4, base - hT); ctx.lineTo(xb, base - hT); ctx.lineTo(xb, base - hN); ctx.lineTo(bxN + bw + 4, base - hN); ctx.stroke();
    }
    const ci = clamp((tc[2] > 0 ? mix(tc[0], 0, tc[2]) : tc[0]) * 20, 0, n - 1), cz = mix(wr.x[Math.floor(ci)], wr.x[Math.min(n - 1, Math.ceil(ci))], ci % 1);
    ctx.globalAlpha = A_ * (1 - noise) * draw_; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(R.x + (ci / (n - 1)) * plotW, Y(cz), 3.5, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    const lw = S.labW;
    place(E.winLab, X(wf[0]), R.y - 26, A_);
    place(labs[0], R.x + plotW + 6, Y(wr.x[n - 1]) - 9, A_ * noise * (1 - rec) * (1 - bar));
    place(labs[1], R.x + plotW + 6, Y(wr.true[n - 1]) - 22, A_ * rec * (1 - bar));
    place(labs[2], R.x + plotW + 6, Y(wr.neg[n - 1]) + 4, A_ * rec * (1 - bar));
    if (Lo.mob) { place(labs[3], R.x + plotW - lw[3], Y(Tn.guides.shoulder) - 18, A_); place(labs[4], R.x + plotW - lw[4], Y(Tn.guides.hip) - 18, A_); }
    else { place(labs[3], R.x - lw[3] - 8, Y(Tn.guides.shoulder) - 9, A_); place(labs[4], R.x - lw[4] - 8, Y(Tn.guides.hip) - 9, A_); }
    const lh = Lo.mob ? 36 : 18;                                   // one line of the labels, two on a phone
    place(labs[5], bx0 + bw / 2 - lw[5] / 2, base - hT - 6 - lh, A_ * tag);
    place(labs[8], clamp(bxN + bw / 2 - lw[8] / 2, 4, Lo.W - lw[8] - 4), base - hN - 6 - lh, A_ * tag);
    place(labs[6], bxN + bw + 18, base - (hT + hN) / 2 - lh / 2, A_ * tag);
    place(labs[7], bx0 - 4, base + 10, A_ * ease(bar));
  }

  // ---------------------------------------------------------------- the clock
  let raf = 0, last = 0;
  function step(dt) {
    S.wall += dt;
    // v20: a finger on the bar: the film at its time, nothing else moves; the second half of a jump: the film runs into its time
    if (S.drag) { filmAt(S.dragTau); return; }
    if (S.jmp && jumpStep()) return;
    // v20: paused, the clock stands; a step played while paused stands at its end (the opening on its own clock, so it never
    // begins its next round)
    if (S.frozen) dt = 0;
    else if (S.paused && !S.hand && !S.jmp) {
      let rest = BEATS[S.k].dur - (S.now - S.stepT0);
      if (S.k === 0) rest = Math.min(rest, PER - 1e-3 - (S.now - S.enter.open));
      if (dt >= rest) { dt = Math.max(0, rest); S.frozen = true; }
    }
    S.now += dt;
    // v16: while the last step stands still (its chart built, or the autoplay at its end), the grid below makes its renderer
    // (a task of its own after this frame; it would hold up any frame that moves)
    if (!S.gridPrep && S.Lo && S.k === NB - 1 && !S.hand && (S.ended || MP.REDUCED || S.now - S.stepT0 >= BEATS[NB - 1].tin + 1.9) && MP.grid && MP.grid.prepare) {
      S.gridPrep = true; setTimeout(() => MP.grid.prepare(), 0);
    }
    if (S.scrolled) { S.scrolled = false; fromScroll(); }
    if (S.hand && S.now - S.hand.t0 >= S.hand.dur) { S.stepT0 = S.now - BEATS[S.hand.k].tin; S.hand = null; fromScroll(); }
    // autoplay: when a step has played, go to the next one and scroll there
    // (v14: only while the page is in the story or on its way to a step, so the autoplay never pulls a visitor back from below)
    if (S.auto && !S.hand && !S.jmp && S.visible && (inStoryAt(SY) || S.prog)) {
      const L = S.now - S.stepT0;
      if (L >= BEATS[S.k].dur) {
        if (S.k < NB - 1) { go(S.k + 1); if (S.hand) S.hand.auto = true; scrollTo(scrollStep(S.k), true); }
        else { S.auto = false; S.ended = true; player.state(); }    // stops on the last step, the hint shows the way on
      }
    }
  }
  function frame(t) {
    raf = 0;
    if (S.test || S.hold) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
    if (S.visible) step(dt);
    // grid fix: the stage is drawn only while a part of it is on screen. At the top of the examples (where the link, the hint and
    // the last gesture lead) the stage's lower edge touches the screen's upper one: the observer still calls it visible, and the
    // stage went on drawing there beside the grid (v17: its videos stop there)
    const onScr = !S.Lo || SY < S.top0 + NB * S.stepH - 1;
    if (!onScr && S.onScr !== false && S.Lo) MP.media.pauseAll(storyTiles());
    S.onScr = onScr;
    if ((S.visible || S.force) && onScr && (S.force || !CAP || t - (S.lastDraw || 0) >= CAP)) { S.force = false; S.lastDraw = t; draw(); }
    if (S.visible && !MP.REDUCED) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf && !S.test && !S.hold) { last = 0; raf = requestAnimationFrame(frame); } }
  const storyTiles = () => (A.open ? A.open.flat().concat(A.gen, A.train, [A.partner]) : []);

  // ---------------------------------------------------------------- the player bar
  const player = (() => {
    const track = $("pl-track"), fill = $("pl-fill"), tip = $("pl-tip"), btn = $("pl-play");
    const ICON = { play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.5v11l9-5.5z" fill="currentColor"/></svg>',
      pause: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="4.5" width="3.4" height="11" rx="1" fill="currentColor"/><rect x="11.6" y="4.5" width="3.4" height="11" rx="1" fill="currentColor"/></svg>',
      again: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 10a5.5 5.5 0 1 1-1.6-3.9M15.5 3.5v3.2h-3.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' };
    // v20: the bar is the story's time: each checkpoint stands at the moment its step is in (start and hand-over)
    const pos = (i) => (100 * BEATS[i].at / TOTAL).toFixed(3) + "%";
    const cks = BEATS.map((b, i) => {
      const c = doc.createElement("button"); c.type = "button"; c.className = "ck"; c.style.left = pos(i);
      c.setAttribute("aria-label", (i + 1) + ". " + b.short);
      // v20: a pointer on a checkpoint is the bar's (below); a click without one (keyboard, screen reader) goes to its step
      c.addEventListener("click", (e) => { e.stopPropagation(); if (performance.now() - TR.done > 600) toStep(i); });
      track.appendChild(c); return c;
    });
    // v20: the grip at the playhead (on hover, while dragging, on keyboard focus): the bar's slider
    const grip = doc.createElement("span"); grip.className = "grip"; grip.tabIndex = 0;
    grip.setAttribute("role", "slider"); grip.setAttribute("aria-label", "Time in the story");
    grip.setAttribute("aria-valuemin", "0"); grip.setAttribute("aria-valuemax", String(Math.round(TOTAL)));
    track.appendChild(grip);
    // the bar's width and left edge: read on layout and when a pointer comes, never in a frame
    let TW = 1, TL = 0, CKH = 9;
    const measure = () => { const r = track.getBoundingClientRect(); TW = Math.max(1, r.width); TL = r.left; CKH = (cks[0].offsetWidth || 18) / 2; };
    const tauAt = (x) => clamp((x - TL) / TW, 0, 1) * TOTAL;
    const nearest = (tau) => BEATS.reduce((a, b, i) => (Math.abs(b.at - tau) < Math.abs(BEATS[a].at - tau) ? i : a), 0);
    const fmt = (t) => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
    // the tip names the step under the pointer (on a checkpoint: that step), it moves with the pointer
    let tipOn = false, tipTxt = "";
    function tipAt(x, i) {
      const j = i != null && i >= 0 ? i : anchorAt(tauAt(x)), cx = i != null && i >= 0 ? TW * BEATS[i].at / TOTAL : clamp(x - TL, 0, TW);
      if (BEATS[j].short !== tipTxt) { tipTxt = BEATS[j].short; tip.textContent = tipTxt; }
      tip.style.transform = "translate3d(" + f1(cx) + "px,0,0) translateX(-50%)";
      if (!tipOn) { tipOn = true; tip.classList.add("on"); }
    }
    function tipOff() { if (tipOn) { tipOn = false; tip.classList.remove("on"); } }
    // pointer (mouse, touch, pen): a click goes to that time (on a checkpoint: its step), a drag scrubs the film
    const TR = { id: null, x0: 0, drag: false, ck: -1, type: "", done: -1e9 };
    // the checkpoint under the pointer, by its place on the bar (a phone's tap adjustment would give a near one to a tap between)
    const ckOf = (e) => {
      let j = -1, d = CKH + 0.5;
      BEATS.forEach((b, i) => { const di = Math.abs(e.clientX - (TL + TW * b.at / TOTAL)); if (di < d) { d = di; j = i; } });
      return j;
    };
    track.addEventListener("pointerdown", (e) => {
      if (TR.id !== null || (e.pointerType === "mouse" && e.button !== 0) || !S.Lo) return;
      measure();
      TR.id = e.pointerId; TR.x0 = e.clientX; TR.drag = false; TR.type = e.pointerType; TR.ck = ckOf(e);
      try { track.setPointerCapture(e.pointerId); } catch (_) { /* capture only keeps the drag on the bar */ }
    });
    track.addEventListener("pointermove", (e) => {
      if (TR.id === e.pointerId) {
        if (!TR.drag && Math.abs(e.clientX - TR.x0) > (TR.type === "mouse" ? 3 : 6)) {
          TR.drag = true; track.classList.add("drag");
          if (!MP.REDUCED) dragStart(tauAt(e.clientX));
        }
        if (TR.drag) {
          if (MP.REDUCED) { const j = nearest(tauAt(e.clientX)); if (j !== S.k) toStep(j); }
          else dragMove(tauAt(e.clientX));
          tipAt(e.clientX);
        }
      } else if (TR.id === null && e.pointerType === "mouse") tipAt(e.clientX, ckOf(e));
    });
    const up = (e, cancel) => {
      if (TR.id !== e.pointerId) return;
      TR.id = null; TR.done = performance.now(); track.classList.remove("drag");
      if (e.pointerType !== "mouse") tipOff();
      if (TR.drag) { dragEnd(); return; }
      if (cancel) return;
      if (TR.ck >= 0) toStep(TR.ck);                              // a checkpoint: its step, as the arrows go there
      else if (MP.REDUCED) toStep(nearest(tauAt(e.clientX)));
      else jumpTo(tauAt(e.clientX));                              // anywhere else on the bar: that time
    };
    track.addEventListener("pointerup", (e) => up(e, false));
    track.addEventListener("pointercancel", (e) => up(e, true));
    // the grip shows while a mouse is over the bar (a class, so a finger's tap leaves no hover behind)
    track.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { measure(); track.classList.add("hov"); } });
    track.addEventListener("pointerleave", () => { track.classList.remove("hov"); if (TR.id === null) tipOff(); });
    // the slider's keys: 5 s on or back, the start and the end of the story (with reduced motion a step)
    grip.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key, base = S.jmp ? S.jmp.tgt : shownTau();
      let t = null;
      if (k === "ArrowRight" || k === "ArrowUp") t = base + 5;
      else if (k === "ArrowLeft" || k === "ArrowDown") t = base - 5;
      else if (k === "Home") t = 0;
      else if (k === "End") t = TOTAL;
      if (t === null) return;
      e.preventDefault(); e.stopPropagation();
      if (MP.REDUCED) toStep(k === "Home" ? 0 : k === "End" ? NB - 1 : S.k + (t > base ? 1 : -1));
      else jumpTo(t);
    });
    // v14: the only pause; after the end it plays again from the first step. v20: the pause stops everything at once (the clock,
    // the videos, the bar); paused, the visitor moves step by step until Play, which goes on from the same place
    btn.addEventListener("click", () => {
      if (S.ended) { S.paused = false; S.frozen = false; toStep(0); }
      else if (MP.REDUCED) { S.auto = !S.auto; S.touched = true; if (S.auto) snapNear(); }      // as before (no button there)
      else if (S.auto) { S.auto = false; S.paused = true; S.frozen = true; S.touched = true; MP.media.pauseAll(storyTiles()); }
      else { S.auto = true; S.paused = false; S.frozen = false; S.touched = true; S.ended = false; snapNear(); }
      player.state(); wake();
    });
    $("pl-prev").addEventListener("click", () => prevStep());
    $("pl-next").addEventListener("click", () => nextStep());
    stage.addEventListener("keydown", (e) => {
      if (e.target !== stage && !$("player").contains(e.target)) return;
      if (e.key === "ArrowRight") { nextStep(); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { prevStep(); e.preventDefault(); }
      else if (e.key === " " && e.target.tagName !== "BUTTON") { btn.click(); e.preventDefault(); }
    });
    let lastI = -1, lastF = "", lastG = "", lastV = "", lastS = "";
    return {
      show(tau) {
        const fr = clamp(tau / TOTAL, 0, 1), f = fr.toFixed(4);
        if (f !== lastF) { lastF = f; fill.style.transform = "scaleX(" + f + ")"; }
        const g = f1(fr * TW);
        if (g !== lastG) { lastG = g; grip.style.transform = "translate3d(" + g + "px,0,0)"; }
        const bi = anchorAt(tau);
        if (bi !== lastI) { lastI = bi; cks.forEach((c, i) => { c.classList.toggle("on", i === bi); c.classList.toggle("past", i < bi); c.setAttribute("aria-current", i === bi ? "step" : "false"); }); }
        const v = Math.round(tau) + "|" + bi;
        if (v !== lastV) { lastV = v; grip.setAttribute("aria-valuenow", String(Math.round(tau))); grip.setAttribute("aria-valuetext", BEATS[bi].short + ", " + fmt(tau) + " of " + fmt(TOTAL)); }
      },
      state() {
        const ic = S.ended ? "again" : S.auto ? "pause" : "play";
        if (ic !== lastS) { lastS = ic; btn.innerHTML = ICON[ic]; }
        btn.setAttribute("aria-label", S.ended ? "Play again" : S.auto ? "Pause" : "Play");
        btn.dataset.state = S.ended ? "ended" : S.auto ? "playing" : S.paused ? "paused" : "stopped";
      },
      // v20: once the time line is known (build) and on every layout: the checkpoints by time, the bar's size
      size() { cks.forEach((c, i) => { c.style.left = pos(i); }); grip.setAttribute("aria-valuemax", String(Math.round(TOTAL))); measure(); lastG = ""; lastV = ""; },
    };
  })();
  // a checkpoint, an arrow, a key or a gesture: go to the step and scroll there (the scroll is only the position; the step
  // already plays); v14: the autoplay plays on from there (with reduced motion there is no autoplay)
  // v20: paused, the autoplay stays off (the step plays once); again: the step on screen from its start
  function toStep(k, again) {
    k = clamp(k, 0, NB - 1);
    S.auto = !MP.REDUCED && !S.paused; S.ended = false; player.state();
    go(k, again); scrollTo(scrollStep(k), true); wake();
  }
  function nextStep() { const j = nextAnchor(); if (j > NB - 1) toOthers(); else toStep(j); }
  function prevStep() { const j = prevAnchor(); toStep(Math.max(0, j), j === S.k); }

  // ---------------------------------------------------------------- back to the top: the page and the player
  // v14: the round button, the brand in the top bar, the links in the page and the Home key: the story from its first step,
  // the autoplay on (as at the first visit)
  function toTop() {
    S.auto = !MP.REDUCED; S.ended = false; S.touched = false; S.paused = false; S.frozen = false; player.state();
    go(0); scrollTo(0); wake();
  }
  const top = $("totop");
  if (top) {
    top.addEventListener("click", toTop);
    const show = () => { const past = window.scrollY > S.top0 + NB * S.stepH - S.stepH * 0.5; top.classList.toggle("on", past); };
    window.addEventListener("scroll", show, { passive: true }); show();
  }
  document.querySelectorAll("[data-totop]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); toTop(); }));
  // v14: the links of the top bar: a step of the story (played on from there) or a section below it (the autoplay ends)
  document.querySelectorAll("[data-step]").forEach((a) => a.addEventListener("click", (e) => {
    if (!S.Lo) return;
    e.preventDefault(); toStep(IDX[a.dataset.step]);
  }));
  document.querySelectorAll("[data-jump]").forEach((a) => a.addEventListener("click", (e) => {
    const el = $(a.dataset.jump); if (!el || !S.Lo) return;
    e.preventDefault(); S.auto = false; player.state();
    scrollTo(el.getBoundingClientRect().top + window.scrollY); wake();
  }));

  // ---------------------------------------------------------------- start
  function start() {
    // v17 (v16 waited here for the grid's renderer): the story starts once the opening's videos have their first frame (at most a few seconds); then the videos of the
    // other steps load, and after them those of the grid (MP.grid.prepare)
    Promise.all([MP.data, MP.examples, MP.chart.ready]).then(([D, X]) => {
      build(D, X);
      // staged: the first movement's videos alone (the story waits for them, at most 3 s), then the rest of the opening, then
      // generation and training, then the grid (MP.grid.prepare); a step that comes earlier loads its own videos at once
      const first = A.open[0], later = A.open.slice(1).flat(), rest = A.gen.concat(A.train, [A.partner]);
      const go = Promise.all(first.map((t) => t.full(3000)));
      go.then(() => { later.forEach((t) => t.load()); return Promise.all(later.map((t) => t.full(8000))); })
        .then(() => { rest.forEach((t) => t.load()); return Promise.all(rest.map((t) => t.full(15000))); })
        .then(() => { if (MP.grid && MP.grid.prepare) MP.grid.prepare(); });
      return go.then(() => [D, X]);
    }).then(([D, X]) => {
      stage.classList.add("live");
      layout();
      let rt = 0;
      window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { layout(); S.force = true; wake(); }, 120); });
      doc.addEventListener("mp:theme", () => { S.force = true; wake(); });
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { layout(); S.force = true; wake(); });
      // the step that the scroll position shows when the page opens (a reload in the middle of the story)
      const x = (window.scrollY - S.top0) / S.stepH;
      S.k = clamp(Math.round(x), 0, NB - 1); S.stepT0 = S.now - BEATS[S.k].tin;
      new IntersectionObserver((es) => {
        es.forEach((e) => {
          S.visible = e.isIntersecting;
          if (!S.visible) MP.media.pauseAll(storyTiles());                 // v17: off screen, no video plays
          if (S.visible && !S.touched && !MP.REDUCED && S.k === 0 && !S.auto && inStory()) { S.auto = true; player.state(); }
          S.force = true; wake();
        });
      }, { threshold: [0, 0.01] }).observe(stage);
      player.state();
      S.force = true; wake();
      MP.story.ready = true;
    }).catch((e) => {
      console.warn("MinPair page: the story could not start.", e && e.message);
      doc.documentElement.classList.add("nogl");
    });
  }

  MP.story = {
    ready: false, get total() { return TOTAL; }, steps: NB,
    info: () => BEATS.map((b) => ({ id: b.id, title: b.title, short: b.short, start: b.start, tin: b.tin, hold: b.hold, end: b.end, dur: b.dur, at: b.at, dip: b.dip })),
    opening: () => SL.map((r) => Object.assign({}, r)),
    // the autoplay film at tau (the clock is held, group clocks as in an uninterrupted autoplay from the top)
    // v20: the same film as a finger on the bar (filmAt): the steps of the training come in as the autoplay brings them
    setTime(tau) {
      S.hold = true; S.auto = false; S.drag = false; S.jmp = null; S.paused = false; S.frozen = false; stopAnim();
      filmAt(tau);
      S.visible = true; draw();
    },
    // a film of the visitor scrolling: test(true) stops the frame loop, tick(dt) runs one frame
    test(on) { S.test = !!on; S.hold = false; S.natural = false; S.auto = false; S.touched = true; S.visible = true; S.now = 0; S.k = 0; S.stepT0 = -BEATS[0].tin; S.hand = null; S.enter.open = 0; S.gw = { open: 1, train: 0, gen: 0 };
      S.paused = false; S.frozen = false; S.jmp = null; S.drag = false; draw(); },
    tick(dt) { S.scrolled = true; step(dt); draw(); return { k: S.k, hand: !!S.hand }; },
    release() { S.hold = false; if (S.natural) toEngine(S.tau); S.force = true; wake(); },
    // v17: resolves once every video on screen shows the frame of the clock (after setTime, tick or a step)
    settled: (ms) => MP.media.settled(ms),
    state: () => ({ k: S.k, auto: S.auto, ended: S.ended, hand: !!S.hand, prog: S.prog, top0: S.top0, stepH: S.stepH, acts: S.acts,
      nav: !!(NAV && NAV.classList.contains("on")), y: window.scrollY, now: S.now, L: S.now - S.stepT0,
      tau: shownTau(), paused: S.paused, frozen: S.frozen, drag: S.drag, jmp: !!S.jmp, free: S.free, anim: !!SA.raf }),
  };
  start();
})();
