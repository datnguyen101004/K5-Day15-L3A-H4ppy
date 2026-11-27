"""Đếm kết quả khảo sát (evidence/survey/questions.md).

Chạy: python evidence/survey/count_survey.py
Đọc raw-responses.csv (gitignore), ghi results.csv đã ẩn danh (bỏ dấu thời gian, đánh mã S1..Sn),
rồi in số x/N trên các phiếu hợp lệ: học viên L3A/L3B, đã từng xem video pre-class.
"""
import csv
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
with open(HERE / "raw-responses.csv", encoding="utf-8-sig", newline="") as f:
    header, *rows = list(csv.reader(f))

ids = [f"S{i}" for i in range(1, len(rows) + 1)]
with open(HERE / "results.csv", "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f)
    w.writerow(["phieu"] + header[1:])
    for sid, r in zip(ids, rows):
        w.writerow([sid] + r[1:])

ROLE, LAST, PER_WEEK, HOW, CHAT, WHY0, CHECK, EXPLAIN, REASK, MINUTES, PAIN = range(1, 12)
valid = [(sid, r) for sid, r in zip(ids, rows)
         if r[ROLE] in ("Học viên L3A", "Học viên L3B") and r[LAST] != "Chưa bao giờ"]
n = len(valid)


def pct(x):
    return f"{x}/{n} ({x / n:.0%})"


def has(col, opt):
    return sum(1 for _, r in valid if opt in r[col].split(";"))


print(f"Tổng phiếu: {len(rows)} · hợp lệ (học viên L3, đã xem pre-class): {n}")
print("Vai:", dict(Counter(r[ROLE] for r in rows)))
for opt in ["Bỏ qua đoạn", "Vừa xem vừa làm việc khác", "Tua nhanh / tốc độ ≥1.5x", "Bỏ qua phần tương tác"]:
    print(f"C4 {opt}:", pct(has(HOW, opt)))
print("C5 lượt trả lời bạn học AI:", dict(Counter(r[CHAT] for _, r in valid)))
print("C5 trả lời bạn học AI ≤1 lượt:", pct(sum(1 for _, r in valid if r[CHAT] in ("0", "1"))))
for opt in ["Không làm gì", "Làm quiz cuối đoạn", "Tự tóm tắt hoặc giải thích lại", "Hỏi ChatGPT"]:
    print(f"C6 {opt}:", pct(has(CHECK, opt)))
real_explain = [sid for sid, r in valid if r[EXPLAIN].strip() and "không nhớ" not in r[EXPLAIN].lower()]
print("C7 giải thích được khái niệm chính:", pct(len(real_explain)),
      "· bỏ trống:", pct(sum(1 for _, r in valid if not r[EXPLAIN].strip())))
print("C8 số lần hỏi/xem lại ở buổi thực hành:", dict(Counter(r[REASK] for _, r in valid)))
print("C8 phải hỏi/xem lại ≥1 lần:", pct(sum(1 for _, r in valid if r[REASK] != "0")))
print("C8 phải hỏi/xem lại ≥2 lần:", pct(sum(1 for _, r in valid if r[REASK] in ("2–3", ">3"))))
print("C9 số phút mỗi lần (người có hỏi/xem lại):",
      dict(Counter(r[MINUTES] for _, r in valid if r[REASK] != "0")))
week = [int(r[PER_WEEK]) for _, r in valid if r[PER_WEEK].strip().isdigit()]
print("C3 số bài pre-class/tuần: trung vị", sorted(week)[len(week) // 2], "· tổng", sum(week), "· n", len(week))
