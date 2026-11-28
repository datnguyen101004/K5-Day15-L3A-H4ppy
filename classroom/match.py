"""Máy trạng thái trận đấu 1 đấu 1 của Lớp học tranh tài v2 + chiến lược của cô Linh và các bot.

Pha: pick -> question -> scored -> question -> ... -> scored (câu 3) -> review.
Hai thí sinh: `player` (bot của người chơi) và một bot đối thủ (minh | vy | hai | an).
Thứ tự phát biểu: câu 1 đối thủ trước, câu 2 player trước (đổi lượt), câu 3 lại đối thủ trước.
Câu 3 (phản biện): mỗi bot phản biện câu trả lời câu 2 của bot kia.

Chế độ offline: câu hỏi dựng từ mẫu (sample: true), bot trả lời chỉ bằng thẻ của mình
(BM25 + cụm then chốt của rag.py), cô Linh chấm theo độ phủ tiêu chí.
Chế độ model: mọi lời qua call_model, JSON nghiêm ngặt (lỗi -> RuntimeError -> HTTP 502).
Số lần gọi model mỗi trận tối thiểu: câu 1+2 soạn chung một lần; hai bot trả lời song song;
cô Linh chấm cả hai câu trả lời trong một lần; câu 3 không cần soạn (dựng từ kết quả chấm câu 2).
"""
import random
import re
import uuid
import zlib
from concurrent.futures import ThreadPoolExecutor

from . import coach, rag
from .coach import ApiError, BOTS, BOT_BY_ID, PLAYER_COLOR, PLAYER_PERSONA, _call_json

DEFAULT_OPPONENT = "vy"
OPPONENTS = tuple(b["id"] for b in BOTS)
KINDS = ["recall", "apply", "rebuttal"]
DIMENSIONS = {"recall": "correctness", "apply": "application", "rebuttal": "rebuttal"}
MAX_CARDS = 5
RELEVANCE_THRESHOLD = 0.3  # tỉ lệ từ nội dung của chủ đề câu hỏi có trong thẻ thì bot mới dám chắc

NO_NITPICK = "Không bắt bẻ những ý đã trả lời đúng"
# Từ chê trong một câu phản biện: câu có từ này mà nhắc lại ý người kia đã đúng là bắt bẻ sai
_CRITIQUE_WORDS = (" sai ", "không đúng", "chưa đúng", " thiếu ", "bắt bẻ", "chưa nói", "bỏ sót",
                   " quên ", "nhầm")
# Mẫu tình huống cho câu "apply" — KHÔNG lặp lại câu chữ của slide và không nhắc số slide (thí sinh không xem slide)
_APPLY_TEMPLATES = [
    "Tình huống: một nhóm học sinh muốn xây dựng {kw} cho lớp mình nhưng chưa biết bắt đầu từ đâu. "
    "Áp dụng kiến thức về “{title}”, nhóm NÊN làm gì và TẠI SAO?",
    "Tình huống: trong dự án của lớp, {kw} bị làm lặp đi lặp lại gây lãng phí. "
    "Dựa vào kiến thức về “{title}”, cả lớp cần xử lý như thế nào?",
    "Tình huống: một bạn trong lớp định làm {kw} theo ý mình mà không theo hướng dẫn. "
    "Dựa vào kiến thức về “{title}”, em khuyên bạn ấy điều gì và vì sao?",
    "Tình huống: cô giao bài tập về {kw}, yêu cầu cả lớp làm việc có kế hoạch rõ ràng. "
    "Theo kiến thức về “{title}”, các bạn nên tổ chức công việc ra sao?",
    "Tình huống: {kw} của một bạn bị sai liên tục mà không rõ nguyên nhân. "
    "Áp dụng kiến thức về “{title}”, cả lớp nên kiểm tra và sửa như thế nào?",
]


def _order(opponent, qindex):
    """Thứ tự phát biểu: đối thủ trước ở câu 1 và 3; player trước ở câu 2."""
    return ["player", opponent] if qindex == 1 else [opponent, "player"]


# ---------------------------------------------------------------------------
# Truy xuất thẻ của một bot (BM25 nhỏ trên title + content của chính bot đó)
# ---------------------------------------------------------------------------
def _ctokens(text):
    """Token nội dung (đã bỏ từ dừng, bỏ dấu) — để truy xuất không bị lệch bởi 'trong', 'của'…"""
    return [k for k, _ in rag.content_tokens(text)]


def _bm25_rank(query, cards, k=3):
    """BM25 trên title + content của CHÍNH các thẻ truyền vào; chỉ trả thẻ có từ nội dung trùng."""
    scores = rag.bm25_scores(query, [c["title"] + " " + c["content"] for c in cards])
    ranked = sorted(((s, i) for i, s in enumerate(scores) if s > 0), key=lambda x: (-x[0], x[1]))
    return [(cards[i], s) for s, i in ranked[:k]]


def _question_focus(q, target=None):
    """Phần chủ đề của câu hỏi: các đoạn trong “ ” (tên slide); câu phản biện thì là lời người bị
    phản biện. Khung câu hỏi mẫu ('Trình bày đầy đủ…', 'Tình huống…') không tham gia truy xuất."""
    if target:
        return target["text"]
    quoted = re.findall(r"“([^”]+)”", q["text"])
    return " ".join(quoted) if quoted else q["text"]


def _uncovered_part(q, target=None):
    """Phần câu hỏi bot nói là chưa chắc: tên slide trong câu hỏi, hoặc phần đầu lời người bị phản biện."""
    if target:
        phrase = target["text"]
    else:
        quoted = re.findall(r"“([^”]+)”", q["text"])
        if not quoted:
            toks = rag.content_tokens(q["text"])
            return max(toks, key=lambda t: len(t[0]))[1] if toks else "điều này"
        phrase = quoted[0]
    words = phrase.split()
    return " ".join(words[:7]) + ("…" if len(words) > 7 else "")


