"""Huấn luyện viên (coach) của Lớp học tranh tài v2.

- Gợi ý thẻ dạy bot cho từng slide (chế độ offline: luật heuristic tiếng Việt;
  chế độ model: một lượt gọi model mỗi slide, JSON nghiêm ngặt).
- Chủ đề (nhóm 2-3 slide liên tiếp có gợi ý).
- Bộ thẻ của 4 bot đối thủ, dựng tự động từ gợi ý của tài liệu theo sở trường.

Mọi trích dẫn (excerpt) phải là chuỗi con nguyên văn của văn bản slide.
"""
import hashlib
import json
import os
import re
import sys
import threading
import time

from . import rag


class ApiError(Exception):
    """Lỗi API: status + câu tiếng Việt giải thích cách sửa."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def _load_ai():
    """Import codebase/ai.py (đưa codebase/ vào sys.path) — gọi lười để không bắt buộc có model."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cb = os.path.join(root, "codebase")
    if cb not in sys.path:
        sys.path.insert(0, cb)
    import ai
    return ai


def model_mode():
    """True nếu .env có MODEL_PROVIDER khác 'fake'."""
    try:
        return _load_ai().MODEL_PROVIDER != "fake"
    except Exception:
        return False


def model_provider():
    """Giá trị MODEL_PROVIDER đang dùng (chữ thường); 'fake' nếu chưa cấu hình."""
    try:
        return _load_ai().MODEL_PROVIDER
    except Exception:
        return "fake"


def ai_call_model():
    """Hàm codebase/ai.py::call_model (không kiểm MODEL_PROVIDER)."""
    return _load_ai().call_model


CARD_TYPES = ("concept", "rule", "example", "mistake")
TYPE_LABELS = {
    "concept": "Khái niệm",
    "rule": "Quy tắc",
    "example": "Ví dụ",
    "mistake": "Lỗi thường gặp",
}

PLAYER_COLOR = "#FFFFFF"
PLAYER_PERSONA = "Bot do bạn huấn luyện"
BOTS = [
    {"id": "minh", "name": "Minh", "color": "#FFD45C",
     "persona": "Trả lời nhanh, ngắn gọn — một câu súc tích từ thẻ phù hợp nhất."},
    {"id": "hai", "name": "Hải", "color": "#FF8A8A",
     "persona": "Giỏi phát hiện lỗi — nêu thẻ lỗi thường gặp và chỉ ra chỗ còn thiếu."},
    {"id": "vy", "name": "Vy", "color": "#7CC4FF",
     "persona": "Bám sát tài liệu — trả lời kèm dẫn số slide của thẻ."},
    {"id": "an", "name": "An", "color": "#9EE09E",
     "persona": "Giỏi đưa ví dụ — luôn kèm thẻ ví dụ áp dụng khi có."},
]
BOT_BY_ID = {b["id"]: b for b in BOTS}

# ---------------------------------------------------------------------------
# Phân loại ý theo dấu hiệu tiếng Việt (chế độ offline)
# ---------------------------------------------------------------------------
_CONCEPT_CUES = (" là ", "=", "nghĩa là", "gọi là", "được gọi là", "định nghĩa là")
_RULE_CUES = ("nên ", "không nên", "phải ", "luôn ", "chỉ ", "khi ", " thì ",
              "bắt đầu bằng", "nguyên tắc", "không được", "cần ", "tuỳ vào", "tốt hơn")
_EXAMPLE_CUES = ("ví dụ", "vd:", "vd ", "chẳng hạn", "như là", "như khi", "ví dụ như")
# "Lỗi thường gặp" cần ngữ cảnh mô tả một sai lầm / hậu quả xấu, không chỉ có chữ "lỗi"/"sai":
# dấu hiệu mạnh tự nó đủ; chữ trần ("lỗi", "sai", "không có") chỉ tính khi đi kèm ngữ cảnh hậu quả.
_MISTAKE_STRONG = ("lỗi thường gặp", "sai lầm", "nhầm lẫn", "rủi ro", "đừng ", "tránh ", "cạm bẫy",
                   "hậu quả", "thất bại", "nguyên nhân", "nếu không", "kéo theo")
_MISTAKE_BARE = ("lỗi", " sai ", "không có ")
_MISTAKE_CONTEXT = (" khiến ", " dễ ", " thường ", "mà không", " có thể ", "kéo theo", "nguyên nhân",
                    "nếu không", "hậu quả")
_IMPERATIVE_RE = re.compile(
    r"^(?:trả|dùng|đặt|giới hạn|đo|ghi|chốt|bắt đầu|tách|xây|tính|chuyển|kiểm tra|tìm|đưa|chia|lưu|tạo)\s")
