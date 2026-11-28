/* Kiểm tra cuối: câu hỏi phỏng vấn thật, người học tự trả lời, cô Linh chấm theo ý của slide. */
import { $, h, api, post, enc, run, busy, announce } from "./api.js";
import { faceChipSVG } from "./faces.js";

let ctx = null;
const qz = { docId: null, data: null, list: [], i: 0, results: [], count: "5" };

export function initQuiz(context) { ctx = context; }

const root = () => $("#quiz-root");

export function renderQuiz() {
  const docId = ctx.getDocId();
  if (!docId) return;
  if (qz.docId !== docId) Object.assign(qz, { docId, data: null, list: [], i: 0, results: [] });
  if (qz.list.length && qz.i < qz.list.length) showQuestion();
  else if (qz.list.length) showSummary();
  else showIntro();
}

/* ---------- Trang đầu ---------- */

async function showIntro() {
  const box = h("div", { id: "quiz-intro", class: "board-panel quiz-intro" }, [
    h("h2", { class: "chalk-title", text: "Kiểm tra cuối" }),
    h("p", { class: "tagline", text: "Câu hỏi phỏng vấn thật về AI agent mà ứng viên kể lại sau khi phỏng vấn ở các công ty AI. Lần này bạn tự trả lời — cô Linh chấm theo các ý trong slide của lớp và chỉ ra slide cần ôn." }),
    h("p", { class: "sug-status", id: "quiz-status", role: "status", text: "Cô Linh đang tìm câu hỏi khớp với slide…" }),
  ]);
  root().replaceChildren(box);
  if (!qz.data) {
    const docId = qz.docId;
    const data = await run(() => api(`/api/docs/${enc(docId)}/quiz`));
    if (!data || qz.docId !== docId || !$("#quiz-intro")) return;
    qz.data = data;
  }
  $("#quiz-status").remove();
  const qs = qz.data.questions;
  if (!qs.length) {
    box.append(h("p", { class: "calm-note", text: "Chưa có câu hỏi phỏng vấn nào khớp với tài liệu này — các câu trong ngân hàng xoay quanh AI agent, RAG, công cụ, đánh giá. Thử chọn tài liệu khác ở góc trên." }));
    return;
  }
  const companies = [...new Set(qs.flatMap((q) => q.companies))];
  const counts = [["5", "5 câu"], ["10", "10 câu"], ["all", `Cả ${qs.length} câu`]].filter(([v]) => v === "all" || Number(v) < qs.length);
  if (!counts.some(([v]) => v === qz.count)) qz.count = "all";
  box.append(
    h("p", { class: "field-label", text: `${qs.length} câu khớp tài liệu này, được báo cáo tại:` }),
    h("ul", { class: "quiz-companies", "aria-label": "Công ty" }, companies.map((c) => h("li", { class: "company-chip", text: c }))),
    h("fieldset", { class: "quiz-count" }, [
      h("legend", { text: "Số câu muốn làm" }),
      ...counts.map(([v, label]) => h("label", { class: "quiz-count-opt" }, [
        h("input", { type: "radio", name: "quiz-count", value: v, checked: v === qz.count, onchange: () => { qz.count = v; } }),
        h("span", { text: label }),
      ])),
    ]),
    h("button", { type: "button", class: "btn btn-primary", id: "quiz-start", text: "Bắt đầu làm bài", onclick: startQuiz }),
    sourceNote(),
  );
}

function sourceNote() {
  const s = qz.data.source;
  return h("p", { class: "calm-note quiz-source" }, [
    "Câu hỏi chép nguyên văn từ bộ tổng hợp công khai ",
    h("a", { href: s.url, target: "_blank", rel: "noopener", text: s.name }),
    ` (giấy phép ${s.license}), chỉ lấy câu có nhãn “Reported”. Tên công ty ghi theo nguồn báo cáo, không phải đề chính thức của công ty. Bản dịch tiếng Việt do nhóm tự dịch.`,
  ]);
}

function startQuiz() {
  const all = [...qz.data.questions];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  qz.list = qz.count === "all" ? all : all.slice(0, Number(qz.count));
  qz.i = 0;
  qz.results = [];
  showQuestion();
}

/* ---------- Một câu hỏi ---------- */