def _overlap_ratio(focus, card):
    q = set(_ctokens(focus))
    if not q:
        return 0.0
    return len(q & set(_ctokens(card["title"] + " " + card["content"]))) / len(q)


def _sentence(text):
    text = text.strip()
    return text if text.endswith((".", "!", "?", "…")) else text + "."


# ---------------------------------------------------------------------------
# Tiêu chí, độ phủ và ngữ cảnh phản biện (dùng chung cho offline và model)
# ---------------------------------------------------------------------------
def _criteria_for(q, cid):
    """Danh sách tiêu chí dùng để đánh giá câu trả lời của cid ở câu q (không gồm tiêu chí hành vi)."""
    return q["_ctx"][cid]["missed"] if q["kind"] == "rebuttal" else q["_rubric"]


def _covered_flags(q, ans):
    """[(tiêu chí, đã nêu đủ?)] cho câu trả lời `ans`: theo chấm của model nếu có, không thì theo cụm then chốt."""
    crits = _criteria_for(q, ans["by"])
    idx = ans.get("_covered_idx")
    if idx is not None:
        return [(c, i in idx) for i, c in enumerate(crits)]
    ratios = rag.bullet_ratios([c["excerpt"] for c in crits], ans["text"]) if crits else []
    return [(c, r >= 1.0) for c, (_, r) in zip(crits, ratios)]


def _crit_ref(c):
    """Tiêu chí kèm số slide, dùng trong lời nhận xét của cô Linh."""
    return f"{c['criterion']} (slide {c['slide']})"


def _rebuttal_contexts(match):
    """Ngữ cảnh phản biện cho từng bot: mỗi bot phản biện câu trả lời câu 2 của bot kia.
    ctx[critic] = {target:{by,text}, missed, covered, rubric} — missed/covered là tiêu chí câu 2
    mà bot bị phản biện bỏ sót / đã nêu đủ; rubric = missed + 'không bắt bẻ ý đã đúng'."""
    q1 = match.questions[1]
    per_target = {}
    for ans in q1["answers"]:
        flags = _covered_flags(q1, ans)
        per_target[ans["by"]] = {
            "target": {"by": ans["by"], "text": ans["text"]},
            "missed": [c for c, f in flags if not f], "covered": [c for c, f in flags if f]}
    ctxs = {}
    for critic in match.cids:
        t = per_target[match.other(critic)]
        anchor = (t["covered"] or q1["_rubric"])[0]
        ctxs[critic] = dict(t, rubric=list(t["missed"]) + [{
            "criterion": NO_NITPICK, "slide": anchor["slide"], "excerpt": anchor["excerpt"]}])
    return ctxs


def _rebuttal_question(match, ctxs, sample, text=None):
    """Câu 3 dùng chung: rubric hiển thị ở review = hợp các tiêu chí bị bỏ sót của hai bên."""
    names = [match.contestants[c]["name"] for c in match.cids]
    if text is None:
        text = (f"Câu 3 (phản biện): {names[0]} và {names[1]} phản biện câu trả lời câu 2 của nhau. "
                f"Theo tài liệu, bạn kia đúng ở đâu, còn thiếu ý nào quan trọng?")
    rubric, seen = [], set()
    for ctx in ctxs.values():
        for c in ctx["missed"]:
            if c["excerpt"] not in seen:
                seen.add(c["excerpt"])
                rubric.append(c)
    rubric.append(next(iter(ctxs.values()))["rubric"][-1])
    return {
        "index": 2, "kind": "rebuttal", "text": text, "sample": sample, "dimension": "rebuttal",
        "target": None,
        "targets": [{"by": a["by"], "text": a["text"]} for a in match.questions[1]["answers"]],
        "_target_slide": match.questions[1]["_target_slide"], "_rubric": rubric, "_ctx": ctxs,
    }


