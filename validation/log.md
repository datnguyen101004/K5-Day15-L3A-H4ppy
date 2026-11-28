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

Phân bổ 5 phiên đề xuất, **chưa phải dữ liệu**: P01 làm chatbot và temperature; P02 làm temperature và ReAct; P03 làm chatbot. Mã tương ứng: `chatbot_is_app_around_model`, `temperature_stability_not_truth`, `react_reasoning_acting_pattern`. Chỉ điền bảng khi đã nhận đáp án lần đầu từ học viên L3 ngoài nhóm.

| # | Người | Mã đoạn | Trước (A/B/C) | Sau (A/B/C) | Ghi chú (số lượt, kết thúc bằng CHOT / TU_CHOI, chỗ học viên vướng) |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

Kết quả (`tong`): **Chưa có phiên A4 đủ dữ liệu trước/sau**; chưa báo tỉ lệ.

## Người dùng thử *(bonus)*

> Điền ở guide bước 4.3 — 2–3 người ngoài nhóm, ~10 phút / người, theo 5 nhịp: làm quen · bối cảnh · giao việc · quan sát · hỏi sau. Ôn lại: ngày 5, ngày 13. Chấm ở rubric Bonus.
> Không ghi tên: ghi vai. Hành vi quan sát được nặng hơn lời nói; toàn lời khen = phiên chưa đạt, giao việc khó hơn.
> Người dùng thử **không thay được** bằng chứng pain ở `evidence/`.

> Sản phẩm thử: **Lớp học tranh tài** (app web `classroom/`), không phải luồng A4 dòng lệnh ở trên. Nguồn: form "Khảo sát trải nghiệm Lớp học tranh tài", 3 phiếu ngày 28/11/2026. Bản trong `data/` và [bản lưu của hồ sơ](khao-sat-lop-hoc-tranh-tai.csv) có cùng 3 phiếu, không cộng dồn. Các lỗi bên dưới do người thử tự báo; nhóm không quan sát trực tiếp. Điểm 1–5: dễ dùng / giúp học / tin nhận xét của cô Linh.

| Người thử (vai) | Việc giao (theo kết quả, không theo nút) | Quan sát (làm gì đầu tiên, chỗ do dự, chỗ hiểu sai) | Trích nguyên văn | Mức nghiêm trọng (cao / vừa / thấp) |
|---|---|---|---|---|
| Phiếu 1 · Khác · điểm 5 / 5 / 4 | Đã dùng: Học slide và viết thẻ · Đấu trường · Xem lại trận và sửa thẻ · Kiểm tra cuối · Hướng dẫn | Cô Linh chấm rộng tay: khen bot đủ ý dù thẻ chưa nêu · lời thoại Đấu trường nhân đôi khi đổi tab · chữ "null" thừa ở Kiểm tra cuối · toast không tự đóng, báo lưu thành công mà viền đỏ như báo lỗi | "Đôi lúc cô Linh chấm hơi rộng tay (khen Bé Bot đủ ý phân biệt chatbot ở câu 1 dù thẻ chưa nêu)" | cao (chấm rộng tay) · vừa (lời thoại nhân đôi) · thấp (null, toast) |
| Phiếu 2 · Học viên L3A · điểm 5 / 5 / 5 | Đã dùng: Đấu trường · Kiểm tra cuối | Không báo lỗi nào; toàn lời khen → theo hướng dẫn ở đầu mục, phiếu này **chưa đạt**, lần sau cần giao việc khó hơn | "Hiện tại website đang ổn chưa có điểm nào cần phải sửa thêm" | — |
| Phiếu 3 · Khác · điểm 4 / 4 / 3 | Đã dùng: Học slide và viết thẻ · Đấu trường · Xem lại trận và sửa thẻ · Hướng dẫn | Kẹt trận: vào trận khi Sổ tay trống, thêm thẻ rồi "Vào lại trận" thì không hiện nút chọn thẻ / bắt đầu · cô Linh chấm 0/10 dù thẻ có ý đúng · tìm từ khoá không tồn tại vẫn trả 5 đoạn · Lưu thẻ đoạn 1 làm mất chữ đang gõ ở đoạn 2 · "Nhắc bài" chỉ ở câu 3 · không bấm chọn trực tiếp ô đối thủ | "thẻ có 'dùng mô hình ngôn ngữ để tự chọn bước tiếp theo, gọi công cụ, đọc kết quả' nhưng Cô Linh vẫn chấm Bé Bot 0/10 ('chưa có ý nào')" | cao (kẹt trận, chấm 0/10) · vừa (mất chữ đang gõ, tìm kiếm không có trạng thái rỗng, Nhắc bài) · thấp (ô đối thủ) |

Câu hỏi sau: *"Nếu mai không được dùng nữa, bạn thấy: rất tiếc / hơi tiếc / không sao?"* → **form không hỏi câu này**. Câu gần nhất form có hỏi: "Bạn có muốn dùng app này để ôn trước buổi thực hành không?" → Có 3/3.

## Tổng hợp

- **Phạm vi:** 3/3 phiếu có dùng Đấu trường, 2/3 dùng Kiểm tra cuối, 3/3 muốn dùng để ôn trước buổi thực hành. Điểm trung bình: dễ dùng 4,67/5 · cảm nhận giúp học 4,67/5 · tin nhận xét 4,00/5. Đây là phản hồi tự báo, không phải điểm kiểm tra kiến thức.
- **Điểm cần ưu tiên:** 2/3 phiếu báo cô Linh chấm lệch so với thẻ, theo hai chiều: khen khi thiếu ý và cho 0 khi người thử thấy thẻ có ý đúng.
- **Đã xử lý từ phiếu 1:** bỏ chữ `null` ở Kiểm tra cuối, chặn lặp Lời thoại khi đổi tab, toast lưu thẻ có viền xanh và tự đóng sau 5 giây. Bé Bot được chấm dựa trên các câu trích từ thẻ; đã thêm kiểm thử tình huống thiếu vế so sánh chatbot ở slide 2. Ba lỗi giao diện đã được kiểm tra trên trình duyệt local trước khi phát hành. Không suy ra rằng mọi trường hợp chấm lệch đã hết.
- **Cần kiểm lại trước:** lỗi kẹt ở bước chọn thẻ sau khi mở trận với Sổ tay trống, mất bản nháp thẻ thứ hai khi lưu thẻ thứ nhất, và trường hợp có ý đúng nhưng bị 0 điểm. Tìm kiếm không có kết quả, mở rộng Nhắc bài và thao tác chọn đối thủ là các góp ý còn lại; chưa xác nhận đã sửa.
- **Giữ:** luồng đọc slide → viết thẻ → đấu → xem lại kiến thức thiếu kèm số slide (phiếu 1 và 3 thích cách học/ôn lại); tour Hướng dẫn bám đúng nút và tab (phiếu 3).
- **Giới hạn:** chưa xác nhận cả 3 phiếu đều ngoài nhóm; không có quan sát trực tiếp hay câu hỏi “rất tiếc / hơi tiếc / không sao”. Ghi nhận đã dùng thử và có feedback, chưa đánh dấu hoàn thành quy trình bonus hoặc điều kiện cứng (4).
