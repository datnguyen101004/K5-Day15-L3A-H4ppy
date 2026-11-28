# Phiên thật với học viên ngoài nhóm

## Đo `tra_loi_dung_sau_phien`

> Điều kiện cứng (4) của chuẩn "đạt" (`spec.md` §7): ≥ 80% phiên trả lời đúng câu SAU phiên, trên ≥ 5 phiên của ≥ 3 học viên L3 **ngoài nhóm**, trải trên ≥ 3 đoạn bài. Định nghĩa: `eval/metric_spec.yaml` metric `tra_loi_dung_sau_phien`.

**Quy trình mỗi phiên** (~10 phút, người điều phối là thành viên nhóm):

1. Phát cho học viên một mã người: P01, P02… (một người có thể làm nhiều phiên, khác đoạn bài). Không ghi tên. Dặn không gõ thông tin cá nhân vào phiên.
2. **Câu trước:** `python validation/tra_loi_sau_phien.py cau <mã đoạn> truoc` → học viên chọn A/B/C, ghi vào cột *Trước*. Không nói đúng / sai.
3. **Phiên:** `python run.py` (luồng A4, **không** dùng app web) → nhập mã đoạn → học viên giải thích cho bạn học AI đến khi phiên chốt hoặc từ chối.
4. **Câu sau:** `python validation/tra_loi_sau_phien.py cau <mã đoạn> sau` → học viên chọn lần đầu, không xem đáp án, không mở lại phiên. Ghi vào cột *Sau*.
5. Hết các phiên: `python validation/tra_loi_sau_phien.py tong` → chép dòng "Trước x/n · Sau y/n" vào `spec.md` §7 và `eval/report.md`. n < 20 thì không ghi %.

Mã đoạn: `A4-01` · `chatbot_is_app_around_model` · `temperature_stability_not_truth` · `react_reasoning_acting_pattern` · `cot_task_fit` · `threshold_by_error_cost`

| # | Người | Mã đoạn | Trước (A/B/C) | Sau (A/B/C) | Ghi chú (số lượt, kết thúc bằng CHOT / TU_CHOI, chỗ học viên vướng) |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

Kết quả (`tong`): Trước __/__ · Sau __/__ · __ phiên · __ học viên · __ đoạn bài

## Người dùng thử *(bonus)*

> Điền ở guide bước 4.3 — 2–3 người ngoài nhóm, ~10 phút / người, theo 5 nhịp: làm quen · bối cảnh · giao việc · quan sát · hỏi sau. Ôn lại: ngày 5, ngày 13. Chấm ở rubric Bonus.
> Không ghi tên: ghi vai. Hành vi quan sát được nặng hơn lời nói; toàn lời khen = phiên chưa đạt, giao việc khó hơn.
> Người dùng thử **không thay được** bằng chứng pain ở `evidence/`.

| Người thử (vai) | Việc giao (theo kết quả, không theo nút) | Quan sát (làm gì đầu tiên, chỗ do dự, chỗ hiểu sai) | Trích nguyên văn | Mức nghiêm trọng (cao / vừa / thấp) |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

Câu hỏi sau: *"Nếu mai không được dùng nữa, bạn thấy: rất tiếc / hơi tiếc / không sao?"* → __ / __ / __

## Tổng hợp

- Chủ đề lặp nhiều nhất: __
- Sửa gì trước demo (ghi `spec.md` §10): __
- Giữ gì và vì sao: __
- Để dành sau: __