# ---------------------------------------------------------------------------
# Chiến lược offline
# ---------------------------------------------------------------------------
class OfflineCoach:
    """Không gọi model: câu hỏi từ mẫu, bot trả lời bằng thẻ của mình, chấm theo độ phủ."""

    def __init__(self, doc, rng):
        self.doc = doc
        self.rng = rng

    # ---------- câu hỏi + tiêu chí ----------
    def _target_slide(self, match, qindex):
        slides = match.topic["slides"] if match.topic else [c["slide"] for c in self.doc.chunks]
        if not slides:
            slides = [c["slide"] for c in self.doc.chunks]
        # câu 1 và câu 2 nên hỏi slide khác nhau nếu có thể
        pool = list(slides)
        if qindex == 1 and len(pool) > 1:
            used = {match.questions[0]["_target_slide"]} if match.questions else set()
            pool = [s for s in pool if s not in used] or list(slides)
        return self.rng.choice(pool)

    def _slide(self, n):
        return next(c for c in self.doc.chunks if c["slide"] == n)

    def _rubric(self, slide, limit=5):
        return [{"criterion": coach._ws(b), "slide": slide["slide"], "excerpt": coach._ws(b)}
                for b in slide["bullets"][:limit]]

    def _kw(self, slide):
        toks = [d for k, d in rag.content_tokens(slide["title"])]
        return " ".join(toks[:3]) if toks else slide["title"].lower()

    def make_question(self, match, qindex):
        kind = KINDS[qindex]
        if kind == "rebuttal":
            return _rebuttal_question(match, _rebuttal_contexts(match), sample=True)
        n = self._target_slide(match, qindex)
        slide = self._slide(n)
        if kind == "recall":
            text = (f"Câu {qindex + 1} (nhớ lại kiến thức): Trình bày đầy đủ các ý quan trọng "
                    f"về “{slide['title']}”.")
        else:
            # gốc cố định theo (tài liệu, slide) để đấu lại (variant + 1) chắc chắn ra mẫu tình huống khác
            base = zlib.crc32(f"{match.doc.id}|{n}".encode("utf-8"))
            t_idx = (base + match.variant) % len(_APPLY_TEMPLATES)
            text = _APPLY_TEMPLATES[t_idx].format(n=n, title=slide["title"], kw=self._kw(slide))
        return {
            "index": qindex, "kind": kind, "text": text, "sample": True,
            "dimension": DIMENSIONS[kind], "target": None,
            "_target_slide": n, "_rubric": self._rubric(slide),
        }

    # ---------- bot trả lời ----------
    def answer_all(self, match, qindex, cids):
        return [self.answer(match, qindex, cid) for cid in cids]

    def answer(self, match, qindex, cid):
        q = match.questions[qindex]
        cards = match.contestants[cid]["_cards"]
        target = q["_ctx"][cid]["target"] if q["kind"] == "rebuttal" else None
        gap = _uncovered_part(q, target)
        unsure_text = f"Mình chưa chắc về “{gap}” vì sổ tay chưa có thẻ nào nói tới."
        if not cards:
            return {"by": cid, "target": target,
                    "text": "Mình chưa có thẻ nào trong sổ tay nên chưa trả lời được câu này.",
                    "used_cards": [], "unsure": unsure_text}
        focus = _question_focus(q, target)
        forced = None
        if cid == "player" and qindex == 2 and match.reminder.get("card_id"):
            forced = next((c for c in cards if c["id"] == match.reminder["card_id"]), None)
        chosen = [forced] if forced is not None else []
        ranked = [c for c, _ in _bm25_rank(focus, cards, k=len(cards))]
        if cid == "an":  # An ưu tiên thẻ ví dụ liên quan trong sổ tay của mình
            example = next((c for c in ranked if c["type"] == "example"), None)
            if example is not None and example not in chosen:
                chosen.append(example)
        for c in ranked:
            if c not in chosen and len(chosen) < 2:
                chosen.append(c)
        if not chosen:  # không thẻ nào chạm tới câu hỏi: không mượn chữ của tài liệu
            return {"by": cid, "target": target,
                    "text": "Mình chưa biết câu này — sổ tay của mình không có thẻ nào nói tới.",
                    "used_cards": [], "unsure": unsure_text}
        best_rel = max(_overlap_ratio(focus, c) for c in chosen)
        text, used = self._compose(cid, chosen, q)
        return {"by": cid, "target": target, "text": text,
                "used_cards": [self._card_ref(c) for c in used],
                "unsure": unsure_text if best_rel < RELEVANCE_THRESHOLD else None}

    def _card_ref(self, c):
        return {"id": c["id"], "title": c["title"], "type": c["type"]}

    def _compose(self, cid, chosen, q):
        """Câu trả lời chỉ ghép từ nội dung các thẻ đã chọn, theo văn phong của từng bot.
        Trả về (văn bản, các thẻ thực sự được dùng trong văn bản)."""
        parts, used = [], []
        if cid == "minh":
            content = chosen[0]["content"]
            parts.append(content if len(content) <= 160 else content[:157].rsplit(" ", 1)[0] + "…")
            used = [chosen[0]]
        elif cid == "vy":
            for c in chosen[:2]:
                src = f" (theo slide {c['source']['slide']})" if c.get("source") else ""
                parts.append(f"{c['content']}{src}")
            used = chosen[:2]
        elif cid == "hai":
            mistakes = [c for c in chosen if c["type"] == "mistake"]
            lead = mistakes[0] if mistakes else chosen[0]
            label = "thẻ lỗi" if lead["type"] == "mistake" else "thẻ"
            parts.append(f"Theo {label} “{lead['title']}”: {lead['content']}")
            used = [lead]
            others = [c for c in chosen if c is not lead]
            if others and q["kind"] == "rebuttal":
                parts.append(f"Câu trả lời kia chưa nói tới điều này, theo thẻ “{others[0]['title']}”: "
                             f"{others[0]['content']}")
                used.append(others[0])
            elif others:
                parts.append(f"Ngoài ra: {others[0]['content']}")
                used.append(others[0])
        elif cid == "an":
            examples = [c for c in chosen if c["type"] == "example"]
            others = [c for c in chosen if c["type"] != "example"]
            if examples:
                parts.append(f"Ví dụ trong thẻ “{examples[0]['title']}”: {examples[0]['content']}")
                used.append(examples[0])
            else:
                parts.append("Mình chưa có thẻ ví dụ nào cho phần này")
            for c in others[:1]:
                parts.append(f"Theo thẻ “{c['title']}”: {c['content']}")
                used.append(c)
        else:  # bot của người chơi: thẻ liên quan nhất, văn phong thường
            for c in chosen[:2]:
                parts.append(c["content"])
            used = chosen[:2]
        return " ".join(_sentence(p) for p in parts if p), used

    # ---------- chấm ----------
    def grade_all(self, match, qindex, answers):
        return [self.grade(match, qindex, a) for a in answers]

    def grade(self, match, qindex, answer):
        q = match.questions[qindex]
        if q["kind"] == "rebuttal":
            score, comment = self._grade_rebuttal(q["_ctx"][answer["by"]], answer["text"])
        else:
            rubric = q["_rubric"]
            ratios = rag.bullet_ratios([c["excerpt"] for c in rubric], answer["text"])
            covered = [_crit_ref(c) for c, (_, r) in zip(rubric, ratios) if r >= 1.0]
            missing = [_crit_ref(c) for c, (_, r) in zip(rubric, ratios) if r < 1.0]
            cov = sum(r for _, r in ratios) / len(ratios) if ratios else 0.0
            score = max(0, min(10, round(10 * cov)))
            comment = (f"Trả lời đúng ý: {', '.join(covered) if covered else 'chưa có ý nào'}; "
                       f"còn thiếu: {', '.join(missing) if missing else 'không'}.")
        return {"score": score, "comment": comment}

    @staticmethod
    def _grade_rebuttal(ctx, text):
        """Chấm phản biện 0-10: tối đa 8 điểm cho tỉ lệ ý bị thiếu mà phản biện nêu ĐÚNG (nêu trọn một
        ý mới tính đủ, nêu lấp lửng chỉ tính bình phương tỉ lệ), +2 nếu không bắt bẻ ý người kia đã
        đúng; mỗi ý đúng bị bắt bẻ (câu có từ chê như 'sai', 'thiếu' mà nhắc lại ý đó) trừ 2.
        Phản biện chung chung không nêu ý nào chỉ được 2 điểm."""
        missed, covered = ctx["missed"], ctx["covered"]
        m_ratios = [r for _, r in rag.bullet_ratios([c["excerpt"] for c in missed], text)] if missed else []
        named_frac = (sum(r ** 2 for r in m_ratios) / len(missed)) if missed else 1.0
        critic = " ".join(s for s in re.split(r"(?<=[.!?])\s+", text)
                          if any(w in " " + rag.normalize(s) + " " for w in _CRITIQUE_WORDS))
        attacked = [c["criterion"] for c, (_, r) in
                    zip(covered, rag.bullet_ratios([c["excerpt"] for c in covered], critic))
                    if r >= 1.0] if critic and covered else []
        score = round(8 * named_frac) + (2 if not attacked else 0) - 2 * len(attacked)
        score = max(0, min(10, score))
        right = [c["criterion"] for c, r in zip(missed, m_ratios) if r >= 1.0]
        left = [c["criterion"] for c, r in zip(missed, m_ratios) if r < 1.0]
        if right:
            comment = f"Phản biện chỉ ra đúng ý còn thiếu: {', '.join(right)}; "
            comment += f"còn bỏ sót: {', '.join(left)}. " if left else "đã nêu đủ các ý còn thiếu. "
        else:
            comment = "Phản biện còn chung chung, chưa chỉ ra trọn ý nào bị thiếu"
            comment += f" (còn thiếu: {', '.join(left)}). " if left else ". "
        comment += (f"Bắt bẻ ý người kia đã đúng: {', '.join(attacked)}." if attacked
                    else "Không bắt bẻ ý đã đúng.")
        return score, comment


