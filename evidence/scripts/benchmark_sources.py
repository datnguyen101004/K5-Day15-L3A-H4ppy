"""Đếm lại các số dùng ở cột `source` (data_that) của eval/benchmark.csv.

Chạy:  python -I evidence/scripts/benchmark_sources.py <đường dẫn tới data/preclass của bộ đề>
Data BTC không commit vào repo nhóm (luật dùng dữ liệu) nên truyền đường dẫn vào.

Cách đếm (ghi trước khi chạy):
1. Tỉ lệ sai theo KC: answers.csv, nguon = pre_post_post, lan_thu = 1, was_correct ∈ {True, False}.
   Nhóm theo kc_code, x = số dòng False, N = tổng số dòng. Chỉ in KC có N ≥ 10.
2. Câu trả lời bạn học AI rất ngắn: chat.csv, channel = video_discussion_reply, do_dai_cau_hoi ≤ 15.
3. Câu nhắn AI không có ý riêng: answers.csv, nguon = chat, trang_thai_cham = da_cham, rubric_y_moi = 0.
4. Như (3) nhưng chỉ các câu trả lời bạn học AI: answers.csv ref = chat.csv id với channel = video_discussion_reply.
"""
import collections
import csv
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def read(folder, name):
    with open(os.path.join(folder, name), encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def main(folder):
    answers = read(folder, "answers.csv")
    chat = read(folder, "chat.csv")

    print("1) Sai lần đầu ở bài ôn sau học, theo KC (N ≥ 10)")
    stats = collections.defaultdict(lambda: [0, 0])
    for r in answers:
        if r["nguon"] == "pre_post_post" and r["lan_thu"] == "1" and r["was_correct"] in ("True", "False"):
            s = stats[r["kc_code"]]
            s[1] += 1
            s[0] += r["was_correct"] == "False"
    for kc, (x, n) in sorted(stats.items(), key=lambda kv: -kv[1][0] / kv[1][1]):
        if n >= 10:
            print("   %-40s %3d/%-3d (%.0f%%)" % (kc, x, n, 100 * x / n))

    replies = [r for r in chat if r["channel"] == "video_discussion_reply"]
    short = sum(int(r["do_dai_cau_hoi"] or 0) <= 15 for r in replies)
    print("2) Trả lời bạn học AI dài ≤15 ký tự: %d/%d (%.0f%%)" % (short, len(replies), 100 * short / len(replies)))

    graded = [r for r in answers if r["nguon"] == "chat" and r["trang_thai_cham"] == "da_cham"]
    zero = sum(r["rubric_y_moi"] == "0" for r in graded)
    print("3) Câu nhắn AI có rubric_y_moi = 0: %d/%d (%.0f%%)" % (zero, len(graded), 100 * zero / len(graded)))

    reply_ids = {r["id"] for r in replies}
    graded_replies = [r for r in graded if r["ref"] in reply_ids]
    zero_r = sum(r["rubric_y_moi"] == "0" for r in graded_replies)
    print("4) Riêng câu trả lời bạn học AI (dùng cho B06), rubric_y_moi = 0: %d/%d (%.0f%%)"
          % (zero_r, len(graded_replies), 100 * zero_r / len(graded_replies)))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
