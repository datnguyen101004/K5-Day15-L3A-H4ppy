# Tổng hợp bằng chứng pain

> Điền ở guide bước 1.2, xong trước **CP3 10:00 Thứ Bảy 28/11**. Chấm ở rubric R1.
> Ba nguồn ngang nhau — tối thiểu **≥1 nguồn đạt ngưỡng**. Mạnh nhất: đào data ra insight → hỏi người dùng để kiểm lại (hoặc ngược lại).

## 1. Nguồn đã dùng

| Nguồn | Đạt ngưỡng? | File |
|---|---|---|
| Đào data (x/N, %, cách đếm chạy lại được, ≥5 ví dụ) | ☑ | `evidence/data-mining.md`, `evidence/count.py` |
| Phỏng vấn (≥3 người ngoài nhóm, đúng người dùng) | ☐ | `evidence/interviews/P1.md`… |
| Khảo sát (≥20 người ngoài nhóm, đúng người dùng) | ☑ 20 phiếu hợp lệ / 21 phiếu | `evidence/survey/questions.md`, `evidence/survey/results.csv`, `evidence/survey/count_survey.py` |

## 2. Số chính

- Đào data: 245/276 (88,8%) học viên thấy tin bạn học AI nhưng không đáp lại lần nào; 354/431 (82,1%) học viên mở video nhưng không nộp câu kiểm tra pre/post nào; 287/431 (66,6%) không gửi chat nào
- Phỏng vấn: **không làm** — nhóm chốt khảo sát ≥20 học viên L3 ngoài nhóm làm nguồn kiểm lại, thay cho phỏng vấn (xem "Lịch khảo sát" cuối file). Đào data và khảo sát đều đạt ngưỡng, vượt yêu cầu tối thiểu ≥1 nguồn.
- Khảo sát (chạy `python evidence/survey/count_survey.py`): 21 phiếu, **n = 20 phiếu hợp lệ** (13 L3A, 7 L3B, đều đã xem pre-class). Bỏ 1 phiếu lab coach vì không đúng người dùng.
  - C8, phải hỏi hoặc xem lại kiến thức pre-class ở buổi thực hành: ≥1 lần **14/20 (70%)**; ≥2 lần 6/20 (30%). Mỗi lần mất: dưới 5' 7 người, 5–15' 5 người, 15–30' 1 người, trên 30' 1 người.
  - C5, trả lời bạn học AI ≤1 lượt: 12/20 (60%); 0 lượt: 5/20 (25%).
  - C6, xem xong không làm gì để tự kiểm: 5/20 (25%). Làm quiz cuối đoạn: 11/20 (55%); tự tóm tắt hoặc giải thích lại: 8/20 (40%).
  - C4, cách xem: bỏ qua đoạn 8/20 (40%); tua nhanh ≥1.5x 7/20 (35%); vừa xem vừa làm việc khác 6/20 (30%).
  - C7, giải thích lại khái niệm chính mà không xem lại: 0/20 giải thích được, nhưng 18/20 bỏ trống (câu tuỳ chọn). **Không dùng câu này làm bằng chứng** vì bỏ trống không có nghĩa là không giải thích được.
  - C3, số bài pre-class mỗi tuần: trung vị 2, dùng cho số lần/tháng ở `spec.md` §2.

## 3. ≥5 trích dẫn hoặc ví dụ nguyên văn (có nguồn, bỏ tên)

1. "xem phần đầu thì thấy dễ hiểu nhưng lúc làm câu hỏi giữa thì chọn bừa vì không chắc, lên lớp làm lab mới biết mình hiểu sai" — phiếu S4, câu 10
2. "Khi xem không có ví dụ thực tế đi kèm ngay nên lúc vào buổi thực hành bị quên, phải mở lại video tìm đúng đoạn cần xem." — phiếu S14, câu 10
3. "Muốn xem nhanh cho kịp tiến độ trước buổi học nên bỏ qua phần chat." — phiếu S13, câu 5a
4. "Thấy tự đọc slide nhanh hơn và không quen chat với AI trong lúc xem video." — phiếu S16, câu 5a
5. "Bận deadline nên chỉ lướt qua nội dung chính, không kịp dừng lại tương tác." — phiếu S18, câu 5a

## 4. Các nguồn có khớp nhau không

- **Khớp:** data cho thấy 354/431 (82,1%) học viên mở video nhưng không nộp câu kiểm tra pre/post nào. Khảo sát cho thấy 14/20 (70%) phải hỏi hoặc xem lại kiến thức pre-class ở buổi thực hành. Học viên xem xong mà chưa chắc đã hiểu, đến lúc làm lab mới lộ ra.
- **Lệch về mức độ, cùng chiều:** data cho thấy 245/276 (88,8%) học viên chưa từng đáp lại bạn học AI. Khảo sát chỉ có 5/20 (25%) nói trả lời 0 lượt, còn 12/20 (60%) trả lời ≤1 lượt. Có thể người chịu làm khảo sát là người tích cực hơn, hoặc học viên tự kể nhiều hơn thực tế. Data đo hành vi thật nên đáng tin hơn về con số; khảo sát cho biết lý do: muốn xem nhanh, bận deadline, không quen chat với AI (trích dẫn 3–5).

## 5. Kết luận

Giả thuyết ở `evidence/hypothesis.md`: **gần đạt, chưa đạt đúng ngưỡng**. Ngưỡng là "≥3/4 người kể được một lần như thế trong 1 tuần qua". Khảo sát C8 cho 14/20 (70%) phải hỏi hoặc xem lại ở buổi thực hành, thấp hơn 75%. Data cùng chiều: 82,1% không tự kiểm bằng câu pre/post. Điều vẫn chưa biết: C8 hỏi về "buổi thực hành sau đó", chưa phải "1 tuần qua"; và vì C7 bị bỏ trống nhiều, chưa đo được việc học viên *tưởng hiểu nhưng giải thích không được*. Đây đúng là chỗ bản chạy thử A4 sẽ đo.

## Lịch khảo sát (dùng cho CP2 — nhóm chốt nguồn kiểm lại là khảo sát ≥20 học viên L3 ngoài nhóm, thay cho phỏng vấn)

| Kênh gửi | Giờ mở | Giờ chốt | Số phiếu hợp lệ |
|---|---|---|---|
| Google Form, gửi link qua group Zalo pre-class | 18:16 27/11 (phiếu đầu tiên) | 18:38 27/11 (phiếu cuối cùng) | 20/20 |

Bộ câu hỏi: `evidence/survey/questions.md`.
