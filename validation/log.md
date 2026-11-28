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

> Sản phẩm thử: **Lớp học tranh tài** (app web `classroom/`), không phải luồng A4 dòng lệnh ở trên. Nguồn: form "Khảo sát trải nghiệm Lớp học tranh tài", 3 phiếu ngày 28/11/2026, bản xuất không có tên / email: `validation/khao-sat-lop-hoc-tranh-tai.csv`. Cột *Quan sát* là lỗi **người thử tự báo** qua form, nhóm không ngồi quan sát trực tiếp. Điểm 1–5: dễ dùng / giúp học / tin nhận xét của cô Linh.

| Người thử (vai) | Việc giao (theo kết quả, không theo nút) | Quan sát (làm gì đầu tiên, chỗ do dự, chỗ hiểu sai) | Trích nguyên văn | Mức nghiêm trọng (cao / vừa / thấp) |
|---|---|---|---|---|
| Phiếu 1 · Khác · điểm 5 / 5 / 4 | Đã dùng: Học slide và viết thẻ · Đấu trường · Xem lại trận và sửa thẻ · Kiểm tra cuối · Hướng dẫn | Cô Linh chấm rộng tay: khen bot đủ ý dù thẻ chưa nêu · lời thoại Đấu trường nhân đôi khi đổi tab · chữ "null" thừa ở Kiểm tra cuối · toast không tự đóng, báo lưu thành công mà viền đỏ như báo lỗi | "Đôi lúc cô Linh chấm hơi rộng tay (khen Bé Bot đủ ý phân biệt chatbot ở câu 1 dù thẻ chưa nêu)" | cao (chấm rộng tay) · vừa (lời thoại nhân đôi) · thấp (null, toast) |
| Phiếu 2 · Học viên L3A · điểm 5 / 5 / 5 | Đã dùng: Đấu trường · Kiểm tra cuối | Không báo lỗi nào; toàn lời khen → theo hướng dẫn ở đầu mục, phiếu này **chưa đạt**, lần sau cần giao việc khó hơn | "Hiện tại website đang ổn chưa có điểm nào cần phải sửa thêm" | — |
| Phiếu 3 · Khác · điểm 4 / 4 / 3 | Đã dùng: Học slide và viết thẻ · Đấu trường · Xem lại trận và sửa thẻ · Hướng dẫn | Kẹt trận: vào trận khi Sổ tay trống, thêm thẻ rồi "Vào lại trận" thì không hiện nút chọn thẻ / bắt đầu · cô Linh chấm 0/10 dù thẻ có ý đúng · tìm từ khoá không tồn tại vẫn trả 5 đoạn · Lưu thẻ đoạn 1 làm mất chữ đang gõ ở đoạn 2 · "Nhắc bài" chỉ ở câu 3 · không bấm chọn trực tiếp ô đối thủ | "thẻ có 'dùng mô hình ngôn ngữ để tự chọn bước tiếp theo, gọi công cụ, đọc kết quả' nhưng Cô Linh vẫn chấm Bé Bot 0/10 ('chưa có ý nào')" | cao (kẹt trận, chấm 0/10) · vừa (mất chữ đang gõ, tìm kiếm không có trạng thái rỗng, Nhắc bài) · thấp (ô đối thủ) |

Câu hỏi sau: *"Nếu mai không được dùng nữa, bạn thấy: rất tiếc / hơi tiếc / không sao?"* → **form không hỏi câu này**. Câu gần nhất form có hỏi: "Bạn có muốn dùng app này để ôn trước buổi thực hành không?" → Có 3/3.

## Tổng hợp

- Chủ đề lặp nhiều nhất: **cô Linh chấm lệch so với nội dung thẻ** — 2/3 phiếu, theo cả hai chiều (khen khi thẻ thiếu ý ở phiếu 1, cho 0/10 khi thẻ có ý ở phiếu 3). Điểm "tin nhận xét của cô Linh" thấp nhất trong 3 tiêu chí (4 / 5 / 3). Đây cùng loại rủi ro với `khong_xac_nhan_sai` ở luồng A4 (`spec.md` §9).
- Sửa gì trước demo (ghi `spec.md` §10): đề xuất sửa lỗi kẹt trận (chặn cả luồng đấu) và chấm lệch của cô Linh — *nhóm chưa quyết*.
- Giữ gì và vì sao: luồng đọc slide → viết thẻ → đấu → xem lại kiến thức thiếu kèm số slide (phiếu 1 và 3 đều nêu là điều thích nhất); tour Hướng dẫn bám đúng nút / tab (phiếu 3).
- Để dành sau: chữ "null", toast, ô đối thủ, "Nhắc bài" ở mọi câu.
- Giới hạn: 3 phiếu tự báo, 2/3 người chọn vai "Khác" — **chưa ghi rõ có phải người ngoài nhóm không**; chưa có quan sát hành vi trực tiếp.
