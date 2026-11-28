/* Xem lại trận: kết quả, câu hỏi + rubric, tổng kết kiến thức bot còn thiếu → người chơi tự sửa thẻ, đấu lại */

import { $, $$, h, post, run, toast, announce, uid } from "./api.js";
import { faceChipSVG, LOOK_OF, KIND_LABELS, TYPE_LABELS, TYPE_COLORS } from "./faces.js";
import { showArenaSub, sceneApi } from "./arena.js";
import { openModal, answerCitations } from "./ui.js";
import * as store from "./store.js";

let ctx = null;

export function initReview(context) { ctx = context; }

export async function renderReview(state) {
  ctx.setMatch(state);
  showArenaSub("review");
  const scene = sceneApi();
  const result = resultText(state);
  if (scene) {
    const players = state.contestants.map((c) => ({
      id: LOOK_OF[c.id] || c.id,
      name: c.id === "player" ? c.name : { minh: "Minh", vy: "Vy", hai: "Hải", an: "An" }[c.id] || c.id,
      color: c.color || "#FFFFFF",
    }));
    scene.setPlayers(players);
    scene.setPhase("summary");
    const ranking = (state.review.ranking || []).map((r) => ({ ...r, id: LOOK_OF[r.id] || r.id }));
    scene.podium(ranking);
    scene.setBoard({
      kind: "lecture",
      title: result.title,
      lines: (state.review.ranking || []).map((r) => `${r.name}: ${r.score} điểm`),
      footer: `${state.doc.title} — chủ đề: ${state.topic.title}`,
    });
  }
  const banner = $("#result-banner");
  banner.hidden = false;
  banner.dataset.result = state.review.result;
  banner.textContent = result.title;
  renderRanking(state);
  renderQuestions(state);
  renderGaps(state);

  const rematchBtn = $("#btn-rematch");
  rematchBtn.onclick = () => run(async () => {
    const next = await post("/api/matches", { doc_id: state.doc.id, rematch_of: state.id });
    if (!next) return;
    ctx.setMatch(next);
    announce("Đã tạo trận mới với câu hỏi mới, cùng chủ đề.");
    toast("Đã tạo trận mới — cùng chủ đề, câu hỏi mới.");
    const { showPrepareFromState } = await import("./arena.js");
    showPrepareFromState(next);
  });
}

function resultText(state) {
  const me = state.contestants.find((c) => c.id === "player");
  const opp = state.contestants.find((c) => c.id !== "player");
  const score = `${me.score} : ${opp.score}`;
  const titles = {
    win: `${me.name} thắng ${opp.name} (${score})`,
    lose: `${me.name} thua ${opp.name} (${score})`,
    draw: `${me.name} hoà ${opp.name} (${score})`,
  };
  const details = {
    win: "Bộ thẻ của bạn đã giúp bot trả lời tốt hơn. Xem các chỗ còn bỏ sót để bot mạnh hơn nữa.",
    lose: "Xem các chỗ bot bỏ sót bên dưới, bổ sung thẻ rồi đấu lại với câu mới.",
    draw: "Hai bên ngang điểm. Bổ sung một thẻ ở chỗ bot bỏ sót là có thể lật thế trận.",
  };
  return { title: titles[state.review.result] || "Kết quả trận", detail: details[state.review.result] || "" };
}

function nameOf(state, id) {
  if (id === "linh") return "Cô Linh";
  const c = state.contestants.find((x) => x.id === id);
  if (c) return c.name;
  return { minh: "Minh", vy: "Vy", hai: "Hải", an: "An" }[id] || id;
}

function renderRanking(state) {
  const ol = $("#ranking-list");
  ol.replaceChildren();
  for (const r of state.review.ranking || []) {
    const li = h("li", { class: "score-row" + (r.id === "player" ? " me" : "") });
    li.append(
      h("span", { class: "face-chip", html: faceChipSVG(LOOK_OF[r.id] || "player"), "aria-hidden": "true" }),
      h("span", { class: "s-name", text: r.name }),
      h("span", { class: "s-score", text: String(r.score) }),
    );
    ol.append(li);
  }
  $("#result-note").textContent = resultText(state).detail;
}

