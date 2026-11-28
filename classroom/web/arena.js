/* Đấu trường: chuẩn bị trận, diễn biến trận trên cảnh 3D, nhắc bài */

import { $, $$, h, api, post, enc, run, toast, announce, reducedMotion, sleep, busy } from "./api.js";
import * as store from "./store.js";
import { TYPE_LABELS, TYPE_COLORS, faceChipSVG, LOOK_OF, CONTESTANT_COLORS, OPPONENT_STRENGTHS, KIND_LABELS } from "./faces.js";
import { openModal, answerCitations } from "./ui.js";

let ctx = null;
let scene = null;
let sceneFailed = false;
let speechRAF = 0;
let speechTimer = 0;
let playing = false;
const prevScores = {};
let feedMatchId = null;

/* ---------- Khởi tạo ---------- */

export function initArena(context) {
  ctx = context;
  $("#btn-prepare").addEventListener("click", () => run(startPrepare));
  $("#btn-resume-match").addEventListener("click", () => { if (ctx.match) enterArena(ctx.match); });
  $("#btn-start-match").addEventListener("click", () => run(startMatch));
  $("#btn-new-topic").addEventListener("click", () => run(repickTopic));
}

const SUB_VIEWS = { landing: "#arena-landing", prepare: "#prepare-view", arena: "#arena-view", review: "#review-view" };

export function showArenaSub(name) {
  for (const [v, sel] of Object.entries(SUB_VIEWS)) $(sel).hidden = v !== name;
  if (name === "landing") renderLanding();
  if (name === "arena" || name === "review") placeCanvas(name === "review" ? "#stage-review" : "#stage");
}

function renderLanding() {
  const mates = $("#landing-mates");
  if (!mates.children.length) {
    for (const id of ["minh", "vy", "hai", "an"]) {
      mates.append(h("div", { class: "mate-chip", style: `--mate:${CONTESTANT_COLORS[id]}` }, [
        h("span", { class: "mate-face", html: faceChipSVG(LOOK_OF[id]), "aria-hidden": true }),
        h("span", { class: "mate-info" }, [
          h("b", { class: "mate-name", text: nameOf(id) }),
          h("span", { class: "mate-desc", text: OPPONENT_STRENGTHS[id] }),
        ]),
      ]));
    }
  }
  $("#landing-resume").hidden = !(ctx.match && ctx.match.phase !== "review");
}

/* ---------- Cảnh 3D ---------- */

async function ensureScene() {
  if (scene || sceneFailed) return scene;
  try {
    const { createScene } = await import("./scene.js");
    scene = createScene($("#scene-canvas"), { reducedMotion });
  } catch (e) {
    sceneFailed = true;
    $$(".scene-fallback").forEach((el) => { el.hidden = false; });
    $$(".stage").forEach((el) => el.classList.add("no-3d"));
  }
  return scene;
}

function placeCanvas(stageSel) {
  const canvas = $("#scene-canvas");
  const stage = $(stageSel);
  if (canvas.parentElement !== stage) {
    // chuyển canvas sang sân khác mà không mất ngữ cảnh WebGL
    const ph = h("div", { id: "canvas-placeholder", style: "display:none" });
    canvas.parentElement && canvas.parentElement.append(ph);
    stage.prepend(canvas);
    ph.remove();
  }
  scene && scene.resize();
}

function setupStage(state) {
  if (!scene) return;
  const players = state.contestants.map((c) => ({
    id: LOOK_OF[c.id] || c.id,
    name: c.id === "player" ? c.name : nameOf(c.id),
    color: c.color || CONTESTANT_COLORS[c.id] || "#FFFFFF",
  }));
  scene.setPlayers(players);
  scene.setPhase(state.phase === "scored" ? "verdict" : state.phase === "review" ? "summary" : state.phase === "question" ? "question" : "lecture");
}

/* ---------- Chuẩn bị trận ---------- */

