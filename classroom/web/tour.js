/* Hướng dẫn từng tính năng: phủ tối màn hình, chừa lỗ quanh một phần tử, cô Linh giải thích.
   Chỉ dùng transform/opacity cho chuyển động; lỗ sáng nhảy tức thì, vòng sáng nổi lên tại chỗ mới. */
import { $, h, reducedMotion } from "./api.js";
import { faceChipSVG } from "./faces.js";
import * as store from "./store.js";
import { goSlideTo, currentSlide, currentDoc } from "./slides.js";

const START_SLIDE = 2;   // slide 1 là bìa, không có đoạn đánh số nên hướng dẫn luôn bắt đầu ở slide 2

const SEEN_KEY = "lhtt.tour.v1";
const PAD = 8;           // khoảng hở quanh phần tử
const GAP = 14;          // khoảng cách bong bóng tới phần tử
const MARGIN = 12;       // lề an toàn với mép màn hình

let ctx = null;
let tour = null;         // { steps, i, root, svgPath, ring, pop, startTab, prevFocus, raf }

const phase = () => (ctx.match ? ctx.match.phase : null);
const inMatch = () => ["question", "scored"].includes(phase());

/* when(): bước có áp dụng ở trạng thái hiện tại không (tính một lần khi mở để biết tổng số bước) */
const STEPS = [
  { title: "Chào bạn!", text: "Cô Linh dẫn bạn đi một vòng: học slide, dạy bot bằng thẻ, cho bot thi đấu, rồi tự làm bài kiểm tra cuối. Bấm Tiếp hoặc phím → để đi tiếp, Esc để thoát." },
  { sel: "#doc-select", title: "Chọn tài liệu", text: "Chọn bộ slide của lớp. Gợi ý, câu hỏi trong trận và bài kiểm tra cuối đều lấy từ tài liệu này." },
  { sel: "#mode-badge", title: "Chế độ AI", text: "Cho biết cô Linh đang dùng model thật hay chế độ không model (gợi ý và chấm theo luật có sẵn, không gọi mạng)." },
  { sel: ".tabs", title: "Bốn khu vực", text: "Đi lần lượt Học slide → Sổ tay → Đấu trường → Kiểm tra cuối là đủ một vòng học." },
  { tab: "study", sel: "#slide-view", title: "Slide gốc", text: "Đọc slide để tự rút ra kiến thức. Số tròn bên lề đánh dấu đoạn quan trọng; thẻ trống cùng số ở cột phải dành cho đoạn đó." },
  { tab: "study", sel: ".slide-toolbar", title: "Chuyển slide", text: "Bấm Trước / Sau hoặc phím ← →. Thanh bên dưới cho biết bạn đang ở slide nào; bên cạnh ghi số slide đã xem." },
  { tab: "study", sel: ".suggest-col", title: "Thẻ cho bot", text: "Cô Linh chỉ đánh số đoạn quan trọng, không viết sẵn gì. Bạn tự đặt tiêu đề và tự viết nội dung thẻ — bot chỉ thi đấu bằng những gì bạn viết." },
  { tab: "study", sel: ".sug-card:has(.edit-grid) .edit-grid .field:nth-child(1)", demo: "title", title: "Viết thẻ · 1. Tiêu đề", text: "Đặt một tiêu đề ngắn nói thẻ này về gì — cô Linh điền thử một ví dụ. Bot dựa vào tiêu đề và nội dung để chọn đúng thẻ khi gặp câu hỏi." },
  { tab: "study", sel: ".sug-card:has(.edit-grid) .edit-grid .field:nth-child(2)", demo: "type", title: "Viết thẻ · 2. Loại thẻ", text: "Khái niệm (định nghĩa), Quy tắc (nên/không nên làm gì), Ví dụ (tình huống cụ thể) hay Lỗi thường gặp (sai ở đâu, hậu quả gì). Hải giỏi bắt lỗi, An giỏi ví dụ — bot của bạn cũng cần đủ loại." },
  { tab: "study", sel: ".sug-card:has(.edit-grid) .edit-grid .field:nth-child(3)", demo: "content", title: "Viết thẻ · 3. Nội dung", text: "Đọc đoạn cùng số trên slide rồi viết lại bằng lời của bạn: ý chính, vì sao, ví dụ nếu có. Bot chỉ nói được những gì bạn viết ở đây — thiếu ý nào thì trong trận bot thiếu ý đó." },
  { tab: "study", sel: ".sug-card:has(.edit-grid) .sug-actions .btn-primary", title: "Viết thẻ · 4. Lưu thẻ", text: "Điền đủ tiêu đề và nội dung rồi bấm Lưu thẻ. Phần cô Linh vừa điền chỉ là ví dụ và sẽ được xoá khi đóng hướng dẫn — bạn tự viết thẻ thật nhé." },
  { tab: "study", sel: ".sug-card:has(.edit-grid) .sug-actions .btn-ghost", title: "Bỏ qua", text: "Ẩn thẻ cho đoạn bạn thấy không cần. Có thể hoàn tác ngay bên dưới danh sách." },
  { tab: "notebook", sel: "#nb-grid", when: () => store.listCards().length > 0, title: "Sổ tay của bot", text: "Bot chỉ biết những gì có trong sổ tay. Bấm một thẻ để sửa hoặc xoá; thẻ lưu ngay trong trình duyệt này." },
  { tab: "notebook", sel: "#nb-empty", when: () => store.listCards().length === 0, title: "Sổ tay của bot", text: "Sổ tay đang trống. Bot chỉ biết những gì bạn ghi vào đây — hãy lưu vài thẻ từ tab Học slide trước khi thi đấu." },
  { tab: "notebook", sel: "#nb-new", title: "Viết thẻ mới", text: "Tự ghi thêm kiến thức không gắn với câu hỏi nào. Thẻ này có nhãn “Ghi chú của bạn”." },
  { tab: "notebook", sel: ".nb-tools", title: "Tìm và lọc", text: "Tìm theo chữ hoặc lọc theo loại thẻ: khái niệm, quy tắc, ví dụ, lỗi thường gặp." },
  { tab: "arena", sel: "#btn-prepare", when: () => !inMatch() && phase() !== "review", title: "Chuẩn bị trận", text: "Cô Linh chọn một chủ đề 2–3 slide. Bạn chọn đối thủ (Minh, Vy, Hải hoặc An) và tối đa 5 thẻ. Trận có 3 câu: nhớ lại, áp dụng, phản biện; ở câu 3 bạn được Nhắc bài một lần." },
  { tab: "arena", sel: "#stage", when: inMatch, title: "Bảng đen", text: "Câu hỏi hiện trên bảng. Sau khi chấm, bảng ghi điểm từng bạn." },
  { tab: "arena", sel: "#feed", when: inMatch, title: "Lời thoại", text: "Câu trả lời của từng bạn, kèm các thẻ bot thật sự đã dùng và nhận xét của cô Linh." },
  { tab: "arena", sel: "#dock", when: inMatch, title: "Điều khiển trận", text: "Cho hai bạn trả lời, rồi Câu tiếp theo. Ở câu 3 có nút Nhắc bài để đưa bot một thẻ." },
  { tab: "arena", sel: "#result-banner", when: () => phase() === "review", title: "Kết quả trận", text: "Thắng, thua hay hoà, kèm điểm của hai bạn." },
  { tab: "arena", sel: "#review-gaps", when: () => phase() === "review", title: "Kiến thức bot còn thiếu", text: "Cô Linh tổng kết từng ý bot chưa trả lời được, kèm câu nguyên văn trong slide. Đọc hiểu rồi bấm Sửa thẻ cho bot để tự viết lại thẻ." },
  { tab: "arena", sel: "#btn-rematch", when: () => phase() === "review", title: "Đấu lại", text: "Cùng chủ đề nhưng câu hỏi mới — để xem thẻ vừa sửa có giúp bot trả lời được không." },
  { tab: "quiz", sel: ["#quiz-card", "#quiz-summary", "#quiz-intro"], title: "Kiểm tra cuối", text: "Câu hỏi phỏng vấn thật về AI agent, được báo cáo ở các công ty như OpenAI, Anthropic. Bạn tự trả lời; cô Linh chấm theo ý trong slide và chỉ slide cần ôn." },
  { sel: "#btn-tour", title: "Xem lại bất cứ lúc nào", text: "Bấm Hướng dẫn để đi lại vòng này. Chúc bạn và bot học vui!" },
];