function usedCardChips(used) {
  if (!used || !used.length) return h("p", { class: "no-cards", text: "Không dùng thẻ nào" });
  return h("div", { class: "used-cards" },
    used.map((c) => h("span", {
      class: "used-chip", style: `--type-c: ${TYPE_COLORS[c.type] || "#CCC"}`,
      text: `${c.title} · ${TYPE_LABELS[c.type] || c.type}`,
    })));
}

function renderQuestions(state) {
  const root = $("#review-questions");
  root.replaceChildren();
  if (!state.questions.length) {
    root.append(h("p", { class: "calm-note", text: "Trận này chưa có câu hỏi nào." }));
    return;
  }
  for (const q of state.questions) {
    const det = h("details", { class: "review-q" });
    const sum = h("summary", {}, [
      h("span", { class: "q-kind", text: `Câu ${q.index + 1} · ${KIND_LABELS[q.kind] || q.kind}` }),
      q.sample ? h("span", { class: "sample-tag", text: "Câu hỏi mẫu" }) : null,
    ]);
    det.append(sum);
    det.append(h("p", { class: "q-text", text: q.text }));
    for (const t of q.targets || []) {
      det.append(h("p", { class: "q-target", text: `Câu 2 của ${nameOf(state, t.by)}: ${t.text}` }));
    }
    const answers = h("div", { class: "q-answers" });
    for (const a of q.answers || []) {
      const box = h("div", { class: "q-answer" });
      box.append(
        h("p", { class: "q-answer-head" }, [
          h("b", { text: nameOf(state, a.by) }),
          h("span", { class: "q-score", text: `${a.score}/10` }),
        ]),
        a.target ? h("p", { class: "answer-target", text: `Phản biện câu 2 của ${nameOf(state, a.target.by)}` }) : null,
        h("p", { class: "q-answer-text", text: a.text }),
      );
      if (a.citations?.length) box.append(answerCitations(a.citations));
      else if (a.by !== "player") box.append(h("p", { class: "used-label", text: "Thẻ đã dùng" }), usedCardChips(a.used_cards));
      if (a.unsure) box.append(h("p", { class: "unsure-callout", text: `Chưa chắc: ${a.unsure}` }));
      if (a.comment) box.append(h("p", { class: "verdict-note", text: `Cô Linh: ${a.comment}` }));
      answers.append(box);
    }
    det.append(answers);
    if (q.rubric && q.rubric.length) {
      const rub = h("div", { class: "q-rubric" });
      rub.append(h("p", { class: "field-label", text: "Tiêu chí chấm của cô Linh" }));
      for (const r of q.rubric) {
        rub.append(h("p", { class: "rubric-item" }, [
          document.createTextNode(`${r.criterion} — `),
          h("button", {
            type: "button", class: "link-btn", text: `slide ${r.slide}`,
            onclick: () => ctx.openSlide(state.doc.id, r.slide),
          }),
        ]));
      }
      det.append(rub);
    }
    root.append(det);
  }
}

function renderGaps(state) {
  const root = $("#review-gaps");
  root.replaceChildren();
  const gaps = (state.review && state.review.gaps) || [];
  if (!gaps.length) {
    root.append(h("p", { class: "calm-note", text: "Bot của bạn trả lời đủ mọi ý — giỏi lắm!" }));
    return;
  }
  root.append(h("p", { class: "calm-note", text: "Đọc kỹ phần kiến thức dưới đây, rồi sửa thẻ bằng lời của bạn để lần sau bot trả lời được." }));
  for (const g of gaps) {
    const status = h("p", { class: "saved-note gap-fixed", hidden: true, text: "Đã sửa thẻ cho bot" });
    root.append(h("div", { class: "gap-item" }, [
      h("p", { class: "gap-question", text: `Câu ${g.qindex + 1}: ${g.question}` }),
      h("p", { class: "gap-criterion", text: `Bot còn thiếu: ${g.criterion}` }),
      h("p", { class: "field-label", text: `Slide ${g.slide} viết:` }),
      h("blockquote", { class: "sug-excerpt", text: g.excerpt }),
      h("p", { class: "sug-source" }, [
        `Nguồn: ${state.doc.title} · slide ${g.slide} · `,
        h("button", { type: "button", class: "link-btn", text: "Mở slide", onclick: () => ctx.openSlide(g.doc_id || state.doc.id, g.slide) }),
      ]),
      h("div", { class: "gap-actions" }, [
        h("button", { type: "button", class: "btn", text: "Sửa thẻ cho bot", onclick: () => openFixCard(state, g, status) }),
        status,
      ]),
    ]));
  }
}