async function startPrepare() {
  let state = ctx.match;
  if (!state || state.phase === "review") {
    const topics = await run(() => api(`/api/docs/${enc(ctx.getDocId())}/topics`));
    if (!topics) return;
    ctx.topics = topics.topics || [];
    if (!ctx.topics.length) { toast("Tài liệu này chưa có chủ đề nào đủ nội dung để ra đề."); return; }
    const topicSel = h("select", { "aria-label": "Chọn chủ đề" },
      ctx.topics.map((t) => h("option", { value: t.id, text: `${t.title} (slide ${t.slides.join(", ")})` })));
    const topicId = await new Promise((resolve) => {
      openModal("Chọn chủ đề cho trận", (body, close) => {
        body.append(h("p", { class: "calm-note", text: "Cô Linh sẽ ra 3 câu hỏi xoay quanh chủ đề bạn chọn." }));
        body.append(h("label", { class: "field" }, [h("span", { class: "field-label", text: "Chủ đề" }), topicSel]));
        const actions = h("div", { class: "modal-actions" });
        actions.append(
          h("button", { type: "button", class: "btn btn-primary", text: "Tạo trận với chủ đề này", onclick: () => { resolve(topicSel.value); close(); } }),
          h("button", { type: "button", class: "btn btn-ghost", text: "Huỷ", onclick: () => { close(); resolve(null); } }),
        );
        body.append(actions);
      }, { onClose: () => resolve(null) });
    });
    if (topicId == null) return;
    state = await createMatch({ topic_id: topicId, opponent: ctx.opponent || "vy" });
    if (!state) return;
  }
  ctx.setMatch(state);
  renderPrepare(state);
  showArenaSub("prepare");
}

function createMatch(extra) {
  return post(`/api/matches`, { doc_id: ctx.getDocId(), bot_name: ctx.botName, ...extra });
}

async function repickTopic() {
  ctx.setMatch(null);
  await startPrepare();
}

/* Đổi đối thủ = tạo lại trận (bộ thẻ đối thủ dựng theo người được chọn), giữ chủ đề */
async function changeOpponent(state, opponent) {
  if (opponent === state.opponent) return;
  const next = await busy(null, $("#prepare-status"), "Đang đổi đối thủ…",
    () => run(() => createMatch({ topic_id: state.topic.id, opponent })));
  if (!next) { renderPrepare(state); return; }
  ctx.opponent = opponent;
  ctx.setMatch(next);
  renderPrepare(next);
}