function showQuestion() {
  const q = qz.list[qz.i];
  const done = qz.results[qz.i];
  const answer = h("textarea", {
    id: "quiz-answer", rows: "6", placeholder: "Trả lời bằng tiếng Việt hoặc tiếng Anh, như khi đang ngồi phỏng vấn…",
    "aria-describedby": "quiz-q-vi",
  });
  const submit = h("button", { type: "button", class: "btn btn-primary", id: "quiz-submit", text: "Nộp câu trả lời", disabled: true });
  const skip = h("button", { type: "button", class: "btn btn-ghost", id: "quiz-skip", text: "Bỏ qua câu này" });
  const status = h("p", { class: "sug-status", id: "quiz-grade-status", role: "status", hidden: true });
  const result = h("div", { class: "quiz-result", id: "quiz-result", "aria-live": "polite", hidden: true });
  answer.addEventListener("input", () => { submit.disabled = !answer.value.trim(); });
  answer.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !submit.disabled) submit.click(); });
  submit.addEventListener("click", () => grade(q, answer, submit, skip, status, result));
  skip.addEventListener("click", () => {
    qz.results[qz.i] = { question: q, skipped: true, score: 0, max: 10, missing: [], slides: [] };
    nextQuestion();
  });

  const card = h("article", { class: "board-panel quiz-card", id: "quiz-card", "aria-labelledby": "quiz-q-en" }, [
    h("div", { class: "quiz-meta" }, [
      h("span", { class: "field-label", text: "Được hỏi tại" }),
      ...q.companies.map((c) => h("span", { class: "company-chip", text: c })),
      h("span", { class: "level-chip", text: `Độ khó: ${q.level_vi}` }),
    ]),
    h("p", { class: "field-label quiz-q-label", text: "Câu gốc (tiếng Anh)" }),
    h("blockquote", { class: "quiz-q-en", id: "quiz-q-en", lang: "en", text: q.question_en }),
    h("p", { class: "quiz-q-vi", id: "quiz-q-vi" }, [h("span", { class: "field-label", text: "Bản dịch: " }), q.question_vi]),
    h("p", { class: "quiz-src" }, [
      `Nguồn: ${q.asked_at} · `,
      h("a", { href: q.source_url, target: "_blank", rel: "noopener", text: "bài báo cáo" }),
      " · ",
      h("a", { href: q.bank_url, target: "_blank", rel: "noopener", text: "trang câu hỏi" }),
    ]),
    h("label", { class: "field quiz-answer-field", for: "quiz-answer" }, [h("span", { class: "field-label", text: "Câu trả lời của bạn" })]),
    answer,
    h("div", { class: "quiz-actions" }, [submit, skip, h("span", { class: "quiz-hint", text: "Ctrl + Enter để nộp" })]),
    status,
    result,
  ]);
  root().replaceChildren(h("div", { class: "quiz-stage" }, [progressBar(), card]));
  if (done && !done.skipped) {
    answer.value = done.answer;
    answer.readOnly = true;
    submit.hidden = true;
    skip.hidden = true;
    renderResult(result, done);
  } else {
    answer.focus({ preventScroll: true });
  }
}

function progressBar() {
  const total = qz.list.length;
  return h("div", { class: "quiz-progress" }, [
    h("p", { class: "quiz-progress-label", text: `Câu ${qz.i + 1} / ${total}` }),
    h("div", { class: "slide-progress-track", "aria-hidden": "true" }, [
      h("div", { class: "quiz-progress-fill", style: `transform: scaleX(${(qz.i + 1) / total})` }),
    ]),
  ]);
}

async function grade(q, answer, submit, skip, status, result) {
  const text = answer.value.trim();
  const res = await busy(submit, status, "Cô Linh đang chấm theo các ý của slide…", () => run(() =>
    post("/api/quiz/grade", { doc_id: qz.docId, question_id: q.id, answer: text })));
  if (!res || qz.list[qz.i] !== q) return;
  const entry = { question: q, answer: text, ...res };
  qz.results[qz.i] = entry;
  answer.readOnly = true;
  submit.hidden = true;
  skip.hidden = true;
  renderResult(result, entry);
  announce(`Cô Linh chấm ${res.score} trên 10.`);
}

function slideButton(n, title) {
  return h("button", {
    type: "button", class: "btn btn-ghost btn-small", text: `Mở slide ${n}`,
    title: title ? `Slide ${n}: ${title}` : undefined,
    onclick: () => ctx.openSlide(qz.docId, n),
  });
}

