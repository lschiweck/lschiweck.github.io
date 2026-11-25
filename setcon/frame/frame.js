/* Frame: the shared behaviour of the project pages (SetCon, MinPair). No library, independent of the page's own scripts.
   Load it at the end of <body>, after config.js:
   - window.SITE_CONFIG (config.js) holds what exists only later: the arXiv identifier, the Code, Model and Data targets and
     the page's absolute address. A link with data-fr-link="arxiv|code|model|data" gets its href from there and stays
     hidden while the value is empty (v2: a head button, a.fr-btn, stays visible instead, greyed, with "soon" (frame.css),
     marked aria-disabled; it turns into a link by itself once its value is set). The arXiv identifier also completes the BibTeX in <pre data-fr-bib>. The address
     makes canonical, og:url, og:image and twitter:image absolute (for link previews, write them into the HTML as well).
   - Buttons with data-fr-theme switch html[data-theme] and remember the choice under the key in html[data-fr-store].
     Restore it early with one line in <head>:
     <script>try{var t=localStorage.getItem("setcon-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}</script>
   - <nav class="fr-topnav" data-fr-after="<selector>"> slides in once that element has left the screen (for the paper links:
     data-fr-after=".fr-head .fr-links", so the bar is in as soon as the head block's links are gone). A page that moves its
     head block itself (MinPair's story) leaves data-fr-after out and toggles the class "on" on the nav.
   - <div class="fr-tn-paper"> in the top bar repeats the head block's links (Paper, arXiv, Code, Model, Data, BibTeX), small,
     at the right end beside the theme switch; its data-fr-link links get their href from config.js like those of the head.
   - data-fr-copy="<id>" copies the text of #id; data-fr-flash="<id>" rings #id once after the jump to it.
   - v2: <button class="fr-totop" data-fr-after="<selector>"> shows once that element is above the screen and scrolls to the
     top of the page. A page with its own way back (MinPair's story) leaves data-fr-after out and toggles "on" itself.
   - v2: <a href="#<id>" data-fr-legal> opens the footer panel #<id> (.fr-legal-panel: imprint, privacy), one at a time.
     The address in the imprint stands in the HTML as "name [at] domain" in <span data-fr-email>; frame.js turns
     imprintEmail of config.js (same form) into a mailto link there, or hides the line when it is empty. */