function renderPrepare(state) {
  const topic = state.topic;
  $("#topic-block").hidden = false;
  $("#topic-title").textContent = topic.title;
  $("#topic-slides").textContent = `Các slide trong chủ đề: ${topic.slides.join(", ")}`;
  $("#bot-name-input").value = (state.contestants.find((c) => c.id === "player") || {}).name || ctx.botName || "Bé Bot";

  const oppList = $("#opp-pick-list");
  oppList.replaceChildren();
  for (const id of ["minh", "vy", "hai", "an"]) {
    const radio = h("input", {
      type: "radio", name: "opponent", value: id, checked: id === state.opponent || null,
      onchange: () => changeOpponent(state, id),
    });
    oppList.append(h("label", { class: "opp-option", style: `--mate:${CONTESTANT_COLORS[id]}` }, [
      radio,
      h("span", { class: "mate-face", html: faceChipSVG(LOOK_OF[id]), "aria-hidden": true }),
      h("span", { class: "mate-info" }, [
        h("b", { class: "mate-name", text: nameOf(id) }),
        h("span", { class: "mate-desc", text: OPPONENT_STRENGTHS[id] }),
      ]),
    ]));
  }

  const opp = state.contestants.find((c) => c.id === state.opponent);
  $("#opp-deck-title").textContent = `Bộ thẻ của ${nameOf(state.opponent)}`;
  $("#opp-deck-note").textContent = opp && opp.cards.length
    ? `${nameOf(state.opponent)} mang ${opp.cards.length} thẻ, dựng từ tài liệu theo sở trường của bạn ấy.`
    : `${nameOf(state.opponent)} chưa có thẻ nào cho chủ đề này.`;
  $("#opp-deck").replaceChildren(...((opp && opp.cards) || []).map((c) =>
    h("li", { class: "opp-deck-item", style: `--type-c: ${TYPE_COLORS[c.type] || "#CCC"}` }, [
      h("span", { class: "type-badge", dataset: { type: c.type }, text: TYPE_LABELS[c.type] || c.type }),
      h("span", { text: c.title }),
    ])));

  const cards = store.listCards();
  const list = $("#pick-list");
  list.replaceChildren();
  const counter = $("#pick-counter");
  const startBtn = $("#btn-start-match");
  if (!cards.length) {
    list.append(h("p", { class: "calm-note" }, [
      document.createTextNode("Sổ tay đang trống. Vào tab "),
      h("button", { type: "button", class: "link-btn", text: "Học slide", onclick: () => ctx.goTab("study") }),
      document.createTextNode(" để gom thẻ trước khi vào trận."),
    ]));
    startBtn.disabled = true;
    counter.textContent = "0/5";
    return;
  }
  const chosen = new Set();
  function paint() {
    counter.textContent = `${chosen.size}/5`;
    startBtn.disabled = chosen.size < 1;
    for (const label of $$(".pick-item", list)) {
      const cb = $("input", label);
      cb.disabled = !chosen.has(cb.value) && chosen.size >= 5;
    }
  }
  for (const c of cards) {
    const cb = h("input", { type: "checkbox", value: c.id, onchange: () => {
      if (cb.checked) chosen.add(c.id); else chosen.delete(c.id);
      paint();
    } });
    list.append(h("label", { class: "pick-item", style: `--type-c: ${TYPE_COLORS[c.type] || "#CCC"}` }, [
      cb,
      h("span", { class: "type-badge", dataset: { type: c.type }, text: TYPE_LABELS[c.type] || c.type }),
      h("span", { class: "pick-title", text: c.title }),
      c.own ? h("span", { class: "type-badge own-badge", text: "Ghi chú của bạn" }) : null,
    ]));
  }
  paint();
}

async function startMatch() {
  const state = ctx.match;
  if (!state) return;
  const chosen = $$("#pick-list input:checked").map((cb) => cb.value);
  if (!chosen.length || chosen.length > 5) {
    toast("Hãy chọn từ 1 đến 5 thẻ để mang vào trận.");
    return;
  }
  const botName = ($("#bot-name-input").value || "").trim() || "Bé Bot";
  ctx.botName = botName;
  const cards = chosen.map((id) => store.getCard(id)).filter(Boolean);
  if (!cards.length) { toast("Không tìm thấy các thẻ đã chọn trong sổ tay."); return; }
  // cô Linh soạn câu 1 (và câu 2) ngay lúc này: có model thì mất vài giây
  const next = await busy($("#btn-start-match"), $("#prepare-status"), "Cô Linh đang soạn câu hỏi…",
    () => post(`/api/matches/${state.id}/cards`, { cards }));
  if (!next) return;
  ctx.setMatch(next);
  enterArena(next, botName);
}

/* ---------- Vào trận ---------- */

export function enterArena(state, botName) {
  if (botName) ctx.botName = botName;
  showArenaSub("arena");
  if (feedMatchId === state.id) return;
  feedMatchId = state.id;
  $("#feed").replaceChildren();
  lastPlayedSeq = 0;
  run(async () => {
    await ensureScene();
    setupStage(state);
    prevScoresReset(state);
    renderScoreboard(state);
    renderControls(state);
    renderBoardQuestion(state);
    // phát các log mở đầu (intro, question, system)
    await playLogFrom(state, 0);
  });
}

function prevScoresReset(state) {
  for (const c of state.contestants) prevScores[c.id] = c.score || 0;
}

function currentQuestion(state) {
  return state.questions[state.qindex] || null;
}

