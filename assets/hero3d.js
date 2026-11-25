/* Lennart Schiweck, homepage v2, look b, head 4 (?v=b4). Under the name: a stage. A body of the Momentum Human Rig dances
   in a spotlight (three.js r144, the body and the motion of the SetCon project page). It wears three devices on its right
   side, turned to the viewer: a watch, AI glasses with the IMU in the right temple, a phone in the front trouser pocket.
   Each device is carried by the skin like the mesh (tools/fit_devices.py). From each device its acceleration, simulated
   from exactly this mounting and motion, runs as a curve over time into a slowly turning 4D simplex, the model. Out of
   it comes, token by token, the real answer of SetCon's language model for this window (assets/media/hero3d_devices.json,
   tools/README_HERO.md). Desktop: the body left, the model right, the answer beside it. Phone: the body on top, the curves
   run forward-down into the model, the answer under the scene.
   Only renders while on screen; the device pixel ratio is capped and comes down on slow frames; with reduced motion
   nothing of this runs (the still stays, the answer stands as text). */
(function () {
  "use strict";
  const doc = document, root = doc.documentElement;
  const host = doc.querySelector("[data-hero3d]");
  if (!host || root.dataset.h !== "4") return;
  const out = host.querySelector("[data-h3-out]"), outA = host.querySelector("[data-h3-a]"), outQ = host.querySelector("[data-h3-q]");
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let gl = true;
  try { const c = doc.createElement("canvas"); gl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { gl = false; }
  const MEDIA = "assets/media/";
  const script = (src) => new Promise((res, rej) => { const s = doc.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; doc.head.appendChild(s); });
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const poster = host.querySelector(".h3-poster");
  const settle = () => { if (host.classList.contains("live") || !poster) return; host.classList.add("settled"); const u = innerWidth < 900 ? poster.dataset.phoneStill : poster.dataset.still; if (u && !poster.src.endsWith(u)) poster.src = u; };
  // the answer as plain text (reduced motion, no WebGL, or before the scene runs)
  const staticAnswer = (D) => { const lm = D.segments && D.segments[0].lm; if (!out || !lm) return; outQ.textContent = lm.question; outA.textContent = lm.answer; out.classList.add("on", "done"); };
  const data = fetch(MEDIA + "hero3d_devices.json").then((r) => r.json());
  if (RM || !gl) { settle(); data.then(staticAnswer).catch(() => {}); return; }
  setTimeout(settle, 7000);
  Promise.all([script("assets/vendor/three.min.js").then(() => script("assets/vendor/GLTFLoader.js")), data])
    .then(([, D]) => start(D)).catch((e) => { settle(); data.then(staticAnswer).catch(() => {}); console.warn("Homepage: the 3D head could not start, the still stays.", e && e.message); });

  function start(D) {
    const T = window.THREE;
    const stage = host.querySelector("[data-h3-stage]") || host;
    const W0 = () => stage.clientWidth, H0 = () => stage.clientHeight;
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    const canvas = renderer.domElement; canvas.className = "h3-canvas"; canvas.setAttribute("aria-hidden", "true");
    stage.appendChild(canvas);
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(30, 1, 0.05, 200);
    // the light of the calm head: a sky and ground fill, a key from above front right (it casts the body's shadow), a rim
    scene.add(new T.HemisphereLight(0xffffff, 0x3a46d8, 0.72));
    const key = new T.DirectionalLight(0xffffff, 0.92); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 2.4, bottom: -0.4, near: 0.5, far: 12 });
    scene.add(key); scene.add(key.target);
    const rim = new T.DirectionalLight(0xc4caff, 0.55); rim.position.set(-3, 2.5, -3.5); scene.add(rim);

    // ---------------------------------------------------------------- layout: wide (desktop) or tall (phone)
    let tall = false, L = null;
    const rectIn = (sel) => { const e = doc.querySelector(sel); if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(), h = stage.getBoundingClientRect(); return { top: r.top - h.top, bottom: r.bottom - h.top, left: r.left - h.left, right: r.right - h.left }; };
    // the mouth: where the three lanes meet, the small embedding cloud sits and the answer begins (world coordinates)
    const layout = () => {
      tall = innerWidth < 900;
      const W = Math.max(2, W0()), H = Math.max(2, H0()), gut = Math.min(72, Math.max(16, W * 0.044));
      if (tall) {
        // the scene box under the name block: the body at the left, the mouth at the lower right; the answer under the box
        const floorY = H - 24, ppm = Math.min((floorY - 10) / 1.95, W / 2.05);
        const sxBody = W * 0.25, sxMouth = W * 0.6;
        L = { tall, ppm, gut, body: [0, 0], cloudR: 0.27, dir: [0.12, 0.12, 1], facing: 1.25, flow: 1.6 };
        L.vis = H / ppm;
        L.target = [(W / 2 - sxBody) / ppm, (H / 2 - (H - floorY)) / ppm, 0];
        L.mouth = [L.target[0] + (sxMouth - W / 2) / ppm, 0.92, 0.2];
        return;
      }
      // the body at the left, under the name block (its head 22 px under the links, its feet 30 px over the head's end);
      // the mouth to its right, where the answer, written from the mouth to the right, still has room
      const tb = rectIn(".hb-text .links") || { bottom: H * 0.45 }, nameL = rectIn(".hb-name") || { left: gut };
      const top = tb.bottom + 22, floor = H - 30, ppm = Math.max(90, (floor - top) / 1.9);
      const sxBody = Math.max(nameL.left + 0.55 * ppm, gut + 0.5 * ppm);
      const textW = Math.min(440, Math.max(260, W * 0.24)), rpx = 2 * 0.46 * 1.08 * ppm;
      const sxMouth = Math.min(W - gut - textW - rpx - 16, Math.max(sxBody + 2.6 * ppm, W * 0.5));
      L = { tall, ppm, gut, body: [0, 0], cloudR: 0.46, dir: [0.12, 0.13, 1], facing: 1.2, flow: 1.6, textW };
      L.vis = H / ppm;
      L.target = [(W / 2 - sxBody) / ppm, (H / 2 - (H - floor)) / ppm, 0];
      L.mouth = [L.target[0] + (sxMouth - W / 2) / ppm, 1.08, 0.2];
    };

    // ---------------------------------------------------------------- the stage: a floor that catches the spot, a haze in the cone
    const radialTex = (stops, size) => { const c = doc.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, size, size); return new T.CanvasTexture(c); };
    const flat = (mat, w, d, order) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.renderOrder = order; scene.add(m); return m; };
    const floorLight = flat(new T.MeshBasicMaterial({ map: radialTex([[0, "rgba(150,160,255,0.34)"], [0.5, "rgba(110,120,245,0.12)"], [1, "rgba(90,100,235,0)"]], 256), transparent: true, depthWrite: false }), 4.2, 2.6, -2);
    const floor = flat(new T.ShadowMaterial({ color: 0x080a40, opacity: 0.32, transparent: true, depthWrite: false }), 4, 3, -1); floor.receiveShadow = true;

    // ---------------------------------------------------------------- the body
    const bodyMat = new T.MeshStandardMaterial({ color: 0xf2efea, roughness: 0.8, metalness: 0 });
    const holder = new T.Group(); scene.add(holder);
    let B = null;

    // ---------------------------------------------------------------- the devices, carried by the skin
    const graphite = new T.MeshStandardMaterial({ color: 0x2a2b30, roughness: 0.4, metalness: 0.4 });
    const black = new T.MeshStandardMaterial({ color: 0x0c0c0f, roughness: 0.15, metalness: 0.1 });
    const strapMat = new T.MeshStandardMaterial({ color: 0x24252b, roughness: 0.75, metalness: 0, side: T.DoubleSide, polygonOffset: false });
    const fabric = new T.MeshStandardMaterial({ color: 0xefece6, roughness: 0.88, metalness: 0, side: T.DoubleSide });
    function superPrism(a, b, z0, z1, m, pw) {
      const pts = []; for (let i = 0; i < m; i++) { const th = 2 * Math.PI * i / m, c = Math.cos(th), s = Math.sin(th); pts.push([a * Math.sign(c) * Math.pow(Math.abs(c), pw), b * Math.sign(s) * Math.pow(Math.abs(s), pw)]); }
      const pos = []; const tri = (p, q, r) => pos.push(...p, ...q, ...r);
      for (let i = 0; i < m; i++) { const j = (i + 1) % m, [ui, vi] = pts[i], [uj, vj] = pts[j];
        tri([ui, vi, z0], [uj, vj, z0], [uj, vj, z1]); tri([ui, vi, z0], [uj, vj, z1], [ui, vi, z1]); tri([0, 0, z0], [uj, vj, z0], [ui, vi, z0]); tri([0, 0, z1], [ui, vi, z1], [uj, vj, z1]); }
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
    }
    const tube = (pts, r, mat, closed) => new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p)), !!closed, "centripetal"), Math.max(8, pts.length * 6), r, 8, !!closed), mat);
    const DV = D.devices;
    const devs = Object.keys(DV).map((id) => {
      const d = DV[id], g = new T.Group(); g.matrixAutoUpdate = true;
      if (id === "watch") {
        // the case: 12-6 across the wrist (x), along the strap; 3-9 along the forearm (y); the crown towards the hand
        g.add(new T.Mesh(superPrism(0.0215, 0.0185, 0.0008, 0.0106, 48, 0.42), graphite));
        g.add(new T.Mesh(superPrism(0.0193, 0.0163, 0.0106, 0.0114, 48, 0.42), black));
        const crown = new T.Mesh(new T.CylinderGeometry(0.0028, 0.0028, 0.003, 16), graphite); crown.position.set(0.006, 0.0198, 0.0062); g.add(crown);
      } else if (id === "earbud") {
        // an earbud in the right ear: a small rounded bud in the concha, a short stem down and forward (device frame:
        // x forward, y up, z out of the ear)
        const white = new T.MeshStandardMaterial({ color: 0xf4f4f6, roughness: 0.25, metalness: 0.05 });
        const bud = new T.Mesh(new T.SphereGeometry(0.0085, 20, 14), white); bud.scale.set(1, 0.95, 0.8); g.add(bud);
        const tip = new T.Mesh(new T.SphereGeometry(0.0045, 14, 10), new T.MeshStandardMaterial({ color: 0xd9dbe1, roughness: 0.6 })); tip.position.set(0.001, 0, -0.006); g.add(tip);
        const stem = new T.Mesh(new T.CapsuleGeometry(0.0028, 0.016, 6, 10), white); stem.position.set(0.004, -0.013, 0.002); stem.rotation.z = 0.32; g.add(stem);
      } else if (id === "armphone") {
        // a phone in an upper-arm sports band: the phone (display out) in a thin holder on the band
        g.add(new T.Mesh(superPrism(0.039, 0.076, -0.0055, -0.0015, 64, 0.16), strapMat));
        g.add(new T.Mesh(superPrism(0.036, 0.073, -0.0015, 0.0055, 64, 0.16), graphite));
        g.add(new T.Mesh(superPrism(0.0338, 0.0708, 0.0055, 0.006, 64, 0.16), black));
      } else if (id === "ankle") {
        // a small tracker pod on an ankle strap
        g.add(new T.Mesh(superPrism(0.017, 0.013, 0.0004, 0.0095, 40, 0.5), graphite));
        g.add(new T.Mesh(superPrism(0.0145, 0.0105, 0.0095, 0.0101, 40, 0.5), black));
      } else if (id === "phone") {
        // the phone in the front pocket: flat on the thigh, its dark display outwards
        g.add(new T.Mesh(superPrism(0.036, 0.073, -0.0039, 0.0036, 64, 0.16), graphite));
        g.add(new T.Mesh(superPrism(0.0338, 0.0708, 0.0036, 0.0041, 64, 0.16), black));
        const isl = new T.Mesh(superPrism(0.006, 0.0022, 0.0041, 0.0043, 24, 0.5), new T.MeshBasicMaterial({ color: 0x050506 })); isl.position.y = 0.064; g.add(isl);
      } else if (id === "glasses") {
        // AI glasses in the manner of today's smart glasses: a rounded rectangular acetate front, broad temples with the
        // electronics (the IMU in the right one); all measures from the head's mesh (fit_devices.py, glasses2), in the
        // device frame: x forward, y up, z out of the right temple
        const G = d.glasses2, V3 = (a) => new T.Vector3(...a);
        const acetate = new T.MeshStandardMaterial({ color: 0x0f0f12, roughness: 0.28, metalness: 0.05 });
        const lensMat = new T.MeshStandardMaterial({ color: 0x8a96c8, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.38, side: T.DoubleSide });
        const across = new T.Vector3(0, 0, -1), up = new T.Vector3(0, 1, 0), fwd = new T.Vector3(1, 0, 0);
        const lcR = V3(G.lc_r), lcL = V3(G.lc_l), mid = lcR.clone().add(lcL).multiplyScalar(0.5), half = lcR.distanceTo(lcL) / 2;
        // a lens of the Wayfarer kind: a rounded trapezoid, wide at the top, narrower at the bottom, softly rounded
        const rr = (w, h, r) => { const pts = [[-w, h], [w, h], [w - 0.0045, -h], [-w + 0.0045, -h]], rad = [r, r, r * 1.5, r * 1.5], sh = new T.Shape();
          const P2 = pts.map((p) => new T.Vector2(...p));
          for (let i = 0; i < 4; i++) {
            const a = P2[(i + 3) % 4], b = P2[i], c = P2[(i + 1) % 4], ra = rad[i];
            const p0 = b.clone().add(a.clone().sub(b).normalize().multiplyScalar(ra)), p1 = b.clone().add(c.clone().sub(b).normalize().multiplyScalar(ra));
            if (i === 0) sh.moveTo(p0.x, p0.y); else sh.lineTo(p0.x, p0.y);
            sh.quadraticCurveTo(b.x, b.y, p1.x, p1.y);
          }
          sh.closePath(); return sh; };
        const front = new T.Group();
        [-1, 1].forEach((sd) => {                                                   // sd -1: the right lens (towards +z), +1: the left
          const ring = rr(G.rw + G.rim, G.rh + G.rim * 1.1, 0.016); ring.holes.push(rr(G.rw, G.rh, 0.012));
          const geo = new T.ExtrudeGeometry(ring, { depth: G.depth, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 2, curveSegments: 10 });
          geo.translate(sd * half, 0, -G.depth / 2); const m = new T.Mesh(geo, acetate); front.add(m);
          const lens = new T.Mesh(new T.ShapeGeometry(rr(G.rw, G.rh, 0.012), 10), lensMat); lens.position.set(sd * half, 0, -0.0005); front.add(lens);
        });
        const br = new T.Mesh(new T.BoxGeometry(2 * (half - G.rw) + 0.004, 0.006, G.depth * 0.9), acetate); br.position.set(0, G.rh * 0.62, 0); front.add(br);
        // the front: its local x = across (to the wearer's left), y = up, z = forward; tilted 8 deg (bottom towards the face)
        const fb = new T.Matrix4().makeBasis(across, up, fwd); front.quaternion.setFromRotationMatrix(fb); front.position.copy(mid);
        front.rotateX(-G.tilt * Math.PI / 180);
        g.add(front);
        // the temples: hinge -> the ear's root (level) -> a short bend down behind the ear; broader at the front (electronics)
        const bar = (a, b, h, t) => { const A = V3(a), Bv = V3(b), dir = Bv.clone().sub(A), len = dir.length(); dir.normalize();
          const side = new T.Vector3().crossVectors(dir, up).normalize(), u2 = new T.Vector3().crossVectors(side, dir).normalize();
          const m = new T.Mesh(new T.BoxGeometry(len + t * 0.6, h, t), acetate); m.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(dir, u2, side));
          m.position.copy(A).add(Bv).multiplyScalar(0.5); return m; };
        [["_r", -1], ["_l", 1]].forEach(([k, sd]) => {
          const hinge = G["hinge" + k], ear = G["ear" + k], md = G["mid" + k], tip = G["tip" + k];
          const corner = mid.clone().addScaledVector(across, sd * (half + G.rw + G.rim * 0.6)).addScaledVector(up, G.rh * 0.45);
          g.add(bar(corner.toArray(), hinge, 0.009, 0.0055));
          const p1 = V3(hinge).lerp(V3(ear), 0.55).toArray();
          g.add(bar(hinge, p1, 0.011, 0.0058)); g.add(bar(p1, ear, 0.0075, 0.0046));
          g.add(bar(ear, md, 0.006, 0.0042)); g.add(bar(md, tip, 0.0055, 0.004));
        });
        // the electronics with the IMU in the right temple, around the device origin
        const hous = bar(V3(G.hinge_r).lerp(V3(G.ear_r), 0.12).toArray(), V3(G.hinge_r).lerp(V3(G.ear_r), 0.5).toArray(), 0.0125, 0.0068);
        const hc = hous.position.clone(); hous.position.set(0, 0, 0.0005).lerp(hc, 0.5); g.add(hous);
      }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(g);
      return { id, d, g, mag: d.acc_mag, med: d.median, sc: d.scale };
    });
    // skinned surfaces: the watch strap and the pocket, rows of points carried by the skin
    const sheet = (rows, mat, closed) => {
      const nr = rows.length, nc = rows[0].length, cols = closed ? nc + 1 : nc, pos = new Float32Array(nr * cols * 3), idx = [];
      for (let r = 0; r < nr - 1; r++) for (let c = 0; c < cols - 1; c++) { const a = r * cols + c, b = a + cols; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      const g = new T.BufferGeometry(); g.setIndex(idx); g.setAttribute("position", new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
      const m = new T.Mesh(g, mat); m.frustumCulled = false; m.castShadow = true; scene.add(m);
      return { rows, nr, nc, cols, closed, m };
    };
    const sheets = [];
    for (const id of Object.keys(DV)) {
      const pr = DV[id].parts; if (!pr) continue;
      if (pr.strap) { const sh = sheet(pr.strap, strapMat, true); sh.id = id; sheets.push(sh); }
      if (pr.band) { const sh = sheet(pr.band, strapMat, true); sh.id = id; sheets.push(sh); }
    }

    // linear blend skinning of a bind-pose point, as the GPU does for the mesh
    const mats = new Map(); let boneIx = null;
    const skinMat = (names, ws) => {
      const key = names.join(",") + ws.join(","); let m = mats.get(key);
      if (!m) { m = { names, ws, M: new T.Matrix4() }; mats.set(key, m); }
      return m;
    };
    const tmpM = new T.Matrix4(), tmpV = new T.Vector3();
    function updateSkinMats() {
      const sk = B.skel; sk.bones.forEach((b, i) => { b._bm = (b._bm || new T.Matrix4()).multiplyMatrices(b.matrixWorld, sk.boneInverses[i]); });
      for (const m of mats.values()) {
        const e = m.M.elements; e.fill(0);
        m.names.forEach((n, k) => { const b = sk.bones[boneIx[n]]; const be = b._bm.elements; for (let q = 0; q < 16; q++) e[q] += m.ws[k] * be[q]; });
        m.M.multiply(B.bindMatrix);
      }
    }
    devs.forEach((dv) => { const a = dv.d.anchor; dv.skin = skinMat(a.skin[0], a.skin[1]); dv.A = [a.O, a.Y, a.Z].map((p) => new T.Vector3(...p)); });
    sheets.forEach((s) => s.rows.forEach((row) => row.forEach((pt) => { pt.sm = skinMat(pt.skin[0], pt.skin[1]); pt.v = new T.Vector3(...pt.p); })));
    const pO = new T.Vector3(), pY = new T.Vector3(), pZ = new T.Vector3(), bx = new T.Vector3(), by = new T.Vector3(), bz = new T.Vector3(), basis = new T.Matrix4();
    function placeDevices() {
      updateSkinMats();
      for (const dv of devs) {
        dv.g.visible = SHOWALL || onSeg(dv.id) >= 0;
        const M = dv.skin.M; pO.copy(dv.A[0]).applyMatrix4(M); pY.copy(dv.A[1]).applyMatrix4(M); pZ.copy(dv.A[2]).applyMatrix4(M);
        by.subVectors(pY, pO).normalize(); bz.subVectors(pZ, pO); bz.addScaledVector(by, -bz.dot(by)).normalize(); bx.crossVectors(by, bz);
        basis.makeBasis(bx, by, bz); dv.g.position.copy(pO); dv.g.quaternion.setFromRotationMatrix(basis);
      }
      for (const s of sheets) {
        s.m.visible = SHOWALL || onSeg(s.id) >= 0; if (!s.m.visible) continue;
        const P = s.m.geometry.attributes.position.array;
        for (let r = 0; r < s.nr; r++) for (let c = 0; c < s.cols; c++) { const pt = s.rows[r][c % s.nc]; tmpV.copy(pt.v).applyMatrix4(pt.sm.M); P.set([tmpV.x, tmpV.y, tmpV.z], (r * s.cols + c) * 3); }
        s.m.geometry.attributes.position.needsUpdate = true; s.m.geometry.computeVertexNormals();
      }
    }

    // ---------------------------------------------------------------- the segments: the dance, then a second activity, again and again
    // Each segment: its motion (a part of one 10-s window, once or twice), its devices' signals, its point's path in the
    // cloud (sliding windows), the real answer for its window. The next one starts once its body has loaded.
    const SEGS = D.segments, NSEG = SEGS.length;
    SEGS.forEach((g) => { g.L = g.loop.t1 - g.loop.t0; g.dur = g.L; });       // one pass of the motion per activity
    const bodies = new Array(NSEG).fill(null);
    let segK = 0, segStart = 0, prevK = -1, prevAnchor = null;
    const segTau = (now) => now - segStart;
    const clipAt = (now) => { const g = SEGS[segK], tt = now - segStart; return g.loop.t0 + (((tt % g.L) + g.L) % g.L); };
    function stepSegment(now) {
      while (now - segStart >= SEGS[segK].dur) {
        const nk = (segK + 1) % NSEG, ok = bodies[nk];
        prevAnchor = anchorAt(segK).clone();
        segStart += SEGS[segK].dur; prevK = segK; if (ok) segK = nk;
      }
    }
    const anchorV = new T.Vector3();
    function anchorAt(k) { return anchorV.set(...SEGS[k].point); }        // the embedding of exactly the window shown, fixed

    // ---------------------------------------------------------------- the model: SetCon's embedding space as a cloud of real points
    // (tools/setcon_pred/cloud.py: the five activities of the SetCon page, 3D principal components); it turns slowly; the
    // point of the window on screen (the three devices together) comes out of the lanes' meeting point and settles at its
    // real place, then the answer is written
    const CL = D.cloud, model = new T.Group(); scene.add(model);
    const dotTex = radialTex([[0, "rgba(255,255,255,1)"], [0.45, "rgba(255,255,255,0.85)"], [1, "rgba(255,255,255,0)"]], 64);
    // per activity a calm colour (lunges, pickup, stairs, dance, badminton, then the Nymeria clips added for the page)
    const ACOL = [[0.62, 0.7, 1], [0.66, 0.93, 0.83], [1, 0.83, 0.64], [1, 0.62, 0.78], [0.84, 0.76, 1], [0.6, 0.9, 1], [1, 0.95, 0.6], [1, 0.7, 0.6], [0.72, 1, 0.66]];
    let cloudPts = null, heroDot = null, heroGlow = null;
    if (CL) {
      const n = CL.points.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      CL.points.forEach((p, i) => { pos.set(p, i * 3); col.set(ACOL[CL.label[i] % ACOL.length], i * 3); });
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("color", new T.BufferAttribute(col, 3));
      const crisp = radialTex([[0, "rgba(255,255,255,1)"], [0.62, "rgba(255,255,255,1)"], [0.8, "rgba(255,255,255,0.25)"], [1, "rgba(255,255,255,0)"]], 64);
      cloudPts = new T.Points(g, new T.PointsMaterial({ size: 0.022, map: crisp, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true }));
      model.add(cloudPts);
      heroDot = new T.Mesh(new T.SphereGeometry(0.055, 16, 12), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); model.add(heroDot);
      heroDot.castShadow = false; heroDot.renderOrder = 6; heroDot.visible = false;   // (an unlit point writes no depth: no dark hole in the lanes)
      heroGlow = new T.Sprite(new T.SpriteMaterial({ map: dotTex, color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 })); heroGlow.renderOrder = 6; heroGlow.visible = false; model.add(heroGlow);
    }
    const up0 = new T.Vector3(0, 1, 0), heroAt = new T.Vector3();
    const baseCol = cloudPts ? cloudPts.geometry.attributes.color.array.slice() : null;
    let litK = -1, litMix = 0;
    function lightCluster(label, mix) {                                          // the active activity's points brighter
      if (!cloudPts) return;
      const C = cloudPts.geometry.attributes.color.array;
      for (let i = 0; i < CL.label.length; i++) { const a = CL.label[i] === label ? 0.55 + 0.45 * mix : 0.55; for (let k = 0; k < 3; k++) C[i * 3 + k] = Math.min(1, baseCol[i * 3 + k] * (0.45 + a * 0.85)); }
      cloudPts.geometry.attributes.color.needsUpdate = true;
    }
    // the window's own point stays at the lanes' meeting point: the cloud is turned so that this point lies on its right,
    // towards the text, and it spins slowly about the line from its centre through this point, which therefore never moves
    const X1 = new T.Vector3(1, 0, 0), q0 = new T.Quaternion(), qs = new T.Quaternion(), qm = new T.Quaternion(), hn = new T.Vector3();
    const mRot = new T.Matrix4(), mAll = new T.Matrix4(), mPos = new T.Matrix4();
    model.matrixAutoUpdate = false;
    let modelPulse = 0, landing = 0;
    // the cloud turns slowly, mirrored left-right, about the horizontal line through the dance window's point, which
    // therefore stays where the lanes meet; the other activity's point turns with the cloud; the lanes end on the current
    // point in every frame
    const mean0 = anchorAt(0).clone(), mouthNow = new T.Vector3();
    q0.setFromUnitVectors(hn.copy(mean0).normalize(), X1);
    function placeCloud(now) {
      const R = L.cloudR;
      qs.setFromAxisAngle(X1, 0.5 + now * 0.16); qm.multiplyQuaternions(qs, q0);
      mRot.makeRotationFromQuaternion(qm); mAll.makeScale(-R, R, R).multiply(mRot);
      tmpV.copy(mean0).applyMatrix4(mAll);
      mAll.premultiply(mPos.makeTranslation(L.mouth[0] - tmpV.x, L.mouth[1] - tmpV.y, L.mouth[2] - tmpV.z));
      model.matrix.copy(mAll); model.matrixWorldNeedsUpdate = true; model.updateMatrixWorld(true);
    }
    function placeModel(now) {
      placeCloud(now);
      const R = L.cloudR, g = SEGS[segK], tau = segTau(now);
      // the point: the embedding of the window shown, fixed in the cloud (it turns with it); at a change of activity the old
      // one goes out where it is (with its lanes and its answer), the new one lights up in its own region once the lanes arrive
      heroAt.copy(anchorAt(segK));
      mouthNow.copy(heroAt).applyMatrix4(model.matrix);
      const lab = CL ? CL.ids.indexOf(g.clip) : -1;
      if (lab !== litK) { litK = lab; litMix = 0; }
      if (litMix < 1) { litMix = Math.min(1, litMix + 0.03); lightCluster(lab, ease(litMix)); }
      if (cloudPts) { cloudPts.material.size = 0.026 * (L.tall ? 1.15 : 1); cloudPts.material.opacity = 0.95; }
      if (heroDot) {
        heroDot.position.copy(heroAt); heroGlow.position.copy(heroAt);
        const on = Math.min(1, landing * 1.5);
        heroDot.material.opacity = on; heroDot.visible = heroGlow.visible = on > 0.004; heroDot.scale.setScalar((0.85 + 0.15 * on + 0.08 * modelPulse) * 0.36 / R);
        heroGlow.material.opacity = on * (0.14 + 0.06 * modelPulse); heroGlow.scale.setScalar(0.26 * 0.36 / R);
      }
    }

    // ---------------------------------------------------------------- the lanes: per device its six channels as a live plot
    // Out of the device a short soft turn (8 % of the way), then a straight time axis to the right, the channels parallel
    // around the lane's baseline (acceleration x/y/z above, stronger; angular rate x/y/z below, finer), newest values at the
    // device; three lanes one above the other (glasses, watch, phone) that meet only just before the cloud.
    const L0flow = () => 2.4;
    const clipT = (now) => clipAt(now);
    const chAt = (d, c, t) => { const S = SEGS[segK].ch[d.id], a = S.ch[c], n = a.length, x = Math.max(0, Math.min(n - 1.001, t * D.hz)), i = Math.floor(x), f = x - i;
      const p0 = a[Math.max(0, i - 1)], p1 = a[i], p2 = a[Math.min(n - 1, i + 1)], p3 = a[Math.min(n - 1, i + 2)];
      const v = 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f);
      return Math.tanh(1.2 * (v - S.ch_med[c]) / S.ch_scale[c]); };
    const TONES_MORE = { earbud: [[1, 0.8, 0.46], [1, 0.9, 0.68], [0.98, 0.68, 0.32]],
      armphone: [[0.58, 0.88, 1], [0.78, 0.95, 1], [0.42, 0.76, 1]], ankle: [[0.72, 0.95, 0.72], [0.86, 1, 0.84], [0.58, 0.88, 0.62]] };
    const TONES = { watch: [[1, 1, 1], [0.84, 0.88, 1], [0.7, 0.76, 1]], glasses: [[1, 0.8, 0.46], [1, 0.9, 0.68], [0.98, 0.68, 0.32]], phone: [[0.58, 0.88, 1], [0.78, 0.95, 1], [0.42, 0.76, 1]] };
    Object.assign(TONES, TONES_MORE);
    const SEPS = [0.48, 0.0, -0.48];                                                // the three lanes: top, middle, bottom (per activity's order)
    const START = { watch: [0, 0, 0.012], glasses: [0, 0, 0.002], phone: [0, 0.05, 0.0045], earbud: [0, -0.006, 0.006], armphone: [0, 0.05, 0.006], ankle: [0, 0, 0.0101] };
    let SHOWALL = false;                                                            // checks: every wearable at once
    const onSeg = (id) => SEGS[segK].devices.indexOf(id);                            // its lane (0..2) in this activity, or -1
    const NS = 150;
    function strip(n) {
      const g = new T.BufferGeometry(), p = new Float32Array(n * 2 * 3), c = new Float32Array(n * 2 * 4), idx = [];
      for (let i = 0; i < n - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(idx); g.setAttribute("position", new T.BufferAttribute(p, 3).setUsage(T.DynamicDrawUsage)); g.setAttribute("color", new T.BufferAttribute(c, 4).setUsage(T.DynamicDrawUsage));
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide })); m.frustumCulled = false; m.renderOrder = 3;
      return m;
    }
    const lanes = [];
    devs.forEach((dv) => { for (let c = 0; c < 6; c++) { const m = strip(NS); scene.add(m); lanes.push({ dv, c, m, col: TONES[dv.id][c % 3], acc: c < 3, pts: new Float32Array(NS * 3) }); } });
    const q = new T.Vector3(), dp = new T.Vector3(), camDir = new T.Vector3(), nrm = new T.Vector3(), tg = new T.Vector3(), up = new T.Vector3(0, 1, 0);
    const b0 = new T.Vector3(), b1 = new T.Vector3(), b2 = new T.Vector3(), b3 = new T.Vector3();
    const bez = (u, outv) => { const v = 1 - u; return outv.set(0, 0, 0).addScaledVector(b0, v * v * v).addScaledVector(b1, 3 * v * v * u).addScaledVector(b2, 3 * v * u * u).addScaledVector(b3, u * u * u); };
    let tokensOn = 0;
    // a lane's spine: one soft curve in space from the device (it moves with the dance) out to the right and a little
    // towards the viewer, then in to the mouth; the three lanes lie apart in the middle and meet only at the mouth
    function spine(id, dpos) {
      const M = mouthNow, dx = Math.max(0.6, M.x - dpos.x), sep = SEPS[Math.max(0, onSeg(id))] * (L.tall ? 0.7 : 1);
      b0.copy(dpos); b3.copy(M);
      b1.set(dpos.x + 0.3 * dx, dpos.y + 0.85 * (M.y + sep - dpos.y), dpos.z + 0.35);
      b2.set(M.x - 0.36 * dx, M.y + sep * 0.95, M.z + 0.18);
    }
    function drawCurves(now) {
      cam.getWorldDirection(camDir);
      const tau = segTau(now), dim = (prevK < 0 ? 1 : Math.min(1, ease(tau / 0.35))) * Math.min(1, (SEGS[segK].dur - tau) / 0.4 + (NSEG > 1 ? 0 : 1));
      const grow = ease(now / L.flow), sp = L.tall ? 0.026 : 0.025, amp = L.tall ? 0.014 : 0.0145;
      for (const ln of lanes) {
        ln.m.visible = onSeg(ln.dv.id) >= 0; if (!ln.m.visible) continue;
        const P = ln.m.geometry.attributes.position.array, C = ln.m.geometry.attributes.color.array, pts = ln.pts;
        ln.dv.g.localToWorld(dp.set(...START[ln.dv.id]));
        spine(ln.dv.id, dp);
        const off = (ln.c < 3 ? ln.c - 2.6 : ln.c - 2.4) * sp;                      // acc above the spine, gyro below, a small gap between
        for (let i = 0; i < NS; i++) {
          const u = i / (NS - 1);
          bez(u, q); bez(Math.min(1, u + 0.01), tg); tg.sub(q).normalize();
          nrm.crossVectors(camDir, tg).normalize(); if (nrm.y < 0) nrm.negate();    // "up" across the lane, as seen
          const spread = ease(u / 0.07) * (1 - ease((u - 0.72) / 0.28));
          const sv = chAt(ln.dv, ln.c, clipT(now - u * L.flow));
          const h = (off + (ln.acc ? amp : amp * 0.8) * sv) * spread;
          pts[i * 3] = q.x + nrm.x * h; pts[i * 3 + 1] = q.y + nrm.y * h; pts[i * 3 + 2] = q.z + nrm.z * h;
        }
        const w = (ln.acc ? 0.0075 : 0.0042) * (L.tall ? 1.15 : 1);
        for (let i = 0; i < NS; i++) {
          const a = Math.max(0, i - 1), b = Math.min(NS - 1, i + 1);
          tg.set(pts[b * 3] - pts[a * 3], pts[b * 3 + 1] - pts[a * 3 + 1], pts[b * 3 + 2] - pts[a * 3 + 2]).normalize();
          nrm.crossVectors(tg, camDir).normalize().multiplyScalar(w / 2);
          P.set([pts[i * 3] + nrm.x, pts[i * 3 + 1] + nrm.y, pts[i * 3 + 2] + nrm.z, pts[i * 3] - nrm.x, pts[i * 3 + 1] - nrm.y, pts[i * 3 + 2] - nrm.z], i * 6);
          const u = i / (NS - 1);
          const ph = (u * 3 - now * 1.2 + onSeg(ln.dv.id) * 0.3) % 1, pulse = tokensOn * Math.pow(Math.max(0, 1 - Math.abs(((ph + 1) % 1) - 0.5) * 7), 2);
          const al = (u < grow ? 1 : 0) * Math.min(1, (1 - u) * 9) * (ln.acc ? 1 : 0.55) * Math.max(0, Math.min(1, dim));
          const br = 0.85 + 0.15 * (1 - u) + 0.8 * pulse;
          for (const o of [0, 4]) { C[i * 8 + o] = Math.min(1, ln.col[0] * br); C[i * 8 + o + 1] = Math.min(1, ln.col[1] * br); C[i * 8 + o + 2] = Math.min(1, ln.col[2] * br); C[i * 8 + o + 3] = al; }
        }
        ln.m.geometry.attributes.position.needsUpdate = true; ln.m.geometry.attributes.color.needsUpdate = true;
      }
    }

    // ---------------------------------------------------------------- the answer: token by token, then it stands, then it goes
    // one cycle = one pass of the motion: the question, the curves arrive (2.4 s), the tokens, the answer stands, it goes
    // one cycle = one segment: the question, the lanes bring the signal (2.4 s), the point lights, the tokens, the answer
    // stands, it goes
    const T_Q = 0.12;
    let shown = -2, cycleN = -1;
    function writeAnswer(now) {
      const g = SEGS[segK], LM = g.lm, TOK = LM ? LM.tokens : [], t = segTau(now), T_TOK = Math.max(1 / 40, Math.min(0.11, 2.0 / Math.max(1, TOK.length))), T_END = g.dur - 0.45;
      const first = prevK < 0, T_L = first ? L.flow - 0.1 : 0.55, T_A = T_L + 0.35;   // the first time: when the growing lanes arrive
      const tEnd = T_A + TOK.length * T_TOK, cyc = segStart * 1000 + segK;
      tokensOn = t > T_A - 0.6 && t < tEnd ? 1 : Math.max(0, 1 - Math.abs(t - tEnd) / 0.8) * (t >= tEnd ? 1 : 0);
      landing = t < T_END ? Math.max(0, Math.min(1, (t - T_L) / 0.3)) : Math.max(0, 1 - (t - T_END) / 0.35);   // lights up as the lanes arrive
      modelPulse = t > T_A - 0.6 && t < tEnd + 0.3 ? 0.6 + 0.4 * Math.abs(Math.sin(now * 7.5)) : 0;
      if (!out || !LM) return;
      if (cyc !== cycleN) { cycleN = cyc; outQ.textContent = LM.question; outA.textContent = ""; shown = -1; out.classList.remove("done"); }
      out.classList.toggle("on", t > T_Q && t < T_END);
      const k = t < T_A ? 0 : Math.min(TOK.length, Math.floor((t - T_A) / T_TOK) + 1);
      if (k !== shown) { shown = k; outA.textContent = TOK.slice(0, k).join(""); }
      out.classList.toggle("done", k >= TOK.length);
    }
    const proj = new T.Vector3(), outA0 = out ? out.querySelector(".h3-a") : null;
    function placeOutput() {
      if (!out) return;
      if (L.tall) { out.style.transform = ""; out.style.maxWidth = ""; return; }
      // the answer starts at the mouth: its first line at the mouth's height, just right of the small cloud; the question
      // and the line above it; nothing of it lies on the lanes (they come from the left)
      proj.set(...L.mouth).project(cam);
      const W = W0(), x = (proj.x + 1) / 2 * W, y = (1 - proj.y) / 2 * H0(), r = 2 * L.cloudR * 1.08 * L.ppm;
      const left = x + r + 18, width = Math.min(L.textW + 40, W - left - L.gut);
      const head = outA0 ? outA0.offsetTop : 40, line = outA0 ? parseFloat(getComputedStyle(outA0).lineHeight) || 30 : 30;
      const top = Math.min(y - head - line / 2, H0() - 10 - out.offsetHeight);
      out.style.maxWidth = Math.round(width) + "px";
      out.style.transform = "translate(" + Math.round(left) + "px," + Math.round(top) + "px)";
    }

    // ---------------------------------------------------------------- timeline, camera, frames
    let raf = 0, visible = false, ready = false, lastNow = 0;
    const tgt = new T.Vector3(), dirv = new T.Vector3();
    let VIEW = null;                                                              // checks: a close view of one device
    const placeCam = (now) => {
      if (VIEW) { const dv = devs.find((x) => x.id === VIEW.id), p = dv ? dv.g.localToWorld(new T.Vector3(...(VIEW.at || [0, 0, 0]))) : new T.Vector3(...VIEW.p); dirv.set(...VIEW.dir).normalize(); if (VIEW.local && dv) dirv.applyQuaternion(dv.g.quaternion); const d = 1.2, asp = W0() / H0();
        cam.fov = 2 * Math.atan(VIEW.vis / (2 * d)) * 180 / Math.PI; cam.position.copy(p).addScaledVector(dirv, d); cam.lookAt(p); cam.near = 0.05; cam.far = 20; cam.updateProjectionMatrix(); return; }
      tgt.set(...L.target); dirv.set(...L.dir).normalize();
      dirv.applyAxisAngle(up0, 0.03 * Math.sin(now * 0.2));                       // a slow drift
      const d = 9.2;
      cam.fov = 2 * Math.atan(L.vis / (2 * d)) * 180 / Math.PI; cam.position.copy(tgt).addScaledVector(dirv, d); cam.lookAt(tgt);
      cam.near = Math.max(0.05, d - 8); cam.far = d + 14; cam.updateProjectionMatrix();
    };
    const glowEl = host.querySelector(".h3-glow");
    const placeStage = () => {
      const bx0 = L.body[0], bz0 = L.body[1];
      key.position.set(bx0 + 2.5, 4.2, bz0 + 4.5); key.target.position.set(bx0, 0.9, bz0); key.target.updateMatrixWorld();
      floorLight.position.set(bx0 + 0.6, 0.001, bz0 - 0.1); floor.position.set(bx0, 0.002, bz0);
    };
    const resize = () => { const w = W0(), h = H0(); if (w < 2 || h < 2) return; renderer.setSize(w, h, false); cam.aspect = w / h; layout(); placeStage(); if (B) faceBody(); cam.updateProjectionMatrix(); if (ready && !raf) tick(lastNow); };
    const rW = new T.Vector3();
        function faceBody() { holder.rotation.y = L.facing - B.meanYaw; }
    function poseBody(now) {
      const nb = bodies[segK]; if (nb && nb !== B) { holder.remove(B.body); B = nb; holder.add(B.body); faceBody(); }
      const ct = clipT(now); B.mixer.setTime(ct);
      let fy = B.floorY;
      if (B.footY) { const x = Math.max(0, Math.min(398.999, ct * 20)), i = Math.floor(x), f = x - i; fy = B.footY[i] * (1 - f) + B.footY[i + 1] * f; }
      holder.position.set(0, 0, 0); holder.updateMatrixWorld(true);
      B.rootB.getWorldPosition(rW); holder.position.set(L.body[0] - rW.x, -fy, L.body[1] - rW.z); holder.updateMatrixWorld(true);
    }
    const PERF = /[?&]perf=1/.test(location.search), perf = [];
    let dprNow = renderer.getPixelRatio(), slow = 0, lastMs = 0, clock = 0;
    const CAPTURE = /[?&]capture=1/.test(location.search);
    function frame(ms) {
      raf = 0; if (!visible || doc.hidden) return;
      raf = requestAnimationFrame(frame);
      if (lastMs && ms - lastMs > 40) { if (++slow > 45 && dprNow > 1) { dprNow = Math.max(1, dprNow - 0.25); renderer.setPixelRatio(dprNow); resize(); slow = 0; } } else slow = Math.max(0, slow - 1);
      const dt = lastMs ? Math.min(0.1, Math.max(0, (ms - lastMs) / 1000)) : 0;   // the clock never jumps (hidden tab, stalled frame)
      lastMs = ms; clock += dt;
      tick(clock);
    }
    const fadeMats = [bodyMat, graphite, black, strapMat, fabric];
    function fadeBody(now) {
      const g = SEGS[segK], t = segTau(now), tau = ((t % g.L) + g.L) % g.L;
      const o = now < 0.3 ? 1 : g.loop.seam ? 1 : Math.max(0, Math.min(1, tau / 0.3, (g.L - tau) / 0.25));
      fadeMats.forEach((m) => { m.transparent = o < 1; m.opacity = o; });
      devs.forEach((dv) => dv.g.traverse((x) => { if (x.isMesh && x.material && !fadeMats.includes(x.material)) { x.material.transparent = true; x.material.opacity = Math.min(x.material.userData.op0 ?? (x.material.userData.op0 = x.material.opacity), 1) * o; } }));
    }
    function tick(now) {
      const pt0 = PERF ? performance.now() : 0;
      lastNow = now;
      stepSegment(now);
      poseBody(now); placeDevices(); fadeBody(now);
      placeCam(now); placeModel(now); writeAnswer(now); drawCurves(now);
      renderer.render(scene, cam);
      placeOutput();
      if (glowEl) { proj.set(L.body[0], 1.0, L.body[1]).project(cam); glowEl.style.setProperty("--lx", Math.round((proj.x + 1) / 2 * W0()) + "px"); glowEl.style.setProperty("--ly", Math.round((1 - proj.y) / 2 * H0()) + "px"); }
      if (PERF) { perf.push(performance.now() - pt0); if (perf.length > 2000) perf.shift(); }
    }
    const kick = () => { if (!raf && visible && ready && !doc.hidden) { lastMs = 0; raf = requestAnimationFrame(frame); } };
    new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; kick(); }, { threshold: 0 }).observe(stage);
    doc.addEventListener("visibilitychange", kick);
    new ResizeObserver(resize).observe(stage);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => resize());
    layout(); placeStage();
    const loadBody = (k) => new Promise((res, rej) => new T.GLTFLoader().load(SEGS[k].file, (g) => {
      const body = g.scene; let sk = null;
      body.traverse((o) => { if (o.isSkinnedMesh) { sk = o; o.material = bodyMat; o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; } });
      const clip = g.animations[0]; clip.tracks.forEach((t) => t.setInterpolation && t.setInterpolation(T.InterpolateLinear));
      const mixer = new T.AnimationMixer(body); mixer.clipAction(clip).play();
      const bones = sk.skeleton.bones; if (!boneIx) { boneIx = {}; bones.forEach((b, i) => { boneIx[b.name] = i; }); }
      const rootB = bones[boneIx.root] || bones[0], feet = bones.filter((b) => /foot|toe|ball/.test(b.name)), tmp = new T.Vector3();
      let floorY = Infinity; for (let f = 0; f < 400; f += 4) { mixer.setTime(f / 20); body.updateMatrixWorld(true); for (const b of feet) floorY = Math.min(floorY, b.getWorldPosition(tmp).y); }
      // a climb (stairs): the floor follows the lower foot, frame by frame (smoothed over 0.3 s), so the body stays on the stage
      let footY = null;
      if (SEGS[k].ground === "frame") {
        const raw = []; for (let f = 0; f < 400; f++) { mixer.setTime(f / 20); body.updateMatrixWorld(true); let m = Infinity; for (const b of feet) m = Math.min(m, b.getWorldPosition(tmp).y); raw.push(m); }
        footY = raw.map((_, i) => { let a = 0, n = 0; for (let j = Math.max(0, i - 3); j <= Math.min(399, i + 3); j++) { a += raw[j]; n++; } return a / n; });
      }
      // the body's mean facing over its part (so that it turns its right side, with the devices, to the viewer)
      let sx = 0, sz = 0; const qq = new T.Quaternion();
      for (let t = SEGS[k].loop.t0; t < SEGS[k].loop.t1; t += 0.25) { mixer.setTime(t); body.updateMatrixWorld(true); const f = new T.Vector3(0, 0, 1).applyQuaternion(rootB.getWorldQuaternion(qq)); sx += f.x; sz += f.z; }
      bodies[k] = { body, mixer, rootB, skel: sk.skeleton, bindMatrix: sk.bindMatrix, floorY, footY, meanYaw: Math.atan2(sx, sz) };
      res(bodies[k]);
    }, undefined, rej));
    loadBody(0).then((b) => {
      B = b; holder.add(B.body); faceBody();
      tick(0);
      requestAnimationFrame(() => { host.classList.add("live"); if (/[?&]hold=1/.test(location.search) || CAPTURE) return; ready = true; kick(); });
      // the other segments' bodies, one after the other, after the first is running
      let chain = Promise.resolve(); for (let k = 1; k < NSEG; k++) chain = chain.then(() => loadBody(k)).catch(() => {});
    }).catch((e) => { settle(); staticAnswer(D); console.warn("Homepage: the body could not load, the still stays.", e && e.message); });
    window.__loadAll = () => Promise.all(SEGS.map((g, k) => bodies[k] ? 1 : loadBody(k)));
    window.__hero3d = { seek: (s) => { clock = s; }, state: () => ({ now: lastNow, seg: SEGS[segK].clip }), loadAll: () => window.__loadAll(), perf, view: (v) => { VIEW = v; }, showAll: () => { SHOWALL = true; },
      dbg: () => { const w = devs.find((x) => x.id === "watch"), s0 = sheets[0]; if (!w || !s0) return null; const cen = new T.Vector3(); s0.rows[1].forEach((pt) => cen.add(tmpV.copy(pt.v).applyMatrix4(pt.sm.M))); cen.multiplyScalar(1 / s0.rows[1].length);
        const z = new T.Vector3(0, 0, 1).applyQuaternion(w.g.quaternion), y = new T.Vector3(0, 1, 0).applyQuaternion(w.g.quaternion), rad = w.g.position.clone().sub(cen); const r = rad.length(); rad.normalize();
        const ax = tmpV.copy(s0.rows[2][0].v).applyMatrix4(s0.rows[2][0].sm.M).sub(new T.Vector3().copy(s0.rows[0][0].v).applyMatrix4(s0.rows[0][0].sm.M)).normalize();
        return { r_mm: Math.round(r * 1000), z_dot_radial: +z.dot(rad).toFixed(3), y_dot_axis: +y.dot(ax).toFixed(3) }; },
      world: (id) => { const dv = devs.find((x) => x.id === id); return dv ? [dv.g.position.toArray(), new T.Vector3(0, 0, 1).applyQuaternion(dv.g.quaternion).toArray()] : null; },
      step: (t) => new Promise((res) => { tick(t); requestAnimationFrame(() => res(1)); }), busy: () => false,
      rects: () => { const r = (pts) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { const v = p.clone().project(cam), x = (v.x + 1) / 2 * W0(), y = (1 - v.y) / 2 * H0(); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, y0, x1, y1].map(Math.round); };
        const bd = []; if (B) { const r0 = B.rootB.getWorldPosition(new T.Vector3()); B.body.traverse((o) => { if (!o.isBone || /null/.test(o.name)) return; const v = o.getWorldPosition(new T.Vector3());
          if (Math.hypot(v.x - r0.x, v.z - r0.z) < 1.3 && v.y > -0.3 && v.y < 2.4) bd.push(v); }); }   // the body's joints (helper nodes far away left out)
        const bodyR = bd.length ? (() => { const qq = r(bd), m = Math.round((qq[3] - qq[1]) * 0.07); return [qq[0] - m, qq[1] - m, qq[2] + m, qq[3] + m]; })() : null;
        const mo = r([[-1, -1, -1], [1, 1, 1], [-1, 1, -1], [1, -1, 1], [1, 1, -1], [-1, -1, 1]].map((d) => new T.Vector3().setFromMatrixPosition(model.matrix).addScaledVector(new T.Vector3(...d), L.cloudR * 1.05)));
        const dv = {}; devs.forEach((d) => { dv[d.id] = r([d.g.position]).slice(0, 2); });
        const hp = heroDot ? r([heroDot.getWorldPosition(new T.Vector3())]).slice(0, 2) : null, ends = lanes.filter((l) => l.c === 0 && l.m.visible).map((l) => r([new T.Vector3(l.pts[(NS - 1) * 3], l.pts[(NS - 1) * 3 + 1], l.pts[(NS - 1) * 3 + 2])]).slice(0, 2));
        const o = out ? out.getBoundingClientRect() : null, h = stage.getBoundingClientRect();
        return { w: W0(), h: H0(), body: bodyR, model: mo, devices: dv, point: hp, laneEnds: ends, out: o && o.width ? [o.left - h.left, o.top - h.top, o.right - h.left, o.bottom - h.top].map(Math.round) : null, clipT: clipT(lastNow) }; } };
  }
})();
