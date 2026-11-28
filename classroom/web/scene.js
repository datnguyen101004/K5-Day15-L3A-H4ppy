/* Cảnh lớp học 3D phong cách anime chibi: MeshToonMaterial + viền mực inverted-hull, nhân vật đầu to, emote sprite */
import * as THREE from "three";

const SKY = "#BFE3FF";
const WALL = "#DCF2EA";
const SAKURA = "#FFB7C9";
const SAKURA_DEEP = "#F78FB0";
const WOOD = "#E0A86B";
const WOOD_DARK = "#B97A45";
const WOOD_DEEP = "#8F5A30";
const BOARD = "#2F5E4E";
const BOARD_DEEP = "#274F41";
const INK = "#3B2F4A";
const CHALK = "#F7F9F2";
const SKIN = "#FFDFC4";
const PAPER = "#FFFDF6";
const DUNG = "#9EE09E";
const SAI = "#FF8A8A";
const PERSONA = { player: "#FFFFFF", nhanh: "#FFD45C", canthan: "#7CC4FF", haycai: "#FF8A8A", mommang: "#9EE09E", teacher: "#FFB7C9" };
const HAIR = { nhanh: "#F2C14E", canthan: "#6B4A3A", haycai: "#4A3A5C", mommang: "#C98A5A", player: "#FFFFFF", teacher: "#8A6A4F" };
const EYE = { player: "#9B7ED9", nhanh: "#E8A13A", canthan: "#4A90D9", haycai: "#D95F5F", mommang: "#6FBF73", teacher: "#8A6A4F" };