export function initTour(context) {
  ctx = context;
  const btn = $("#btn-tour");
  btn.addEventListener("click", () => startTour());
  if (!localStorage.getItem(SEEN_KEY)) btn.classList.add("tour-new");
}

function targetOf(step) {
  if (!step.sel) return null;
  for (const sel of [].concat(step.sel)) {
    const el = $(sel);
    if (el && el.getClientRects().length) {
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) return el;
    }
  }
  return null;
}

export async function startTour() {
  if (tour) return;
  localStorage.setItem(SEEN_KEY, "1");
  $("#btn-tour").classList.remove("tour-new");
  const steps = STEPS.filter((s) => !s.when || s.when());
  const root = h("div", { class: "tour", role: "presentation" });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "tour-dim");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill-rule", "evenodd");
  svg.append(path);
  const ring = h("div", { class: "tour-ring", "aria-hidden": "true" });
  const pop = h("div", { class: "tour-pop", role: "dialog", "aria-modal": "true", "aria-labelledby": "tour-title", "aria-describedby": "tour-text" });
  root.append(svg, ring, pop);
  root.addEventListener("mousedown", (e) => { if (!pop.contains(e.target)) e.preventDefault(); });
  document.body.append(root);
  tour = { steps, i: -1, root, path, ring, pop, startTab: ctx.tab, startSlide: currentSlide(),
    prevFocus: document.activeElement, raf: 0, demo: new Map(), typer: 0 };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", schedulePlace);
  window.addEventListener("scroll", schedulePlace, true);
  const t = tour;
  const doc = currentDoc();
  if (doc && doc.slides.length >= START_SLIDE && currentSlide() !== START_SLIDE) {
    if (ctx.tab !== "study") ctx.goTab("study", { quiet: true });
    await goSlideTo(START_SLIDE); // chờ vẽ xong slide + thẻ để các bước viết thẻ có chỗ khoanh
  }
  if (tour === t) go(0, 1);
}