function nameOf(id) {
  if (id === "linh") return "Cô Linh";
  if (id === "player") return (ctx.match && ctx.match.contestants.find((c) => c.id === "player") || {}).name || ctx.botName || "Bé Bot";
  return { minh: "Minh", vy: "Vy", hai: "Hải", an: "An" }[id] || id;
}

/* Mọi người trong cảnh (trừ người đang nói) nhìn về người nói */
function everyoneLooksAt(state, speakerLook) {
  if (!scene) return;
  for (const c of state.contestants) {
    const look = LOOK_OF[c.id] || c.id;
    if (look !== speakerLook) scene.lookAt(look, speakerLook);
  }
  if (speakerLook !== "teacher") scene.lookAt("teacher", speakerLook);
}

/* ---------- Bảng 3D + bảng DOM ---------- */

function renderBoardQuestion(state) {
  const q = currentQuestion(state);
  const chip = $("#round-chip");
  const content = $("#board-content");
  content.replaceChildren();
  if (!q) {
    chip.textContent = "";
    if (scene) scene.setBoard(null);
    return;
  }
  const kindLabel = `Câu ${q.index + 1} · ${KIND_LABELS[q.kind] || q.kind}`;
  const sampleTag = q.sample ? " · Câu hỏi mẫu" : "";
  chip.textContent = kindLabel + sampleTag;
  if (scene) {
    scene.setPhase("question");
    const lines = [q.text];
    for (const t of q.targets || []) {
      lines.push({ text: `Câu 2 của ${nameOf(t.by)}: “${t.text}”`, plain: true });
    }
    scene.setBoard({ kind: "question", title: kindLabel + sampleTag, lines, footer: `${state.doc.title} — chủ đề: ${state.topic.title}` });
  }
  // bảng DOM (màn hẹp / trình đọc màn hình)
  content.append(
    h("p", { class: "board-title", text: kindLabel + sampleTag }),
    h("p", { class: "board-question", text: q.text }),
  );
  for (const t of q.targets || []) {
    content.append(
      h("p", { class: "board-answerer", text: `Câu trả lời câu 2 của ${nameOf(t.by)} (bạn kia sẽ phản biện):` }),
      h("p", { class: "board-target", text: t.text }),
    );
  }
}

function renderVerdictBoard(state) {
  const q = currentQuestion(state);
  if (!q || !q.answers || !q.answers.length) return;
  const chip = $("#round-chip");
  const content = $("#board-content");
  chip.textContent = `Điểm câu ${q.index + 1}`;
  if (scene) {
    scene.setPhase("verdict");
    const total = (id) => (state.contestants.find((c) => c.id === id) || {}).score || 0;
    scene.setBoard({
      kind: "verdict",
      title: `Điểm câu ${q.index + 1}`,
      lines: q.answers.map((a) => `${nameOf(a.by)}: ${a.score}/10 (tổng ${total(a.by)})`),
      comment: "Nhận xét chi tiết của cô Linh ở khung lời thoại bên phải.",
      footer: `${state.doc.title} — chủ đề: ${state.topic.title}`,
    });
  }
  content.replaceChildren(
    h("p", { class: "board-title", text: `Điểm câu ${q.index + 1}` }),
    h("ul", { class: "board-deltas" },
      q.answers.map((a) => h("li", { "data-sign": a.score >= 5 ? "pos" : "neg", text: `${nameOf(a.by)}: ${a.score}/10 — ${a.comment || ""}` }))),
  );
}

/* ---------- Sổ điểm ---------- */

function renderScoreboard(state) {
  const ol = $("#scoreboard");
  ol.replaceChildren();
  const rows = [...state.contestants].sort((a, b) => (b.score || 0) - (a.score || 0));
  for (const c of rows) {
    const li = h("li", { class: "score-row" + (c.id === "player" ? " me" : ""), dataset: { id: c.id } });
    li.append(
      h("span", { class: "face-chip", html: faceChipSVG(LOOK_OF[c.id] || "player"), "aria-hidden": true }),
      h("span", { class: "s-name", text: nameOf(c.id) }),
      h("span", { class: "s-score", text: String(c.score || 0) }),
    );
    ol.append(li);
  }
}

