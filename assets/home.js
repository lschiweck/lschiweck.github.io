/* Lennart Schiweck, homepage v2: everything that moves or comes from config.js. No library.
   - links, role, photo, publication buttons and BibTeX from window.SITE_CONFIG (config.js)
   - theme (remembered under "ls-theme"), imprint and privacy, copy
   - three pieces of real motion, each loaded only when it comes near the screen and played only while it is on screen:
     the kick you can steer (MinPair, data-toy), three turns (MinPair, data-trio), the dancer with the signals of the watch
     on the dancer's wrist (SetCon, data-dancer; on the blue field of b it can be scrubbed)
   With JavaScript off, the page shows its static content and the still pictures. With reduced motion, nothing plays:
   the kick shows its still for the chosen word, the dancer its still. */
(function () {
  "use strict";
  const doc = document, root = doc.documentElement, C = window.SITE_CONFIG || {}, H = C.home || {};
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const mqDark = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => root.dataset.theme === "dark" || (root.dataset.theme !== "light" && mqDark.matches);
  const theme = () => (isDark() ? "dark" : "light");
  const themeCb = [];
  const onTheme = (f) => themeCb.push(f);
  new MutationObserver(() => themeCb.forEach((f) => f())).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  if (mqDark.addEventListener) mqDark.addEventListener("change", () => { if (!root.dataset.theme) themeCb.forEach((f) => f()); });
  const isExternal = (u) => /^[a-z][a-z0-9+.-]*:/i.test(u);
  const dpr = () => Math.min(window.devicePixelRatio || 1, 3);

  // ================================================================ config: role, links, photo, publications
  const role = str(H.role);
  doc.querySelectorAll("[data-role]").forEach((el) => { el.textContent = role ? role + ", " : ""; });

  const mail = str(C.imprintEmail).replace(/\s*\[at\]\s*/i, "@");
  const mailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail);
  const ICON = {
    mail: '<rect x="2.75" y="4.25" width="14.5" height="11.5" rx="1.75"/><path d="M3.6 5.6l6.4 4.9 6.4-4.9"/>',
    github: '<circle cx="6" cy="4.8" r="1.9"/><circle cx="6" cy="15.2" r="1.9"/><circle cx="14" cy="7.6" r="1.9"/><path d="M6 6.7v6.6M14 9.5c0 2.8-2.4 3.5-6.3 4.3"/>',
    scholar: '<path d="M10 3.8l8 4-8 4-8-4z"/><path d="M5 9.4v3.8c0 1.2 2.2 2.3 5 2.3s5-1.1 5-2.3V9.4M18 7.8v4.6"/>',
    linkedin: '<rect x="3" y="3" width="14" height="14" rx="2.5"/><path d="M7 9.2V14M7 6.4v.1M10.2 14V9.2M10.2 11.4c0-1.4.9-2.3 2.1-2.3s1.9.8 1.9 2.2V14"/>',
    x: '<path d="M4 3.5h3.4L16 16.5h-3.4z"/><path d="M15.6 3.5l-5.2 5.9M9.6 10.6L4.4 16.5"/>',
    orcid: '<circle cx="10" cy="10" r="7.25"/><path d="M7.5 9v4.6M7.5 6.6v.1M10.2 13.6V6.9h1.4c1.9 0 3 1.4 3 3.35s-1.1 3.35-3 3.35z"/>'
  };
  const NAME = { github: "GitHub", scholar: "Scholar", linkedin: "LinkedIn", x: "X", orcid: "ORCID" };
  const links = H.links || {};
  doc.querySelectorAll("[data-links]").forEach((nav) => {
    const items = [];
    if (mailOk && !nav.hasAttribute("data-nomail")) items.push(["mailto:" + mail, "Email", ICON.mail, true]);
    for (const k of ["github", "scholar", "linkedin", "x", "orcid"]) { const u = str(links[k]); if (u) items.push([u, NAME[k], ICON[k], false]); }
    nav.replaceChildren(...items.map(([href, label, icon, main]) => {
      const a = doc.createElement("a");
      a.className = "lk" + (main ? " lk-main" : ""); a.href = href;
      if (isExternal(href) && !href.startsWith("mailto:")) a.rel = "noopener";
      a.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true">' + icon + "</svg><span></span>";
      a.lastChild.textContent = label;
      return a;
    }));
    nav.hidden = items.length === 0;
  });
  doc.querySelectorAll("a[data-mail-big]").forEach((a) => {
    if (!mailOk) { a.closest("p").hidden = true; return; }
    a.href = "mailto:" + mail; a.textContent = mail;
  });
  doc.querySelectorAll("[data-email-line]").forEach((el) => {
    if (!mailOk) { el.hidden = true; return; }
    const a = doc.createElement("a"); a.href = "mailto:" + mail; a.textContent = mail;
    (el.querySelector(".legal-mail") || el).replaceChildren(a);
  });

  // the picture: an <img> in every slot once config.js names a file; a missing file falls back to the initials
  if (root.dataset.photo === "image") {
    doc.querySelectorAll("[data-photo-slot]").forEach((slot) => {
      const i = new Image(); i.alt = "Lennart Schiweck"; i.decoding = "async";
      i.onerror = () => { root.dataset.photo = "placeholder"; i.remove(); };
      i.src = window.HP_PHOTO; slot.appendChild(i); slot.removeAttribute("aria-hidden");
    });
  }

  // publication buttons: target from config.js home.pubs; "soon" buttons stay greyed, others without target are hidden
  const pubs = H.pubs || {};
  doc.querySelectorAll("[data-link]").forEach((a) => {
    const [id, key] = a.dataset.link.split("."), p = pubs[id];
    let u = p ? str(p[key]) : str(a.getAttribute("href") || "");
    if (p && !(key in p)) u = str(a.getAttribute("href") || "");
    if (key === "arxiv" && u && !isExternal(u)) u = "https://arxiv.org/abs/" + u;
    if (u) {
      a.setAttribute("href", u); if (isExternal(u)) a.setAttribute("rel", "noopener");
      if (key === "title") { if (isExternal(u)) a.setAttribute("target", "_blank"); else a.removeAttribute("target"); }
      a.removeAttribute("aria-disabled"); a.removeAttribute("role"); a.hidden = false;
    } else if (a.classList.contains("btn")) {
      a.removeAttribute("href");
      if (a.hasAttribute("data-soon")) { a.setAttribute("role", "link"); a.setAttribute("aria-disabled", "true"); a.hidden = false; }
      else a.hidden = true;
    } else if (a.classList.contains("pj-cover")) a.remove();
    else a.removeAttribute("href");
  });
  // BibTeX: eprint, archivePrefix and primaryClass once the arXiv identifier is known
  doc.querySelectorAll("pre[data-arxiv]").forEach((pre) => {
    const p = pubs[pre.dataset.arxiv] || {}, ax = str(p.arxiv); if (!ax) return;
    const lines = pre.textContent.trim().split("\n"), head = lines[0], fields = [];
    for (const l of lines.slice(1, -1)) { const m = l.match(/^\s*([A-Za-z]+)\s*=\s*(.*?),?\s*$/); if (m) fields.push([m[1], m[2]]); }
    const add = [["eprint", ax], ["archivePrefix", "arXiv"]]; if (str(p.primaryClass)) add.push(["primaryClass", str(p.primaryClass)]);
    for (const [k, v] of add) if (!fields.some((f) => f[0] === k)) fields.push([k, "{" + v + "}"]);
    const w = Math.max(...fields.map((f) => f[0].length));
    pre.textContent = head + "\n" + fields.map((f) => "  " + f[0].padEnd(w) + " = " + f[1]).join(",\n") + "\n}";
  });

  // absolute addresses for canonical and the link preview
  const page = str(C.pageUrl);
  if (page) {
    try {
      const abs = (p) => new URL(p, page).href;
      let link = doc.head.querySelector('link[rel="canonical"]'); if (!link) { link = doc.createElement("link"); link.rel = "canonical"; doc.head.appendChild(link); }
      link.href = abs("./");
    } catch (e) { /* not an absolute address: leave the head as it is */ }
  }

  // ================================================================ BibTeX, copy, imprint and privacy, theme
  doc.querySelectorAll("a[data-bib]").forEach((a) => a.addEventListener("click", (e) => {
    const box = doc.getElementById(a.getAttribute("aria-controls")); if (!box) return;
    e.preventDefault();
    const open = a.getAttribute("aria-expanded") !== "true";
    a.setAttribute("aria-expanded", String(open)); box.classList.toggle("on", open);
    if (open) box.scrollIntoView({ block: "nearest", behavior: RM.matches ? "auto" : "smooth" });
  }));
  const hashOpen = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id.startsWith("bib-")) { const a = doc.querySelector(`a[data-bib][aria-controls="${CSS.escape(id)}"]`), box = doc.getElementById(id); if (a && box) { a.setAttribute("aria-expanded", "true"); box.classList.add("on"); } }
    if (id === "imprint" || id === "privacy") openLegal(id, false);
  };
  doc.querySelectorAll("[data-copy]").forEach((btn) => btn.addEventListener("click", () => {
    const el = doc.getElementById(btn.dataset.copy); if (!el) return;
    const done = () => { btn.textContent = "Copied"; setTimeout(() => { btn.textContent = "Copy"; }, 1500); };
    const select = () => { const r = doc.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.textContent).then(done, select); else select();
  }));
  const legal = [...doc.querySelectorAll("a[data-legal]")];
  function openLegal(id, scroll) {
    legal.forEach((b) => { const on = b.getAttribute("aria-controls") === id && b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", String(on)); const p = doc.getElementById(b.getAttribute("aria-controls")); if (p) p.classList.toggle("on", on); });
    const p = doc.getElementById(id); if (p && p.classList.contains("on") && scroll) p.scrollIntoView({ block: "nearest", behavior: RM.matches ? "auto" : "smooth" });
  }
  legal.forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openLegal(a.getAttribute("aria-controls"), true); }));
  hashOpen(); addEventListener("hashchange", hashOpen);
  doc.querySelectorAll("[data-theme-toggle]").forEach((btn) => btn.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("ls-theme", root.dataset.theme); } catch (e) { /* private window: the choice holds for this visit */ }
  }));
  // pictures with a light and a dark file
  const themeImgs = () => doc.querySelectorAll("img[data-theme-img]").forEach((img) => { const u = img.dataset.themeImg.replace("{t}", theme()); if (img.getAttribute("src") !== u) img.src = u; });
  themeImgs(); onTheme(themeImgs);

  // the slim bar: solid once the head has scrolled away
  const bar = doc.getElementById("bar");
  const head = doc.querySelector(root.dataset.v === "b" ? ".hb" : ".ha");   // (b: the field of whichever head is shown)
  // and a background as soon as the page moves, so that the links never stand on the head's text
  if (bar) { let q = 0; const sc = () => { q = 0; bar.classList.toggle("scrolled", scrollY > 8); root.classList.toggle("left-top", scrollY > 40); }; addEventListener("scroll", () => { if (!q) q = requestAnimationFrame(sc); }, { passive: true }); sc(); }
  if (bar && head) new IntersectionObserver((es) => { const e = es[es.length - 1]; bar.classList.toggle("solid", !e.isIntersecting); }, { rootMargin: "-64px 0px 0px 0px", threshold: 0 }).observe(head);

  // ================================================================ media helpers
  const MEDIA = "assets/media/";
  function makeVideo(cls) {
    const v = doc.createElement("video");
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = true; v.preload = "auto";
    ["muted", "playsinline", "disablepictureinpicture", "disableremoteplayback"].forEach((a) => v.setAttribute(a, ""));
    v.setAttribute("aria-hidden", "true"); v.setAttribute("tabindex", "-1");
    if (cls) v.className = cls;
    return v;
  }
  const play = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  // near: start loading (once); on: on screen (play) or off (pause)
  function watch(el, near, on) {
    let loaded = false;
    new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting && !loaded && el.offsetParent !== null) { loaded = true; near(); } }, { rootMargin: "160px 0px" }).observe(el);
    new IntersectionObserver((es) => { const e = es[es.length - 1]; on(e.isIntersecting && el.offsetParent !== null); }, { threshold: 0.08 }).observe(el);
  }
  const big = (el, px) => el.getBoundingClientRect().width * dpr() > px;

  // ================================================================ the kick you can steer (MinPair)
  const WORDS = ["knee", "waist", "head"];
  const APEX = { knee: 45 / 60, waist: 35 / 60, head: 30 / 60 };       // the frames of the stills (top of each kick)
  doc.querySelectorAll("[data-toy]").forEach((fig) => {
    const stage = fig.querySelector("[data-toy-stage]"), poster = stage.querySelector("img"), slot = fig.querySelector("[data-toy-slot]");
    const pick = fig.querySelector(".toy-pick"), btns = [...pick.querySelectorAll("button")];
    const ind = doc.createElement("span"); ind.className = "toy-ind"; ind.setAttribute("aria-hidden", "true"); pick.prepend(ind);
    const prog = doc.createElement("i"); prog.className = "toy-prog"; ind.appendChild(prog);   // the tour's progress, on the chosen word
    let word = "head", auto = true, hold = false, vids = null, small = false, visible = false, raf = 0, lastT = 0, shownFor = 0, switching = false;
    // the smart tour pauses while the pointer or the focus is on the kick; a real click ends it and keeps the word
    fig.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hold = true; });
    fig.addEventListener("pointerleave", () => { hold = false; });
    fig.addEventListener("focusin", () => { hold = true; });
    fig.addEventListener("focusout", (e) => { if (!fig.contains(e.relatedTarget)) hold = false; });
    const posterSrc = (w) => MEDIA + "kick_" + w + "." + theme() + (small ? ".s" : "") + ".webp";
    const src = (w) => MEDIA + "kick_" + w + "." + theme() + (small ? ".s" : "") + ".mp4";
    const placeInd = (anim) => {
      const b = btns.find((x) => x.dataset.w === word); if (!b) return;
      if (!anim) ind.style.transition = "none";
      ind.style.width = b.offsetWidth + "px"; ind.style.transform = "translateX(" + b.offsetLeft + "px)";
      if (!anim) { void ind.offsetWidth; ind.style.transition = ""; }
    };
    const setSlot = (w) => {
      const old = slot.querySelector("span:not(.out)") || null;
      const nu = doc.createElement("span"); nu.textContent = w; nu.className = "in";
      if (!old) { slot.textContent = ""; nu.className = ""; slot.appendChild(nu); return; }
      slot.appendChild(nu); void nu.offsetWidth; nu.className = ""; old.className = "out";
      setTimeout(() => old.remove(), 520);
    };
    slot.textContent = ""; setSlot(word);
    const setWord = (w, user) => {
      if (w === word) return;
      word = w; shownFor = 0;
      btns.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.w === w)));
      placeInd(true); setSlot(w);
      if (!vids || RM.matches) { poster.src = posterSrc(w); return; }
      crossTo(w, user);
    };
    // the new word's video fades in over the old one (0.22 s): on a click from its start, so that its kick follows at once;
    // in the tour at the same moment near the loop's end, where all three stand in the same pose
    const crossTo = (w, user) => {
      const cur = vids.find((v) => v.classList.contains("on")), nxt = vids[WORDS.indexOf(w)];
      if (!cur || cur === nxt) { if (nxt) { nxt.classList.add("on"); play(nxt); } return; }
      switching = true;
      const t = user ? 0 : cur.currentTime + 0.03;
      let done = false;
      const go = () => {
        if (done) return; done = true; nxt.removeEventListener("seeked", go); play(nxt);
        requestAnimationFrame(() => { nxt.classList.add("on"); cur.classList.remove("on"); lastT = nxt.currentTime;
          setTimeout(() => { if (!cur.classList.contains("on")) cur.pause(); switching = false; }, 260); });
      };
      nxt.addEventListener("seeked", go);
      try { nxt.currentTime = Math.min(t, (nxt.duration || 2.7) - 0.02); } catch (e) { go(); }
      setTimeout(go, 450);
    };
    const user = () => { auto = false; fig.classList.add("toy-held"); slot.setAttribute("aria-live", "polite"); };
    btns.forEach((b) => b.addEventListener("click", () => { user(); setWord(b.dataset.w, true); }));
    pick.addEventListener("keydown", (e) => {
      const i = WORDS.indexOf(word); let j = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % 3; else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i + 2) % 3;
      if (j < 0) return; e.preventDefault(); user(); setWord(WORDS[j], true); btns[j].focus();
    });
    btns.forEach((b) => b.setAttribute("tabindex", b.dataset.w === word ? "0" : "-1"));
    pick.addEventListener("focusin", () => btns.forEach((b) => b.setAttribute("tabindex", b.dataset.w === word ? "0" : "-1")));
    requestAnimationFrame(() => placeInd(false));
    addEventListener("resize", () => placeInd(false));
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => placeInd(false));
    // the smart tour: a word changes only after its whole kick was shown once (one full loop); the switch happens in the
    // loop's last 0.16 s, where the three clips meet; only while on screen and the tab is visible (rAF stops otherwise)
    const tick = () => {
      raf = 0; if (!visible || !vids) return;
      const cur = vids.find((v) => v.classList.contains("on"));
      if (cur && !switching) {
        const t = cur.currentTime, L = cur.duration || 2.7, wrapped = t < lastT - 1;
        if (wrapped) shownFor++;
        lastT = t;
        // near the loop's end; or, if a slow frame missed that moment, right at the next start (the same pose)
        const run = auto && !hold && !RM.matches;
        prog.style.transform = "scaleX(" + (auto && shownFor >= 1 ? Math.min(1, t / L) : 0).toFixed(3) + ")";
        fig.classList.toggle("toy-paused", auto && hold);
        if (run && ((shownFor >= 1 && t > L - 0.16) || (wrapped && shownFor >= 2))) setWord(WORDS[(WORDS.indexOf(word) + 1) % 3], false);
      }
      raf = requestAnimationFrame(tick);
    };
    const load = () => {
      small = !big(stage, 760);
      poster.src = posterSrc(word);
      if (RM.matches) return;
      vids = WORDS.map((w) => { const v = makeVideo(); v.src = src(w); stage.appendChild(v); return v; });
      const first = vids[WORDS.indexOf(word)];
      first.addEventListener("loadedmetadata", () => { try { first.currentTime = APEX[word]; } catch (e) { /* from its start */ } }, { once: true });
      first.addEventListener("playing", () => { if (!vids.some((v) => v.classList.contains("on"))) first.classList.add("on"); lastT = first.currentTime; }, { once: true });
      if (visible) play(first);
    };
    watch(fig, load, (on) => {
      visible = on;
      if (!vids) return;
      const cur = vids.find((v) => v.classList.contains("on")) || vids[WORDS.indexOf(word)];
      if (on) { play(cur); if (!raf) raf = requestAnimationFrame(tick); } else vids.forEach((v) => v.pause());
    });
    onTheme(() => {
      poster.src = posterSrc(word);
      if (!vids) return;
      vids.forEach((v, k) => { const t = v.currentTime, wasOn = v.classList.contains("on"); v.src = src(WORDS[k]); v.addEventListener("loadedmetadata", () => { try { v.currentTime = t; } catch (e) { /* the browser seeks once it can */ } if (wasOn && visible) play(v); }, { once: true }); });
    });
    RM.addEventListener && RM.addEventListener("change", () => { if (RM.matches && vids) { vids.forEach((v) => { v.pause(); v.classList.remove("on"); }); poster.src = posterSrc(word); } });
  });

  // ================================================================ three turns (MinPair)
  doc.querySelectorAll("[data-trio]").forEach((fig) => {
    const stage = fig.querySelector("[data-trio-stage]"), poster = stage.querySelector("img"), name = fig.dataset.src;
    let v = null, visible = false;
    const posterSrc = () => MEDIA + name + "." + theme() + ".webp";
    const load = () => {
      poster.src = posterSrc();
      if (RM.matches) return;
      v = makeVideo(); v.src = MEDIA + name + "." + theme() + ".mp4"; stage.appendChild(v);
      v.addEventListener("loadedmetadata", () => { try { v.currentTime = 70 / 60; } catch (e) { /* from its start */ } }, { once: true });
      v.addEventListener("playing", () => v.classList.add("on"));
      if (visible) play(v);
    };
    watch(fig, load, (on) => { visible = on; if (v) { if (on) play(v); else v.pause(); } });
    onTheme(() => { poster.src = posterSrc(); if (v) { const t = v.currentTime; v.src = MEDIA + name + "." + theme() + ".mp4"; v.addEventListener("loadedmetadata", () => { try { v.currentTime = t; } catch (e) { /* later */ } if (visible) play(v); }, { once: true }); } });
  });

  // ================================================================ the films of b's head: one loop each, chosen by the layout
  doc.querySelectorAll("[data-film]").forEach((box) => {
    // a film that shows another one beside b2's head (data-alt, used when the head is b2), so no film appears twice
    if (box.dataset.alt && root.dataset.h === "2") { box.dataset.src = box.dataset.alt; box.dataset.hi = box.dataset.altHi; const im = box.querySelector("img"); im.src = MEDIA + box.dataset.alt + ".webp"; im.width = 1100; im.height = 800; }
    const img = box.querySelector("img"), phone = () => innerWidth < 900 && box.dataset.phone;
    let v = null, visible = false;
    if (phone() && img.dataset.phoneImg) img.src = img.dataset.phoneImg;
    const load = () => {
      if (RM.matches) return;
      const name = phone() ? box.dataset.phone : box.dataset.src + (big(box, +box.dataset.hi || 1200) ? "" : (box.dataset.src === "hero_b2" ? ".m" : ".s"));
      v = makeVideo(); v.src = MEDIA + name + ".mp4"; box.appendChild(v);
      // a film may start at the moment of its still (b3: the top of the kicks), so the still turns into motion without a jump
      if (box.dataset.start) v.addEventListener("loadedmetadata", () => { try { v.currentTime = +box.dataset.start; } catch (e) { /* from its start */ } }, { once: true });
      v.addEventListener("playing", () => v.classList.add("on"));
      if (visible) play(v);
    };
    watch(box, load, (on) => { visible = on; if (v) { if (on) play(v); else v.pause(); } });
  });

  // ================================================================ the dancer and the signals of the watch (SetCon)
  let DANCE = null;
  const danceData = () => DANCE || (DANCE = fetch(MEDIA + "dance.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }));
  const SIG_COL = ["rgba(255,255,255,0.95)", "#ffcf2e", "rgba(160,215,255,0.9)"];
  doc.querySelectorAll("[data-dancer]").forEach((box) => {
    const stage = box.querySelector("[data-dancer-stage]"), sigBox = box.querySelector("[data-sig]"), poster = stage.querySelector("img");
    const scrub = box.hasAttribute("data-hero");
    let v = null, D = null, visible = false, raf = 0, drag = null, seeking = false, wantT = null;
    const WIN = 3.2;                                   // seconds of signal on screen
    let tape = null, clip = null, dots = [], W = 0, Hc = 0, pps = 0, x1 = 0, mid = 0, amp = 0, lastDraw = 0;
    const sample = (t, k) => {                         // the periodic 60-Hz trace at time t (s) of the loop
      const n = D.acc.length, x = (((t * D.hz) % n) + n) % n, i = Math.floor(x), f = x - i;
      return D.acc[i][k] * (1 - f) + D.acc[(i + 1) % n][k] * f;
    };
    // the tape: the trace from one window before the loop to its end, drawn once per size; the page only moves it
    const build = () => {
      if (!sigBox || !D) return;
      const r = sigBox.getBoundingClientRect(); if (r.width < 20 || r.height < 20) return;
      W = r.width; Hc = r.height; x1 = W - (scrub ? Math.max(24, W * 0.04) : 18); pps = x1 / WIN;
      mid = Hc / 2; amp = (Hc / 2 - 10) / D.lim;
      if (!tape) {
        clip = doc.createElement("div"); clip.className = "sig-clip"; tape = doc.createElement("canvas"); clip.appendChild(tape); sigBox.appendChild(clip);
        for (let c = 0; c < 3; c++) { const d = doc.createElement("i"); d.style.background = SIG_COL[c]; sigBox.appendChild(d); dots.push(d); }
      }
      clip.style.width = x1 + 4 + "px";
      const len = (D.dur + WIN) * pps, k = Math.min(dpr(), 16000 / len);
      tape.width = Math.round(len * k); tape.height = Math.round(Hc * k); tape.style.width = len + "px"; tape.style.height = Hc + "px";
      const g = tape.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0); g.lineJoin = "round"; g.lineCap = "round";
      for (let c = 2; c >= 0; c--) {
        g.beginPath(); g.lineWidth = c === 0 ? 2 : 1.6; g.strokeStyle = SIG_COL[c];
        for (let x = 0; x <= len + 1; x += 2) { const y = mid - sample(x / pps - WIN, c) * amp; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      }
      dots.forEach((d, c) => { d.style.width = d.style.height = (c === 0 ? 8 : 7) + "px"; });
      draw(lastDraw);
    };
    const draw = (t) => {
      if (!D) return;
      lastDraw = t;
      if (!tape) return;                               // (the ring on the watch is drawn into the video itself)
      const tm = ((t % D.dur) + D.dur) % D.dur;
      tape.style.transform = "translate3d(" + (-tm * pps).toFixed(2) + "px,0,0)";
      dots.forEach((d, c) => { d.style.transform = "translate(" + x1.toFixed(1) + "px," + (mid - sample(tm, c) * amp).toFixed(1) + "px)"; });
    };
    let shownT = 0, rvfc = false;
    const onFrame = (now, meta) => { shownT = meta.mediaTime; if (v) v.requestVideoFrameCallback(onFrame); };
    const loop = () => { raf = 0; if (!visible) return; if (v && v.readyState >= 2) draw(drag && wantT != null && !rvfc ? wantT : (rvfc ? shownT : v.currentTime)); raf = requestAnimationFrame(loop); };
    const load = () => {
      danceData().then((d) => { D = d; build(); draw(0); }).catch(() => { if (sigBox) sigBox.hidden = true; });
      if (RM.matches) return;
      v = makeVideo(); v.src = MEDIA + (big(stage, 960) ? "dance.mp4" : "dance.s.mp4"); stage.appendChild(v);
      v.addEventListener("playing", () => v.classList.add("on"));
      if ("requestVideoFrameCallback" in v) { rvfc = true; v.requestVideoFrameCallback(onFrame); }
      v.addEventListener("seeked", () => { seeking = false; if (rvfc) shownT = v.currentTime; if (drag && wantT != null && Math.abs(v.currentTime - wantT) > 0.04) seekTo(wantT); });
      if (visible) play(v);
    };
    watch(box, load, (on) => { visible = on; if (v) { if (on && !drag) play(v); else if (!on) v.pause(); } if (on && !raf) raf = requestAnimationFrame(loop); });
    if (sigBox) new ResizeObserver(() => build()).observe(sigBox);
    // scrubbing (b's field): drag left to move forward in time, as if pulling the trace
    const seekTo = (t) => { if (!v) return; wantT = t; if (seeking) return; seeking = true; try { if (v.fastSeek && !navigator.userAgent.includes("Chrome")) v.fastSeek(t); else v.currentTime = t; } catch (e) { seeking = false; } };
    if (scrub) {
      box.addEventListener("pointerdown", (e) => {
        if (!v || e.button > 0 || e.target.closest("a, button")) return;
        drag = { x: e.clientX, t: v.currentTime, id: e.pointerId, moved: false }; box.classList.add("drag", "touched");
        box.setPointerCapture(e.pointerId);
      });
      box.addEventListener("pointermove", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x; if (Math.abs(dx) > 3 && !drag.moved) { drag.moved = true; v.pause(); }
        if (!drag.moved) return;
        const dur = D ? D.dur : (v.duration || 7.2), t = (((drag.t - dx / box.clientWidth * dur * 0.9) % dur) + dur) % dur;
        seekTo(t);
      });
      const end = (e) => { if (!drag || (e && e.pointerId !== drag.id)) return; const moved = drag.moved; drag = null; wantT = null; box.classList.remove("drag"); if (moved && visible && !RM.matches) play(v); };
      box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end); box.addEventListener("lostpointercapture", end);
    }
  });
})();

// the hint at the bottom of the head: a soft scroll to the research (the browser's own jump without motion)
document.querySelectorAll(".hb-more").forEach((a) => a.addEventListener("click", (e) => {
  const t = document.getElementById("research"); if (!t) return; e.preventDefault();
  t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", "#research");
}));
