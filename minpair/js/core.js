/* MinPair project page: core.js. Shared basics: small maths, colour tokens, theme, the numbers of the paper
   (data/results.json), the story's data (data/story.json) and the examples (data/examples.json). v17: no motions, the bodies
   are videos (media.js).
   v15: the theme switches are those of the frame (frame/frame.js, data-fr-theme); page.js passes a change of html[data-theme]
   on to the canvases as the event mp:theme. Nothing here touches the layout during scrolling. */
(function () {
  "use strict";
  const MP = (window.MP = window.MP || {});
  const doc = document, root = doc.documentElement;
  root.classList.add("js");

  // ---------------------------------------------------------------- maths
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sub = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const mix = (a, b, t) => a + (b - a) * t;
  // progress of the transition from station k to k + 1, with a short rest at both ends
  const tr = (P, k) => clamp((P - k - 0.12) / 0.76, 0, 1);
  MP.fx = { clamp, sub, ease, mix, tr };
  // v16: a box for a canvas that covers only part of the stage, on whole device pixels (so its pixels sit exactly where those
  // of a canvas over the whole stage would): x0, y0 rounded down, x1, y1 up to a step q of CSS pixels with q * dpr whole;
  // with no such step the box is the whole stage
  MP.pxBox = function (x0, y0, x1, y1, W, H, dpr) {
    const q = [1, 2, 3, 4, 5, 8, 10, 20].find((k) => Math.abs(k * dpr - Math.round(k * dpr)) < 1e-4);
    if (!q) return [0, 0, W, H];
    const dn = (v) => Math.max(0, Math.floor(v / q) * q), up = (v, m) => Math.min(m, Math.ceil(v / q) * q);
    return [dn(x0), dn(y0), up(x1, W), up(y1, H)];
  };

  // ---------------------------------------------------------------- preferences
  const mqReduced = matchMedia("(prefers-reduced-motion: reduce)");
  MP.REDUCED = mqReduced.matches;
  if (MP.REDUCED) root.classList.add("reduced");
  const sysDark = matchMedia("(prefers-color-scheme: dark)");
  MP.isDark = () => root.dataset.theme === "dark" || (root.dataset.theme !== "light" && sysDark.matches);
  let COL = null;
  MP.css = (name) => getComputedStyle(root).getPropertyValue("--" + name).trim();
  MP.col = () => COL || (COL = { ink: MP.css("ink"), ink2: MP.css("ink-2"), ink3: MP.css("ink-3"), line: MP.css("line"),
    accent: MP.css("accent"), bg: MP.css("bg"), bg3: MP.css("bg-3"), sans: MP.css("sans"), dark: MP.isDark(),
    tones: [MP.css("t0"), MP.css("t1"), MP.css("t2")] });
  function fireTheme() { COL = null; doc.dispatchEvent(new CustomEvent("mp:theme", { detail: { dark: MP.isDark() } })); }
  const onSys = () => { if (!root.dataset.theme) fireTheme(); };
  if (sysDark.addEventListener) sysDark.addEventListener("change", onSys); else if (sysDark.addListener) sysDark.addListener(onSys);
  MP.fireTheme = fireTheme;                                  // v15: called by page.js when the frame switches the theme
  MP.setTheme = function (t) {
    root.dataset.theme = t;
    try { localStorage.setItem(root.dataset.frStore || "mp-theme", t); } catch (e) { /* private window: the choice lasts for this page view */ }
  };

  // ---------------------------------------------------------------- numbers of the paper
  let PV = null;
  MP.pv = function (key, d) {
    if (!PV || !PV[key] || !PV[key].p) return null;
    const s = PV[key].p[String(d == null ? 1 : d)];
    return s == null ? null : String(s);
  };
  MP.pvNum = (key) => (PV && PV[key] && typeof PV[key].v === "number" ? PV[key].v : null);
  MP.ready = fetch("data/results.json").then((r) => { if (!r.ok) throw new Error("results.json " + r.status); return r.json(); })
    .then((r) => { PV = (r && r.pv) || {}; return r; })
    .catch((e) => { console.warn("MinPair page: results.json did not load.", e && e.message); PV = {}; return null; });

  // ---------------------------------------------------------------- the story's data and the examples
  // v17: no motions any more. data/story.json holds the numbers of the training figure and the extents of the two training
  // bodies, data/examples.json the captions, words and guides of the examples, the extents of their bodies and the windows
  // of their videos (media/v/, see media.js)
  MP.data = fetch("data/story.json").then((r) => { if (!r.ok) throw new Error("story.json " + r.status); return r.json(); })
    .then((man) => ({ man }));
  MP.data.catch((e) => console.warn("MinPair page: story data did not load.", e && e.message));
  MP.examples = fetch("data/examples.json").then((r) => { if (!r.ok) throw new Error("examples.json " + r.status); return r.json(); })
    .then((ex) => ({ ex }));
  MP.examples.catch((e) => console.warn("MinPair page: examples did not load.", e && e.message));

  // ---------------------------------------------------------------- one clock for all looping motions
  // MP.now() is the page time in seconds; it stops while paused, so every motion stops with it
  let tAcc = 0, tLast = performance.now(), playing = !MP.REDUCED;
  MP.tick = function (now) { const dt = Math.min(0.1, (now - tLast) / 1000); tLast = now; if (playing) tAcc += dt; return tAcc; };
  MP.now = () => tAcc;
  MP.playing = () => playing;
  MP.setPlaying = function (p) { playing = !!p; tLast = performance.now(); doc.dispatchEvent(new CustomEvent("mp:play", { detail: { playing } })); };
})();
