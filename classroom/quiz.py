"""Kiểm tra cuối: câu hỏi phỏng vấn thật (classroom/quiz_bank.json) chấm theo slide của lớp.

Mỗi câu được nối với slide bằng RAG (classroom/retrieval.py: hybrid vector + từ khoá, gộp RRF) trên
bản dịch + từ khoá — không gắn cứng số slide, nên đổi tài liệu vẫn chạy; câu nào không khớp slide nào
thì không đưa vào bài. Tiêu chí chấm là các ý (gạch đầu dòng nguyên văn) tìm được, không dùng đáp án mẫu
bên ngoài.
"""
import json
import os

from . import coach, rag
from .coach import ApiError

BANK_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "quiz_bank.json")
MAX_SLIDES = 2          # tối đa số slide làm nguồn tiêu chí cho một câu
MAX_CRITERIA = 4        # tối đa số ý cần nêu
SEARCH_K = 12           # số đoạn con lấy về trước khi chọn tiêu chí
MAX_ANSWER_CHARS = 4000
MIN_COVERAGE = 0.4      # slide khớp nhất phải chứa >= 40% từ nội dung của câu hỏi + từ khoá
_BANK = None


def bank():
    global _BANK
    if _BANK is None:
        with open(BANK_PATH, encoding="utf-8") as f:
            _BANK = json.load(f)
    return _BANK


def _query(item):
    return f"{item['question_vi']} {item.get('keywords_vi', '')}"


def rubric(doc, item, retriever, use_vectors=False):
    """Các ý cần nêu: gạch đầu dòng nguyên văn tìm được bằng RAG, gói trong tối đa 2 slide.
    Cổng độ phủ từ khoá trên slide khớp nhất loại câu hỏi lạc đề (vector luôn trả "gần nhất" dù không liên quan).
    Slide khớp nhất luôn góp ít nhất 2 ý (nếu có) để tiêu chí không lệch sang slide phụ."""
    hits = retriever.search(doc, _query(item), k=SEARCH_K, use_vectors=use_vectors)
    if not hits:
        return []
    terms = {k for k, _ in rag.content_tokens(_query(item))}
    have = {k for k, _ in rag.content_tokens(hits[0]["heading"] + " " + hits[0]["parent_text"])}
    if not terms or len(terms & have) / len(terms) < MIN_COVERAGE:
        return []
    slides = []
    for hit in hits:
        if hit["slide"] not in slides:
            slides.append(hit["slide"])
    slides = slides[:MAX_SLIDES]
    pool = [hit for hit in hits if hit["slide"] in slides and coach.content_words(hit["text"]) >= 3]
    first = [hit for hit in pool if hit["slide"] == slides[0]][:2]
    picked = first + [hit for hit in pool if hit not in first][: MAX_CRITERIA - len(first)]
    picked.sort(key=lambda hit: (slides.index(hit["slide"]), hit["position"]))
    titles = {c["slide"]: c["title"] for c in doc.chunks}
    return [{"slide": hit["slide"], "title": titles.get(hit["slide"], ""), "excerpt": hit["text"]} for hit in picked]


def _public(item, slides):
    keys = ("id", "question_en", "question_vi", "companies", "asked_at", "level_vi", "source_url", "bank_url")
    out = {k: item.get(k) for k in keys}
    out["slide_count"] = len(slides)
    return out


def questions_for(doc, retriever, use_vectors=False):
    """Câu hỏi dùng được với tài liệu này (giữ thứ tự trong bank)."""
    data = bank()
    if use_vectors:
        retriever.prewarm([_query(item) for item in data["questions"]])  # một lượt gọi embedding cho cả bank
    out = []
    for item in data["questions"]:
        crit = rubric(doc, item, retriever, use_vectors)
        if crit:
            out.append(_public(item, {c["slide"] for c in crit}))
    return {"questions": out, "source": data["source"], "bank_total": len(data["questions"]),
            "retrieval": retriever.describe(use_vectors)}


def _find(qid):
    for item in bank()["questions"]:
        if item["id"] == qid:
            return item
    raise ApiError(404, f"Không có câu hỏi '{qid}' trong ngân hàng câu hỏi — tải lại bài kiểm tra.")


