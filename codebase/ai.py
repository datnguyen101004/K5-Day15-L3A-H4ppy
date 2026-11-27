"""Gọi model qua Chat Completions và ghi số token thực tế từ phản hồi API."""
import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

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
MODEL_PROVIDER = (os.getenv("MODEL_PROVIDER", "").strip()
                  or os.getenv("LLM_PROVIDER", "").strip() or "fake").lower()
MODEL_NAME = os.getenv("MODEL_NAME", "").strip()
API_KEY = os.getenv("API_KEY", "").strip() or os.getenv("OPENAI_API_KEY", "").strip()
API_BASE = os.getenv("OPENAI_API_BASE", "").strip().rstrip("/") or "https://api.openai.com/v1"


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
    latest = " ".join(request["learner_reply"].casefold().split())
    for reason, pattern in MOCK_REFUSALS:
        if re.search(pattern, latest):
            return json.dumps({"core_covered": False, "has_error": False, "reason": reason})

    opening, followup = MOCK_QUESTIONS.get(
        passage["code"],
        ("Bạn thử giải thích ý cốt lõi của đoạn bài cho mình nhé?", "Bạn có thể nói rõ một bước trong lập luận không?"),
    )
    core_covered = latest == " ".join(passage["text"].casefold().split())
    text = ""
    if not request["turn"]:
        text = opening
    elif not core_covered and request["followups_remaining"] > 0:
        text = followup
        if request["turn"] == 2:
            text = "Bạn thử nêu một ví dụ và giải thích vì sao ví dụ đó phù hợp với ý cốt lõi nhé?"
    return json.dumps({"core_covered": core_covered, "has_error": False, "text": text}, ensure_ascii=False)



@model_call
def call_model(system: str, user: str) -> dict:
    if MODEL_PROVIDER == "fake":
        return {"text": _fake_study_reply(user), "model": "fake", "tokens_in": 0, "tokens_out": 0}
    if MODEL_PROVIDER != "openai":
        raise ValueError(f"MODEL_PROVIDER={MODEL_PROVIDER} chưa được hỗ trợ. Xem docs/connect-model.md.")
    if not MODEL_NAME or not API_KEY:
        raise ValueError("Cần đặt MODEL_NAME và API_KEY hoặc OPENAI_API_KEY trong .env.")

    endpoint = urlsplit(API_BASE)
    if endpoint.scheme != "https" or not endpoint.hostname or endpoint.username or endpoint.query or endpoint.fragment:
        raise ValueError("OPENAI_API_BASE phải là URL HTTPS cơ sở, ví dụ https://api.openai.com/v1.")

    payload = {
        "model": MODEL_NAME,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {"type": "json_object"},
    }
    if endpoint.hostname.endswith(".maas.aliyuncs.com") and MODEL_NAME.startswith("qwen"):
        payload["enable_thinking"] = False

    request = Request(
        f"{API_BASE}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    request.add_unredirected_header("Authorization", f"Bearer {API_KEY}")
    try:
        with urlopen(request, timeout=45) as response:
            data = json.load(response)
    except HTTPError as exc:
        exc.close()
        raise RuntimeError(f"Model API trả HTTP {exc.code}. Xem docs/connect-model.md.") from None
    except URLError as exc:
        raise RuntimeError("Không kết nối được model API. Kiểm tra mạng và OPENAI_API_BASE.") from exc

    try:
        text = data["choices"][0]["message"]["content"]
        model = data["model"]
        usage = data["usage"]
        tokens_in = usage["prompt_tokens"]
        tokens_out = usage["completion_tokens"]
    except (IndexError, KeyError, TypeError) as exc:
        raise RuntimeError("Model API trả phản hồi thiếu nội dung hoặc số token.") from exc
    if not isinstance(text, str) or not text.strip() or not isinstance(model, str) or not model:
        raise RuntimeError("Model API trả nội dung hoặc tên model không hợp lệ.")
    if type(tokens_in) is not int or type(tokens_out) is not int or min(tokens_in, tokens_out) <= 0:
        raise RuntimeError("Model API trả số token không hợp lệ.")
    return {"text": text, "model": model, "tokens_in": tokens_in, "tokens_out": tokens_out}