/* ---------- Điều khiển theo pha ---------- */

function renderControls(state) {
  const box = $("#controls");
  box.replaceChildren();
  if (playing) return; // trạng thái chờ hiện ở #controls-status
  if (state.phase === "question") {
    const q = currentQuestion(state);
    box.append(h("button", {
      type: "button", class: "btn btn-primary", text: "Cho hai bạn trả lời",
      onclick: () => run(onNext),
    }));
    // Nhắc bài: chỉ ở pha question của câu phản biện, còn lượt nhắc
    if (q && q.kind === "rebuttal" && state.reminder && state.reminder.available) {
      box.append(h("button", { type: "button", class: "btn", text: "Nhắc bài", onclick: openRemindPicker }));
    } else if (q && q.kind === "rebuttal" && state.reminder && !state.reminder.available) {
      box.append(h("p", { class: "remind-note", text: "Đã nhắc bài trong trận này, không còn lượt nhắc." }));
    }
  } else if (state.phase === "scored") {
    const q = currentQuestion(state);
    box.append(h("button", {
      type: "button", class: "btn btn-primary",
      text: q && q.index >= 2 ? "Xem lại trận" : "Câu tiếp theo",
      onclick: () => run(onNext),
    }));
  }
}

function waitText(state) {
  if (state.phase === "question") return `${nameOf("player")} và ${nameOf(state.opponent)} đang suy nghĩ, cô Linh sẽ chấm ngay sau đó…`;
  const q = currentQuestion(state);
  return q && q.index >= 2 ? "Cô Linh đang tổng kết trận…" : "Cô Linh đang soạn câu hỏi tiếp theo…";
}

async function onNext() {
  const state = ctx.match;
  if (!state || playing) return;
  playing = true;
  renderControls(state);
  if (scene) scene.setPhase(state.phase === "question" ? "question" : "verdict"); // bot suy nghĩ ("?")
  let next;
  try {
    next = await busy(null, $("#controls-status"), waitText(state),
      () => post(`/api/matches/${state.id}/next`));
  } finally {
    playing = false;
  }
  if (!next) { renderControls(state); return; }
  ctx.setMatch(next);
  if (next.phase === "scored") {
    playing = true;
    renderControls(next);
    try { await playScored(next); } finally { playing = false; }
    renderVerdictBoard(next);
  } else if (next.phase === "question") {
    renderBoardQuestion(next);
    await playLogFrom(next, lastPlayedSeq);
  } else if (next.phase === "review") {
    const { renderReview } = await import("./review.js");
    renderReview(next);
    return;
  }
  renderScoreboard(next);
  renderControls(next);
}

/* Hiện màn chuẩn bị từ một MatchState ở pha pick (vd: sau khi "Đấu lại với câu mới") */
export function showPrepareFromState(state) {
  ctx.setMatch(state);
  renderPrepare(state);
  showArenaSub("prepare");
}

/* ---------- Phát lời thoại theo log ---------- */

let lastPlayedSeq = 0;

async function playLogFrom(state, fromSeq) {
  const entries = (state.log || []).filter((l) => l.seq > fromSeq);
  for (const entry of entries) {
    lastPlayedSeq = Math.max(lastPlayedSeq, entry.seq);
    await playLogEntry(state, entry);
  }
}

async function playLogEntry(state, entry) {
  addTranscript(state, entry);
  const look = entry.by === "linh" ? "teacher" : (LOOK_OF[entry.by] || entry.by);
  if (scene) {
    scene.highlight(look);
    if (["question", "intro", "remind"].includes(entry.kind)) {
      scene.talk(look, 1400);
      showSpeech(look, nameOf(entry.by), entry.text);
    }
    everyoneLooksAt(state, look);
  }
  await sleep(reducedMotion ? 350 : 1500);
  hideSpeech();
}