QUIZ_SYSTEM = (
    "Bạn là Cô Linh, giáo viên chấm bài kiểm tra cuối. Học viên trả lời một câu hỏi phỏng vấn thật về AI agent. "
    "Chỉ chấm theo các ý của slide được đưa ra, chấp nhận diễn đạt khác chữ nếu cùng ý, không chấm theo kiến "
    "thức ngoài slide. Mọi lời bằng tiếng Việt. Chỉ trả về MỘT JSON object hợp lệ, không thêm chữ nào ngoài JSON."
)


def _grade_offline(crit, answer):
    ratios = [r for _, r in rag.bullet_ratios([c["excerpt"] for c in crit], answer)]
    covered = [i for i, r in enumerate(ratios) if r >= 1.0]
    score = max(0, min(10, round(10 * sum(ratios) / len(ratios)))) if ratios else 0
    n = len(covered)
    missing = sorted({c["slide"] for i, c in enumerate(crit) if i not in covered})
    if n == len(crit):
        comment = "Bạn nêu đủ các ý chính của slide."
    elif n:
        comment = (f"Bạn nêu được {n}/{len(crit)} ý chính; xem lại slide "
                   f"{', '.join(map(str, missing))} cho các ý còn thiếu bên dưới.")
    else:
        comment = (f"Câu trả lời chưa chạm ý chính nào — đọc lại slide {', '.join(map(str, missing))} "
                   "rồi thử diễn đạt lại.")
    return score, covered, comment


def _grade_model(item, crit, answer, call_model):
    numbered = "\n".join(f"  [{i}] (slide {c['slide']}) \"{c['excerpt']}\"" for i, c in enumerate(crit))
    user = (f"Câu hỏi phỏng vấn (tiếng Anh, nguyên văn): {item['question_en']}\n"
            f"Bản dịch: {item['question_vi']}\n"
            f"Các ý cần nêu, lấy nguyên văn từ slide (đánh số):\n{numbered}\n\n"
            f"Câu trả lời của học viên: \"{answer}\"\n\n"
            "Chấm 0–10 theo mức nêu đúng các ý trên. \"covered\" = số thứ tự các ý học viên đã nêu đủ. "
            "\"comment\" 1–2 câu: khen cái đúng, chỉ ra ý còn thiếu bằng NỘI DUNG của ý (không ghi số thứ tự như [0]), "
            "BẮT BUỘC ghi số slide của từng ý nhắc tới (vd \"theo slide 4\").\n"
            "Định dạng: {\"score\":0-10,\"covered\":[0,2],\"comment\":\"...\"}")
    data = coach._call_json(call_model, QUIZ_SYSTEM, user)
    try:
        score = max(0, min(10, round(float(data.get("score")))))
    except (TypeError, ValueError, AttributeError):
        raise RuntimeError("Model chấm bài trả về điểm không hợp lệ — nộp lại câu trả lời.")
    covered = sorted({i for i in (data.get("covered") or []) if isinstance(i, int) and 0 <= i < len(crit)})
    comment = coach._ws(str(data.get("comment") or "Cô Linh chấm theo các ý của slide."))
    return score, covered, comment


def grade(doc, qid, answer, retriever, call_model=None):
    item = _find(qid)
    answer = coach._ws(str(answer or ""))
    if not answer:
        raise ApiError(400, "Câu trả lời đang trống — viết vài câu rồi nộp.")
    if len(answer) > MAX_ANSWER_CHARS:
        raise ApiError(400, f"Câu trả lời dài quá {MAX_ANSWER_CHARS} ký tự — rút gọn lại nhé.")
    crit = rubric(doc, item, retriever, use_vectors=call_model is not None)
    if not crit:
        raise ApiError(404, f"Câu '{qid}' không khớp slide nào của tài liệu '{doc.id}'.")
    if call_model is None:
        score, covered, comment = _grade_offline(crit, answer)
    else:
        score, covered, comment = _grade_model(item, crit, answer, call_model)
    slides = []
    for c in crit:
        if not any(s["n"] == c["slide"] for s in slides):
            slides.append({"n": c["slide"], "title": c["title"]})
    return {
        "question_id": qid, "score": score, "max": 10,
        "comment": coach.with_slide_refs(comment, [c["slide"] for c in crit]),
        "covered": [crit[i] for i in covered],
        "missing": [c for i, c in enumerate(crit) if i not in covered],
        "slides": slides,
        "mode": "model" if call_model else "offline",
    }