_TITLE_HINT = {
    "mistake": re.compile(r"lỗi thường gặp|kiểu lỗi|sai lầm|rủi ro|cạm bẫy"),
    "example": re.compile(r"ví dụ|tình huống"),
}
_CUE_WEIGHT = {"concept": 3.0, "rule": 2.5, "example": 2.0, "mistake": 3.5}
_TIE_ORDER = ("concept", "rule", "example", "mistake")
_COLON_DEF_RE = re.compile(r"^[^:]{3,48}:")

MIN_CONTENT_WORDS = 6
MIN_SLIDE_BULLETS = 2
MIN_SLIDE_TOKENS = 12

# Slide bìa / mục lục / chuyển tiếp: các ý chỉ mang tính giới thiệu
_META_PREFIXES = ("chủ đề", "mỗi trang", "mỗi slide", "bộ slide", "bài giảng", "nội dung",
                  "gồm các", "tiết học", "buổi học", "agenda", "mục lục", "thực hành")
_COVER_TITLE_RE = re.compile(r"bìa|giới thiệu|mục lục|agenda|tổng quan", re.IGNORECASE)


def _ws(text):
    return " ".join(text.split())


_SLIDE_REF_RE = re.compile(r"slide\s*\d", re.IGNORECASE)


def with_slide_refs(text, slides):
    """Mọi lời giải thích của cô Linh phải kèm số slide: chưa nhắc slide nào thì thêm "(Theo slide a, b.)"."""
    text = _ws(text or "")
    nums = sorted({int(n) for n in slides if n})
    if not nums or _SLIDE_REF_RE.search(text):
        return text
    return f"{text} (Theo slide {', '.join(map(str, nums))}.)"


def slide_text(slide):
    return _ws(slide["text"])


def content_words(text):
    return len(rag.content_tokens(text))


def _is_meta_slide(slide):
    if _COVER_TITLE_RE.search(slide.get("title") or ""):
        return True
    bullets = slide.get("bullets", [])
    if not bullets:
        return True
    norm = [rag.normalize(b) for b in bullets]
    return all(b.startswith(_META_PREFIXES) or len(b) <= 48 for b in norm)


def slide_informative(slide):
    """Slide bìa / mục lục / chuyển tiếp hoặc thiếu nội dung thì không có gợi ý."""
    return len(slide.get("bullets", [])) >= MIN_SLIDE_BULLETS and \
        content_words(slide["text"]) >= MIN_SLIDE_TOKENS and not _is_meta_slide(slide)


def _cue_hits(ctype, norm):
    if ctype == "mistake":
        hits = sum(1 for cue in _MISTAKE_STRONG if cue in norm)
        if any(cue in norm for cue in _MISTAKE_CONTEXT):
            hits += sum(1 for cue in _MISTAKE_BARE if cue in norm)
        return hits
    cues = {"concept": _CONCEPT_CUES, "rule": _RULE_CUES, "example": _EXAMPLE_CUES}[ctype]
    hits = sum(1 for cue in cues if cue in norm)
    if ctype == "rule" and _IMPERATIVE_RE.match(norm.strip()):
        hits += 1
    return hits


def classify_bullet(text, slide_title=""):
    """Phân loại một ý theo dấu hiệu tiếng Việt -> (type, điểm) hoặc (None, 0).

    Điểm = độ mạnh dấu hiệu + độ đậm nội dung; cần tối thiểu MIN_CONTENT_WORDS từ có nghĩa.
    Tiêu đề slide kiểu "Các kiểu lỗi thường gặp" / "Ví dụ …" cũng là một dấu hiệu cho mọi ý trong slide.
    """
    if content_words(text) < MIN_CONTENT_WORDS:
        return None, 0.0
    plain = rag.normalize(text).strip()
    norm = " " + plain + " "
    title = rag.normalize(slide_title)
    best_type, best_score = None, 0.0
    for ctype in _TIE_ORDER:
        hits = _cue_hits(ctype, norm)
        if ctype == "concept" and _COLON_DEF_RE.match(plain):
            head = plain.split(":", 1)[0]
            if not any(cue in head for cue in _EXAMPLE_CUES + _MISTAKE_STRONG) \
                    and not _IMPERATIVE_RE.match(head + " "):
                hits += 1  # định nghĩa dạng "Khái niệm: …"
        if ctype in _TITLE_HINT and _TITLE_HINT[ctype].search(title):
            hits += 1
        if not hits:
            continue
        density = min(content_words(text), 14) / 14.0
        score = hits * _CUE_WEIGHT[ctype] + density
        if score > best_score or (score == best_score and best_type is None):
            best_type, best_score = ctype, score
    return best_type, best_score