function endTour() {
  if (!tour) return;
  const t = tour;
  tour = null;
  window.removeEventListener("keydown", onKey, true);
  window.removeEventListener("resize", schedulePlace);
  window.removeEventListener("scroll", schedulePlace, true);
  cancelAnimationFrame(t.raf);
  clearInterval(t.typer);
  for (const [control, value] of t.demo) control.value = value; // trả các ô về như trước khi xem hướng dẫn
  if (t.startSlide && currentSlide() !== t.startSlide) goSlideTo(t.startSlide); // về lại slide đang xem trước đó
  if (ctx.tab !== t.startTab) ctx.goTab(t.startTab, { quiet: true });
  if (reducedMotion) t.root.remove();
  else { t.root.classList.add("leaving"); setTimeout(() => t.root.remove(), 200); }
  const back = $("#btn-tour");
  (back || t.prevFocus)?.focus?.();
}

/* Tìm bước kế tiếp hiển thị được theo hướng dir; bước có tab thì chuyển tab và chờ phần tử xuất hiện. */
async function go(from, dir) {
  const t = tour;
  for (let i = from; i >= 0 && i < t.steps.length; i += dir) {
    const step = t.steps[i];
    if (step.tab && ctx.tab !== step.tab) ctx.goTab(step.tab, { quiet: true });
    const el = step.sel ? await waitForTarget(step, step.tab ? 1500 : 0) : null;
    if (tour !== t) return;
    if (step.sel && !el) continue;
    t.i = i;
    show(step, el);
    return;
  }
  if (dir > 0) endTour();
}