/* ---------- cache geometry/material: chia sẻ, không cấp phát lại mỗi frame ---------- */
const geoCache = new Map();
function G(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
const matCache = new Map();
function M(key, make) {
  let m = matCache.get(key);
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}

/* Bảng gradient 3 bậc cho cel-shading */
const gradientMap = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

const toon = (color, opts = {}) =>
  M("toon:" + color + JSON.stringify(opts), () => new THREE.MeshToonMaterial({ color, gradientMap, ...opts }));
const flat = (color, opts = {}) =>
  M("flat:" + color + JSON.stringify(opts), () => new THREE.MeshBasicMaterial({ color, ...opts }));
const outlineMat = M("outline", () => new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
/* Inverted-hull outline: bản sao scale lớn hơn vẽ mặt sau màu mực */
function addOutline(obj, kx = 1.05, ky = 1.05, kz = 1.05) {
  if (!obj.geometry) return null;
  const o = new THREE.Mesh(obj.geometry, outlineMat);
  o.scale.set(kx, ky, kz);
  obj.add(o);
  return o;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dampK = (dt, s = 6) => 1 - Math.pow(0.0001, dt * s);

export function createScene(canvas, opts = {}) {
  let camPush = 0;
  const reducedMotion = !!opts.reducedMotion;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = false; // blob shadow đọc rõ hơn ở cel style
  renderer.toneMapping = THREE.NoToneMapping; // giữ màu pastel đậm, không xám
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 26, 48);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
  const narrowQuery = window.matchMedia("(max-width: 1099px)");
  let lookY = 2.5;
  const camPos = new THREE.Vector3(0, 3.4, 9.5);
  const camLook = new THREE.Vector3(0, lookY, -1);
  const camGoalPos = camPos.clone();
  const camGoalLook = camLook.clone();

  /* ---------- Ánh sáng đều, sáng rõ ---------- */
  scene.add(new THREE.HemisphereLight("#FFFFFF", "#FFE4EE", 1.25));
  const sun = new THREE.DirectionalLight("#FFF3DC", 1.7);
  sun.position.set(-5, 8.5, 6);
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#DCEFFF", 0.55);
  fill.position.set(6, 4, 8);
  scene.add(fill);

  /* ---------- Sàn gỗ sáng kiểu toon ---------- */
  function plankTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d");
    const shades = ["#E0A86B", "#D89A5C", "#EBBE8A", "#D2904F", "#E6B078", "#CD8749"];
    const rows = 8, rh = 512 / rows;
    for (let r = 0; r < rows; r++) {
      let px = -((r * 173) % 140);
      while (px < 512) {
        const w = 90 + ((r * 31 + px * 7) % 90);
        x.fillStyle = shades[(r * 3 + ((px / 90) | 0)) % shades.length];
        x.fillRect(px, r * rh, w - 3, rh - 2);
        x.strokeStyle = "rgba(143,90,48,0.5)";
        x.lineWidth = 2;
        x.strokeRect(px, r * rh, w - 3, rh - 2);
        x.strokeStyle = "rgba(143,90,48,0.22)";
        x.lineWidth = 1;
        for (let gline = 0; gline < 3; gline++) {
          const gy = r * rh + 6 + ((px * 13 + gline * 19) % (rh - 12));
          x.beginPath(); x.moveTo(px + 4, gy); x.bezierCurveTo(px + w * 0.3, gy + 3, px + w * 0.6, gy - 3, px + w - 6, gy); x.stroke();
        }
        px += w;
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }
  const floorTex = plankTexture();
  const floor = new THREE.Mesh(G("floor", () => new THREE.PlaneGeometry(30, 30)),
    M("floorMat", () => new THREE.MeshToonMaterial({ map: floorTex, gradientMap })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 2);
  scene.add(floor);

  /* ---------- Tường mint pastel, có hốc cửa sổ thật ---------- */
  const wallMat = toon(WALL);
  function wallSeg(w, h, x, y, z) {
    const m = new THREE.Mesh(G("wall" + w + "x" + h + x + y, () => new THREE.PlaneGeometry(w, h)), wallMat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
  const WIN = { x: 8.8, y0: 3.0, y1: 5.7, hw: 1.15 }; // một cửa sổ bên phải (cây sakura ở ngoài)
  // tường sau z=-8, đục hốc cửa sổ
  wallSeg(24, WIN.y0, 0, WIN.y0 / 2, -8);
  wallSeg(24, 10 - WIN.y1, 0, (10 + WIN.y1) / 2, -8);
  wallSeg(WIN.x - WIN.hw + 12, WIN.y1 - WIN.y0, (WIN.x - WIN.hw - 12) / 2, (WIN.y0 + WIN.y1) / 2, -8);
  wallSeg(12 - (WIN.x + WIN.hw), WIN.y1 - WIN.y0, (WIN.x + WIN.hw + 12) / 2, (WIN.y0 + WIN.y1) / 2, -8);
  wallSeg(24, 10, -12, 5, 2).rotation.y = Math.PI / 2;   // tường trái
  wallSeg(24, 10, 12, 5, 2).rotation.y = -Math.PI / 2;   // tường phải
  // nền trời sau cửa sổ
  const skyBack = new THREE.Mesh(G("skyback", () => new THREE.PlaneGeometry(40, 20)), flat(SKY));
  skyBack.position.set(0, 6, -13);
  scene.add(skyBack);
  const ceil = new THREE.Mesh(G("ceil", () => new THREE.PlaneGeometry(30, 30)), toon(PAPER));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 10, 2);
  scene.add(ceil);
  // chân tường
  const baseMat = toon(WOOD_DARK);
  function baseboard(w, x, z, ry) {
    const b = new THREE.Mesh(G("base" + w, () => new THREE.BoxGeometry(w, 0.22, 0.08)), baseMat);
    b.position.set(x, 0.11, z); b.rotation.y = ry;
    scene.add(b);
  }
  baseboard(24, 0, -7.96, 0); baseboard(24, -11.96, 2, Math.PI / 2); baseboard(24, 11.96, 2, -Math.PI / 2);

  /* ---------- Cửa sổ: khung trắng + kính trong suốt thấy trời xanh ---------- */
  const frameMat = toon(PAPER);
  {
    const win = new THREE.Group();
    const fw = 2.5, fh = 2.9;
    const mk = (w, h, x, y) => {
      const m = new THREE.Mesh(G("wf" + w + h, () => new THREE.BoxGeometry(w, h, 0.1)), frameMat);
      m.position.set(x, y, 0);
      win.add(m);
    };
    mk(fw, 0.12, 0, fh / 2); mk(fw, 0.12, 0, -fh / 2); mk(0.12, fh, -fw / 2, 0); mk(0.12, fh, fw / 2, 0);
    const glass = new THREE.Mesh(G("winglass", () => new THREE.PlaneGeometry(fw - 0.14, fh - 0.14)),
      M("glass", () => new THREE.MeshBasicMaterial({ color: SKY, transparent: true, opacity: 0.5 })));
    glass.position.z = 0.02;
    const mullV = new THREE.Mesh(G("mullV", () => new THREE.BoxGeometry(0.07, fh - 0.14, 0.05)), frameMat);
    const mullH = new THREE.Mesh(G("mullH", () => new THREE.BoxGeometry(fw - 0.14, 0.07, 0.05)), frameMat);
    mullV.position.z = 0.03; mullH.position.z = 0.03;
    win.add(glass, mullV, mullH);
    win.position.set(WIN.x, (WIN.y0 + WIN.y1) / 2 + 0.1, -7.94);
    scene.add(win);
  }

  /* ---------- Cây sakura ngoài cửa sổ ---------- */
  {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(G("trunk", () => new THREE.CylinderGeometry(0.16, 0.24, 2.6, 10)), toon(WOOD_DEEP));
    trunk.position.y = 1.3;
    addOutline(trunk, 1.12, 1.02, 1.12);
    tree.add(trunk);
    for (const [x, y, z, r] of [[0, 3.1, 0, 1.05], [-0.7, 2.7, 0.2, 0.72], [0.65, 2.75, -0.15, 0.66], [0.1, 2.55, 0.55, 0.6]]) {
      const puff = new THREE.Mesh(G("sakura" + r, () => new THREE.SphereGeometry(r, 14, 10)), toon(SAKURA));
      puff.position.set(x, y, z);
      addOutline(puff, 1.05, 1.05, 1.05);
      tree.add(puff);
    }
    tree.position.set(WIN.x, 0, -10.2);
    scene.add(tree);
  }

  /* ---------- Cánh hoa sakura rơi trong phòng ---------- */
  const PETAL_N = 70;
  const petalGeo = new THREE.BufferGeometry();
  const petalPos = new Float32Array(PETAL_N * 3);
  const petalSeed = new Float32Array(PETAL_N);
  for (let i = 0; i < PETAL_N; i++) {
    petalPos[i * 3] = -9 + Math.random() * 18;
    petalPos[i * 3 + 1] = Math.random() * 6.5;
    petalPos[i * 3 + 2] = -7.5 + Math.random() * 10;
    petalSeed[i] = Math.random() * 10;
  }
  petalGeo.setAttribute("position", new THREE.BufferAttribute(petalPos, 3));
  const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({ color: SAKURA, size: 0.11, transparent: true, opacity: 0.9, depthWrite: false }));
  petals.frustumCulled = false;
  petals.visible = !reducedMotion;
  scene.add(petals);

  /* ---------- Bảng viết: CanvasTexture, chữ Patrick Hand ---------- */
  const BOARD_W = 12.6, BOARD_H = 7.09, BOARD_Y = 4.45, BOARD_Z = -7.86;
  const boardGroup = new THREE.Group();
  boardGroup.position.set(0, BOARD_Y, BOARD_Z);
  const bFrameMat = toon(WOOD);
  const fT = new THREE.Mesh(G("bfT", () => new THREE.BoxGeometry(BOARD_W + 0.4, 0.2, 0.14)), bFrameMat);
  fT.position.y = BOARD_H / 2 + 0.1;
  addOutline(fT, 1.03, 1.1, 1.03);
  const fB = fT.clone(); fB.position.y = -BOARD_H / 2 - 0.1;
  const fL = new THREE.Mesh(G("bfL", () => new THREE.BoxGeometry(0.2, BOARD_H + 0.4, 0.14)), bFrameMat);
  fL.position.x = -BOARD_W / 2 - 0.1;
  addOutline(fL, 1.1, 1.03, 1.03);
  const fR = fL.clone(); fR.position.x = BOARD_W / 2 + 0.1;
  boardGroup.add(fT, fB, fL, fR);
  scene.add(boardGroup);

  const boardCanvas = document.createElement("canvas");
  boardCanvas.width = 2048; boardCanvas.height = 1152;
  const bctx = boardCanvas.getContext("2d");
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  boardTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const boardMesh = new THREE.Mesh(
    G("board", () => new THREE.PlaneGeometry(BOARD_W, BOARD_H)),
    M("boardMat", () => new THREE.MeshToonMaterial({ map: boardTex, gradientMap }))
  );
  boardGroup.add(boardMesh);

  const smudgeCanvas = document.createElement("canvas");
  smudgeCanvas.width = 2048; smudgeCanvas.height = 1152;
  {
    const s = smudgeCanvas.getContext("2d");
    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      s.fillStyle = `rgba(247,249,242,${0.025 + rnd() * 0.045})`;
      s.beginPath();
      s.ellipse(rnd() * 2048, rnd() * 912, 60 + rnd() * 260, 18 + rnd() * 60, rnd() * 3, 0, Math.PI * 2);
      s.fill();
    }
    for (let i = 0; i < 7; i++) {
      s.fillStyle = `rgba(247,249,242,${0.03 + rnd() * 0.03})`;
      s.fillRect(rnd() * 1700, rnd() * 700, 200 + rnd() * 320, 120 + rnd() * 200);
    }
    for (let i = 0; i < 260; i++) {
      s.fillStyle = `rgba(247,249,242,${0.04 + rnd() * 0.08})`;
      s.beginPath();
      s.arc(rnd() * 2048, 1040 + rnd() * 100, 1 + rnd() * 3.5, 0, Math.PI * 2);
      s.fill();
    }
  }

  function wrapText(ctx, text, maxW, firstPrefix = "", contPrefix = "") {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    let prefix = firstPrefix;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(prefix + test).width > maxW && line) {
        lines.push(prefix + line);
        line = w;
        prefix = contPrefix;
      } else line = test;
    }
    if (line) lines.push(prefix + line);
    return lines;
  }

  const lineText = (ln) => (typeof ln === "string" ? ln : ln.text);
  const linePlain = (ln) => typeof ln === "object" && !!ln.plain;

  let boardKey = "__none__";
  let fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  function drawBoard(b) {
    const W = 2048, H = 1152, ctx = bctx;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#356B57");
    grad.addColorStop(1, BOARD);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(smudgeCanvas, 0, 0);
    // hoa sakura nhỏ ở góc phải dưới cho vui
    ctx.save();
    ctx.translate(W - 120, H - 110);
    for (let p = 0; p < 5; p++) {
      ctx.save();
      ctx.rotate((p / 5) * Math.PI * 2);
      ctx.fillStyle = "rgba(255,183,201,0.85)";
      ctx.beginPath(); ctx.ellipse(14, 0, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = "rgba(247,249,242,0.9)";
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (b && b.title) {
      const kind = b.kind || "lecture";
      let titleSize = kind === "question" ? 108 : 116;
      let lineSize = 62, footSize = 46;
      ctx.textAlign = "left";
      const measure = (ts, ls) => {
        ctx.font = `${ts}px "Patrick Hand", "Nunito", cursive`;
        const tl = wrapText(ctx, b.title, W - 320);
        let h = tl.length * ts * 1.18 + 26;
        ctx.font = `${ls}px "Patrick Hand", "Nunito", cursive`;
        const bullet = "•  ";
        const ind = " ".repeat(Math.max(2, Math.round(ctx.measureText(bullet).width / ctx.measureText(" ").width)));
        if (b.comment) {
          const wc = wrapText(ctx, b.comment, W - 300);
          h += wc.length * ls * 1.25 + 14;
        }
        for (const ln of (b.lines || [])) {
          const wl = wrapText(ctx, lineText(ln), W - 300, linePlain(ln) ? "" : bullet, linePlain(ln) ? "" : ind);
          h += wl.length * ls * 1.3 + 10;
        }
        h += 90;
        return { h, tl };
      };
      let m = measure(titleSize, lineSize);
      const avail = H - 120;
      if (m.h > avail) {
        const f = avail / m.h;
        titleSize = Math.max(64, Math.floor(titleSize * f));
        lineSize = Math.max(47, Math.floor(lineSize * f));
        footSize = Math.max(32, Math.floor(footSize * f));
        m = measure(titleSize, lineSize);
      }
      ctx.textAlign = "center";
      let titleColor = CHALK;
      if (kind === "verdict") {
        const mm = /(\d+)\s*\/\s*10/.exec(b.title);
        if (mm) titleColor = Number(mm[1]) >= 7 ? DUNG : Number(mm[1]) <= 4 ? SAI : CHALK;
      }
      ctx.font = `${titleSize}px "Patrick Hand", "Nunito", cursive`;
      ctx.fillStyle = titleColor;
      ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
      const titleLines = m.tl;
      let ty = 110 + titleSize * 0.9;
      for (const ln of titleLines) { ctx.fillText(ln, W / 2, ty); ty += titleSize * 1.18; }
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      if (kind === "lecture") {
        ctx.strokeStyle = "rgba(247,249,242,0.75)";
        ctx.lineWidth = 5; ctx.lineCap = "round";
        ctx.beginPath();
        const uw = Math.min(W - 700, ctx.measureText(titleLines[0]).width * 1.05);
        ctx.moveTo(W / 2 - uw / 2, ty - titleSize * 0.55);
        ctx.quadraticCurveTo(W / 2, ty - titleSize * 0.42, W / 2 + uw / 2, ty - titleSize * 0.55);
        ctx.stroke();
      }
      ctx.textAlign = "left";
      ctx.font = `${lineSize}px "Patrick Hand", "Nunito", cursive`;
      let ly = ty + 34;
      if (b.comment) {
        ctx.fillStyle = "rgba(247,249,242,0.75)";
        const wc = wrapText(ctx, b.comment, W - 300);
        const cw = Math.max(0, ...wc.map((w) => ctx.measureText(w).width));
        const cx0 = W / 2 - cw / 2;
        for (const w of wc) { ctx.fillText(w, cx0, ly); ly += lineSize * 1.25; }
        ly += 14;
      }
      ctx.fillStyle = CHALK;
      const bullet = "•  ";
      const ind = " ".repeat(Math.max(2, Math.round(ctx.measureText(bullet).width / ctx.measureText(" ").width)));
      let maxW = 0;
      const laid = [];
      for (const ln of (b.lines || [])) {
        const wl = wrapText(ctx, lineText(ln), W - 300, linePlain(ln) ? "" : bullet, linePlain(ln) ? "" : ind);
        for (const w of wl) { laid.push(w); maxW = Math.max(maxW, ctx.measureText(w).width); }
        laid.push(null);
      }
      const x0 = W / 2 - maxW / 2;
      for (const w of laid) {
        if (w === null) { ly += 10; continue; }
        ctx.fillText(w, x0, ly);
        ly += lineSize * 1.3;
      }
      if (b.footer) {
        ctx.textAlign = "center";
        ctx.font = `700 ${footSize}px "Baloo 2", "Nunito", sans-serif`;
        ctx.fillStyle = "rgba(247,249,242,0.7)";
        ctx.fillText(String(b.footer), W / 2, H - 52);
      }
    }
    boardTex.needsUpdate = true;
  }

  function setBoard(b) {
    const key = b ? JSON.stringify(b) : "__none__";
    if (key === boardKey) return;
    boardKey = key;
    drawBoard(b);
    fontsReady.then(() => { if (boardKey === key) drawBoard(b); });
  }
  drawBoard(null);

  // Khay phấn + phấn + cục tẩy
  const tray = new THREE.Mesh(G("tray", () => new THREE.BoxGeometry(2.8, 0.07, 0.16)), baseMat);
  tray.position.set(0, BOARD_Y - BOARD_H / 2 - 0.06, BOARD_Z + 0.12);
  scene.add(tray);
  const chalkPieceMat = toon(CHALK);
  for (const dx of [-0.5, -0.28]) {
    const stick = new THREE.Mesh(G("chalkpiece", () => new THREE.BoxGeometry(0.2, 0.035, 0.06)), chalkPieceMat);
    stick.position.set(dx, BOARD_Y - BOARD_H / 2 - 0.005, BOARD_Z + 0.12);
    stick.rotation.y = dx * 2;
    scene.add(stick);
  }
  const eraser = new THREE.Group();
  const eraserFelt = new THREE.Mesh(G("felt", () => new THREE.BoxGeometry(0.34, 0.09, 0.16)), toon("#8A7A96"));
  const eraserWood = new THREE.Mesh(G("erwood", () => new THREE.BoxGeometry(0.34, 0.05, 0.16)), toon(WOOD));
  eraserWood.position.y = 0.07;
  eraser.add(eraserFelt, eraserWood);
  eraser.position.set(0.75, BOARD_Y - BOARD_H / 2 + 0.04, BOARD_Z + 0.12);
  scene.add(eraser);

  /* ---------- Đồng hồ treo tường ---------- */
  const clockGroup = new THREE.Group();
  const clockFace = new THREE.Mesh(G("clockface", () => new THREE.CylinderGeometry(0.42, 0.42, 0.06, 28)), toon(CHALK));
  clockFace.rotation.x = Math.PI / 2;
  const clockRim = new THREE.Mesh(G("clockrim", () => new THREE.TorusGeometry(0.42, 0.05, 10, 28)), baseMat);
  addOutline(clockFace, 1.02, 1.02, 1.02);
  const hourHand = new THREE.Mesh(G("hourhand", () => new THREE.BoxGeometry(0.05, 0.22, 0.02)), flat(INK));
  hourHand.geometry.translate(0, 0.09, 0);
  const minHand = new THREE.Mesh(G("minhand", () => new THREE.BoxGeometry(0.035, 0.34, 0.02)), flat(INK));
  minHand.geometry.translate(0, 0.15, 0);
  hourHand.position.z = 0.045; minHand.position.z = 0.055;
  clockGroup.add(clockFace, clockRim, hourHand, minHand);
  clockGroup.position.set(7.3, 6.4, -7.93);
  scene.add(clockGroup);

  /* ---------- Kệ sách ---------- */
  const shelf = new THREE.Group();
  const carcass = new THREE.Mesh(G("carcass", () => new THREE.BoxGeometry(1.9, 2.3, 0.36)), baseMat);
  addOutline(carcass, 1.04, 1.02, 1.04);
  shelf.add(carcass);
  const bookCols = ["#FFD45C", "#7CC4FF", "#FF8A8A", "#9EE09E", CHALK, "#FFB7C9"];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let s = 0; s < 3; s++) {
    const sh = new THREE.Mesh(G("shelf", () => new THREE.BoxGeometry(1.78, 0.05, 0.3)), toon(WOOD));
    sh.position.set(0, -0.75 + s * 0.75, 0.03);
    shelf.add(sh);
    let bx = -0.82;
    while (bx < 0.8) {
      const bw = 0.09 + rnd() * 0.1, bh = 0.42 + rnd() * 0.22;
      const book = new THREE.Mesh(G("book" + bw.toFixed(2) + bh.toFixed(2), () => new THREE.BoxGeometry(bw, bh, 0.24)),
        toon(bookCols[(rnd() * bookCols.length) | 0]));
      book.position.set(bx + bw / 2, -0.72 + s * 0.75 + bh / 2, 0.03);
      book.rotation.z = (rnd() - 0.5) * 0.06;
      shelf.add(book);
      bx += bw + 0.02;
    }
  }
  shelf.position.set(-8.3, 1.15, -7.75);
  scene.add(shelf);

  const plant = new THREE.Group();
  const pot = new THREE.Mesh(G("pot", () => new THREE.CylinderGeometry(0.28, 0.22, 0.4, 14)), toon(SAKURA_DEEP));
  pot.position.y = 0.2;
  addOutline(pot, 1.06, 1.03, 1.06);
  plant.add(pot);
  const leafMat = toon("#7FC97F");
  for (const [lx, ly, lz, lr] of [[0, 0.75, 0, 0.34], [-0.18, 0.6, 0.08, 0.22], [0.16, 0.62, -0.06, 0.24], [0.02, 0.95, -0.05, 0.2]]) {
    const leaf = new THREE.Mesh(G("leaf" + lr, () => new THREE.SphereGeometry(lr, 10, 8)), leafMat);
    leaf.position.set(lx, ly, lz);
    plant.add(leaf);
  }
  plant.position.set(-9.4, 0, 7.6);
  scene.add(plant);

  /* ---------- Bàn cô + chuông 3D ---------- */
  const deskMat = toon(WOOD);
  const teacherDesk = new THREE.Group();
  const tTop = new THREE.Mesh(G("tdesk", () => new THREE.BoxGeometry(2.3, 0.12, 1.05)), deskMat);
  tTop.position.y = 0.95;
  addOutline(tTop, 1.03, 1.12, 1.05);
  const tLegL = new THREE.Mesh(G("tleg", () => new THREE.BoxGeometry(0.1, 0.95, 0.9)), baseMat);
  tLegL.position.set(-1.0, 0.475, 0);
  const tLegR = tLegL.clone(); tLegR.position.x = 1.0;
  teacherDesk.add(tTop, tLegL, tLegR);
  teacherDesk.position.set(0.8, 0, -4.7);
  scene.add(teacherDesk);
  const paper = new THREE.Mesh(G("paper", () => new THREE.BoxGeometry(0.5, 0.02, 0.36)), toon(CHALK));
  paper.position.set(0.3, 1.025, -4.5); paper.rotation.y = 0.3;
  scene.add(paper);
  const tBook = new THREE.Mesh(G("tbook", () => new THREE.BoxGeometry(0.42, 0.06, 0.3)), toon(SAI));
  tBook.position.set(1.35, 1.045, -4.9);
  scene.add(tBook);

  const bellMat = toon("#FFD45C");
  const bell = new THREE.Group();
  const bellBase = new THREE.Mesh(G("bellbase", () => new THREE.CylinderGeometry(0.17, 0.21, 0.05, 22)), bellMat);
  const bellDome = new THREE.Mesh(G("belldome", () => new THREE.SphereGeometry(0.17, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2)), bellMat);
  bellDome.scale.y = 0.75;
  const bellKnob = new THREE.Mesh(G("bellknob", () => new THREE.SphereGeometry(0.05, 10, 8)), bellMat);
  bellKnob.position.y = 0.15;
  bell.add(bellBase, bellDome, bellKnob);
  bell.position.set(0.8, 1.06, -4.7);
  scene.add(bell);
  let bellShake = 0;

  /* ---------- Bàn học + ghế ---------- */
  function deskSlot(i, n) {
    if (n === 2) return { x: (i === 0 ? -1 : 1) * 2.3, z: 1.6 }; // trận 1 đấu 1: hai bàn hai bên, đối mặt nhau
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    return { x: t * 6.0, z: 2.4 - Math.abs(t) * 1.8 };
  }
  function makeDesk(x, z) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(G("deskTop", () => new THREE.BoxGeometry(1.15, 0.08, 0.72)), deskMat);
    top.position.y = 0.66;
    addOutline(top, 1.04, 1.18, 1.06);
    const legL = new THREE.Mesh(G("deskLeg", () => new THREE.BoxGeometry(0.08, 0.72, 0.6)), baseMat);
    legL.position.set(-0.46, 0.33, 0);
    const legR = legL.clone(); legR.position.x = 0.46;
    g.add(top, legL, legR);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }
  function makeChair(x, z) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(G("chairSeat", () => new THREE.BoxGeometry(0.5, 0.06, 0.48)), baseMat);
    seat.position.y = 0.5;
    const back = new THREE.Mesh(G("chairBack", () => new THREE.BoxGeometry(0.5, 0.6, 0.06)), baseMat);
    back.position.set(0, 0.82, -0.24);
    const legGeo = G("chairLeg", () => new THREE.BoxGeometry(0.05, 0.46, 0.05));
    for (const [lx, lz] of [[-0.21, -0.19], [0.21, -0.19], [-0.21, 0.19], [0.21, 0.19]]) {
      const l = new THREE.Mesh(legGeo, baseMat);
      l.position.set(lx, 0.23, lz);
      g.add(l);
    }
    g.add(seat, back);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }
  // Bóng blob mềm màu mực
  const blobTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, "rgba(59,47,74,0.38)"); g.addColorStop(1, "rgba(59,47,74,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const blobMat = M("blob", () => new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  function blob(x, z, s) {
    const m = new THREE.Mesh(G("blob", () => new THREE.PlaneGeometry(1, 1)), blobMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.012, z);
    m.scale.set(s, s, 1);
    scene.add(m);
    return m;
  }

  /* ---------- Nhãn tên kiểu sticker ---------- */
  function textSprite(text, accent, fontPx, pad) {
    const c = document.createElement("canvas");
    const ctx0 = c.getContext("2d");
    ctx0.font = `700 ${fontPx}px "Baloo 2", "Nunito", sans-serif`;
    const w = Math.min(520, ctx0.measureText(text).width + pad * 2);
    c.width = Math.max(128, Math.ceil(w) + 20); c.height = fontPx + pad * 2 + 16;
    const ctx = c.getContext("2d");
    ctx.font = `700 ${fontPx}px "Baloo 2", "Nunito", sans-serif`;
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.roundRect((c.width - w) / 2, 6, w, c.height - 12, (c.height - 12) / 2);
    ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = accent; ctx.fillRect(c.width / 2 - w / 2 - 6, c.height - 16, 10, 6);
    ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, c.height / 2 + 1);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    const sc = 0.0027;
    spr.scale.set(c.width * sc, c.height * sc, 1);
    spr.renderOrder = 2;
    return spr;
  }
  function nameTag(name, color) { return textSprite(name, color, 52, 32); }

  /* ---------- Emote sprite vẽ tay trên canvas ---------- */
  function drawEmote(ctx, type) {
    const S = 160;
    ctx.clearRect(0, 0, S, S);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    const ink = INK;
    if (type === "bang") {
      ctx.strokeStyle = "rgba(59,47,74,0.8)"; ctx.lineWidth = 7;
      for (const [x0, y0, x1, y1] of [[18, 40, 52, 52], [12, 80, 50, 80], [18, 120, 52, 108]]) {
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      ctx.font = `800 104px "Baloo 2", "Nunito", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 12; ctx.strokeStyle = ink;
      ctx.strokeText("!", 108, 82);
      ctx.fillStyle = "#FF8A8A";
      ctx.fillText("!", 108, 82);
    } else if (type === "q") {
      ctx.font = `800 110px "Baloo 2", "Nunito", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 12; ctx.strokeStyle = ink;
      ctx.strokeText("?", 80, 78);
      ctx.fillStyle = "#7CC4FF";
      ctx.fillText("?", 80, 78);
    } else if (type === "spark") {
      const star = (x, y, r, fill) => {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const rr = i % 2 === 0 ? r : r * 0.42;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.stroke();
        ctx.fillStyle = fill; ctx.fill();
      };
      star(50, 55, 34, "#FFD45C");
      star(112, 40, 22, "#FFB7C9");
      star(105, 110, 26, "#FFD45C");
    } else if (type === "sweat") {
      ctx.fillStyle = "#7CC4FF";
      ctx.strokeStyle = ink; ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(80, 30);
      ctx.bezierCurveTo(112, 74, 116, 96, 80, 122);
      ctx.bezierCurveTo(44, 96, 48, 74, 80, 30);
      ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.strokeStyle = "rgba(59,47,74,0.75)"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(24, 52); ctx.quadraticCurveTo(38, 44, 52, 52); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(108, 52); ctx.quadraticCurveTo(122, 44, 136, 52); ctx.stroke();
    } else if (type === "anger") {
      ctx.fillStyle = "#FF5A5A";
      ctx.strokeStyle = ink; ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(80, 34); ctx.lineTo(80, 126);
      ctx.moveTo(34, 80); ctx.lineTo(126, 80);
      ctx.lineWidth = 22; ctx.strokeStyle = "#FF5A5A"; ctx.stroke();
      ctx.lineWidth = 7; ctx.strokeStyle = ink;
      ctx.strokeRect(58, 58, 44, 44);
      ctx.beginPath();
      ctx.moveTo(80, 34); ctx.lineTo(80, 126);
      ctx.moveTo(34, 80); ctx.lineTo(126, 80);
      ctx.stroke();
    } else if (type === "zzz") {
      ctx.font = `800 64px "Baloo 2", "Nunito", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 9; ctx.strokeStyle = ink;
      ctx.strokeText("Z", 62, 66); ctx.strokeText("z", 98, 92); ctx.strokeText("z", 126, 112);
      ctx.fillStyle = "#B9A8E8";
      ctx.fillText("Z", 62, 66); ctx.fillText("z", 98, 92); ctx.fillText("z", 126, 112);
    }
  }

  /* ---------- Nhân vật chibi: đầu to bằng thân, mắt nhiều lớp ---------- */
  const chars = new Map();
  let teacherRec = null;

  function buildRig(colorHex, standing, scaleK) {
    const mat = toon(colorHex);
    const skin = toon(SKIN);
    const root = new THREE.Group();
    root.scale.setScalar(scaleK || 1);
    const hips = new THREE.Group();
    hips.position.y = standing ? 1.0 : 0.62;
    root.add(hips);

    const torso = new THREE.Group();
    torso.position.y = 0.06;
    hips.add(torso);
    const chest = new THREE.Mesh(G("chest", () => new THREE.CapsuleGeometry(0.235, 0.2, 6, 14)), mat);
    chest.position.y = 0.26;
    addOutline(chest, 1.06, 1.05, 1.06);
    torso.add(chest);
    // cổ áo thủy thủ trắng
    const collar = new THREE.Mesh(G("collar", () => new THREE.CylinderGeometry(0.245, 0.27, 0.06, 16)), toon("#FFFFFF"));
    collar.position.y = 0.46;
    torso.add(collar);
    // nơ sakura trước ngực
    const ribbon = new THREE.Group();
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(G("ribbonW", () => new THREE.ConeGeometry(0.045, 0.09, 8)), toon(SAKURA));
      wing.rotation.z = sx * 1.9;
      wing.position.x = sx * 0.05;
      ribbon.add(wing);
    }
    const knot = new THREE.Mesh(G("ribbonK", () => new THREE.SphereGeometry(0.035, 8, 6)), toon(SAKURA_DEEP));
    ribbon.add(knot);
    ribbon.position.set(0, 0.4, 0.21);
    torso.add(ribbon);

    const neck = new THREE.Group();
    neck.position.y = 0.5;
    torso.add(neck);
    const head = new THREE.Group();
    head.position.y = 0.1;
    head.scale.setScalar(1.14); // đầu to chuẩn chibi, mặt ≥50px trên màn hình
    neck.add(head);
    const skull = new THREE.Mesh(G("skull", () => new THREE.SphereGeometry(0.34, 24, 18)), skin);
    addOutline(skull, 1.04, 1.04, 1.04);
    head.add(skull);

    // Mắt anime nhiều lớp: lòng trắng → mống màu → đồng tử → 2 đốm sáng
    const eyes = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(0.125 * sx, -0.02, 0.30);
      const white = new THREE.Mesh(G("eyewhite", () => new THREE.SphereGeometry(0.095, 14, 10)), toon("#FFFFFF"));
      white.scale.set(1, 1.18, 0.55);
      const iris = new THREE.Mesh(G("iris" + sx, () => new THREE.SphereGeometry(0.058, 12, 9)), toon("#9B7ED9"));
      iris.scale.set(1, 1.1, 0.5);
      iris.position.z = 0.055;
      const pupil = new THREE.Mesh(G("pupil", () => new THREE.SphereGeometry(0.026, 8, 6)), flat(INK));
      pupil.scale.set(1, 1.15, 0.5);
      pupil.position.z = 0.085;
      const hl1 = new THREE.Mesh(G("hl1", () => new THREE.SphereGeometry(0.017, 6, 5)), flat("#FFFFFF"));
      hl1.position.set(-0.02, 0.028, 0.1);
      const hl2 = new THREE.Mesh(G("hl2", () => new THREE.SphereGeometry(0.011, 6, 5)), flat("#FFFFFF"));
      hl2.position.set(0.022, -0.02, 0.1);
      eye.add(white, iris, pupil, hl1, hl2);
      head.add(eye);
      eyes.push(eye);
    }
    // Lông mày
    const brows = [];
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(G("brow", () => new THREE.BoxGeometry(0.14, 0.03, 0.02)), flat(INK));
      b.position.set(0.125 * sx, 0.16, 0.315);
      head.add(b);
      brows.push(b);
    }
    // Má hồng
    for (const sx of [-1, 1]) {
      const blush = new THREE.Mesh(G("blush", () => new THREE.SphereGeometry(0.05, 8, 6)),
        M("blush", () => new THREE.MeshToonMaterial({ color: SAKURA, gradientMap, transparent: true, opacity: 0.85 })));
      blush.scale.set(1, 0.5, 0.3);
      blush.position.set(0.21 * sx, -0.09, 0.27);
      head.add(blush);
    }
    // Miệng: 4 hình đổi qua lại (smile / o / wavy / grit)
    const mouthG = new THREE.Group();
    mouthG.position.set(0, -0.16, 0.315);
    const smile = new THREE.Mesh(G("mouthSmile", () => new THREE.TorusGeometry(0.05, 0.013, 8, 16, Math.PI)), flat(INK));
    smile.rotation.z = Math.PI;
    const open = new THREE.Mesh(G("mouthOpen", () => new THREE.CircleGeometry(0.052, 14)), flat("#B04A5A"));
    open.scale.set(1, 0.8, 1);
    const wavyTex = (() => {
      const c = document.createElement("canvas"); c.width = 128; c.height = 48;
      const x = c.getContext("2d");
      x.strokeStyle = INK; x.lineWidth = 8; x.lineCap = "round";
      x.beginPath(); x.moveTo(6, 24);
      x.quadraticCurveTo(22, 6, 38, 24); x.quadraticCurveTo(54, 42, 70, 24);
      x.quadraticCurveTo(86, 6, 102, 24); x.quadraticCurveTo(114, 36, 122, 28);
      x.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const wavy = new THREE.Mesh(G("mouthWavy", () => new THREE.PlaneGeometry(0.13, 0.05)),
      M("mouthWavyMat", () => new THREE.MeshBasicMaterial({ map: wavyTex, transparent: true })));
    const grit = new THREE.Mesh(G("mouthGrit", () => new THREE.BoxGeometry(0.12, 0.04, 0.02)), flat(CHALK));
    addOutline(grit, 1.15, 1.3, 1.15);
    mouthG.add(smile, open, wavy, grit);
    head.add(mouthG);

    // Tay stubby: vai → khủy → cẳng → bàn tay to
    function arm(sx) {
      const sh = new THREE.Group();
      sh.position.set(0.27 * sx, 0.4, 0);
      torso.add(sh);
      const upper = new THREE.Mesh(G("upperarm", () => new THREE.CapsuleGeometry(0.065, 0.12, 4, 8)), mat);
      upper.position.y = -0.09;
      sh.add(upper);
      const el = new THREE.Group();
      el.position.y = -0.19;
      sh.add(el);
      const fore = new THREE.Mesh(G("forearm", () => new THREE.CapsuleGeometry(0.055, 0.1, 4, 8)), mat);
      fore.position.y = -0.08;
      el.add(fore);
      const hand = new THREE.Mesh(G("hand", () => new THREE.SphereGeometry(0.085, 10, 8)), skin);
      hand.position.y = -0.18;
      el.add(hand);
      return { sh, el, hand };
    }
    const armL = arm(-1), armR = arm(1);

    // Chân stubby
    function leg(sx) {
      const hip = new THREE.Group();
      hip.position.set(0.12 * sx, -0.04, 0);
      hips.add(hip);
      const thigh = new THREE.Mesh(G("thigh", () => new THREE.CapsuleGeometry(0.08, 0.16, 4, 8)), mat);
      if (standing) { thigh.position.y = -0.14; }
      else { thigh.rotation.x = Math.PI / 2; thigh.position.set(0, 0.02, 0.12); }
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.set(0, standing ? -0.3 : 0.02, standing ? 0 : 0.26);
      hip.add(knee);
      const shin = new THREE.Mesh(G("shin", () => new THREE.CapsuleGeometry(0.065, 0.18, 4, 8)), mat);
      shin.position.y = -0.14;
      knee.add(shin);
      const shoe = new THREE.Mesh(G("shoe", () => new THREE.BoxGeometry(0.15, 0.09, 0.26)), toon(INK));
      shoe.position.set(0, -0.3, standing ? 0.05 : 0.03);
      knee.add(shoe);
      return { hip, knee };
    }
    const legL = leg(-1), legR = leg(1);

    return { root, hips, torso, neck, head, skull, eyes, brows, mouthG, mouthParts: [smile, open, wavy, grit], armL, armR, legL, legR };
  }

  function setEyeColor(rig, hex) {
    for (const eye of rig.eyes) {
      const iris = eye.children[1];
      iris.material = toon(hex);
    }
  }

  function addHair(rig, id) {
    const hairMat = toon(HAIR[id] || "#FFFFFF");
    const g = rig.head;
    if (id === "nhanh") { // gai blond + ahoge
      const cap = new THREE.Mesh(G("capN", () => new THREE.SphereGeometry(0.345, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.9)), hairMat);
      cap.position.y = 0.02;
      addOutline(cap, 1.045, 1.045, 1.045);
      g.add(cap);
      for (const [px, py, pz, s, rz] of [[0, 0.36, 0, 1, 0], [-0.16, 0.3, 0.06, 0.8, 0.5], [0.16, 0.3, 0.06, 0.8, -0.5], [-0.08, 0.33, -0.14, 0.7, 0.3], [0.08, 0.33, -0.14, 0.7, -0.3], [0, 0.3, 0.18, 0.75, 0]]) {
        const spike = new THREE.Mesh(G("spike" + s, () => new THREE.ConeGeometry(0.075 * s + 0.03, 0.22 * s + 0.12, 7)), hairMat);
        spike.position.set(px, py, pz);
        spike.rotation.z = rz;
        g.add(spike);
      }
      const ahoge = new THREE.Mesh(G("ahoge", () => new THREE.TorusGeometry(0.07, 0.014, 6, 12, 2.2)), hairMat);
      ahoge.position.set(0.05, 0.4, 0);
      ahoge.rotation.set(0.4, 0, 2.4);
      g.add(ahoge);
    } else if (id === "canthan") { // bob gọn + kính tròn
      const cap = new THREE.Mesh(G("capC", () => new THREE.SphereGeometry(0.355, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.7)), hairMat);
      cap.position.y = 0.015;
      addOutline(cap, 1.045, 1.045, 1.045);
      g.add(cap);
      for (const sx of [-1, 1]) {
        const side = new THREE.Mesh(G("bobSide", () => new THREE.SphereGeometry(0.14, 10, 8)), hairMat);
        side.scale.set(0.75, 1.25, 0.9);
        side.position.set(0.3 * sx, -0.08, -0.02);
        g.add(side);
      }
      addGlasses(g, 0.085);
    } else if (id === "haycai") { // mái nhọn + tóc đuôi ngựa một bên
      const cap = new THREE.Mesh(G("capH", () => new THREE.SphereGeometry(0.35, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.9)), hairMat);
      cap.position.y = 0.02;
      addOutline(cap, 1.045, 1.045, 1.045);
      g.add(cap);
      for (const [px, rz] of [[-0.2, 0.35], [-0.07, 0.12], [0.07, -0.12], [0.2, -0.35]]) {
        const bang = new THREE.Mesh(G("bang", () => new THREE.ConeGeometry(0.075, 0.24, 6)), hairMat);
        bang.position.set(px, 0.16, 0.3);
        bang.rotation.x = 0.25;
        bang.rotation.z = rz;
        g.add(bang);
      }
      const tail = new THREE.Mesh(G("ponytail", () => new THREE.CapsuleGeometry(0.07, 0.3, 4, 8)), hairMat);
      tail.position.set(0.33, 0.02, -0.12);
      tail.rotation.z = -1.1;
      tail.rotation.x = -0.3;
      g.add(tail);
      const tie = new THREE.Mesh(G("ponytie", () => new THREE.SphereGeometry(0.05, 8, 6)), toon(SAKURA));
      tie.position.set(0.36, 0.16, -0.05);
      g.add(tie);
    } else if (id === "mommang") { // tóc xù + mí nửa cụp
      const cap = new THREE.Mesh(G("capM", () => new THREE.SphereGeometry(0.35, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.8)), hairMat);
      cap.position.y = 0.02;
      g.add(cap);
      let sd = 99;
      const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 8; i++) {
        const puff = new THREE.Mesh(G("messpuff", () => new THREE.SphereGeometry(0.1, 8, 6)), hairMat);
        const a = rr() * Math.PI * 2, r = 0.2 + rr() * 0.13;
        puff.position.set(Math.cos(a) * r, 0.28 + rr() * 0.12, Math.sin(a) * r * 0.75 - 0.04);
        g.add(puff);
      }
      rig.lidBase = 0.55; // mí cụp
    } else if (id === "player") { // tóc trắng mềm + kẹp sakura
      const cap = new THREE.Mesh(G("capP", () => new THREE.SphereGeometry(0.35, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.9)), hairMat);
      cap.position.y = 0.02;
      addOutline(cap, 1.045, 1.045, 1.045);
      g.add(cap);
      const clip = new THREE.Group();
      for (let p = 0; p < 5; p++) {
        const petal = new THREE.Mesh(G("clipPetal", () => new THREE.SphereGeometry(0.045, 8, 6)), toon(SAKURA));
        petal.scale.set(1, 0.35, 0.6);
        const a = (p / 5) * Math.PI * 2;
        petal.position.set(Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0);
        petal.rotation.z = a;
        clip.add(petal);
      }
      const center = new THREE.Mesh(G("clipCenter", () => new THREE.SphereGeometry(0.03, 8, 6)), toon(SAKURA_DEEP));
      clip.add(center);
      clip.position.set(-0.22, 0.26, 0.16);
      clip.rotation.set(0.5, 0, 0.6);
      g.add(clip);
    } else if (id === "teacher") { // búi + đuôi ngựa, kính, áo cardigan
      const cap = new THREE.Mesh(G("capT", () => new THREE.SphereGeometry(0.35, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.8)), hairMat);
      cap.position.y = 0.02;
      addOutline(cap, 1.045, 1.045, 1.045);
      g.add(cap);
      const tail = new THREE.Mesh(G("ttail", () => new THREE.CapsuleGeometry(0.08, 0.34, 4, 8)), hairMat);
      tail.position.set(0, 0.2, -0.36);
      tail.rotation.x = -0.5;
      g.add(tail);
      const bun = new THREE.Mesh(G("tbun", () => new THREE.SphereGeometry(0.1, 10, 8)), hairMat);
      bun.position.set(0, 0.32, -0.3);
      g.add(bun);
      addGlasses(g, 0.082);
    }
    if (id === "haycai") {
      rig.brows[0].rotation.z = 0.38;
      rig.brows[1].rotation.z = -0.38;
    }
  }
  function addGlasses(g, r) {
    const gm = toon(INK);
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(G("lens" + r, () => new THREE.TorusGeometry(r, 0.014, 8, 20)), gm);
      lens.position.set(0.125 * sx, -0.02, 0.345);
      g.add(lens);
    }
    const bridge = new THREE.Mesh(G("bridge" + r, () => new THREE.BoxGeometry(0.06, 0.014, 0.02)), gm);
    bridge.position.set(0, -0.02, 0.355);
    g.add(bridge);
  }

  function makeCharacter(p, i, n) {
    const slot = deskSlot(i, n);
    const rig = buildRig(p.color || CHALK, false, 1);
    addHair(rig, p.id);
    setEyeColor(rig, EYE[p.id] || "#9B7ED9");
    const g = rig.root;
    g.position.set(slot.x, 0, slot.z - 0.78);
    g.rotation.y = 0.4; // quay 3/4 về phía camera
    scene.add(g);
    makeDesk(slot.x, slot.z);
    makeChair(slot.x, slot.z - 1.33); // ghế ở sau lưng, không che người
    blob(slot.x, slot.z - 0.4, 2.1);
    blob(slot.x, slot.z, 1.7);

    const ring = new THREE.Mesh(
      G("ring", () => new THREE.RingGeometry(0.46, 0.6, 32)),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color || CHALK), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(slot.x, 0.02, slot.z - 0.78);
    scene.add(ring);

    const tag = nameTag(p.name, p.color || CHALK);
    tag.position.set(slot.x, 0.34, slot.z + 0.5);
    scene.add(tag);

    // Emote sprite một cái mỗi nhân vật, vẽ lại khi đổi
    const eCanvas = document.createElement("canvas");
    eCanvas.width = eCanvas.height = 160;
    const eTex = new THREE.CanvasTexture(eCanvas);
    eTex.colorSpace = THREE.SRGBColorSpace;
    const emoteSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: eTex, transparent: true, depthTest: false }));
    emoteSpr.scale.set(0.62, 0.62, 1);
    emoteSpr.position.set(0.44, 0.62, 0);
    emoteSpr.renderOrder = 3;
    emoteSpr.visible = false;
    rig.head.add(emoteSpr);

    let marker = null;
    if (p.id === "player") {
      marker = textSprite("Bạn", SAKURA_DEEP, 44, 26);
      marker.position.set(-0.02, 0.82, 0);
      rig.head.add(marker);
    }

    if (p.id === "canthan") {
      const bk = new THREE.Mesh(G("deskbook", () => new THREE.BoxGeometry(0.4, 0.05, 0.3)), toon("#7CC4FF"));
      bk.position.set(slot.x - 0.25, 0.725, slot.z - 0.1);
      bk.rotation.y = -0.2;
      scene.add(bk);
    }

    const rec = {
      id: p.id, name: p.name, color: p.color || CHALK,
      group: g, rig, ring, tag, marker, emoteSpr, eCanvas, eTex, emote: null,
      baseHipsY: rig.hips.position.y,
      onPodium: false,
      action: { type: "idle", until: 0 },
      lookId: null,
      talkUntil: 0,
      blinkAt: 1 + Math.random() * 3, blinkT: 1,
      lidBase: rig.lidBase || 1,
      phase: (i * 1.7) % (Math.PI * 2),
      hopT: -1,
      cur: { lean: 0, yaw: 0, pitch: 0, hipY: 0, shLx: 0, shLz: 0, elLx: 0, shRx: 0, shRz: 0, elRx: 0, mouth: 0.5, brow: 0, mouthMode: 0 },
      tgt: { lean: 0, yaw: 0, pitch: 0, hipY: 0, shLx: 0, shLz: 0, elLx: 0, shRx: 0, shRz: 0, elRx: 0, mouth: 0.5, brow: 0, mouthMode: 0 },
    };
    chars.set(p.id, rec);
    return rec;
  }

  function makeTeacher() {
    const rig = buildRig(SAKURA, true, 1.22); // cardigan sakura, cao hơn
    addHair(rig, "teacher");
    setEyeColor(rig, EYE.teacher);
    rig.root.position.set(-6.5, 0, -6.4);
    rig.root.rotation.y = 0.5;
    scene.add(rig.root);
    blob(-6.5, -6.4, 1.8);
    const pointer = new THREE.Mesh(G("pointer", () => new THREE.CylinderGeometry(0.016, 0.016, 0.9, 8)), toon(WOOD_DEEP));
    pointer.position.set(0, -0.2, 0.1);
    pointer.rotation.x = Math.PI / 2 - 0.25;
    rig.armR.el.add(pointer);
    const tag = nameTag("Cô Linh", SAKURA_DEEP);
    tag.position.set(-6.5, 0.34, -5.8);
    scene.add(tag);
    const eCanvas = document.createElement("canvas");
    eCanvas.width = eCanvas.height = 160;
    const eTex = new THREE.CanvasTexture(eCanvas);
    eTex.colorSpace = THREE.SRGBColorSpace;
    const emoteSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: eTex, transparent: true, depthTest: false }));
    emoteSpr.scale.set(0.62, 0.62, 1);
    emoteSpr.position.set(0.44, 0.62, 0);
    emoteSpr.renderOrder = 3;
    emoteSpr.visible = false;
    rig.head.add(emoteSpr);
    const rec = {
      id: "teacher", name: "Cô Linh", color: SAKURA,
      group: rig.root, rig, ring: null, tag, marker: null, emoteSpr, eCanvas, eTex, emote: null,
      baseHipsY: rig.hips.position.y,
      onPodium: false,
      action: { type: "idle", until: 0 },
      lookId: null,
      talkUntil: 0,
      blinkAt: 1 + Math.random() * 3, blinkT: 1,
      lidBase: rig.lidBase || 1,
      phase: 2.1,
      hopT: -1,
      cur: { lean: 0, yaw: 0, pitch: 0, hipY: 0, shLx: 0, shLz: 0, elLx: 0, shRx: 0, shRz: 0, elRx: 0, mouth: 0.5, brow: 0, mouthMode: 0 },
      tgt: { lean: 0, yaw: 0, pitch: 0, hipY: 0, shLx: 0, shLz: 0, elLx: 0, shRx: 0, shRz: 0, elRx: 0, mouth: 0.5, brow: 0, mouthMode: 0 },
    };
    teacherRec = rec;
    chars.set("teacher", rec);
    return rec;
  }
  makeTeacher();

  function setPlayers(players) {
    const ids = players.map((p) => p.id).join(",");
    if ([...chars.keys()].filter((k) => k !== "teacher").join(",") === ids) return;
    for (const [id, rec] of chars) {
      if (id === "teacher") continue;
      scene.remove(rec.group); scene.remove(rec.ring); scene.remove(rec.tag);
      chars.delete(id);
    }
    players.forEach((p, i) => makeCharacter(p, i, players.length));
    if (players.length === 2) { // trận 1 đấu 1: hai thí sinh quay mặt về nhau
      const [a, b] = players;
      const ra = chars.get(a.id), rb = chars.get(b.id);
      if (ra) ra.group.rotation.y = 0.85;
      if (rb) rb.group.rotation.y = -0.85;
    }
  }

  function recOf(id) { return chars.get(id); }
  function headWorld(rec, out) {
    out.set(0, 0, 0);
    rec.rig.head.getWorldPosition(out);
    return out;
  }

  function setEmote(rec, type, until) {
    rec.emote = type ? { type, until } : null;
    rec.emoteSpr.visible = !!type;
    if (type) {
      drawEmote(rec.eCanvas.getContext("2d"), type);
      rec.eTex.needsUpdate = true;
    }
  }

  /* ---------- Sparkles (pool) cho cheer ---------- */
  const SPARK_N = 90;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(SPARK_N * 3);
  const sparkCol = new Float32Array(SPARK_N * 3);
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  sparks.visible = false;
  sparks.frustumCulled = false;
  scene.add(sparks);
  const sparkData = [];
  for (let i = 0; i < SPARK_N; i++) sparkData.push({ life: 0, vx: 0, vy: 0, vz: 0 });
  function spawnSparkles(rec) {
    if (reducedMotion) return;
    const c = new THREE.Color(rec.color);
    const base = headWorld(rec, _v1);
    let n = 0;
    for (let i = 0; i < SPARK_N; i++) {
      const d = sparkData[i];
      if (d.life > 0) continue;
      d.life = 0.9 + Math.random() * 0.5;
      d.vx = (Math.random() - 0.5) * 1.6;
      d.vy = 1.2 + Math.random() * 1.6;
      d.vz = (Math.random() - 0.5) * 1.6;
      sparkPos[i * 3] = base.x + (Math.random() - 0.5) * 0.5;
      sparkPos[i * 3 + 1] = base.y + (Math.random() - 0.5) * 0.5;
      sparkPos[i * 3 + 2] = base.z + (Math.random() - 0.5) * 0.5;
      sparkCol[i * 3] = c.r; sparkCol[i * 3 + 1] = c.g; sparkCol[i * 3 + 2] = c.b;
      if (++n >= 22) break;
    }
    sparks.visible = true;
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
  }

  /* ---------- Máy trạng thái hoạt cảnh ---------- */
  let scenePhase = "lecture";

  function setPhase(phase) {
    scenePhase = phase;
    const t = clock.elapsedTime;
    for (const rec of chars.values()) {
      if (rec.id === "teacher") {
        if (phase === "lecture" || phase === "question") rec.action = { type: "point", until: Infinity };
        else if (phase === "verdict") rec.action = { type: "nod", until: t + 4 };
        else if (phase === "summary") rec.action = { type: "clap", until: Infinity };
        else rec.action = { type: "idle", until: 0 };
        if (phase !== "summary") setEmote(rec, null, 0);
        continue;
      }
      if (phase === "lecture") {
        rec.lookId = "board"; rec.action = { type: "idle", until: 0 };
        setEmote(rec, rec.id === "mommang" ? "zzz" : null, Infinity);
      } else if (phase === "question") {
        rec.lookId = "board"; rec.action = { type: "think", until: Infinity };
        setEmote(rec, "q", Infinity);
      } else if (phase === "verdict") {
        rec.lookId = "board"; if (rec.action.type === "think") rec.action = { type: "idle", until: 0 };
        if (rec.emote && rec.emote.until === Infinity) setEmote(rec, rec.id === "mommang" ? "zzz" : null, Infinity);
      } else {
        if (rec.action.type === "think") rec.action = { type: "idle", until: 0 };
        if (rec.emote && rec.emote.until === Infinity) setEmote(rec, rec.id === "mommang" ? "zzz" : null, Infinity);
      }
    }
  }

  function lookAt(id, targetId) {
    const rec = recOf(id);
    if (rec) rec.lookId = targetId;
  }

  function talk(id, ms) {
    const rec = recOf(id);
    if (!rec) return;
    rec.talkUntil = clock.elapsedTime + Math.max(0.4, (ms || 1000) / 1000);
    if (id === "haycai" && !reducedMotion) setEmote(rec, "anger", rec.talkUntil + 0.2);
  }

  function react(id, delta) {
    const rec = recOf(id);
    if (!rec) return;
    const t = clock.elapsedTime;
    if (delta > 0) {
      rec.action = { type: "cheer", until: t + 1.5 };
      if (!reducedMotion) { rec.hopT = 0; setEmote(rec, "spark", t + 1.6); }
      spawnSparkles(rec);
    } else if (delta < 0) {
      rec.action = { type: "slump", until: t + 1.8 };
      setEmote(rec, "sweat", t + 1.9);
    } else {
      rec.action = { type: "shrug", until: t + 1.0 };
    }
  }

  function highlight(id) {
    for (const rec of chars.values()) if (rec.ring) rec.ring.material.opacity = 0;
    const rec = recOf(id);
    if (!rec) return;
    if (rec.ring) rec.ring.material.opacity = 0.9;
    if (!reducedMotion && id !== "teacher") {
      const hp = headWorld(rec, _v1);
      camGoalLook.set(clamp(hp.x * 0.25, -0.22, 0.22), clamp(hp.y + 0.9, 2.2, 2.6), hp.z * 0.3);
      camGoalPos.set(clamp(hp.x * 0.12, -0.08, 0.08), 3.3, 9.5);
    } else if (!reducedMotion) {
      camGoalLook.set(0, lookY, -1);
      camGoalPos.set(0, 3.4, 9.5);
    }
  }

  function buzz(id) {
    const rec = recOf(id);
    if (!rec) return;
    rec.action = { type: "raise", until: clock.elapsedTime + 2.4 };
    if (!reducedMotion) { rec.hopT = 0; camPush = 0.3; setEmote(rec, "bang", clock.elapsedTime + 2.2); }
    highlight(id);
  }

  function ringBell() {
    if (!reducedMotion) bellShake = 1;
  }

  /* ---------- Điểm bay lên: số Baloo 2 đậm viền mực ---------- */
  const floats = [];
  function floatScore(id, delta) {
    const rec = recOf(id);
    if (!rec) return;
    const c = document.createElement("canvas");
    c.width = 256; c.height = 128;
    const ctx = c.getContext("2d");
    ctx.font = '800 84px "Baloo 2", "Nunito", sans-serif';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.lineJoin = "round";
    const text = (delta > 0 ? "+" : "") + delta;
    ctx.strokeText(text, 128, 66);
    ctx.fillStyle = rec.color === "#FFFFFF" ? "#FFD45C" : rec.color;
    ctx.fillText(text, 128, 66);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(1.5, 0.75, 1);
    const hp = headWorld(rec, _v1);
    spr.position.set(hp.x, hp.y + 0.5, hp.z);
    scene.add(spr);
    floats.push({ spr, life: 0, rise: reducedMotion ? 0 : 0.9 });
  }

  /* ---------- Bục vinh danh 3 bậc ---------- */
  let podiumGroup = null;
  let petalsBurst = null;
  function podium(ranking) {
    if (podiumGroup) { scene.remove(podiumGroup); podiumGroup = null; }
    if (petalsBurst) { scene.remove(petalsBurst); petalsBurst.geometry.dispose(); petalsBurst = null; }
    podiumGroup = new THREE.Group();
    const heights = [1.15, 0.78, 0.45];
    const slots = [0, -1, 1];
    const PODIUM_Z = -6.2;
    const t = clock.elapsedTime;
    ranking.slice(0, 3).forEach((r, i) => {
      const x = 4.3 + slots[i] * 1.5;
      const block = new THREE.Mesh(G("podiumBlock" + i, () => new THREE.BoxGeometry(1.15, heights[i], 1.15)), i === 0 ? toon("#FFD45C") : deskMat);
      block.position.set(x, heights[i] / 2, PODIUM_Z);
      addOutline(block, 1.05, 1.02, 1.05);
      podiumGroup.add(block);
      const rec = recOf(r.id);
      if (rec) {
        rec.group.position.set(x, heights[i], PODIUM_Z + 0.6);
        rec.group.rotation.y = 0; // trên bục quay thẳng về camera
        rec.rig.hips.position.y = rec.baseHipsY + heights[i];
        rec.tag.position.set(x, heights[i] + 0.05, PODIUM_Z + 1.3);
        rec.onPodium = true;
        if (rec.ring) rec.ring.material.opacity = 0.9;
        rec.ring && (rec.ring.position.set(x, heights[i] + 0.02, PODIUM_Z + 0.6));
        rec.action = { type: "cheer", until: t + 2 + i * 0.4 };
        setEmote(rec, i === 0 ? "spark" : null, t + 2.2);
        if (!reducedMotion && i === 0) { rec.hopT = 0; spawnSparkles(rec); }
      }
    });
    const topIds = new Set(ranking.slice(0, 3).map((r) => r.id));
    for (const rec of chars.values()) {
      if (topIds.has(rec.id) || rec.id === "teacher") continue;
      setEmote(rec, null, 0);
      // học sinh ngồi bên nửa phải che bục → rời khung hình (vẫn có trong thẻ xếp hạng)
      if (rec.group.position.x > 1.5) { rec.group.visible = false; rec.tag.visible = false; if (rec.ring) rec.ring.visible = false; }
    }
    const last = ranking[ranking.length - 1];
    if (last && last.id !== ranking[0].id) {
      const rec = recOf(last.id);
      if (rec && !rec.onPodium) { rec.action = { type: "slump", until: t + 5 }; setEmote(rec, "sweat", t + 5); }
    }
    scene.add(podiumGroup);
    if (!reducedMotion) {
      const N = 260;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 10;
        pos[i * 3 + 1] = Math.random() * 6 + 1;
        pos[i * 3 + 2] = Math.random() * 6 - 4;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      petalsBurst = new THREE.Points(geo, new THREE.PointsMaterial({ color: SAKURA, size: 0.07, transparent: true, opacity: 0.85 }));
      petalsBurst.frustumCulled = false;
      scene.add(petalsBurst);
    }
  }

  /* ---------- screenPos ---------- */
  function screenPos(id) {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    if (id === "board") { // khung chữ nhật của bảng trên màn hình (app.js dùng để đặt bong bóng tránh chữ)
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        _v2.set(sx * BOARD_W / 2, BOARD_Y + sy * BOARD_H / 2, BOARD_Z).project(camera);
        const px = (_v2.x * 0.5 + 0.5) * w, py = (-_v2.y * 0.5 + 0.5) * h;
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
        if (py < y0) y0 = py;
        if (py > y1) y1 = py;
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, visible: true };
    }
    const rec = recOf(id);
    if (!rec) return null;
    headWorld(rec, _v1);
    _v2.copy(_v1).project(camera);
    return {
      x: (_v2.x * 0.5 + 0.5) * w,
      y: (-_v2.y * 0.5 + 0.5) * h,
      visible: _v2.z < 1 && Math.abs(_v2.x) < 1.15 && Math.abs(_v2.y) < 1.15,
    };
  }

  /* ---------- Pose mục tiêu ---------- */
  function computePose(rec, t) {
    const tg = rec.tgt;
    tg.lean = 0; tg.yaw = 0; tg.pitch = 0; tg.hipY = 0;
    tg.shLx = 0; tg.shLz = 0; tg.elLx = 0; tg.shRx = 0; tg.shRz = 0; tg.elRx = 0;
    tg.mouth = 0.5; tg.brow = 0; tg.mouthMode = 0;

    if (rec.lookId) {
      if (rec.lookId === "board") {
        // Nhìn về bảng: đầu chỉ xoay ~37° từ camera, mặt vẫn thấy rõ
        tg.yaw = -0.65; tg.pitch = 0.15;
      } else {
        const other = recOf(rec.lookId);
        if (other) {
          const a = headWorld(rec, _v1), b = headWorld(other, _v2);
          const dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
          tg.yaw = clamp(Math.atan2(dx, dz) - rec.group.rotation.y, -1.15, 1.15);
          tg.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)) * 0.9, -0.55, 0.65);
        }
      }
    }
    if (rec.id === "nhanh") tg.lean = 0.13;
    if (rec.id === "mommang" && !rec.lookId) tg.pitch = 0.28;
    if (rec.id === "haycai") { tg.shLx = -0.85; tg.shLz = 0.5; tg.elLx = -1.7; tg.shRx = -0.85; tg.shRz = -0.5; tg.elRx = -1.7; tg.brow = 1; }
    if (rec.id === "nhanh" && rec.action.type === "idle" && !reducedMotion) {
      tg.shRx = Math.sin(t * 7 + rec.phase) * 0.1;
    }

    const act = rec.action;
    if (act.type === "think") {
      tg.shRx = -1.25; tg.shRz = -0.2; tg.elRx = -2.0;
      tg.pitch = Math.max(tg.pitch, 0.12);
      tg.shLx = -0.25; tg.elLx = -0.5;
    } else if (act.type === "raise") {
      tg.hipY = Math.sin(clamp((t - (act.until - 2.4)) / 2.4, 0, 1) * Math.PI) * 0.45;
      if (reducedMotion) tg.hipY = 0;
      tg.shRx = 0; tg.shRz = -2.95; tg.elRx = -0.15;
      tg.pitch = Math.min(tg.pitch, -0.15);
    } else if (act.type === "cheer") {
      const k = clamp((act.until - t) / 1.5, 0, 1);
      if (!reducedMotion) tg.hipY = Math.sin(k * Math.PI * 2) * 0.12 + Math.sin(k * Math.PI) * 0.25;
      tg.shLx = 0; tg.shLz = 2.95; tg.elLx = 0.2;
      tg.shRx = 0; tg.shRz = -2.95; tg.elRx = -0.2;
      tg.pitch = Math.min(tg.pitch, -0.2);
    } else if (act.type === "slump") {
      tg.lean = 0.38; tg.pitch = Math.max(tg.pitch, 0.5); tg.shLz = 0.25; tg.shRz = -0.25;
      tg.mouthMode = 2;
    } else if (act.type === "shrug") {
      tg.shLx = -0.5; tg.shLz = 0.55; tg.shRx = -0.5; tg.shRz = -0.55;
      tg.yaw = Math.sin(t * 6) * 0.08;
    } else if (act.type === "point") {
      tg.shRx = -1.5 + Math.sin(t * 2.2) * 0.08; tg.shRz = -0.55; tg.elRx = -0.12;
      tg.shLx = -0.3; tg.shLz = 0.35; tg.elLx = -1.4;
      tg.lean = 0.06;
    } else if (act.type === "nod") {
      tg.pitch = Math.max(tg.pitch, Math.abs(Math.sin(t * 3)) * 0.22);
      tg.shRx = -1.1 + Math.sin(t * 5) * 0.12; tg.shRz = -0.4; tg.elRx = -1.1 + Math.cos(t * 5) * 0.15;
    } else if (act.type === "clap") {
      const c = Math.abs(Math.sin(t * 6));
      tg.shLx = -1.15; tg.shLz = 0.35 + c * 0.15; tg.elLx = -1.7;
      tg.shRx = -1.15; tg.shRz = -0.35 - c * 0.15; tg.elRx = -1.7;
    }

    if (t < rec.talkUntil) {
      tg.mouth = 0.6 + Math.abs(Math.sin(t * 15 + rec.phase)) * 1.7;
      tg.mouthMode = rec.id === "haycai" ? 3 : 1;
      tg.pitch += Math.sin(t * 9 + rec.phase) * 0.05;
      tg.yaw += Math.sin(t * 5.5) * 0.04;
    }
    return tg;
  }

  /* ---------- Vòng lặp ---------- */
  let running = true;
  let rafId = 0;
  const clock = new THREE.Clock();

  function tick() {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    for (const rec of chars.values()) {
      computePose(rec, t);
      const k = reducedMotion ? 1 : dampK(dt, 5);
      const cur = rec.cur, tg = rec.tgt;
      for (const key of ["lean", "yaw", "pitch", "hipY", "shLx", "shLz", "elLx", "shRx", "shRz", "elRx", "mouth", "brow", "mouthMode"]) {
        cur[key] += (tg[key] - cur[key]) * k;
      }
      const rig = rec.rig;
      rig.torso.rotation.x = cur.lean;
      rig.head.rotation.y = cur.yaw;
      rig.head.rotation.x = cur.pitch;
      rig.hips.position.y = rec.baseHipsY + cur.hipY;
      rig.armL.sh.rotation.x = cur.shLx; rig.armL.sh.rotation.z = cur.shLz; rig.armL.el.rotation.x = cur.elLx;
      rig.armR.sh.rotation.x = cur.shRx; rig.armR.sh.rotation.z = cur.shRz; rig.armR.el.rotation.x = cur.elRx;
      rig.brows[0].rotation.z = (rec.id === "haycai" ? 0.38 : 0) + cur.brow * 0.15;
      rig.brows[1].rotation.z = (rec.id === "haycai" ? -0.38 : 0) - cur.brow * 0.15;
      // Miệng theo mode
      const mm = Math.round(cur.mouthMode);
      rig.mouthParts.forEach((part, idx) => { part.visible = idx === mm; });
      rig.mouthParts[1].scale.y = Math.max(0.3, cur.mouth);

      // Thở + chớp mắt + emote nổi
      if (!reducedMotion) {
        rig.torso.scale.set(1, 1 + Math.sin(t * 1.9 + rec.phase) * 0.02, 1);
        if (t > rec.blinkAt) { rec.blinkT = 0; rec.blinkAt = t + 2 + Math.random() * 4; }
        if (rec.blinkT < 1) {
          rec.blinkT = Math.min(1, rec.blinkT + dt * 5);
          const env = Math.sin(rec.blinkT * Math.PI);
          for (const e of rig.eyes) e.scale.y = rec.lidBase * (0.08 + env * 1.05);
        } else {
          for (const e of rig.eyes) e.scale.y = rec.lidBase;
        }
        if (rec.marker) rec.marker.position.y = 0.82 + Math.sin(t * 2 + rec.phase) * 0.03;
        if (rec.emoteSpr.visible) rec.emoteSpr.position.y = 0.62 + Math.sin(t * 3 + rec.phase) * 0.04;
        if (rec.ring && rec.ring.material.opacity > 0) {
          rec.ring.material.opacity = 0.65 + Math.sin(t * 4 + rec.phase) * 0.2;
          const rs = 1 + Math.sin(t * 4 + rec.phase) * 0.06;
          rec.ring.scale.set(rs, rs, 1);
        }
        // Nhảy: squash-and-stretch trên root
        if (rec.hopT >= 0) {
          rec.hopT += dt * 1.6;
          const j = Math.min(rec.hopT, 1);
          const s = Math.sin(j * Math.PI);
          rig.root.scale.setScalar((rig.id === "teacher" ? 1.22 : 1) * (1 - s * 0.1));
          rig.root.scale.y = (rig.id === "teacher" ? 1.22 : 1) * (1 + s * 0.2);
          if (j >= 1) { rec.hopT = -1; rig.root.scale.setScalar(rig.id === "teacher" ? 1.22 : 1); }
        }
      } else {
        for (const e of rig.eyes) e.scale.y = rec.lidBase;
        if (rec.hopT >= 0) { rec.hopT = -1; }
      }
      // Hết hạn emote + hành động
      if (rec.emote && rec.emote.until !== Infinity && t > rec.emote.until) setEmote(rec, null, 0);
      if (rec.action.until !== Infinity && t > rec.action.until && rec.action.type !== "idle") {
        rec.action = { type: "idle", until: 0 };
      }
    }

    // Đồng hồ kim chạy theo giờ thật
    const now = new Date();
    const mAng = (now.getMinutes() + now.getSeconds() / 60) / 60 * Math.PI * 2;
    const hAng = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2;
    minHand.rotation.z = -mAng;
    hourHand.rotation.z = -hAng;

    // Chuông rung
    if (bellShake > 0.01) {
      bell.rotation.z = Math.sin(t * 30) * 0.35 * bellShake;
      bellShake *= Math.pow(0.02, dt);
    } else bell.rotation.z = 0;

    // Điểm bay
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life += dt;
      f.spr.position.y += f.rise * dt;
      f.spr.material.opacity = Math.max(0, 1 - f.life / 1.6);
      if (f.life > 1.6) {
        scene.remove(f.spr);
        f.spr.material.map.dispose();
        f.spr.material.dispose();
        floats.splice(i, 1);
      }
    }
    // Sparkles
    if (sparks.visible) {
      let any = false;
      for (let i = 0; i < SPARK_N; i++) {
        const d = sparkData[i];
        if (d.life <= 0) { sparkPos[i * 3 + 1] = -100; continue; }
        d.life -= dt;
        sparkPos[i * 3] += d.vx * dt;
        sparkPos[i * 3 + 1] += d.vy * dt;
        sparkPos[i * 3 + 2] += d.vz * dt;
        d.vy -= 2.2 * dt;
        if (d.life > 0) any = true;
      }
      sparks.visible = any;
      sparkGeo.attributes.position.needsUpdate = true;
    }
    // Cánh hoa rơi
    if (petals.visible) {
      const pos = petalGeo.attributes.position;
      for (let i = 0; i < PETAL_N; i++) {
        let y = pos.getY(i) - dt * 0.45;
        if (y < 0) y = 6.5;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(t * 1.3 + petalSeed[i]) * 0.25 * dt);
      }
      pos.needsUpdate = true;
    }
    // Cánh hoa tung ở tổng kết
    if (petalsBurst) {
      const pos = petalsBurst.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 0.6;
        if (y < 0) y = 7;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    // Camera
    if (!reducedMotion) {
      if (camPush > 0) camPush = Math.max(0, camPush - dt * 1.4);
      camGoalPos.z = (scenePhase === "summary" ? camGoalPos.z : 9.5) - camPush * 0.7;
      const ck = dampK(dt, 2.2);
      camPos.lerp(camGoalPos, ck);
      camLook.lerp(camGoalLook, ck);
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    renderer.render(scene, camera);
  }

  /* ---------- Kích thước ---------- */
  function resize() {
    const narrow = narrowQuery.matches;
    const box = narrow || !canvas.parentElement ? canvas : canvas.parentElement;
    const w = Math.max(1, box.clientWidth || 800);
    const h = Math.max(1, box.clientHeight || 450);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    lookY = narrow ? 1.35 : 2.5;
    const camZ = narrow ? 9.0 : 9.5;
    if (!reducedMotion) {
      camGoalPos.set(0, narrow ? 2.8 : 3.4, camZ);
      camGoalLook.set(0, lookY, -1);
      camPos.set(camGoalPos.x, camGoalPos.y, camGoalPos.z);
      camLook.set(0, lookY, -1);
    }
    const tanH = (narrow ? 5.0 : 4.1) / (camZ - 2.4);
    const vFov = 2 * Math.atan(tanH / camera.aspect) * (180 / Math.PI);
    camera.fov = Math.min(95, Math.max(44, vFov));
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  if (canvas.parentElement) ro.observe(canvas.parentElement);
  window.addEventListener("resize", resize);
  resize();
  tick();

  function dispose() {
    running = false;
    cancelAnimationFrame(rafId);
    ro.disconnect();
    window.removeEventListener("resize", resize);
    for (const g of geoCache.values()) g.dispose();
    for (const m of matCache.values()) m.dispose();
    boardTex.dispose();
    floorTex.dispose();
    blobTex.dispose();
    renderer.dispose();
  }

  return {
    setPlayers, highlight, buzz, ringBell, floatScore, podium, resize, dispose,
    setPhase, setBoard, talk, react, screenPos, lookAt,
  };
}