(function () {
  "use strict";
  const doc = document, root = doc.documentElement, C = window.SITE_CONFIG || {};
  const val = (k) => (typeof C[k] === "string" ? C[k].trim() : "");
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- links that exist only with a target
  const arxiv = val("arxiv");
  const target = { arxiv: arxiv ? "https://arxiv.org/abs/" + arxiv : "", code: val("code"), model: val("model"), data: val("data") };
  doc.querySelectorAll("a[data-fr-link]").forEach((a) => {
    const u = target[a.dataset.frLink], btn = a.classList.contains("fr-btn");
    if (u) { a.setAttribute("href", u); a.setAttribute("rel", "noopener"); if (btn) { a.removeAttribute("role"); a.removeAttribute("aria-disabled"); } }
    else { a.removeAttribute("href"); if (btn) { a.setAttribute("role", "link"); a.setAttribute("aria-disabled", "true"); } }
  });

  // ---------------------------------------------------------------- BibTeX: eprint, archivePrefix and primaryClass once the arXiv identifier is known
  if (arxiv) {
    doc.querySelectorAll("pre[data-fr-bib]").forEach((pre) => {
      const lines = pre.textContent.trim().split("\n"), head = lines[0], fields = [];
      for (const l of lines.slice(1, -1)) { const m = l.match(/^\s*([A-Za-z]+)\s*=\s*(.*?),?\s*$/); if (m) fields.push([m[1], m[2]]); }
      const add = [["eprint", arxiv], ["archivePrefix", "arXiv"]]; if (val("primaryClass")) add.push(["primaryClass", val("primaryClass")]);
      for (const [k, v] of add) if (!fields.some((f) => f[0] === k)) fields.push([k, "{" + v + "}"]);
      const w = Math.max(...fields.map((f) => f[0].length));
      pre.textContent = head + "\n" + fields.map((f) => "  " + f[0].padEnd(w) + " = " + f[1]).join(",\n") + "\n}";
    });
  }

  // ---------------------------------------------------------------- absolute addresses for canonical and the link preview
  const page = val("pageUrl");
  if (page) {
    try {
      const abs = (p) => new URL(p, page).href;
      const meta = (attr, name) => {
        let m = doc.head.querySelector(`meta[${attr}="${name}"]`);
        if (!m) { m = doc.createElement("meta"); m.setAttribute(attr, name); doc.head.appendChild(m); }
        return m;
      };
      let link = doc.head.querySelector('link[rel="canonical"]'); if (!link) { link = doc.createElement("link"); link.rel = "canonical"; doc.head.appendChild(link); }
      link.href = abs("./");
      meta("property", "og:url").setAttribute("content", abs("./"));
      const img = meta("property", "og:image"), rel = img.getAttribute("content") || "media/og.png";
      img.setAttribute("content", abs(rel)); meta("name", "twitter:image").setAttribute("content", abs(rel));
    } catch (e) { console.warn("Frame: pageUrl in config.js is not an absolute address.", e && e.message); }
  }

  // ---------------------------------------------------------------- theme
  const key = root.dataset.frStore || "fr-theme", mqDark = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => root.dataset.theme === "dark" || (root.dataset.theme !== "light" && mqDark.matches);
  doc.querySelectorAll("[data-fr-theme]").forEach((btn) => btn.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem(key, root.dataset.theme); } catch (e) { /* private window: the choice holds for this visit */ }
  }));

  // ---------------------------------------------------------------- slim top bar
  doc.querySelectorAll(".fr-topnav[data-fr-after]").forEach((nav) => {
    const el = doc.querySelector(nav.dataset.frAfter); if (!el) return;
    new IntersectionObserver((es) => nav.classList.toggle("on", !es[es.length - 1].isIntersecting), { threshold: 0 }).observe(el);
  });

  // ---------------------------------------------------------------- v2: back to the top
  doc.querySelectorAll(".fr-totop[data-fr-after]").forEach((btn) => {
    const el = doc.querySelector(btn.dataset.frAfter); if (!el) return;
    new IntersectionObserver((es) => { const e = es[es.length - 1]; btn.classList.toggle("on", !e.isIntersecting && e.boundingClientRect.top < 0); }, { threshold: 0 }).observe(el);
    btn.addEventListener("click", (ev) => {
      window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
      // from the keyboard, the focus goes to the first button of the head block, so that it does not stay on the hidden button
      if (ev.detail === 0) { const f = doc.querySelector(".fr-head a[href]"); if (f) f.focus({ preventScroll: true }); }
    });
  });

  // ---------------------------------------------------------------- v2: imprint and privacy in the footer
  const mail = val("imprintEmail").replace(/\s*\[at\]\s*/i, "@");
  doc.querySelectorAll("[data-fr-email]").forEach((el) => {
    const box = el.querySelector(".fr-email") || el;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { el.hidden = true; return; }
    const a = doc.createElement("a"); a.href = "mailto:" + mail; a.textContent = mail;
    box.replaceChildren(a);
  });
  const legal = [...doc.querySelectorAll("a[data-fr-legal]")];
  legal.forEach((a) => a.addEventListener("click", (e) => {
    const p = doc.getElementById(a.getAttribute("href").slice(1)); if (!p) return;
    e.preventDefault();
    const open = a.getAttribute("aria-expanded") !== "true";
    legal.forEach((b) => { b.setAttribute("aria-expanded", "false"); const q = doc.getElementById(b.getAttribute("href").slice(1)); if (q) q.classList.remove("on"); });
    if (open) { p.classList.add("on"); a.setAttribute("aria-expanded", "true"); p.scrollIntoView({ block: "nearest", behavior: REDUCED ? "auto" : "smooth" }); }
  }));

  // ---------------------------------------------------------------- copy, and the ring after a jump
  doc.querySelectorAll("[data-fr-copy]").forEach((btn) => btn.addEventListener("click", () => {
    const el = doc.getElementById(btn.dataset.frCopy); if (!el) return;
    const done = () => { const t = btn.textContent; btn.textContent = "Copied"; setTimeout(() => { btn.textContent = t; }, 1500); };
    const select = () => { const r = doc.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.textContent).then(done, select); else select();
  }));
  const flash = (id) => { const el = doc.getElementById(id); if (!el) return; el.classList.remove("fr-flash"); void el.offsetWidth; el.classList.add("fr-flash"); };
  doc.querySelectorAll("[data-fr-flash]").forEach((a) => a.addEventListener("click", () => setTimeout(() => flash(a.dataset.frFlash), REDUCED ? 0 : 550)));
})();