function criterionList(items, kind) {
  return h("ul", { class: `quiz-crit ${kind}` }, items.map((c) => h("li", {}, [
    h("span", { class: "quiz-crit-mark", "aria-hidden": "true", text: kind === "hit" ? "✓" : "○" }),
    h("span", { class: "quiz-crit-text" }, [
      h("q", { text: c.excerpt }),
      h("span", { class: "quiz-crit-src", text: ` — slide ${c.slide}` }),
    ]),
    kind === "miss" ? slideButton(c.slide, c.title) : null,
  ])));
}

function renderResult(box, r) {
  const last = qz.i === qz.list.length - 1;
  const tier = r.score >= 8 ? "good" : r.score >= 5 ? "ok" : "low";
  box.replaceChildren(...[
    h("div", { class: "quiz-verdict" }, [
      h("span", { class: "tour-face", html: faceChipSVG("teacher"), "aria-hidden": "true" }),
      h("div", {}, [
        h("p", { class: `quiz-score ${tier}`, text: `${r.score}/10` }),
        h("p", { class: "quiz-comment" }, [h("b", { text: "Cô Linh: " }), r.comment]),
      ]),
    ]),
    r.covered.length ? h("p", { class: "field-label", text: "Ý bạn đã nêu" }) : null,
    r.covered.length ? criterionList(r.covered, "hit") : null,
    r.missing.length ? h("p", { class: "field-label", text: "Ý còn thiếu (theo slide)" }) : null,
    r.missing.length ? criterionList(r.missing, "miss") : null,
    r.mode === "offline" ? h("p", { class: "calm-note", text: "Chế độ không model chấm theo cụm từ then chốt của slide — diễn đạt quá khác chữ có thể bị tính thiếu." }) : null,
    h("div", { class: "quiz-actions" }, [
      h("button", { type: "button", class: "btn btn-primary", id: "quiz-next", text: last ? "Xem kết quả" : "Câu tiếp theo", onclick: nextQuestion }),
    ]),
  ].filter(Boolean));
  box.hidden = false;
  $("#quiz-next").focus({ preventScroll: true });
}

function nextQuestion() {
  qz.i += 1;
  if (qz.i < qz.list.length) showQuestion();
  else showSummary();
  root().scrollIntoView({ block: "start" });
}

/* ---------- Tổng kết ---------- */

function showSummary() {
  const rs = qz.results.filter(Boolean);
  const got = rs.reduce((s, r) => s + r.score, 0);
  const max = qz.list.length * 10;
  const pct = max ? got / max : 0;
  const verdict = pct >= 0.8 ? "Sẵn sàng đi phỏng vấn rồi!" : pct >= 0.5 ? "Khá vững — ôn thêm vài slide là chắc." : "Cần ôn lại — bắt đầu từ các slide bên dưới.";
  const review = new Map();
  for (const r of rs) for (const s of (r.skipped ? [] : r.slides)) {
    if (r.missing.some((c) => c.slide === s.n)) review.set(s.n, s.title);
  }
  const skippedSlides = rs.filter((r) => r.skipped).length;
  root().replaceChildren(h("div", { class: "board-panel quiz-summary", id: "quiz-summary" }, [
    h("h2", { class: "chalk-title", text: "Kết quả kiểm tra cuối" }),
    h("p", { class: "quiz-total", text: `${got} / ${max} điểm` }),
    h("p", { class: "tagline", text: verdict }),
    h("ol", { class: "quiz-sum-list" }, qz.list.map((q, k) => {
      const r = qz.results[k];
      return h("li", {}, [
        h("button", { type: "button", class: "link-btn", text: q.question_vi, onclick: () => { qz.i = k; showQuestion(); } }),
        h("span", { class: "quiz-sum-meta", text: ` · ${q.companies.join(", ")}` }),
        h("span", { class: "quiz-sum-score", text: r && !r.skipped ? `${r.score}/10` : "Bỏ qua" }),
      ]);
    })),
    review.size ? h("p", { class: "field-label", text: "Slide nên ôn lại" }) : null,
    review.size ? h("div", { class: "quiz-review-slides" }, [...review].sort((a, b) => a[0] - b[0]).map(([n, title]) => slideButton(n, title))) : null,
    skippedSlides ? h("p", { class: "calm-note", text: `Bạn bỏ qua ${skippedSlides} câu — câu bỏ qua tính 0 điểm.` }) : null,
    h("div", { class: "quiz-actions" }, [
      h("button", { type: "button", class: "btn btn-primary", text: "Làm bài mới", onclick: startQuiz }),
      h("button", { type: "button", class: "btn btn-ghost", text: "Về trang đầu", onclick: () => { qz.list = []; showIntro(); } }),
    ]),
    sourceNote(),
  ]));
}