function waitForTarget(step, timeout) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const el = targetOf(step);
      if (el || performance.now() - t0 >= timeout) resolve(el);
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

function show(step, el) {
  const t = tour;
  t.el = el;
  const n = t.i + 1, total = t.steps.length;
  const last = t.i === t.steps.length - 1;
  t.pop.replaceChildren(
    h("div", { class: "tour-pop-head" }, [
      h("span", { class: "tour-face", html: faceChipSVG("teacher"), "aria-hidden": true }),
      h("div", {}, [
        h("p", { class: "tour-step", text: `Bước ${n} / ${total}` }),
        h("h3", { id: "tour-title", class: "tour-title", text: step.title }),
      ]),
    ]),
    h("p", { id: "tour-text", class: "tour-text", text: step.text }),
    h("div", { class: "tour-dots", "aria-hidden": "true" },
      t.steps.map((_, k) => h("span", { class: "tour-dot" + (k === t.i ? " on" : k < t.i ? " done" : "") }))),
    h("div", { class: "tour-actions" }, [
      h("button", { type: "button", class: "btn btn-ghost tour-skip", text: last ? "Đóng" : "Bỏ qua", onclick: endTour }),
      h("span", { class: "tour-spacer" }),
      t.i > 0 ? h("button", { type: "button", class: "btn btn-ghost", text: "Trước", onclick: () => go(t.i - 1, -1) }) : null,
      h("button", { type: "button", class: "btn btn-primary tour-next", text: last ? "Xong" : "Tiếp", onclick: () => go(t.i + 1, 1) }),
    ]),
  );
  if (el) {
    const r = el.getBoundingClientRect();
    const clip = visibleBox(el);
    if (r.top < clip.top + MARGIN || r.bottom > clip.bottom - MARGIN) {
      el.scrollIntoView({ block: r.height > clip.bottom - clip.top - 2 * MARGIN ? "start" : "center", behavior: "auto" });
    }
  }
  place();
  restart(t.ring, "is-in");
  restart(t.pop, "is-in");
  t.pop.querySelector(".tour-next").focus({ preventScroll: true });
  if (step.demo && el) demoFill(step.demo, el);
}

/* Điền thử một ví dụ vào ô của thẻ (gõ từng chữ). Chỉ dựa vào tên slide, không chép nội dung slide. */
function demoFill(kind, field) {
  const t = tour;
  const control = field.querySelector("input, select, textarea");
  if (!control) return;
  if (!t.demo.has(control)) t.demo.set(control, control.value);
  const card = field.closest(".sug-card");
  const num = card?.querySelector(".sug-num")?.textContent || "1";
  const slideTitle = ($("#suggest-sub").textContent || "").replace(/^Slide \d+:\s*/, "") || "đoạn này";
  if (kind === "type") return; // loại thẻ đã chọn sẵn theo đoạn — chỉ khoanh sáng để giải thích
  const text = kind === "title"
    ? `Ví dụ: ${slideTitle}`
    : `(Ví dụ) Đoạn số ${num} nói về ${slideTitle.toLowerCase()}: ý chính là … vì … Ví dụ: …`;
  clearInterval(t.typer);
  if (reducedMotion) { control.value = text; return; }
  control.value = "";
  let i = 0;
  t.typer = setInterval(() => {
    i += 2;
    control.value = text.slice(0, i);
    if (i >= text.length) clearInterval(t.typer);
  }, 24);
}

