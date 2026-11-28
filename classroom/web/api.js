/* Lớp học tranh tài v2 — tiện ích chung: DOM, API, toast */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Tạo phần tử DOM an toàn (textContent, không bao giờ chèn HTML thô) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v; // chỉ dùng cho SVG tĩnh tự viết
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(9)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

/* ---------- API ---------- */

export async function api(path, opts) {
  let res;
  try {
    res = await fetch(path, opts);
  } catch (e) {
    const err = new Error("Không kết nối được tới máy chủ. Kiểm tra lại server rồi thử lại nhé.");
    err.network = true;
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* để null */ }
  if (!res.ok) {
    throw new Error((data && data.error) || `Máy chủ báo lỗi ${res.status}.`);
  }
  return data;
}

export const post = (path, body) =>
  api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

export const enc = encodeURIComponent;

/* Chạy một tác vụ, báo lỗi bằng toast — luôn có nút Thử lại (mạng và cả lỗi 5xx như 502) */
export async function run(fn) {
  try {
    return await fn();
  } catch (e) {
    const msg = e && e.network ? e.message : (e && e.message) || "Có lỗi xảy ra. Thử lại nhé.";
    toast(msg, { retry: () => run(fn) });
    return null;
  }
}

/* Trạng thái chờ theo ngữ cảnh: khoá nút + hiện dòng chữ trong khi gọi API chậm */
export async function busy(btn, statusEl, statusText, fn) {
  if (btn) btn.disabled = true;
  if (statusEl) { statusEl.textContent = statusText; statusEl.hidden = false; }
  try {
    return await fn();
  } finally {
    if (btn) btn.disabled = false;
    if (statusEl) { statusEl.hidden = true; statusEl.textContent = ""; }
  }
}

/* ---------- Toast ---------- */

export function toast(message, opts = {}) {
  const root = $("#toast-root");
  const el = h("div", { class: "toast", role: "status" });
  el.append(h("span", { text: message }));
  if (opts.retry) {
    el.append(h("button", { type: "button", class: "toast-btn", text: "Thử lại", onclick: () => { dismiss(); opts.retry(); } }));
  }
  const x = h("button", { type: "button", class: "toast-btn", "aria-label": "Đóng thông báo", text: "Đóng", onclick: dismiss });
  el.append(x);
  root.append(el);
  function dismiss() {
    if (!el.isConnected) return;
    if (reducedMotion) { el.remove(); return; }
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 220);
  }
  return dismiss;
}

/* Thông báo ngắn dùng aria-live cho hành động đã lưu */
export function announce(message) {
  let live = $("#live-announcer");
  if (!live) {
    live = h("p", { id: "live-announcer", class: "sr-only", "aria-live": "polite", role: "status" });
    document.body.append(live);
  }
  live.textContent = "";
  requestAnimationFrame(() => { live.textContent = message; });
}

/* Chuẩn hoá văn bản để so khớp: NFC + gom khoảng trắng */
export function normText(s) {
  return String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

export function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
