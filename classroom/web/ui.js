/* Modal đơn giản, quản lý focus cơ bản */
import { h, $, reducedMotion } from "./api.js";

export function openModal(title, buildContent, opts = {}) {
  const root = $("#modal-root");
  const prevFocus = document.activeElement;
  const overlay = h("div", { class: "modal-overlay", role: "presentation" });
  const dialog = h("div", {
    class: "modal-dialog", role: "dialog", "aria-modal": "true",
    "aria-label": title,
  });
  const head = h("div", { class: "modal-head" }, [
    h("h3", { text: title }),
    h("button", { type: "button", class: "toast-btn modal-close", "aria-label": "Đóng", text: "Đóng", onclick: close }),
  ]);
  const body = h("div", { class: "modal-body" });
  dialog.append(head, body);
  overlay.append(dialog);
  root.append(overlay);
  buildContent(body, close);
  const focusable = dialog.querySelector("button, input, textarea, select, [tabindex]");
  (focusable || dialog).focus();
  dialog.tabIndex = -1;

  function onKey(e) {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    if (e.key === "Tab") {
      const f = [...dialog.querySelectorAll("button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])")]
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  window.addEventListener("keydown", onKey, true);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });

  function close() {
    window.removeEventListener("keydown", onKey, true);
    if (reducedMotion) overlay.remove();
    else { overlay.classList.add("leaving"); setTimeout(() => overlay.remove(), 200); }
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    if (opts.onClose) opts.onClose();
  }
  return close;
}