function restart(el, cls) {
  if (reducedMotion) return;
  el.classList.remove(cls);
  void el.offsetWidth; // chạy lại animation cho bước mới
  el.classList.add(cls);
}

/* Vùng thực sự nhìn thấy: giao của cửa sổ với mọi khung cuộn chứa phần tử (panel có thanh cuộn riêng) */
function visibleBox(el) {
  let top = 0, bottom = window.innerHeight;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden") {
      const pr = p.getBoundingClientRect();
      top = Math.max(top, pr.top);
      bottom = Math.min(bottom, pr.bottom);
    }
  }
  return { top, bottom };
}

function schedulePlace() {
  if (!tour) return;
  cancelAnimationFrame(tour.raf);
  tour.raf = requestAnimationFrame(place);
}

function roundedHole(x, y, w, hgt, r) {
  r = Math.min(r, w / 2, hgt / 2);
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${hgt - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}` +
    `h-${w - 2 * r}a${r} ${r} 0 0 1 -${r} -${r}v-${hgt - 2 * r}a${r} ${r} 0 0 1 ${r} -${r}z`;
}

function place() {
  const t = tour;
  if (!t) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  let outer = `M0 0H${vw}V${vh}H0Z`;
  const pop = t.pop;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  if (!t.el || !t.el.isConnected) {
    t.path.setAttribute("d", outer);
    t.ring.hidden = true;
    pop.style.left = `${Math.round((vw - pw) / 2)}px`;
    pop.style.top = `${Math.round((vh - ph) / 2)}px`;
    return;
  }
  const r = t.el.getBoundingClientRect();
  // phần tử cao hơn màn hình: chỉ khoanh phần đang thấy
  const x = Math.max(MARGIN / 2, r.left - PAD), y = Math.max(MARGIN / 2, r.top - PAD);
  const w = Math.min(vw - MARGIN / 2, r.right + PAD) - x;
  const hh = Math.min(vh - MARGIN / 2, r.bottom + PAD) - y;
  t.path.setAttribute("d", outer + roundedHole(x, y, w, hh, 14));
  t.ring.hidden = false;
  Object.assign(t.ring.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px` });

  // bong bóng: dưới → trên → phải → trái → góc dưới màn hình
  const fits = {
    below: y + hh + GAP + ph <= vh - MARGIN,
    above: y - GAP - ph >= MARGIN,
    right: x + w + GAP + pw <= vw - MARGIN,
    left: x - GAP - pw >= MARGIN,
  };
  const clampX = (v) => Math.min(Math.max(MARGIN, v), vw - pw - MARGIN);
  const clampY = (v) => Math.min(Math.max(MARGIN, v), vh - ph - MARGIN);
  let left, top, side;
  if (fits.below) { side = "below"; top = y + hh + GAP; left = clampX(x + w / 2 - pw / 2); }
  else if (fits.above) { side = "above"; top = y - GAP - ph; left = clampX(x + w / 2 - pw / 2); }
  else if (fits.right) { side = "right"; left = x + w + GAP; top = clampY(y + hh / 2 - ph / 2); }
  else if (fits.left) { side = "left"; left = x - GAP - pw; top = clampY(y + hh / 2 - ph / 2); }
  else { side = "inside"; left = clampX(vw - pw - MARGIN); top = clampY(vh - ph - MARGIN); }
  pop.dataset.side = side;
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

function onKey(e) {
  if (!tour) return;
  const t = tour;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); endTour(); return; }
  if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); go(t.i + 1, 1); return; }
  if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); if (t.i > 0) go(t.i - 1, -1); return; }
  if (e.key === "Tab") {
    const f = [...t.pop.querySelectorAll("button")];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!t.pop.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    e.stopPropagation();
    return;
  }
  // phím khác (Enter/Space trên nút) để mặc định; chặn phím tắt của trang phía sau
  if (!t.pop.contains(e.target)) { e.preventDefault(); e.stopPropagation(); }
}
