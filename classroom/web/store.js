/* Sổ tay lưu ở trình duyệt + các trạng thái nhỏ khác (localStorage) */

const NB_KEY = "lhtt.notebook.v1";
const DISMISS_KEY = "lhtt.dismissed.v1";   // {docId: [suggestionId...]} — đã bỏ qua
const SAVED_KEY = "lhtt.saved.v1";         // {docId: {suggestionId: cardId}} — đã lưu từ gợi ý
const PROGRESS_KEY = "lhtt.progress.v1";   // {docId: {visited:[n], last:n}}

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* đầy hoặc tắt — bỏ qua */ }
};

/* ---------- Sổ tay thẻ ---------- */

export function listCards() {
  const arr = read(NB_KEY, []);
  return Array.isArray(arr) ? arr : [];
}

export function getCard(id) {
  return listCards().find((c) => c.id === id) || null;
}

export function addCard(card) {
  const cards = listCards();
  const now = new Date().toISOString();
  const full = { createdAt: now, updatedAt: now, ...card };
  cards.unshift(full);
  write(NB_KEY, cards);
  return full;
}

export function updateCard(id, patch) {
  const cards = listCards();
  const i = cards.findIndex((c) => c.id === id);
  if (i < 0) return null;
  cards[i] = { ...cards[i], ...patch, id, updatedAt: new Date().toISOString() };
  write(NB_KEY, cards);
  return cards[i];
}

export function deleteCard(id) {
  write(NB_KEY, listCards().filter((c) => c.id !== id));
}

/* ---------- Gợi ý đã bỏ qua / đã lưu ---------- */

export function dismissedFor(docId) {
  return read(DISMISS_KEY, {})[docId] || [];
}
export function dismissSuggestion(docId, sugId) {
  const all = read(DISMISS_KEY, {});
  const set = new Set(all[docId] || []);
  set.add(sugId);
  all[docId] = [...set];
  write(DISMISS_KEY, all);
}
export function undoDismiss(docId, sugId) {
  const all = read(DISMISS_KEY, {});
  all[docId] = (all[docId] || []).filter((s) => s !== sugId);
  write(DISMISS_KEY, all);
}

export function savedMap(docId) {
  return read(SAVED_KEY, {})[docId] || {};
}
export function markSaved(docId, sugId, cardId) {
  const all = read(SAVED_KEY, {});
  all[docId] = { ...(all[docId] || {}), [sugId]: cardId };
  write(SAVED_KEY, all);
}

/* ---------- Tiến độ học theo tài liệu ---------- */

export function progressFor(docId) {
  return read(PROGRESS_KEY, {})[docId] || { visited: [], last: 1 };
}
export function markVisited(docId, n, total) {
  const all = read(PROGRESS_KEY, {});
  const p = all[docId] || { visited: [], last: 1 };
  if (!p.visited.includes(n)) p.visited.push(n);
  p.last = n;
  p.total = total;
  all[docId] = p;
  write(PROGRESS_KEY, all);
  return p;
}