/* Khung sửa thẻ: kiến thức còn thiếu ở trên để đọc, thẻ của bot ở dưới để người chơi tự viết lại */
function openFixCard(state, g, status) {
  const used = (g.used_cards || []).map((c) => store.getCard(c.id)).filter(Boolean);
  const sameSlide = store.listCards().filter((c) =>
    c.source && c.source.doc_id === (g.doc_id || state.doc.id) && c.source.slide === g.slide && !used.some((u) => u.id === c.id));
  openModal("Sửa thẻ cho bot", (body, close) => {
    const pick = h("select", { "aria-label": "Thẻ cần sửa" }, [
      ...used.map((c) => h("option", { value: c.id, text: `${c.title} — bot đã dùng ở câu ${g.qindex + 1}` })),
      ...sameSlide.map((c) => h("option", { value: c.id, text: `${c.title} — thẻ về slide ${g.slide}` })),
      h("option", { value: "", text: "Viết thẻ mới" }),
    ]);
    const titleIn = h("input", { type: "text", maxlength: "120", "aria-label": "Tiêu đề thẻ" });
    const typeSel = h("select", { "aria-label": "Loại thẻ" },
      Object.entries(TYPE_LABELS).map(([v, label]) => h("option", { value: v, text: label })));
    const contentIn = h("textarea", { rows: 6, "aria-label": "Nội dung thẻ", placeholder: "Viết lại bằng lời của bạn sau khi đọc phần kiến thức ở trên…" });
    const fill = () => {
      const c = pick.value ? store.getCard(pick.value) : null;
      titleIn.value = c ? c.title : "";
      typeSel.value = c ? c.type : g.type;
      contentIn.value = c ? c.content : "";
    };
    pick.addEventListener("change", fill);
    fill();
    const save = () => {
      const title = titleIn.value.trim(), content = contentIn.value.trim();
      if (!title || !content) { toast("Tiêu đề và nội dung thẻ không được để trống."); return; }
      if (pick.value) {
        store.updateCard(pick.value, { title, content, type: typeSel.value });
      } else {
        store.addCard({
          id: uid("c"), title, content, type: typeSel.value, own: false,
          source: { doc_id: g.doc_id || state.doc.id, doc_title: state.doc.title, slide: g.slide, question: g.question },
        });
      }
      ctx.refreshNotebook();
      status.hidden = false;
      announce(`Đã lưu thẻ “${title}” cho bot.`);
      toast(`Đã lưu thẻ “${title}” — đấu lại để xem bot trả lời được chưa.`, { success: true });
      close();
    };
    body.append(
      h("div", { class: "fix-knowledge" }, [
        h("p", { class: "field-label", text: `Câu ${g.qindex + 1}: ${g.question}` }),
        h("p", { class: "gap-criterion", text: `Bot còn thiếu: ${g.criterion}` }),
        h("blockquote", { class: "sug-excerpt", text: g.excerpt }),
        h("p", { class: "sug-source", text: `Nguồn: ${state.doc.title} · slide ${g.slide}` }),
      ]),
      h("div", { class: "edit-grid" }, [
        h("label", { class: "field field-wide" }, [h("span", { class: "field-label", text: "Thẻ cần sửa" }), pick]),
        h("label", { class: "field" }, [h("span", { class: "field-label", text: "Tiêu đề" }), titleIn]),
        h("label", { class: "field" }, [h("span", { class: "field-label", text: "Loại thẻ" }), typeSel]),
        h("label", { class: "field field-wide" }, [h("span", { class: "field-label", text: "Nội dung (bằng lời của bạn)" }), contentIn]),
      ]),
      h("div", { class: "modal-actions" }, [
        h("button", { type: "button", class: "btn btn-primary", text: "Lưu thẻ", onclick: save }),
        h("button", { type: "button", class: "btn btn-ghost", text: "Huỷ", onclick: close }),
      ]),
    );
  });
}