# ---------------------------------------------------------------------------
# Chiến lược model: mọi lời của cô Linh và bot qua call_model, JSON nghiêm ngặt
# ---------------------------------------------------------------------------
LINH_SYSTEM = (
    "Bạn là Cô Linh, giáo viên điều phối lớp học tranh tài. Bạn là người DUY NHẤT được xem tài liệu "
    "gốc và tiêu chí chấm. Mọi lời đều bằng tiếng Việt. Chỉ trả về MỘT JSON object hợp lệ, "
    "không thêm chữ nào ngoài JSON, không bọc trong ```."
)
_STYLE = {
    "minh": "trả lời nhanh, ngắn: đúng 1 câu ngắn gọn",
    "vy": "bám sát tài liệu: dùng nội dung thẻ và dẫn 'theo slide n' khi thẻ có ghi nguồn",
    "hai": "giỏi phát hiện lỗi: nêu thẳng lỗi/sai lầm thường gặp; khi phản biện thì chỉ rõ ý người kia bỏ sót",
    "an": "giỏi đưa ví dụ: nêu ví dụ áp dụng lấy từ thẻ ví dụ; nếu sổ tay chưa có thẻ ví dụ thì nói thật là chưa có",
    "player": "văn phong bình thường, tự nhiên; dùng 1–2 thẻ liên quan nhất",
}
_RUBRIC_SCHEMA = '"rubric":[{"criterion":"...","slide":N,"excerpt":"..."}]'


def _slide_text_block(slide):
    return f"Slide {slide['slide']} — {slide['title']}\n{slide['text']}"