/* ---------- Pha scored: phát từng câu trả lời theo đúng thứ tự máy chủ trả về ---------- */

async function playScored(state) {
  const q = currentQuestion(state);
  if (!q || !q.answers) return;
  // log của câu này: bỏ qua phần answer/verdict (phát riêng bên dưới kèm thẻ + điểm)
  lastPlayedSeq = Math.max(lastPlayedSeq, ...(state.log || []).map((l) => l.seq));
  for (const a of q.answers) {
    const look = LOOK_OF[a.by] || a.by;
    if (scene) {
      scene.highlight(look);
      scene.talk(look, Math.min(4200, 1200 + a.text.length * 18));
      everyoneLooksAt(state, look);
      showSpeech(look, nameOf(a.by), a.text);
    }
    addAnswerEntry(state, q, a);
    await sleep(reducedMotion ? 500 : Math.min(4200, 1400 + a.text.length * 22));
    hideSpeech();
    // điểm của từng bạn hiện ngay sau lượt nói
    const c = state.contestants.find((x) => x.id === a.by);
    if (c) applyScore(c.id, (prevScores[c.id] || 0) + (a.score || 0));
  }
  if (scene) { scene.highlight("teacher"); scene.talk("teacher", 1200); }
}

function applyScore(id, total) {
  const delta = total - (prevScores[id] || 0);
  prevScores[id] = total;
  const li = $(`#scoreboard .score-row[data-id="${id}"]`);
  if (li) $(".s-score", li).textContent = String(total);
  if (scene && delta !== 0) {
    scene.react(LOOK_OF[id] || id, delta);
    scene.floatScore(LOOK_OF[id] || id, delta);
  }
}

function usedCardChips(used) {
  if (!used || !used.length) return h("p", { class: "no-cards", text: "Không dùng thẻ nào" });
  return h("div", { class: "used-cards", "aria-label": "Thẻ đã dùng" },
    used.map((c) => h("span", {
      class: "used-chip", style: `--type-c: ${TYPE_COLORS[c.type] || "#CCC"}`,
      text: `${c.title} · ${TYPE_LABELS[c.type] || c.type}`,
    })));
}

function addTranscript(state, entry) {
  const feed = $("#feed");
  const bubble = h("div", { class: "bubble" + (entry.by === "linh" ? " teacher" : entry.kind === "system" ? " system" : "") });
  bubble.append(h("span", { class: "who", text: nameOf(entry.by) }), h("span", { class: "txt", text: entry.text }));
  if (entry.citations?.length) bubble.append(answerCitations(entry.citations));
  else if (entry.used_cards?.length) bubble.append(usedCardChips(entry.used_cards));
  feed.append(bubble);
  feed.scrollTop = feed.scrollHeight;
}

function addAnswerEntry(state, q, a) {
  const feed = $("#feed");
  const bubble = h("div", { class: "bubble answer", style: `--speaker:${CONTESTANT_COLORS[a.by] || "#CCC"}` });
  bubble.append(h("span", { class: "who", text: `${nameOf(a.by)}: ${a.score}/10` }));
  if (a.target) bubble.append(h("p", { class: "answer-target", text: `Phản biện câu 2 của ${nameOf(a.target.by)}` }));
  bubble.append(h("span", { class: "txt", text: a.text }));
  if (a.citations?.length) bubble.append(answerCitations(a.citations));
  else if (a.by !== "player") bubble.append(h("p", { class: "used-label", text: "Thẻ đã dùng" }), usedCardChips(a.used_cards));
  if (a.unsure) bubble.append(h("p", { class: "unsure-callout", text: `Chưa chắc: ${a.unsure}` }));
  if (a.comment) bubble.append(h("p", { class: "verdict-note", text: `Cô Linh: ${a.comment}` }));
  feed.append(bubble);
  feed.scrollTop = feed.scrollHeight;
}

/* ---------- Bong bóng lời thoại trên đầu nhân vật 3D ---------- */

