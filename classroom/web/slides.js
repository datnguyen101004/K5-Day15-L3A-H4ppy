/* Học slide: hiển thị slide thật (PDF qua pdf.js CDN, fallback HTML), đánh số đoạn quan trọng; người học tự viết thẻ (tiêu đề + nội dung) */

import { $, $$, h, api, enc, run, toast, announce, normText, uid, reducedMotion } from "./api.js";
import * as store from "./store.js";
import { TYPE_LABELS, TYPE_COLORS } from "./faces.js";

const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.mjs";

let pdfjs = null; // null: chưa thử; false: lỗi -> fallback HTML
async function getPdfjs() {
  if (pdfjs !== null) return pdfjs || null;
  try {
    const mod = await import("pdfjs-dist");
    mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    pdfjs = mod;
  } catch (e) {
    pdfjs = false;
  }
  return pdfjs || null;
}

const study = {
  ctx: null,
  docId: null,
  doc: null,
  slide: 1,
  pdfDoc: null,
  pdfFailed: false,
  renderToken: 0,
  sugCache: new Map(),
  sugInflight: new Map(), // key -> Promise: không gọi lặp cùng một slide
  hlEls: [],       // các phần tử highlight đang vẽ [{el, sugId, num}]
  activeSug: null,
};

export function initStudy(ctx) {
  study.ctx = ctx;
  $("#prev-slide").addEventListener("click", () => goSlide(study.slide - 1));
  $("#next-slide").addEventListener("click", () => goSlide(study.slide + 1));
  window.addEventListener("keydown", (e) => {
    if (ctx.tab !== "study") return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); goSlide(study.slide - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); goSlide(study.slide + 1); }
  });
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (ctx.tab === "study" && isPdfShown()) renderCurrentPdf(); }, 250);
  });
  $("#slide-search").addEventListener("submit", (e) => { e.preventDefault(); searchSlides(); });
}

/* ---------- Tìm trong slide (RAG: hybrid vector + từ khoá trên server) ---------- */

