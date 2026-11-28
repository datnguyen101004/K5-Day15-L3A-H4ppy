/* Sổ tay: danh sách thẻ, lọc/tìm, xem/sửa/xoá, viết thẻ mới */

import { $, $$, h, toast, announce, uid } from "./api.js";
import * as store from "./store.js";
import { TYPE_LABELS, TYPE_COLORS } from "./faces.js";
import { openModal } from "./ui.js";

let ctx = null;
let filterType = "";
let query = "";

export function initNotebook(context) {
  ctx = context;
  $("#nb-search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); renderNotebook(); });
  $("#nb-filter").addEventListener("change", (e) => { filterType = e.target.value; renderNotebook(); });
  $("#nb-new").addEventListener("click", () => openCardModal(null));
  $("#nb-go-study").addEventListener("click", () => ctx.goTab("study"));
}

export function refreshNotebook() {
  const count = store.listCards().length;
  const badge = $("#nb-count");
  badge.hidden = count === 0;
  badge.textContent = String(count);
  if (ctx.tab === "notebook") renderNotebook();
}

export function renderNotebook() {
  const grid = $("#nb-grid");
  grid.replaceChildren();
  const cards = store.listCards();
  $("#nb-empty").hidden = cards.length > 0;
  $("#nb-hint").textContent = cards.length
    ? `${cards.length} thẻ trong sổ tay — chọn tối đa 5 thẻ để mang vào trận.`
    : "";
  const q = query;
  const shown = cards.filter((c) =>
    (!filterType || c.type === filterType) &&
    (!q || `${c.title} ${c.content}`.toLowerCase().includes(q)));
  if (cards.length && !shown.length) {
    grid.append(h("p", { class: "calm-note", text: "Không có thẻ nào khớp bộ lọc hiện tại." }));
    return;
  }
  for (const c of shown) grid.append(cardTile(c));
}

function cardTile(c) {
  const tile = h("button", {
    type: "button", class: "nb-card", dataset: { id: c.id },
    style: `--type-c: ${TYPE_COLORS[c.type] || "#CCC"}`,
    "aria-label": `Mở thẻ: ${c.title}`,
    onclick: () => openCardModal(c.id),
  });
  const head = h("div", { class: "nb-card-head" }, [
    h("span", { class: "type-badge", dataset: { type: c.type }, text: TYPE_LABELS[c.type] || c.type }),
    c.own ? h("span", { class: "type-badge own-badge", text: "Ghi chú của bạn" }) : null,
  ]);
  tile.append(
    h("span", { class: "nb-ribbon", "aria-hidden": "true" }),
    head,
    h("span", { class: "nb-card-title", text: c.title }),
    h("span", { class: "nb-card-content", text: c.content }),
  );
  if (c.source) {
    tile.append(h("span", { class: "nb-card-source", text: `Nguồn: ${c.source.doc_title} · slide ${c.source.slide}` }));
  }
  return tile;
}

/* ---------- Modal xem / sửa thẻ ---------- */

export function openNotebookCard(cardId) {
  ctx.goTab("notebook");
  renderNotebook();
  openCardModal(cardId);
}

function openCardModal(cardId) {
  const card = cardId ? store.getCard(cardId) : null;
  if (cardId && !card) { toast("Không tìm thấy thẻ trong sổ tay."); return; }
  let editing = !card; // thẻ mới mở luôn ở chế độ sửa
  openModal(card ? `Thẻ: ${card.title}` : "Viết thẻ mới", (body, close) => {
    body.append(buildCardForm(card, editing, close));
  });
}

function buildCardForm(card, editing, close) {
  const isNew = !card;
  const titleIn = h("input", { type: "text", value: card ? card.title : "", maxlength: "120", "aria-label": "Tiêu đề thẻ" });
  const contentIn = h("textarea", { rows: 6, "aria-label": "Nội dung thẻ" });
  contentIn.value = card ? card.content : "";
  const typeSel = h("select", { "aria-label": "Loại thẻ" },
    Object.entries(TYPE_LABELS).map(([v, label]) =>
      h("option", { value: v, text: label, selected: card ? card.type === v : v === "concept" })));

  const wrap = h("div", { class: "card-form" });
  const viewBox = h("div", { class: "card-view" });
  const editBox = h("div", { class: "edit-grid" }, [
    h("label", { class: "field" }, [h("span", { class: "field-label", text: "Tiêu đề" }), titleIn]),
    h("label", { class: "field" }, [h("span", { class: "field-label", text: "Loại thẻ" }), typeSel]),
    h("label", { class: "field field-wide" }, [h("span", { class: "field-label", text: "Nội dung" }), contentIn]),
  ]);
  const actions = h("div", { class: "modal-actions" });
  wrap.append(viewBox, editBox, actions);

  function sourceBlock() {
    if (!card || !card.source) return null;
    return h("div", { class: "source-block" }, [
      card.source.question
        ? h("p", { class: "gap-question", text: `Trả lời câu hỏi: ${card.source.question}` })
        : card.source.excerpt ? h("blockquote", { class: "sug-excerpt", text: card.source.excerpt }) : null,
      h("p", { class: "sug-source" }, [
        document.createTextNode(`Nguồn: ${card.source.doc_title} · slide ${card.source.slide} · `),
        h("button", {
          type: "button", class: "link-btn", text: "Mở slide",
          onclick: () => { close(); ctx.openSlide(card.source.doc_id, card.source.slide); },
        }),
      ]),
    ]);
  }

  function paintView() {
    editing = false;
    viewBox.replaceChildren(
      h("div", { class: "proposal-head" }, [
        h("span", { class: "type-badge", dataset: { type: card.type }, style: `--type-c: ${TYPE_COLORS[card.type] || "#CCC"}`, text: TYPE_LABELS[card.type] || card.type }),
        card.own ? h("span", { class: "type-badge own-badge", text: "Ghi chú của bạn" }) : null,
      ]),
      h("h4", { class: "card-form-title", text: card.title }),
      h("p", { class: "proposal-content", text: card.content }),
    );
    const sb = sourceBlock();
    if (sb) viewBox.append(sb);
    editBox.hidden = true;
    actions.replaceChildren(
      h("button", { type: "button", class: "btn", text: "Sửa", onclick: paintEdit }),
      h("button", { type: "button", class: "btn btn-danger", text: "Xoá thẻ", onclick: askDelete }),
      h("button", { type: "button", class: "btn btn-ghost", text: "Đóng", onclick: close }),
    );
  }

  function paintEdit() {
    editing = true;
    viewBox.replaceChildren();
    editBox.hidden = false;
    actions.replaceChildren(
      h("button", {
        type: "button", class: "btn btn-primary", text: isNew ? "Lưu thẻ" : "Lưu thay đổi",
        onclick: () => {
          const title = titleIn.value.trim(), content = contentIn.value.trim();
          if (!title || !content) { toast("Tiêu đề và nội dung thẻ không được để trống."); return; }
          if (isNew) {
            const created = store.addCard({ id: uid("c"), title, content, type: typeSel.value, own: true, source: null });
            announce(`Đã tạo thẻ “${created.title}”.`);
            toast(`Đã tạo thẻ “${created.title}”.`);
          } else {
            store.updateCard(card.id, { title, content, type: typeSel.value });
            announce(`Đã lưu thay đổi cho thẻ “${title}”.`);
            toast(`Đã lưu thẻ “${title}”.`);
          }
          ctx.refreshNotebook();
          close();
        },
      }),
      h("button", { type: "button", class: "btn btn-ghost", text: "Huỷ", onclick: isNew ? close : paintView }),
    );
  }

  function askDelete() {
    actions.replaceChildren(
      h("span", { class: "confirm-note", text: `Xoá thẻ “${card.title}” khỏi sổ tay?` }),
      h("button", {
        type: "button", class: "btn btn-danger", text: "Chắc chắn xoá",
        onclick: () => {
          store.deleteCard(card.id);
          announce(`Đã xoá thẻ “${card.title}”.`);
          toast(`Đã xoá thẻ “${card.title}”.`);
          ctx.refreshNotebook();
          close();
        },
      }),
      h("button", { type: "button", class: "btn btn-ghost", text: "Giữ lại", onclick: paintView }),
    );
  }

  if (editing) paintEdit(); else paintView();
  return wrap;
}
