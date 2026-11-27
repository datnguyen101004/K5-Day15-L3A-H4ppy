"""Đếm bằng chứng pain cho lát cắt A4 (xem evidence/data-mining.md §1).

Chạy: python evidence/count.py [thư mục data, mặc định data-btc/preclass]
Chỉ in số đã tổng hợp và mã ẩn danh (hv, id); không in nội dung gốc.
"""
import csv
import json
import sys
from collections import defaultdict

DATA = sys.argv[1] if len(sys.argv) > 1 else "data-btc/preclass"


def load(name):
    with open(f"{DATA}/{name}", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def pct(x, n):
    return f"{x}/{n} ({x / n:.1%})" if n else f"{x}/0"


events = load("events.csv")
chat = load("chat.csv")

opened_video = set()
shown_classmate = defaultdict(int)  # hv -> số tin bạn học AI hiện ra
first_try = []  # (hv, correct) của câu pre/post, lần thử 1
for r in events:
    hv, t = r["hv"], r["type"]
    if t == "video_opened":
        opened_video.add(hv)
    elif t == "agent_message_shown":
        if json.loads(r["data"] or "{}").get("agent_id", "").startswith("classmate_"):
            shown_classmate[hv] += 1
    elif t == "answer_submitted":
        d = json.loads(r["data"] or "{}")
        if d.get("nguon") == "pre_post_post" and d.get("lan_thu") == 1:
            first_try.append((hv, d.get("correct") is True))

replied_classmate = {r["hv"] for r in chat if r["agent_id"].startswith("classmate_")}
any_chat = {r["hv"] for r in chat}
answered = {hv for hv, _ in first_try}

# M1: thấy tin bạn học AI nhưng chưa từng đáp lại bạn học AI nào
n1 = set(shown_classmate)
x1 = n1 - replied_classmate
shown_total = sum(shown_classmate.values())
replies_total = sum(1 for r in chat if r["agent_id"].startswith("classmate_"))
print("M1 HV thấy tin bạn học AI mà không đáp lại lần nào:", pct(len(x1), len(n1)))
print("   tin bạn học AI hiện ra / lượt HV đáp lại bạn học AI:", shown_total, "/", replies_total,
      f"({replies_total / shown_total:.1%})" if shown_total else "")

# M2: mở video nhưng không gửi chat nào (cả trợ giảng lẫn bạn học AI)
x2 = opened_video - any_chat
print("M2 HV mở video mà không gửi chat nào:", pct(len(x2), len(opened_video)))

# M3: mở video nhưng không nộp câu kiểm tra pre/post nào
x3 = opened_video - answered
print("M3 HV mở video mà không nộp câu kiểm tra pre/post nào:", pct(len(x3), len(opened_video)))

# M4: câu kiểm tra pre/post sai ở lần thử 1
wrong = sum(1 for _, ok in first_try if not ok)
print("M4 lượt trả lời pre/post sai ở lần thử 1:", pct(wrong, len(first_try)))

print("Ví dụ HV thuộc M1 (mã ẩn danh, số tin bạn học AI đã hiện):",
      sorted(((hv, shown_classmate[hv]) for hv in x1), key=lambda p: -p[1])[:5])
