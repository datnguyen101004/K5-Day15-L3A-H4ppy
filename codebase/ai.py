"""Nối model — chỗ DUY NHẤT trong bản chạy thử gọi model AI. NHÓM VIẾT phần gọi model thật.

Hợp đồng (giữ nguyên để khung đo được token):
    call_model(system: str, user: str) -> dict với 4 khoá
        "text":       str   chữ model trả về
        "model":      str   tên model đã gọi (để tra giá ở bảng giá model)
        "tokens_in":  int   số token vào, lấy từ trường usage trong phản hồi API — KHÔNG ước lượng
        "tokens_out": int   số token ra, gồm cả token suy luận / suy nghĩ nếu API tính riêng
    @model_call (từ tracing.py) tự ghi mỗi lần gọi vào trace; agent.py gọi call_model bao nhiêu lần
    cũng được, khung tự cộng token.
    Lỗi gọi model (hết lượt, sai key, mất mạng): cứ để exception bay ra — khung ghi lỗi vào cột error.

Chế độ giả (mặc định khi .env chưa có MODEL_PROVIDER, hoặc MODEL_PROVIDER=fake):
    chạy kịch bản dạy lại theo từng đoạn, model "fake", token 0 — để thử luồng CP2.
    Lượt `run.py eval` / `run.py simulate` chạy bằng model giả KHÔNG được tính.

Nối model thật: điền .env (chép từ .env.example), rồi viết nhánh gọi API ở dưới theo docs/connect-model.md
(có ví dụ OpenAI, Claude, model chạy trên máy, và cách nối nhà cung cấp khác). Không dán API key vào file này.
"""
import json
import os
import re

from tracing import model_call

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_env(path=os.path.join(ROOT, ".env")):
    """Đọc file .env (KEY=VALUE mỗi dòng) vào biến môi trường, không ghi đè biến đã có. Khung — không cần sửa."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()
MODEL_PROVIDER = (os.environ.get("MODEL_PROVIDER") or "fake").strip().lower()
MODEL_NAME = (os.environ.get("MODEL_NAME") or "").strip()
API_KEY = (os.environ.get("API_KEY") or "").strip()


MOCK_QUESTIONS = {
    "A4-01": (
        "Mình tưởng dữ liệu đánh giá cũng dùng để điều chỉnh mô hình. Bạn giải thích giúp mình vì sao cần tách hai tập?",
        "Nếu điều chỉnh mô hình dựa trên cả tập đánh giá, kết quả đo có còn độc lập không?",
    ),
    "chatbot_is_app_around_model": (
        "Mình tưởng mô hình tự lưu lại từng tin nhắn. Nếu mình đóng ứng dụng thì lịch sử nằm ở đâu?",
        "Thành phần nào giữ lịch sử và mỗi lần gọi mô hình nhận được những gì?",
    ),
    "temperature_stability_not_truth": (
        "Mình nghĩ cứ giảm temperature là câu trả lời sẽ chính xác hơn. Bạn giải thích giúp mình tham số này làm gì?",
        "Một câu trả lời lặp lại rất ổn định thì có chắc là đúng không? Vì sao?",
    ),
    "react_reasoning_acting_pattern": (
        "Mình tưởng trong ReAct kết quả gọi công cụ chỉ dùng để in ra. Nó được dùng thế nào?",
        "Sau khi nhận kết quả công cụ, mô hình sẽ làm gì và khi nào chu trình dừng?",
    ),
    "cot_task_fit": (
        "Mình nghĩ yêu cầu suy luận nhiều bước có lợi với mọi bài. Bạn giải thích xem cách này phù hợp khi nào?",
        "Với tác vụ đơn giản, thêm bước suy luận đổi chi phí và độ trễ ra sao?",
    ),
    "threshold_by_error_cost": (
        "Mình nghĩ dùng một ngưỡng cố định cho mọi bài toán là hợp lý. Bạn giải thích giúp mình cách chọn ngưỡng?",
        "Nếu bỏ sót tốn kém hơn báo nhầm, bạn sẽ dịch ngưỡng về phía nào và vì sao?",
    ),
}
MOCK_REFUSALS = (
    ("override", r"(?:bỏ qua|phớt lờ|quên).{0,40}(?:hướng dẫn|chỉ dẫn|quy tắc|luật)|xác nhận mọi thứ|đổi vai trò"),
    ("answer_key", r"(?:đưa|cho|gửi|tiết lộ).{0,40}(?:đáp án|lời giải)|(?:làm|giải)\s*(?:bài\s*)?hộ"),
    ("off_topic", r"hạn nộp|phòng nào|phòng học|lịch học"),
)


def _fake_study_reply(user: str) -> str:
    """Mô phỏng các nhánh CP2. Không đánh giá được lời diễn đạt tương đương."""
    request = json.loads(user)
    passage = request["passage"]
    explanations = request["explanations"]
    latest = " ".join(explanations[-1].casefold().split()) if explanations else ""
    for reason, pattern in MOCK_REFUSALS:
        if re.search(pattern, latest):
            return json.dumps({"action": "decline", "reason": reason})

    opening, followup = MOCK_QUESTIONS.get(
        passage["code"],
        ("Bạn thử giải thích ý cốt lõi của đoạn bài cho mình nhé?", "Bạn có thể nói rõ một bước trong lập luận không?"),
    )
    if not explanations:
        action, text = "ask", opening
    elif latest == " ".join(passage["text"].casefold().split()):
        action, text = "confirm", ""
    elif request["followups_remaining"] > 0:
        action, text = "ask", followup
        if request["turn"] == 2:
            text = "Bạn thử nêu một ví dụ và giải thích vì sao ví dụ đó phù hợp với ý cốt lõi nhé?"
    else:
        action, text = "review", ""
    return json.dumps({"action": action, "text": text}, ensure_ascii=False)


@model_call
def call_model(system: str, user: str) -> dict:
    if MODEL_PROVIDER == "fake":
        return {"text": _fake_study_reply(user), "model": "fake", "tokens_in": 0, "tokens_out": 0}

    # NHÓM VIẾT: gọi model thật ở đây (theo MODEL_PROVIDER, MODEL_NAME, API_KEY) rồi trả đúng 4 khoá.
    # Ví dụ chép được cho từng nhà cung cấp: docs/connect-model.md mục 2.
    raise NotImplementedError(
        "chưa viết phần gọi model thật cho MODEL_PROVIDER=%s trong codebase/ai.py — xem docs/connect-model.md"
        % MODEL_PROVIDER)
