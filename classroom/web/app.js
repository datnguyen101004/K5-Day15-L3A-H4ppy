/* Lớp học tranh tài v2 — vỏ ứng dụng: thanh trên, tab, chọn tài liệu, trạng thái chung */

import { $, $$, h, api, enc, run, toast } from "./api.js";
import * as store from "./store.js";
import { initStudy, loadDocInStudy } from "./slides.js";
import { initNotebook, refreshNotebook, renderNotebook, openNotebookCard } from "./notebook.js";
import { initArena, showArenaSub } from "./arena.js";
import { initReview } from "./review.js";
import { initQuiz, renderQuiz } from "./quiz.js";
import { initTour } from "./tour.js";
const ctx = {
  tab: "study",
  match: null,
  botName: localStorage.getItem("lhtt.botname") || "Bé Bot",
  topics: [],
  goTab, refreshNotebook, openNotebookCard,
  getDocId: () => ctx.docId,
  setMatch(m) { ctx.match = m; },
  openSlide(docId, n) {
    goTab("study");
    run(async () => {
      if (ctx.docId !== docId) await selectDoc(docId, true);
      const { goSlideTo } = await import("./slides.js");
      await goSlideTo(n);
    });
  },
};
/* ---------- Tab ---------- */

const TABS = ["study", "notebook", "arena", "quiz"];

/* opts.quiet: chỉ đổi tab, giữ nguyên màn con của Đấu trường nếu đang hiện (hướng dẫn dùng để không phát lại trận) */
function goTab(name, opts = {}) {
  if (!TABS.includes(name)) return;
  ctx.tab = name;
  for (const t of TABS) {
    const btn = $(`#tab-btn-${t}`);
    const panel = $(`#panel-${t}`);
    const active = t === name;
    btn.setAttribute("aria-selected", String(active));
    btn.setAttribute("aria-current", active ? "page" : "false");
    btn.tabIndex = active ? 0 : -1;
    panel.hidden = !active;
  }
  if (name === "notebook") renderNotebook();
  if (name === "quiz") renderQuiz();
  const arenaShowing = ["#arena-landing", "#prepare-view", "#arena-view", "#review-view"].some((s) => !$(s).hidden);
  if (name === "arena" && !(opts.quiet && arenaShowing)) {
    const m = ctx.match;
    if (m && (m.phase === "question" || m.phase === "scored")) {
      import("./arena.js").then((a) => a.enterMatch(m));
    } else if (m && m.phase === "review") {
      import("./review.js").then((r) => r.renderReview(m)); // xem lại trận rồi bấm "Đấu lại với câu mới"
    } else {
      showArenaSub("landing");
    }
  }
}

function initTabs() {
  const list = $(".tabs");
  for (const t of TABS) {
    $(`#tab-btn-${t}`).addEventListener("click", () => goTab(t));
  }
  list.addEventListener("keydown", (e) => {
    const i = TABS.indexOf(ctx.tab);
    let j = null;
    if (e.key === "ArrowRight") j = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = TABS.length - 1;
    if (j !== null) {
      e.preventDefault();
      goTab(TABS[j]);
      $(`#tab-btn-${TABS[j]}`).focus();
    }
  });
}

/* ---------- Thanh trên: tài liệu + chế độ ---------- */

async function loadDocs() {
  const data = await run(() => api("/api/docs"));
  if (!data) return;
  const sel = $("#doc-select");
  sel.replaceChildren();
  const docs = data.docs || [];
  $("#docs-empty").hidden = docs.length > 0;
  $("#docs-empty-dir").textContent = `${data.source_dir || "data/slides"}/`;
  for (const d of docs) {
    sel.append(h("option", { value: d.id, text: `${d.title} (${d.slides} slide)` }));
  }
  renderModeBadge(data.mode, data.mode_note);
  if (!docs.length) return;
  const wanted = ctx.docId && docs.some((d) => d.id === ctx.docId) ? ctx.docId : docs[0].id;
  await selectDoc(wanted);
}

function renderModeBadge(mode, modeNote) {
  const badge = $("#mode-badge");
  badge.hidden = false;
  badge.classList.toggle("offline", mode !== "model");
  badge.textContent = mode === "model" ? "Có model" : "Chế độ không model";
  const old = $("#mode-note");
  if (old) old.remove();
  if (modeNote) {
    // ghi chú nhỏ cạnh badge, bấm để mở rộng / thu gọn
    const short = modeNote.length > 70 ? modeNote.slice(0, 70).trimEnd() + "…" : modeNote;
    const full = h("span", { class: "mode-note-full", hidden: true, text: modeNote });
    const btn = h("button", {
      type: "button", class: "mode-note-toggle", "aria-expanded": "false",
      text: short,
      onclick: () => {
        const expanded = full.hidden;
        full.hidden = !expanded;
        btn.setAttribute("aria-expanded", String(expanded));
        btn.textContent = expanded ? "Thu gọn" : short;
      },
    });
    badge.after(h("span", { class: "mode-note", id: "mode-note" }, [btn, full]));
  }
}

async function selectDoc(docId, force) {
  if (ctx.docId === docId && !force) return;
  ctx.docId = docId;
  $("#doc-select").value = docId;
  await loadDocInStudy(docId);
  if (ctx.tab === "quiz") renderQuiz();
}

/* ---------- Khởi động ---------- */

async function boot() {
  initTabs();
  initStudy(ctx);
  initNotebook(ctx);
  initArena(ctx);
  initReview(ctx);
  initQuiz(ctx);
  initTour(ctx);
  $("#doc-select").addEventListener("change", (e) => run(() => selectDoc(e.target.value, true)));
  $("#reload-docs-btn").addEventListener("click", loadDocs);
  $("#bot-name-input") && $("#bot-name-input").addEventListener("change", (e) => {
    ctx.botName = e.target.value.trim() || "Bé Bot";
    localStorage.setItem("lhtt.botname", ctx.botName);
  });
  await loadDocs();
  refreshNotebook();
  goTab("study");
}

/* Thanh cuộn chỉ hiện khi đang cuộn: gắn .is-scrolling lên phần tử đang cuộn, gỡ sau 900ms đứng yên */
const scrollTimers = new WeakMap();
window.addEventListener("scroll", (e) => {
  const el = e.target === document ? document.documentElement : e.target;
  if (!(el instanceof Element)) return;
  el.classList.add("is-scrolling");
  clearTimeout(scrollTimers.get(el));
  scrollTimers.set(el, setTimeout(() => el.classList.remove("is-scrolling"), 900));
}, { capture: true, passive: true });

boot();