_GENERIC_HEADS = ("nguyên tắc", "quy tắc", "lưu ý", "chú ý", "mẹo", "ghi nhớ", "ví dụ", "vd",
                  "lỗi thường gặp", "sai lầm", "cảnh báo", "rủi ro", "kết luận", "tóm lại")
_CLAUSE_CUT_RE = re.compile(r"[,;]|\s(?:khi|thì|để|vì|nếu|rồi|nhưng)\s")
_IS_DEF_RE = re.compile(r"^(.{2,48}?)\s+(?:là|nghĩa là|được gọi là)\s+")


def _short_clause(text, max_words=8):
    """Mệnh đề đầu của ý: cắt ở dấu phẩy / liên từ (khi đã có ≥4 từ), tối đa max_words từ."""
    text = _ws(text).strip(" .,;")
    for m in _CLAUSE_CUT_RE.finditer(text):
        if len(text[:m.start()].split()) >= (1 if m.group(0) in ",;" else 4):
            text = text[:m.start()]
            break
    return " ".join(text.split()[:max_words]).strip(" .,;")


def _head_phrase(bullet):
    """Cụm đầu của ý dùng làm tiêu đề thẻ: phần trước ':' / '=' / ' là ' (khái niệm);
    đầu đề chung như 'Nguyên tắc: …' thì lấy mệnh đề sau dấu ':'; còn lại là mệnh đề đầu."""
    norm = _ws(bullet)
    m = re.match(r"^([^:=]{2,48}?)\s*[:=]\s*(.+)$", norm)
    if m:
        head, rest = m.group(1).strip(), m.group(2).strip()
        if rag.normalize(head) in _GENERIC_HEADS:
            return _short_clause(rest)
        return head.strip(" .,;")
    m = _IS_DEF_RE.match(norm)
    if m:
        return m.group(1).strip()
    return _short_clause(norm)


def card_from_excerpt(excerpt, ctype):
    """Thẻ nháp từ một đoạn slide: title là cụm ngắn đầu ý, content là đoạn gốc."""
    title = _head_phrase(excerpt)
    if title:
        title = title[0].upper() + title[1:]
    if len(title) > 70:
        title = " ".join(title.split()[:8]).strip(" .,;")
    if ctype == "concept" and title and len(title.split()) == 1:
        title += " là gì"  # tiêu đề một từ quá trống: biến thành câu hỏi bot cần trả lời được
    return {"title": title or TYPE_LABELS[ctype], "content": _ws(excerpt), "type": ctype}


def linh_says(ctype, bullet, slide_title):
    """Một câu cô Linh nêu việc cụ thể bot làm được nhờ thẻ, gắn với chủ đề của slide."""
    topic = f"“{slide_title}”" if slide_title else "chủ đề này"
    head = _head_phrase(bullet)
    if ctype == "concept":
        return f"Thẻ này giúp bot giải thích đúng “{head}” khi gặp câu hỏi về {topic}."
    if ctype == "rule":
        return f"Thẻ này giúp bot quyết định đúng theo quy tắc “{head}” khi gặp câu hỏi về {topic}."
    if ctype == "example":
        return f"Thẻ này cho bot một ví dụ cụ thể (“{head}”) để minh hoạ khi gặp câu hỏi về {topic}."
    return f"Thẻ này giúp bot tránh lỗi “{head}” khi gặp câu hỏi về {topic}."


def _hash_id(prefix, *parts):
    return prefix + hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:12]


def _suggestion(doc, slide, excerpt, ctype):
    return {
        "id": _hash_id("s_", doc.id, str(slide["slide"]), excerpt),
        "doc_id": doc.id,
        "doc_title": doc.title,
        "slide": slide["slide"],
        "type": ctype,
        "excerpt": excerpt,
        "card": card_from_excerpt(excerpt, ctype),  # chỉ dùng cho bộ thẻ của bot đối thủ, không hiện cho người học
        "linh_says": linh_says(ctype, excerpt, slide["title"]),
    }


def _suggest_offline(doc, slide):
    """0-2 gợi ý mỗi slide, chỉ từ các ý có dấu hiệu rõ và đủ nội dung."""
    if not slide_informative(slide):
        return []
    text = slide_text(slide)
    scored = []
    for pos, bullet in enumerate(slide["bullets"]):
        excerpt = _ws(bullet)
        if excerpt not in text:
            continue  # không phải chuỗi con nguyên văn -> bỏ
        ctype, score = classify_bullet(excerpt, slide["title"])
        if ctype is None:
            continue
        scored.append((score, pos, excerpt, ctype))
    scored.sort(key=lambda t: (-t[0], t[1]))
    out = []
    for _, _, excerpt, ctype in scored[:2]:
        out.append(_suggestion(doc, slide, excerpt, ctype))
    return out