function showSpeech(lookId, who, text) {
  const el = $("#speech-bubble");
  el.replaceChildren(
    h("span", { class: "who", text: who }),
    h("span", { class: "txt", text }),
  );
  el.hidden = false;
  el.classList.remove("show");
  requestAnimationFrame(() => el.classList.add("show"));
  cancelAnimationFrame(speechRAF);
  const place = () => {
    if (!scene || el.hidden) return;
    const pos = scene.screenPos(lookId);
    if (!pos || !pos.visible) { el.hidden = true; return; }
    const board = scene.screenPos("board");
    const stage = $("#stage").getBoundingClientRect();
    let x = pos.x, y = pos.y - 14;
    let cls = "";
    // né bảng: nếu bong bóng đè lên bảng thì đặt sang bên phải
    if (board && board.w && x > board.x - 160 && x < board.x + board.w + 40 && y > board.y - 40 && y < board.y + board.h) {
      x = Math.min(pos.x + 90, stage.width - 170);
      cls = "side";
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.className = `speech-bubble show ${cls}`;
    speechRAF = requestAnimationFrame(place);
  };
  place();
}

function hideSpeech() {
  const el = $("#speech-bubble");
  cancelAnimationFrame(speechRAF);
  el.classList.remove("show");
  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => { el.hidden = true; }, reducedMotion ? 0 : 220);
}

/* ---------- Nhắc bài ---------- */

function openRemindPicker() {
  const state = ctx.match;
  if (!state || !state.reminder || !state.reminder.available) return;
  const player = state.contestants.find((c) => c.id === "player");
  const cards = (player && player.cards) || [];
  if (!cards.length) { toast("Bot chưa mang thẻ nào vào trận."); return; }
  openModal("Nhắc bài cho bot", (body, close) => {
    body.append(h("p", { class: "calm-note", text: "Chọn một thẻ đã mang theo — bot của bạn sẽ xem lại và ưu tiên dùng ở câu phản biện. Mỗi trận chỉ nhắc một lần." }));
    const list = h("div", { class: "remind-list", role: "radiogroup", "aria-label": "Thẻ để nhắc" });
    for (const c of cards) {
      list.append(h("label", { class: "pick-item", style: `--type-c: ${TYPE_COLORS[c.type] || "#CCC"}` }, [
        h("input", { type: "radio", name: "remind-card", value: c.id }),
        h("span", { class: "type-badge", dataset: { type: c.type }, text: TYPE_LABELS[c.type] || c.type }),
        h("span", { class: "pick-title", text: c.title }),
      ]));
    }
    body.append(list);
    const actions = h("div", { class: "modal-actions" });
    actions.append(
      h("button", {
        type: "button", class: "btn btn-primary", text: "Nhắc thẻ này",
        onclick: async () => {
          const sel = $("input[name='remind-card']:checked", list);
          if (!sel) { toast("Hãy chọn một thẻ để nhắc."); return; }
          close();
          await run(async () => {
            const next = await post(`/api/matches/${state.id}/remind`, { card_id: sel.value });
            if (!next) return;
            ctx.setMatch(next);
            const card = cards.find((c) => c.id === sel.value);
            announce("Bot đã xem lại thẻ vừa nhắc.");
            if (scene) {
              scene.highlight("player");
              scene.talk("player", 2000);
              showSpeech("player", nameOf("player"), `Mình xem lại thẻ “${card ? card.title : ""}” rồi!`);
              setTimeout(hideSpeech, reducedMotion ? 800 : 2200);
            }
            addTranscript(next, { by: "player", kind: "remind", text: `Mình xem lại thẻ “${card ? card.title : ""}” rồi!`, seq: 9999 });
            renderControls(next);
          });
        },
      }),
      h("button", { type: "button", class: "btn btn-ghost", text: "Huỷ", onclick: close }),
    );
    body.append(actions);
  });
}

export function sceneApi() { return scene; }
export { enterArena as enterMatch };