class ModelCoach:
    def __init__(self, doc, call_model, rng):
        self.doc = doc
        self.call_model = call_model
        self.rng = rng
        self._apply_q = None  # câu 2 được soạn cùng lượt gọi với câu 1

    def _slide(self, n):
        return next(c for c in self.doc.chunks if c["slide"] == n)

    # ---------- câu hỏi + tiêu chí: 1 lượt gọi cho câu 1 và 2 ----------
    def _validated_rubric(self, items, slide):
        text, rubric = coach.slide_text(slide), []
        for item in items if isinstance(items, list) else []:
            if not isinstance(item, dict):
                continue
            excerpt = coach._ws(str(item.get("excerpt") or ""))
            if excerpt and excerpt in text:  # trích dẫn phải nguyên văn
                rubric.append({"criterion": coach._ws(str(item.get("criterion") or excerpt)),
                               "slide": slide["slide"], "excerpt": excerpt})
        return rubric[:5] or [{"criterion": coach._ws(b), "slide": slide["slide"], "excerpt": coach._ws(b)}
                              for b in slide["bullets"][:5]]

    def _question_dict(self, qindex, text, slide, rubric):
        kind = KINDS[qindex]
        return {"index": qindex, "kind": kind, "text": text, "sample": False,
                "dimension": DIMENSIONS[kind], "target": None,
                "_target_slide": slide["slide"], "_rubric": rubric}

    def make_question(self, match, qindex):
        if qindex == 2:
            # Câu 3 dựng từ kết quả chấm câu 2 (không cần thêm lượt gọi model)
            return _rebuttal_question(match, _rebuttal_contexts(match), sample=True)
        if qindex == 1 and self._apply_q is not None:
            q, self._apply_q = self._apply_q, None
            return q
        slides = match.topic["slides"] if match.topic else [c["slide"] for c in self.doc.chunks]
        v = match.variant
        n0, n1 = slides[v % len(slides)], slides[(v + 1) % len(slides)]
        s0, s1 = self._slide(n0), self._slide(n1)
        extra = (f"\nĐây là lần đấu lại thứ {v}: hãy chọn tình huống và cách hỏi KHÁC thường lệ."
                 if v else "")
        user = (
            f"Chủ đề trận đấu: {match.topic['title'] if match.topic else match.doc.title}.\n"
            "Soạn 2 câu hỏi, mỗi câu kèm 3–5 tiêu chí chấm:\n"
            f"1) \"recall\": nhớ kiến thức của slide {n0} — hỏi khái niệm/quy tắc chính bằng tên của nó.\n"
            f"2) \"apply\": áp dụng vào một TÌNH HUỐNG MỚI cụ thể (một người hoặc nhóm đang đứng trước một "
            f"quyết định) dựa trên slide {n1}; KHÔNG chép câu chữ của slide; hỏi nên làm gì và vì sao.\n"
            "Thí sinh KHÔNG được xem slide: trong \"text\" của câu hỏi tuyệt đối không nhắc số slide hay "
            "'theo slide/tài liệu'; hỏi thẳng vào nội dung.\n"
            "Mỗi tiêu chí gồm: \"criterion\" (≤20 từ), \"slide\" (số slide), \"excerpt\" = đoạn chép NGUYÊN VĂN, "
            "từng chữ, từ slide.\n"
            "Định dạng: {\"recall\":{\"text\":\"...\"," + _RUBRIC_SCHEMA + "},"
            "\"apply\":{\"text\":\"...\"," + _RUBRIC_SCHEMA + "}}" + extra + "\n\n"
            + _slide_text_block(s0) + ("\n\n" + _slide_text_block(s1) if n1 != n0 else "")
        )
        data = _call_json(self.call_model, LINH_SYSTEM, user)
        out = {}
        for key, qi, slide in (("recall", 0, s0), ("apply", 1, s1)):
            item = data.get(key) if isinstance(data, dict) else None
            text = str(item.get("text") or "").strip() if isinstance(item, dict) else ""
            if not text:
                raise RuntimeError(f"Model không soạn được câu hỏi '{key}' — chạy lại hoặc kiểm tra prompt.")
            out[qi] = self._question_dict(qi, text, slide, self._validated_rubric(item.get("rubric"), slide))
        if qindex == 0:
            self._apply_q = out[1]  # câu 2 dùng lại ở lượt mở câu 2, không gọi model lần nữa
        return out[qindex]

    # ---------- bot trả lời (hai bot gọi song song, độc lập) ----------
    def answer_all(self, match, qindex, cids):
        if len(cids) == 1:
            return [self.answer(match, qindex, cids[0])]
        with ThreadPoolExecutor(max_workers=len(cids)) as pool:
            futures = [pool.submit(self.answer, match, qindex, cid) for cid in cids]
            return [f.result() for f in futures]

    @staticmethod
    def _transcript(match, upto):
        lines = []
        for q in match.questions[:upto]:
            lines.append(f"Câu {q['index'] + 1} ({q['kind']}): {q['text']}")
            for a in q.get("answers", []):
                lines.append(f"  - {match.contestants[a['by']]['name']}: {a['text']}")
        return "\n".join(lines) or "(chưa có)"

    def answer(self, match, qindex, cid):
        q = match.questions[qindex]
        me = match.contestants[cid]
        cards = me["_cards"]
        target = q["_ctx"][cid]["target"] if q["kind"] == "rebuttal" else None
        cards_txt = "\n".join(
            f"- [{c['id']}] ({c['type']}) {c['title']}: {c['content']}"
            + (f" (nguồn: slide {c['source']['slide']})" if c.get("source") else "")
            for c in cards) or "(sổ tay trống)"
        system = (
            f"Bạn là {me['name']}, một bạn học trong lớp tranh tài. Tính cách: {me['persona']}. "
            f"Văn phong: {_STYLE[cid]}.\n"
            "QUY TẮC TUYỆT ĐỐI: chỉ được trả lời bằng nội dung các THẺ trong sổ tay của bạn; không dùng kiến "
            "thức nào khác, không bịa. Thẻ không đủ thì vẫn nói phần thẻ nói được và ghi vào \"unsure\" một câu "
            "nêu rõ phần nào chưa chắc vì sổ tay chưa có thẻ nói tới; không có thẻ nào liên quan thì nói thẳng "
            "là chưa biết. Trả lời tối đa 4 câu, tiếng Việt, gọi thẻ bằng tiêu đề nếu cần — KHÔNG ghi mã thẻ (dạng "
            "c_...) trong câu trả lời. Chỉ trả về MỘT JSON object, không thêm chữ nào "
            "ngoài JSON: {\"answer\":\"...\",\"used_card_ids\":[\"id thẻ bạn thực sự dùng\"],"
            "\"unsure\":\"...\" hoặc null}."
        )
        ask = (f"Câu hỏi hiện tại ({q['kind']}): {q['text']}\n"
               "(Bạn không xem được slide hay tài liệu gốc: nếu câu hỏi nhắc tới slide, cứ đối chiếu NỘI DUNG câu "
               "hỏi với nội dung các thẻ và dùng thẻ nào nói về cùng vấn đề.)")
        if target:
            ask += (f"\nBạn phản biện câu trả lời của {match.contestants[target['by']]['name']} ở câu 2: "
                    f"\"{target['text']}\"\nHãy chỉ ra họ đúng ở đâu và còn thiếu ý nào (dựa vào thẻ của bạn).")
        if cid == "player" and qindex == 2 and match.reminder.get("card_id"):
            ask += (f"\nBạn vừa được nhắc bài: hãy xem lại và ưu tiên dùng thẻ [{match.reminder['card_id']}] "
                    "trước tiên (nếu thẻ liên quan).")
        user = (f"Sổ tay của bạn:\n{cards_txt}\n\nDiễn biến trận đấu từ đầu:\n"
                f"{self._transcript(match, qindex)}\n\n{ask}")
        data = _call_json(self.call_model, system, user)
        answer = str(data.get("answer") or "").strip() if isinstance(data, dict) else ""
        if not answer:
            raise RuntimeError(f"Model trả về câu trả lời rỗng cho bot {me['name']} — chạy lại.")
        by_id = {c["id"]: c for c in cards}
        used_ids = [i for i in (data.get("used_card_ids") or []) if isinstance(i, str)]
        used = [by_id[i] for i in dict.fromkeys(used_ids) if i in by_id]  # chỉ giữ thẻ của chính mình
        unsure = data.get("unsure")
        unsure = coach._ws(str(unsure)) if unsure and str(unsure).strip().lower() not in ("null", "none") else None
        return {"by": cid, "target": target, "text": answer, "unsure": unsure,
                "used_cards": [{"id": c["id"], "title": c["title"], "type": c["type"]} for c in used]}

    # ---------- chấm: 1 lượt gọi cho cả hai câu trả lời ----------
    def grade_all(self, match, qindex, answers):
        q = match.questions[qindex]
        rebuttal = q["kind"] == "rebuttal"
        blocks = []
        for a in answers:
            name = match.contestants[a["by"]]["name"]
            if rebuttal:
                ctx = q["_ctx"][a["by"]]
                missed = "\n".join(f"    [{i}] {c['criterion']}" for i, c in enumerate(ctx["missed"])) or "    (không có)"
                right = "\n".join(f"    - {c['criterion']}" for c in ctx["covered"]) or "    (không có)"
                blocks.append(
                    f"### by=\"{a['by']}\" ({name}) phản biện câu trả lời câu 2 của "
                    f"{match.contestants[ctx['target']['by']]['name']}: \"{ctx['target']['text']}\"\n"
                    f"  Ý còn THIẾU trong câu trả lời bị phản biện (đánh số):\n{missed}\n"
                    f"  Ý bị phản biện đã nêu ĐÚNG (không được bắt bẻ):\n{right}\n"
                    f"  Lời phản biện của {name}: \"{a['text']}\"")
            else:
                blocks.append(f"### by=\"{a['by']}\" ({name}) trả lời: \"{a['text']}\"")
        if rebuttal:
            rule = ("Chấm 0–10 mỗi lời phản biện: điểm cao khi chỉ ra ĐÚNG và cụ thể nhiều ý còn thiếu; thấp khi "
                    "chung chung; trừ điểm nếu bắt bẻ ý đã đúng. \"covered\" = danh sách số thứ tự các ý còn "
                    "THIẾU mà lời phản biện đã nêu đúng.")
        else:
            rule = ("Chấm 0–10 mỗi câu trả lời theo chiều "
                    + ("ĐÚNG KIẾN THỨC (nêu đủ, đúng các ý của slide)" if q["kind"] == "recall"
                       else "ÁP DỤNG (đề xuất hành động cụ thể phù hợp tình huống, có lý do bám slide)")
                    + ". Chấp nhận diễn đạt khác chữ nếu cùng ý. \"covered\" = danh sách số thứ tự các tiêu chí "
                      "mà câu trả lời đã nêu đủ.")
        crit_txt = ("" if rebuttal else "Tiêu chí chấm (đánh số):\n" + "\n".join(
            f"  [{i}] (slide {c['slide']}) {c['criterion']} — slide viết: \"{c['excerpt']}\""
            for i, c in enumerate(q["_rubric"])) + "\n")
        user = (f"Câu hỏi ({q['kind']}): {q['text']}\n{crit_txt}\n{rule}\n"
                "Nhận xét (\"comment\") 1–2 câu tiếng Việt nêu cái đúng và cái còn thiếu bằng NỘI DUNG của ý (không ghi "
                "số thứ tự như [0]), BẮT BUỘC ghi số slide của từng ý nhắc tới (vd \"theo slide 3\").\n"
                "Định dạng: {\"grades\":[{\"by\":\"<id>\",\"score\":0-10,\"comment\":\"...\",\"covered\":[0,2]}]} "
                "— đúng một phần tử cho mỗi 'by' dưới đây.\n\n" + "\n\n".join(blocks))
        data = _call_json(self.call_model, LINH_SYSTEM, user)
        items = data.get("grades") if isinstance(data, dict) else None
        if not isinstance(items, list):
            raise RuntimeError("Model chấm điểm trả về JSON thiếu mảng 'grades' — chạy lại.")
        by = {str(i.get("by")): i for i in items if isinstance(i, dict)}
        verdicts = []
        for a in answers:
            item = by.get(a["by"])
            if item is None:
                raise RuntimeError(f"Model chấm điểm bỏ sót bot '{a['by']}' — chạy lại.")
            try:
                score = max(0, min(10, round(float(item.get("score")))))
            except (TypeError, ValueError):
                raise RuntimeError("Model trả về điểm không hợp lệ — chạy lại câu hỏi.")
            n_crit = len(q["_ctx"][a["by"]]["missed"] if rebuttal else q["_rubric"])
            idx = [i for i in (item.get("covered") or []) if isinstance(i, int) and 0 <= i < n_crit]
            verdicts.append({"score": score, "covered_idx": sorted(set(idx)),
                             "comment": coach._ws(str(item.get("comment") or "Cô Linh chấm theo tiêu chí của slide."))})
        return verdicts