MODEL_STATS = {"calls": 0, "tokens_in": 0, "tokens_out": 0, "seconds": 0.0}
_STATS_LOCK = threading.Lock()


def model_stats():
    """Số lần gọi model, token và tổng thời gian (cộng dồn từ lúc reset)."""
    with _STATS_LOCK:
        return dict(MODEL_STATS)


def reset_model_stats():
    with _STATS_LOCK:
        MODEL_STATS.update(calls=0, tokens_in=0, tokens_out=0, seconds=0.0)


def _extract_json(text):
    """Lấy JSON object từ chữ model trả: chịu được khối <think>, hàng rào ```json và chữ thừa quanh JSON."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text).strip()
    candidates = [text]
    start, end = text.find("{"), text.rfind("}")
    if 0 <= start < end:
        candidates.append(text[start:end + 1])
    for cand in candidates:
        try:
            data = json.loads(cand)
        except (ValueError, TypeError):
            continue
        if isinstance(data, dict):
            return data
    return None


def _call_json(call_model, system, user):
    """Gọi model và parse JSON; lỗi thì raise RuntimeError (server -> 502)."""
    t0 = time.perf_counter()
    resp = call_model(system, user)
    elapsed = time.perf_counter() - t0
    with _STATS_LOCK:
        MODEL_STATS["calls"] += 1
        MODEL_STATS["seconds"] += elapsed
        if isinstance(resp, dict):
            MODEL_STATS["tokens_in"] += int(resp.get("tokens_in") or 0)
            MODEL_STATS["tokens_out"] += int(resp.get("tokens_out") or 0)
    text = (resp.get("text") or "") if isinstance(resp, dict) else str(resp)
    data = _extract_json(text)
    if data is None:
        raise RuntimeError(
            "Model trả về dữ liệu không phải JSON hợp lệ — kiểm tra lại prompt hoặc chạy lại. "
            f"(đầu câu trả lời: {text.strip()[:120]!r})")
    return data


_SUGGEST_CACHE = {}


def clear_suggestion_cache():
    _SUGGEST_CACHE.clear()


def suggestions_for(doc, n):
    """Đoạn gợi ý của slide n (luật, không gọi model; cache theo (doc, slide)). Trả về list 0-2 gợi ý."""
    slide = next((c for c in doc.chunks if c["slide"] == n), None)
    if slide is None:
        return None
    key = (doc.id, n)
    if key not in _SUGGEST_CACHE:
        _SUGGEST_CACHE[key] = _suggest_offline(doc, slide)
    return _SUGGEST_CACHE[key]


# ---------------------------------------------------------------------------
# Chủ đề: nhóm 2-3 slide liên tiếp có gợi ý
# ---------------------------------------------------------------------------
def topics(doc):
    """Các chủ đề của tài liệu: nhóm 2-3 slide liên tiếp có gợi ý. Id ổn định."""
    has = []
    for c in doc.chunks:
        sugs = suggestions_for(doc, c["slide"])
        has.append(bool(sugs))
    out = []
    i = 0
    while i < len(doc.chunks):
        if not has[i]:
            i += 1
            continue
        group = [doc.chunks[i]]
        j = i + 1
        while j < len(doc.chunks) and has[j] and len(group) < 3:
            group.append(doc.chunks[j])
            j += 1
        if len(group) >= 2:
            slides = [c["slide"] for c in group]
            out.append({
                "id": _hash_id("t_", doc.id, ",".join(map(str, slides))),
                "title": group[0]["title"],
                "slides": slides,
            })
        i = max(j, i + 1)
    return out


# ---------------------------------------------------------------------------
# Bộ thẻ của 4 bot đối thủ
# ---------------------------------------------------------------------------
_SPECIALTY = {"hai": "mistake", "an": "example"}   # loại thẻ đúng sở trường, lấy trước
_SPECIALTY_CAP = 3                                 # tối đa số thẻ sở trường để còn thẻ bám chủ đề
_SECONDARY = {"hai": ("rule", "concept"), "an": ("rule", "concept"), "vy": ("concept", "rule")}
_DECK_SIZE = 5
_MAX_BOTS_PER_CARD = 2
_MAX_SHARED_BETWEEN_BOTS = 2


def _suggestion_card(doc, sug):
    c = dict(sug["card"])
    return {
        "id": _hash_id("c_", doc.id, str(sug["slide"]), sug["excerpt"]),
        "title": c["title"],
        "content": c["content"],
        "type": c["type"],
        "own": False,
        "source": {
            "doc_id": doc.id,
            "doc_title": doc.title,
            "slide": sug["slide"],
            "excerpt": sug["excerpt"],
        },
    }


def _cards_of_slides(doc, slide_numbers, seen):
    out = []
    for n in slide_numbers:
        for sug in suggestions_for(doc, n) or []:
            if sug["id"] not in seen:
                seen.add(sug["id"])
                out.append(_suggestion_card(doc, sug))
    return out


def _topic_tiers(doc, topic):
    """Thẻ ứng viên theo ba tầng: slide trong chủ đề; slide lân cận (cách ≤2, gần trước);
    phần còn lại của tài liệu xếp theo BM25 với nội dung chủ đề."""
    in_topic = sorted(topic["slides"]) if topic else []
    others = [c["slide"] for c in doc.chunks if c["slide"] not in in_topic]

    def dist(n):
        return in_topic[0] - n if n < in_topic[0] else n - in_topic[-1]

    near = sorted((n for n in others if dist(n) <= 2), key=lambda n: (dist(n), n)) if in_topic else []
    far = [n for n in others if n not in near]
    seen = set()
    t0 = _cards_of_slides(doc, in_topic, seen)
    t1 = _cards_of_slides(doc, near, seen)
    t2 = _cards_of_slides(doc, far, seen)
    if t2:
        by_n = {c["slide"]: c["text"] for c in doc.chunks}
        query = (topic["title"] if topic else "") + " " + " ".join(by_n.get(n, "") for n in in_topic)
        scores = rag.bm25_scores(query, [c["title"] + " " + c["content"] for c in t2])
        t2 = [c for _, c in sorted(zip(scores, t2), key=lambda p: -p[0])]  # sort ổn định
    return [t0, t1, t2]


def opponent_decks(doc, topic):
    """Bộ thẻ (<=5) cho mỗi bot đối thủ, dựng từ gợi ý của tài liệu theo sở trường:
    vy khái niệm/quy tắc, hai lỗi thường gặp (rồi quy tắc/khái niệm), an ví dụ (rồi quy tắc/khái niệm),
    minh thẻ ngắn nhất. Thẻ thuộc chủ đề lấy trước; thiếu thẻ đúng sở trường thì mở rộng sang slide lân
    cận rồi toàn tài liệu (BM25 với chủ đề) TRƯỚC khi lấy loại khác. Mỗi thẻ dùng cho tối đa 2 bot và
    hai bot bất kỳ chung nhau tối đa 2 thẻ, để ba sở trường khác nhau thật.
    Trả về {bot_id: [card...]}; mỗi card có own=False kèm source."""
    tiers = _topic_tiers(doc, topic)
    decks = {b["id"]: [] for b in BOTS}
    holders = {}  # card id -> các bot đang giữ thẻ đó

    def shared(a, b):
        return len({c["id"] for c in decks[a]} & {c["id"] for c in decks[b]})

    def can_add(bid, c):
        held = holders.get(c["id"], [])
        return (len(decks[bid]) < _DECK_SIZE and bid not in held and len(held) < _MAX_BOTS_PER_CARD
                and all(shared(bid, o) < _MAX_SHARED_BETWEEN_BOTS for o in held))

    def take(bid, cards, limit=_DECK_SIZE):
        added = 0
        for c in cards:
            if added >= limit or len(decks[bid]) >= _DECK_SIZE:
                break
            if can_add(bid, c):
                decks[bid].append(c)
                holders.setdefault(c["id"], []).append(bid)
                added += 1

    def shortest(cards):
        return sorted(cards, key=lambda c: (len(c["content"]), c["id"]))

    for bid in ("hai", "an", "vy", "minh"):  # người có sở trường hiếm chọn trước
        specialty = _SPECIALTY.get(bid)
        if specialty:
            left = _SPECIALTY_CAP
            for tier in tiers:  # chủ đề -> lân cận -> toàn tài liệu, đều trước khi lấy loại khác
                before = len(decks[bid])
                take(bid, [c for c in tier if c["type"] == specialty], left)
                left -= len(decks[bid]) - before
        for tier in tiers:
            for t in _SECONDARY.get(bid, ()):
                take(bid, [c for c in tier if c["type"] == t])
        for tier in tiers:  # còn thiếu chỗ: loại nào cũng được, thẻ ngắn trước (minh chỉ dùng bước này)
            take(bid, shortest(tier))
    return decks
