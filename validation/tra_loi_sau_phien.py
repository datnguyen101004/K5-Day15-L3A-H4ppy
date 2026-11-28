"""Đo metric tra_loi_dung_sau_phien trên bảng phiên ở validation/log.md.

  python validation/tra_loi_sau_phien.py cau <mã đoạn> truoc|sau   in câu hỏi, không in đáp án
  python validation/tra_loi_sau_phien.py tong                       đếm x/n trước → y/n sau
"""
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "data" / "check_questions.csv"
LOG = ROOT / "validation" / "log.md"
HEADING = "## Đo `tra_loi_dung_sau_phien`"


def load_questions():
    with QUESTIONS.open(encoding="utf-8-sig", newline="") as f:
        return {(r["code"], r["lan"]): r for r in csv.DictReader(f)}


def show(code, lan):
    q = load_questions().get((code, lan))
    if q is None:
        codes = sorted({c for c, _ in load_questions()})
        sys.exit(f"Không có câu {lan} cho mã '{code}'. Mã hợp lệ: {', '.join(codes)}")
    print(q["cau_hoi"])
    for opt in "ABC":
        print(f"  {opt}. {q[opt]}")
    return 0


def read_sessions():
    text = LOG.read_text(encoding="utf-8")
    if HEADING not in text:
        sys.exit(f"Không thấy mục '{HEADING}' trong {LOG.name}")
    section = text.split(HEADING, 1)[1].split("\n## ", 1)[0]
    rows = []
    for line in section.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 5 or not cells[0].isdigit():
            continue
        num, person, code, before, after = cells[:5]
        if not (person and code and before and after):
            continue
        rows.append((num, person, code.strip("`"), before.upper(), after.upper()))
    return rows


def tally():
    questions = load_questions()
    rows = read_sessions()
    before_ok = after_ok = 0
    for num, person, code, before, after in rows:
        if (code, "truoc") not in questions:
            sys.exit(f"Phiên {num}: mã đoạn '{code}' không có trong {QUESTIONS.name}")
        if not re.fullmatch(r"[ABC]", before) or not re.fullmatch(r"[ABC]", after):
            sys.exit(f"Phiên {num}: cột Trước / Sau phải là A, B hoặc C")
        b = before == questions[(code, "truoc")]["dap_an"]
        a = after == questions[(code, "sau")]["dap_an"]
        before_ok += b
        after_ok += a
        print(f"Phiên {num} · {person} · {code}: trước {'đúng' if b else 'sai'} → sau {'đúng' if a else 'sai'}")

    n = len(rows)
    people = len({r[1] for r in rows})
    codes = len({r[2] for r in rows})
    if not n:
        print("Chưa có phiên nào được ghi.")
        return 0
    rate = f" ({after_ok / n:.0%})" if n >= 20 else ""
    print(f"\nTrước phiên: {before_ok}/{n} · Sau phiên: {after_ok}/{n}{rate}")
    print(f"{n} phiên · {people} học viên · {codes} đoạn bài")
    enough = n >= 5 and people >= 3
    met = enough and after_ok >= 0.8 * n
    print("Đủ mẫu (≥5 phiên, ≥3 học viên):", "có" if enough else "chưa")
    print("Đạt điều kiện cứng (4) — ≥80% đúng sau phiên:", "có" if met else "chưa")
    if codes < 3:
        print("Lưu ý: issue #26 cần phiên trải trên ≥3 đoạn bài.")
    return 0


def main(argv):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(argv) == 3 and argv[0] == "cau" and argv[2] in ("truoc", "sau"):
        return show(argv[1], argv[2])
    if argv == ["tong"]:
        return tally()
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