# ---------------------------------------------------------------------------
# Trận đấu
# ---------------------------------------------------------------------------
class Match:
    def __init__(self, doc, topic=None, bot_name="Bé Bot", rematch_of=None, variant=0,
                 call_model=None, seed=None, mode_note=None, opponent=DEFAULT_OPPONENT):
        if opponent not in OPPONENTS:
            raise ApiError(400, f"Đối thủ '{opponent}' không có — chọn một trong: {', '.join(OPPONENTS)}.")
        self.id = "m_" + uuid.uuid4().hex[:12]
        self.doc = doc
        self.mode = "model" if call_model else "offline"
        self.mode_note = mode_note
        self.opponent = opponent
        self.cids = [opponent, "player"]
        self.rng = random.Random(seed if seed is not None else random.randrange(1 << 30))
        self.coach = ModelCoach(doc, call_model, self.rng) if call_model \
            else OfflineCoach(doc, self.rng)
        self.topic = topic
        self.variant = variant
        self.rematch_of = rematch_of
        self.bot_name = bot_name or "Bé Bot"
        self.phase = "pick"
        self.qindex = 0
        self.questions = []
        self.reminder = {"available": True, "card_id": None}
        self.review = None
        self._log_seq = 0
        self.log = []
        decks = coach.opponent_decks(doc, topic)
        bot = BOT_BY_ID[opponent]
        self.contestants = {
            "player": {
                "id": "player", "name": self.bot_name, "kind": "player_bot",
                "persona": PLAYER_PERSONA, "color": PLAYER_COLOR, "score": 0, "_cards": [],
            },
            opponent: {
                "id": opponent, "name": bot["name"], "kind": "bot",
                "persona": bot["persona"], "color": bot["color"], "score": 0,
                "_cards": decks.get(opponent, []),
            },
        }
        self._log("linh", "intro",
                  f"Cô Linh chào lớp! Trận 1 đấu 1: {self.bot_name} gặp {bot['name']} về chủ đề "
                  f"“{topic['title'] if topic else doc.title}”. Chọn tối đa {MAX_CARDS} thẻ cho bot của bạn.")

    def other(self, cid):
        return self.cids[1] if cid == self.cids[0] else self.cids[0]

    # ---------- log ----------
    def _log(self, by, kind, text, used_cards=None):
        self._log_seq += 1
        entry = {"seq": self._log_seq, "by": by, "kind": kind, "text": text}
        if used_cards is not None:
            entry["used_cards"] = used_cards
        self.log.append(entry)
        return entry

    # ---------- hành động ----------
    def set_cards(self, cards):
        if self.phase != "pick":
            raise ApiError(409, f"Trận đang ở pha '{self.phase}' — chỉ chọn thẻ được ở pha 'pick'.")
        if not isinstance(cards, list) or not (1 <= len(cards) <= MAX_CARDS):
            raise ApiError(400, f"Cần chọn từ 1 đến {MAX_CARDS} thẻ để mang vào trận.")
        norm = []
        for c in cards:
            ctype = c.get("type")
            if ctype not in coach.CARD_TYPES:
                raise ApiError(400, f"Thẻ '{c.get('title', '?')}' có type '{ctype}' không hợp lệ "
                                    f"— phải là một trong: {', '.join(coach.CARD_TYPES)}.")
            norm.append({
                "id": str(c.get("id") or coach._hash_id("c_", "own", str(c.get("title")), str(c.get("content")))),
                "title": str(c.get("title") or "")[:120],
                "content": str(c.get("content") or ""),
                "type": ctype,
                "own": bool(c.get("own", True)),
                "source": c.get("source") if isinstance(c.get("source"), dict) else None,
            })
        self.contestants["player"]["_cards"] = norm
        self._open_question(0)  # lỗi model (nếu có) bay ra TRƯỚC khi đổi pha: gọi lại được
        self.phase = "question"
        self.qindex = 0
        self._log("player", "system", f"{self.bot_name} mang {len(norm)} thẻ vào trận.")
        return self.state()

    def remind(self, card_id):
        if self.phase != "question" or self.qindex != 2:
            raise ApiError(409, "Chỉ nhắc bài được ở pha 'question' của câu 3 (phản biện).")
        if not self.reminder["available"]:
            raise ApiError(409, "Đã dùng lượt nhắc bài duy nhất của trận này rồi.")
        if card_id not in {c["id"] for c in self.contestants["player"]["_cards"]}:
            raise ApiError(400, f"Không tìm thấy thẻ '{card_id}' trong số thẻ bot của bạn đã mang theo.")
        self.reminder = {"available": False, "card_id": card_id}
        card = next(c for c in self.contestants["player"]["_cards"] if c["id"] == card_id)
        self._log("linh", "remind", f"Cô Linh nhắc bài: bot của bạn hãy xem lại thẻ “{card['title']}”.")
        return self.state()

    def next(self):
        if self.phase == "question":
            self._score_current()
        elif self.phase == "scored":
            if self.qindex >= 2:
                self.phase = "review"
                self._build_review()
            else:
                self._open_question(self.qindex + 1)  # lỗi model bay ra trước khi đổi trạng thái
                self.qindex += 1
                self.phase = "question"
        else:
            raise ApiError(409, f"Ở pha '{self.phase}' không bấm được 'next' — "
                                f"hãy hoàn thành các bước hiện tại.")
        return self.state()

    # ---------- nội bộ ----------
    def _open_question(self, qindex):
        q = self.coach.make_question(self, qindex)
        self.questions.append(q)
        self._log("linh", "question", q["text"])

    def use_offline(self, note):
        """Chuyển trận sang chế độ không model (server auto hết model): các câu đã mở giữ nguyên."""
        self.coach = OfflineCoach(self.doc, self.rng)
        self.mode = "offline"
        self.mode_note = note

    def _score_current(self):
        q = self.questions[-1]
        order = _order(self.opponent, q["index"])
        # Mọi lời gọi model xong rồi mới ghi điểm/log: lỗi giữa chừng thì không để lại trạng thái dở dang
        answers = self.coach.answer_all(self, q["index"], order)
        verdicts = self.coach.grade_all(self, q["index"], answers)
        for ans, v in zip(answers, verdicts):
            ctx = q.get("_ctx", {}).get(ans["by"]) if q["kind"] == "rebuttal" else None
            crit = (ctx["missed"] + ctx["covered"]) if ctx else q["_rubric"]
            ans["score"] = v["score"]
            ans["comment"] = coach.with_slide_refs(v["comment"], [c["slide"] for c in crit])
            ans["_covered_idx"] = v.get("covered_idx")
        q["answers"] = answers
        for ans in answers:
            cid = ans["by"]
            self.contestants[cid]["score"] += ans["score"]
            self._log(cid, "answer", ans["text"], used_cards=ans["used_cards"])
            self._log("linh", "verdict",
                      f"Cô Linh chấm {self.contestants[cid]['name']} {ans['score']}/10. {ans['comment']}")
        self.phase = "scored"

    def _build_review(self):
        p, o = self.contestants["player"], self.contestants[self.opponent]
        ranking = sorted([p, o], key=lambda c: (-c["score"], 0 if c["id"] == "player" else 1))
        ranks = [{"id": c["id"], "name": c["name"], "score": c["score"], "rank": i}
                 for i, c in enumerate(ranking, start=1)]
        result = "win" if p["score"] > o["score"] else "lose" if p["score"] < o["score"] else "draw"
        gaps, seen = [], set()
        for q in self.questions:
            ans = next((a for a in q.get("answers", []) if a["by"] == "player"), None)
            if not ans:
                continue
            for crit, covered in _covered_flags(q, ans):
                if not covered and crit["excerpt"] not in seen:
                    seen.add(crit["excerpt"])
                    title = next((c["title"] for c in self.doc.chunks if c["slide"] == crit["slide"]), "")
                    ctype, _ = coach.classify_bullet(crit["excerpt"], title)
                    # tổng kết kiến thức bot còn thiếu; người chơi tự sửa thẻ, không có thẻ nháp viết sẵn
                    gaps.append({
                        "qindex": q["index"], "question": q["text"], "criterion": crit["criterion"],
                        "doc_id": self.doc.id, "slide": crit["slide"], "slide_title": title,
                        "excerpt": crit["excerpt"], "type": ctype or "concept",
                        "used_cards": ans["used_cards"],
                    })
        self.review = {"ranking": ranks, "result": result, "gaps": gaps}
        self._log("linh", "system",
                  "Cô Linh: hết trận! Xem lại các chỗ bot của bạn còn thiếu để bổ sung thẻ.")

    # ---------- state ----------
    def state(self):
        show_rubric = self.phase == "review"
        questions = []
        for q in self.questions:
            item = {
                "index": q["index"], "kind": q["kind"], "text": q["text"],
                "sample": q["sample"], "dimension": q["dimension"],
                "target": q.get("target"),
                "answers": [{
                    "by": a["by"], "text": a["text"],
                    "used_cards": a["used_cards"], "unsure": a["unsure"],
                    "target": a.get("target"),
                    "score": a.get("score"), "comment": a.get("comment"),
                } for a in q.get("answers", [])],
            }
            if q["kind"] == "rebuttal":
                item["targets"] = q["targets"]
            if show_rubric:
                item["rubric"] = [{"criterion": c["criterion"], "slide": c["slide"],
                                   "excerpt": c["excerpt"]} for c in q["_rubric"]]
            questions.append(item)
        return {
            "id": self.id, "mode": self.mode, "mode_note": self.mode_note,
            "doc": {"id": self.doc.id, "title": self.doc.title},
            "topic": self.topic, "phase": self.phase, "qindex": self.qindex,
            "opponent": self.opponent, "rematch_of": self.rematch_of,
            "contestants": [{
                "id": c["id"], "name": c["name"], "kind": c["kind"], "persona": c["persona"],
                "color": c["color"], "score": c["score"],
                "cards": [{"id": card["id"], "title": card["title"], "type": card["type"]}
                          for card in c["_cards"]],
            } for c in (self.contestants[cid] for cid in ("player", self.opponent))],
            "questions": questions,
            "reminder": dict(self.reminder),
            "log": list(self.log),
            "review": self.review,
        }


def create_match(doc, topic=None, bot_name="Bé Bot", rematch_of=None, variant=0,
                 call_model=None, seed=None, mode_note=None, opponent=DEFAULT_OPPONENT):
    return Match(doc, topic=topic, bot_name=bot_name, rematch_of=rematch_of, variant=variant,
                 call_model=call_model, seed=seed, mode_note=mode_note, opponent=opponent)