async function searchSlides() {
  const q = $("#slide-search-q").value.trim();
  const box = $("#slide-search-results");
  if (!q || !study.docId) { box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren(h("p", { class: "sug-status", text: "Cô Linh đang tìm trong slide…" }));
  const data = await run(() => api(`/api/docs/${enc(study.docId)}/search?q=${enc(q)}&k=5`));
  if (!data) { box.hidden = true; return; }
  const how = data.retrieval && data.retrieval.method === "hybrid-rrf"
    ? `Tìm bằng ngữ nghĩa + từ khoá (${data.retrieval.embed_model})` : "Tìm theo từ khoá";
  box.replaceChildren(
    h("div", { class: "search-head" }, [
      h("span", { class: "field-label", text: data.results.length ? `${data.results.length} đoạn liên quan · ${how}` : "Không tìm thấy đoạn nào khớp." }),
      h("button", { type: "button", class: "link-btn", text: "Đóng", onclick: () => { box.hidden = true; } }),
    ]),
    h("ol", { class: "search-list" }, data.results.map((r) => h("li", {}, [
      h("button", {
        type: "button", class: "search-hit", onclick: () => goSlide(r.slide),
        "aria-label": `Mở slide ${r.slide}`,
      }, [
        h("span", { class: "search-slide", text: `Slide ${r.slide}` }),
        h("span", { class: "search-text", text: r.text }),
      ]),
    ]))),
  );
}

export async function loadDocInStudy(docId) {
  const doc = await run(() => api(`/api/docs/${enc(docId)}`));
  if (!doc) return;
  study.docId = doc.id;
  study.doc = doc;
  study.pdfDoc = null;
  study.pdfFailed = false;
  const prog = store.progressFor(doc.id);
  const first = doc.slides.length ? Math.min(Math.max(prog.last || 1, 1), doc.slides.length) : 1;
  await goSlide(first);
}

function isPdfShown() {
  return !$("#pdf-wrap").hidden;
}

async function goSlide(n) {
  const doc = study.doc;
  if (!doc || !doc.slides.length) return;
  n = Math.min(Math.max(n, 1), doc.slides.length);
  study.slide = n;
  store.markVisited(doc.id, n, doc.slides.length);
  renderChrome();
  await renderSlideBody(n);
  if (study.slide === n) await renderSuggestions();
}

function renderChrome() {
  const doc = study.doc;
  const n = study.slide, total = doc.slides.length;
  $("#slide-counter").textContent = `Slide ${n} / ${total} — ${doc.title}`;
  $("#prev-slide").disabled = n <= 1;
  $("#next-slide").disabled = n >= total;
  const prog = store.progressFor(doc.id);
  const visited = (prog.visited || []).filter((x) => x >= 1 && x <= total).length;
  // thanh theo vị trí slide đang mở (lùi thì giảm); chữ bên cạnh vẫn đếm số slide đã xem
  $("#slide-progress-fill").style.width = `${(n / total) * 100}%`;
  $("#slide-progress-label").textContent = `Slide ${n}/${total} · đã xem ${visited}`;
  const s = doc.slides[n - 1];
  $("#suggest-sub").textContent = s ? `Slide ${n}: ${s.title}` : "";
}

/* ---------- Hiển thị thân slide ---------- */

async function renderSlideBody(n) {
  const doc = study.doc;
  const s = doc.slides[n - 1];
  $("#slide-status").textContent = "";
  study.hlEls = [];
  $("#hl-layer").replaceChildren();
  if (doc.kind === "pdf" && doc.file_url) {
    const ok = await renderPdfPage(n);
    if (ok) {
      $("#pdf-wrap").hidden = false;
      $("#html-slide").hidden = true;
      return;
    }
    $("#slide-status").textContent = "Không vẽ được slide PDF bằng pdf.js — hiển thị bản chữ của slide.";
  }
  $("#pdf-wrap").hidden = true;
  $("#html-slide").hidden = false;
  renderHtmlSlide(s);
}

export const goSlideTo = (n) => goSlide(n);

function renderHtmlSlide(s) {
  const root = $("#html-slide");
  root.replaceChildren();
  if (!s) { root.append(h("p", { text: "Slide này không có nội dung chữ." })); return; }
  root.append(h("h3", { class: "html-slide-title", text: s.title }));
  const ul = h("ul", { class: "html-slide-bullets" });
  for (const b of s.bullets || []) ul.append(h("li", { text: b }));
  if (!ul.children.length && s.text) {
    for (const line of s.text.split(/\n+/).filter(Boolean)) ul.append(h("li", { text: line }));
  }
  root.append(ul);
  drawHtmlHighlights();
}

/* ---------- PDF ---------- */

async function renderPdfPage(n) {
  const lib = await getPdfjs();
  const doc = study.doc;
  if (!lib || !doc.file_url) return false;
  try {
    if (!study.pdfDoc) {
      // file PDF là byte: fetch trực tiếp thay vì api() (api parse JSON)
      const res = await fetch(doc.file_url);
      if (!res.ok) throw new Error("file lỗi");
      const data = await res.arrayBuffer();
      study.pdfDoc = await lib.getDocument({ data }).promise;
    }
    const page = await study.pdfDoc.getPage(n);
    const wrap = $("#pdf-wrap");
    const cssW = Math.max(280, wrap.clientWidth || wrap.parentElement.clientWidth - 4);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const base = page.getViewport({ scale: 1 });
    const scale = (cssW / base.width) * dpr;
    const viewport = page.getViewport({ scale });
    const canvas = $("#pdf-canvas");
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${viewport.height / dpr}px`;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const token = ++study.renderToken;
    const ctx2d = canvas.getContext("2d");
    await page.render({ canvasContext: ctx2d, viewport }).promise;
    if (token !== study.renderToken) return true; // đã có bản mới hơn
    const layer = $("#hl-layer");
    layer.style.width = `${cssW}px`;
    layer.style.height = `${viewport.height / dpr}px`;
    const index = await buildPageIndex(page);
    study.pageIndex = index;
    study.pdfPage = page;
    study.pdfViewport = viewport;
    study.pdfScale = cssW / viewport.width; // viewport px -> css px
    drawPdfHighlights();
    return true;
  } catch (e) {
    study.pdfFailed = true;
    return false;
  }
}

async function renderCurrentPdf() {
  if (study.doc && study.doc.kind === "pdf") await renderPdfPage(study.slide);
}

/* Chỉ số chữ của trang PDF: chuỗi đã chuẩn hoá khoảng trắng + ánh xạ từng ký tự về text item */
async function buildPageIndex(page) {
  const tc = await page.getTextContent();
  const items = tc.items.filter((it) => it.str);
  const chars = []; // {ch, i: chỉ số item}
  let prev = null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (prev) {
      const ph = prev.it.height || 10;
      const dy = Math.abs(it.transform[5] - prev.it.transform[5]);
      const gap = it.transform[4] - (prev.it.transform[4] + prev.it.width);
      if (prev.it.hasEOL || dy > ph * 0.6 || gap > ph * 0.25) chars.push({ ch: "\n", i: prev.i });
    }
    for (const ch of it.str) chars.push({ ch, i });
    prev = { it, i };
  }
  let text = "";
  const map = [];
  let ws = false, wsI = 0;
  for (const c of chars) {
    if (/\s/.test(c.ch)) { if (!ws) { ws = true; wsI = c.i; } continue; }
    if (ws) { text += " "; map.push(wsI); ws = false; }
    text += c.ch; map.push(c.i);
  }
  let s = 0;
  while (s < text.length && /\s/.test(text[s])) s++;
  return { text: text.slice(s), map: map.slice(s), items };
}

/* Tìm excerpt trong chỉ số trang; trả về dải ký tự [start,end) hoặc null */
function locateRange(index, excerpt) {
  const q = normText(excerpt);
  if (!q || !index) return null;
  const idx = index.text.indexOf(q);
  if (idx < 0) return null;
  return { start: idx, end: idx + q.length };
}

/* Hộp chữ của một item theo toạ độ viewport (canvas). item.width đã ở đơn vị trang (không nhân ma trận font);
   cao dòng = độ dài cột 2 của ma trận đã biến đổi (cách pdf.js tự dựng lớp chữ) */
function itemRect(lib, viewport, it) {
  const t = lib.Util.transform(viewport.transform, it.transform);
  const fontH = Math.hypot(t[2], t[3]);
  const x0 = t[4], baseline = t[5];
  return { x0, y0: baseline - fontH, x1: x0 + it.width * viewport.scale, y1: baseline + fontH * 0.2 };
}

/* Gộp các hộp item thành từng dòng tô sáng */
function lineRects(rects) {
  const sorted = [...rects].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const groups = [];
  for (const r of sorted) {
    const cy = (r.y0 + r.y1) / 2, hh = Math.max(1, r.y1 - r.y0);
    const g = groups[groups.length - 1];
    if (g && Math.abs(g.cy - cy) < Math.max(hh, g.h) * 0.6) {
      g.x0 = Math.min(g.x0, r.x0); g.x1 = Math.max(g.x1, r.x1);
      g.y0 = Math.min(g.y0, r.y0); g.y1 = Math.max(g.y1, r.y1);
      g.cy = (g.y0 + g.y1) / 2; g.h = g.y1 - g.y0;
    } else {
      groups.push({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, cy, h: hh });
    }
  }
  return groups;
}

/* Danh sách cần tô: các đoạn quan trọng của slide, số thứ tự trùng số trên thẻ trống bên phải */
function excerptTargets() {
  return currentSuggestions().map((s, i) => ({ excerpt: s.excerpt, sugId: s.id, num: i + 1 }));
}

function currentSuggestions() {
  const key = `${study.docId}:${study.slide}`;
  return study.sugCache.get(key) || [];
}

async function drawPdfHighlights() {
  const lib = pdfjs;
  const layer = $("#hl-layer");
  layer.replaceChildren();
  study.hlEls = [];
  if (!study.pageIndex || !lib) return;
  const targets = excerptTargets();
  for (const t of targets) {
    const range = locateRange(study.pageIndex, t.excerpt);
    if (!range) continue; // không tìm thấy: thẻ bên vẫn hiện excerpt + Slide n
    const itemIdxs = new Set(study.pageIndex.map.slice(range.start, range.end));
    const rects = [...itemIdxs].map((i) => itemRect(lib, study.pdfViewport, study.pageIndex.items[i]));
    const lines = lineRects(rects);
    const k = study.pdfScale;
    lines.forEach((r, li) => {
      const el = h("button", {
        type: "button",
        class: "hl",
        "aria-label": `Đoạn số ${t.num} — bấm để tới thẻ số ${t.num}`,
        dataset: { sug: t.sugId },
      });
      el.style.left = `${r.x0 * k}px`;
      el.style.top = `${r.y0 * k}px`;
      el.style.width = `${Math.max(8, (r.x1 - r.x0) * k)}px`;
      el.style.height = `${Math.max(6, (r.y1 - r.y0) * k)}px`;
      el.addEventListener("click", () => onHighlightClick(t));
      layer.append(el);
      study.hlEls.push({ el, sugId: t.sugId });
      if (li === 0) {
        const badge = h("button", {
          type: "button", class: "hl-badge", text: String(t.num),
          "aria-label": `Tới thẻ số ${t.num}`,
        });
        badge.style.left = `${Math.max(14, r.x0 * k - 22)}px`; // số thứ tự nằm ở lề trái, không che chữ
        badge.style.top = `${r.y0 * k}px`;
        badge.addEventListener("click", (e) => { e.stopPropagation(); onHighlightClick(t); });
        layer.append(badge);
        el.dataset.num = String(t.num);
        study.hlEls[study.hlEls.length - 1].num = t.num;
      }
    });
  }
  linkCardsToHighlights();
}

/* Tô đoạn trên slide HTML (fallback hoặc tài liệu không phải PDF): tô bullet chứa excerpt */
function drawHtmlHighlights() {
  const layer = $("#hl-layer");
  // với slide HTML không dùng lớp highlight tuyệt đối: tô trực tiếp lên bullet
  const s = study.doc.slides[study.slide - 1];
  if (!s) return;
  const targets = excerptTargets();
  const lis = $$("#html-slide .html-slide-bullets li");
  const titleEl = $("#html-slide .html-slide-title");
  for (const t of targets) {
    const q = normText(t.excerpt);
    if (!q) continue;
    let hit = null, hitEl = null;
    for (const li of lis) if (normText(li.textContent).includes(q)) { hit = li; hitEl = li; break; }
    if (!hit && titleEl && normText(titleEl.textContent).includes(q)) { hit = titleEl; hitEl = titleEl; }
    if (!hit && normText(s.text || "").includes(q)) {
      // tô cả khối nếu không khớp bullet nào (trường hợp text dài)
      hit = $("#html-slide"); hitEl = $("#html-slide");
    }
    if (!hit) continue;
    hitEl.classList.add("hl-text");
    const badge = h("button", {
      type: "button", class: "hl-badge hl-badge-inline", text: String(t.num),
      "aria-label": `Tới thẻ số ${t.num}`,
      onclick: () => onHighlightClick(t),
    });
    hitEl.prepend(badge);
    study.hlEls.push({ el: hitEl, badge, sugId: t.sugId, num: t.num });
  }
  linkCardsToHighlights();
}

function onHighlightClick(t) {
  const card = $(`#suggest-list .sug-card[data-sug="${t.sugId}"]`);
  if (card) {
    card.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    card.classList.add("flash");
    setTimeout(() => card.classList.remove("flash"), 1200);
    setActiveHl(t.sugId);
  }
}

function setActiveHl(sugId) {
  for (const x of study.hlEls) {
    x.el.classList.toggle("active", x.sugId === sugId);
    if (x.badge) x.badge.classList.toggle("active", x.sugId === sugId);
  }
}

function linkCardsToHighlights() {
  $$("#suggest-list .sug-card").forEach((card) => {
    const sugId = card.dataset.sug;
    card.onclick = (e) => {
      if (e.target.closest("button, input, textarea, select, a, blockquote")) return;
      setActiveHl(sugId);
    };
  });
}

/* ---------- Gợi ý ---------- */

function sugKey(n) { return `${study.docId}:${n}`; }

/* Tải gợi ý của slide n (có model thì vài giây); các lời gọi trùng dùng chung một Promise */
function fetchSuggestions(n) {
  const key = sugKey(n);
  if (study.sugCache.has(key)) return Promise.resolve(study.sugCache.get(key));
  if (!study.sugInflight.has(key)) {
    const p = api(`/api/docs/${enc(study.docId)}/slides/${n}/suggestions`)
      .then((data) => { const s = (data && data.suggestions) || []; study.sugCache.set(key, s); return s; })
      .finally(() => study.sugInflight.delete(key));
    study.sugInflight.set(key, p);
  }
  return study.sugInflight.get(key);
}

async function renderSuggestions() {
  const list = $("#suggest-list");
  const status = $("#suggest-status");
  const n = study.slide, docId = study.docId;
  list.replaceChildren();
  let sugs = study.sugCache.get(sugKey(n));
  if (!sugs) {
    status.textContent = "Cô Linh đang đọc slide này để soạn câu hỏi…";
    status.hidden = false;
    sugs = await run(() => fetchSuggestions(n));
    if (study.slide !== n || study.docId !== docId) return; // người học đã sang slide khác
    status.hidden = true;
    if (!sugs) return; // lỗi: toast đã có nút Thử lại
  }
  // tải sẵn slide kế tiếp khi rảnh, để chuyển slide không phải chờ
  if (study.doc && n < study.doc.slides.length) fetchSuggestions(n + 1).catch(() => {});
  const dismissed = store.dismissedFor(study.docId);
  const saved = store.savedMap(study.docId);
  const visible = sugs.filter((s) => !dismissed.includes(s.id));
  const hiddenDismissed = sugs.filter((s) => dismissed.includes(s.id));

  if (!sugs.length) {
    list.append(h("p", { class: "calm-note", text: "Slide này không có đoạn nào được đánh số. Bạn vẫn có thể tự viết thẻ ở tab Sổ tay." }));
  }
  for (const s of visible) list.append(renderSuggestion(s, sugs.indexOf(s) + 1, saved[s.id] || null));
  for (const s of hiddenDismissed) {
    const row = h("div", { class: "sug-dismissed" });
    row.append(h("span", { text: `Đã bỏ qua thẻ số ${sugs.indexOf(s) + 1}` }));
    row.append(h("button", {
      type: "button", class: "link-btn",
      text: "Hoàn tác",
      onclick: () => { store.undoDismiss(study.docId, s.id); renderSuggestions(); },
    }));
    list.append(row);
  }
  // vẽ lại highlight (số thứ tự có thể đổi sau khi bỏ qua)
  if (isPdfShown()) drawPdfHighlights(); else drawHtmlHighlights();
}

function truncate(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function typeBadge(type) {
  return h("span", { class: "type-badge", dataset: { type }, style: `--type-c: ${TYPE_COLORS[type] || "#CCC"}`, text: TYPE_LABELS[type] || type });
}

function renderSuggestion(sug, num, savedCardId) {
  const card = h("article", { class: "sug-card", dataset: { sug: sug.id } });
  card.append(h("p", { class: "sug-q-label" }, [
    h("span", { class: "sug-num", text: String(num), "aria-hidden": "true" }),
    h("span", { class: "field-label", text: `Thẻ cho đoạn số ${num} trên slide` }),
  ]));
  const body = h("div", { class: "sug-body" });
  const actions = h("div", { class: "sug-actions" });
  card.append(body, actions);

  /* Khung thẻ trống: người học tự đặt tiêu đề và tự viết nội dung, không có gì viết sẵn */
  function paintEdit(focus = false) {
    const titleIn = h("input", { type: "text", "aria-label": "Tiêu đề thẻ", maxlength: "120", placeholder: "Tự đặt tiêu đề cho thẻ" });
    const contentIn = h("textarea", {
      rows: 4, "aria-label": "Nội dung thẻ",
      placeholder: "Đọc đoạn số " + num + " trên slide rồi viết lại bằng lời của bạn — bot chỉ biết những gì bạn viết ở đây.",
    });
    const typeSel = h("select", { "aria-label": "Loại thẻ" },
      Object.entries(TYPE_LABELS).map(([v, label]) => h("option", { value: v, text: label, selected: v === sug.type || null })));
    body.replaceChildren(
      h("div", { class: "edit-grid" }, [
        h("label", { class: "field" }, [h("span", { class: "field-label", text: "Tiêu đề" }), titleIn]),
        h("label", { class: "field" }, [h("span", { class: "field-label", text: "Loại thẻ" }), typeSel]),
        h("label", { class: "field field-wide" }, [h("span", { class: "field-label", text: "Nội dung cho bot" }), contentIn]),
      ]),
    );
    actions.replaceChildren(
      h("button", {
        type: "button", class: "btn btn-primary", text: "Lưu thẻ",
        onclick: () => saveSuggestion(sug, { title: titleIn.value.trim(), content: contentIn.value.trim(), type: typeSel.value }),
      }),
      h("button", { type: "button", class: "btn btn-ghost", text: "Bỏ qua", onclick: () => {
        store.dismissSuggestion(study.docId, sug.id);
        announce("Đã bỏ qua thẻ này. Có thể hoàn tác bên dưới.");
        renderSuggestions();
      } }),
    );
    if (focus) titleIn.focus();
  }

  function paintDone(cardId) {
    const saved = store.getCard(cardId);
    body.replaceChildren(saved
      ? h("div", {}, [
        h("div", { class: "proposal-head" }, [typeBadge(saved.type), h("h4", { text: saved.title })]),
        h("p", { class: "proposal-content", text: saved.content }),
      ])
      : h("p", { class: "calm-note", text: "Thẻ đã bị xoá khỏi sổ tay." }));
    actions.replaceChildren(...(saved
      ? [h("span", { class: "saved-note", text: "Đã lưu vào sổ tay" }),
        h("button", { type: "button", class: "btn", text: "Mở thẻ", onclick: () => {
          study.ctx.openNotebookCard(cardId, () => {
            paintDone(cardId);
            actions.querySelector("button")?.focus();
          });
        } })]
      : [h("button", { type: "button", class: "btn btn-primary", text: "Viết lại thẻ", onclick: () => paintEdit(true) })]));
  }

  if (savedCardId) paintDone(savedCardId); else paintEdit();
  return card;
}

function saveSuggestion(sug, cardFields) {
  if (!cardFields.title || !cardFields.content) {
    toast("Tiêu đề và nội dung thẻ không được để trống.");
    return;
  }
  const card = store.addCard({
    id: uid("c"),
    title: cardFields.title,
    content: cardFields.content,
    type: cardFields.type || "concept",
    own: false,
    source: { doc_id: sug.doc_id, doc_title: sug.doc_title, slide: sug.slide },
  });
  store.markSaved(study.docId, sug.id, card.id);
  announce(`Đã lưu thẻ “${card.title}” vào sổ tay.`);
  toast(`Đã lưu thẻ “${truncate(card.title, 40)}” vào sổ tay.`, { success: true });
  study.ctx.refreshNotebook();
  renderSuggestions();
}

export function currentDoc() { return study.doc; }
export function currentSlide() { return study.slide; }
