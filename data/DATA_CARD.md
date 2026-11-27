# Data card — dữ liệu bản chạy thử dùng

> Bản đầu CP2 (27/11). Đủ ở CP3. Chấm ở rubric R4.
> Không commit nguyên tài liệu khoá, dữ liệu cá nhân thật hay nguyên file data BTC cấp — chỉ đoạn trích ngắn, bản viết lại, hoặc số đã tổng hợp.

## Dataset 1 · Đoạn bài khái niệm pre-class có mã đoạn (`data/passages.csv`)

| | |
|---|---|
| Dùng để làm gì | Nguồn sự thật cho công cụ `get_passage` (`codebase/tools.py`): AI đối chiếu lời giải thích của học viên với đoạn gốc, rồi hỏi vặn hoặc chốt kiến thức đúng · nguồn cho câu thử trong `eval/benchmark.csv` |
| Từ đâu | Nhóm tự viết lại (tóm ý, không chép nguyên văn) từ bài pre-class của khoá AI20K, buổi Day__ — bài: __ |
| Xử lý những bước gì | Chọn __ khái niệm cốt lõi · mỗi khái niệm viết thành 1 đoạn ngắn (≤ 120 chữ) · gán mã đoạn dạng `D<ngày>-<số>` (vd `D05-01`) · mỗi đoạn kèm 1–3 "ý cốt lõi" để đối chiếu · người thứ hai trong nhóm soát lại so với bài gốc |
| Số dòng / số đoạn | __ đoạn *(chốt khi xong issue #3)* |
| Phiên bản / ngày lấy | v1 · 27/11/2026 |
| Nhãn | Viết lại từ tài liệu thật của khoá (không phải `synthetic`) — **không phải bằng chứng pain** |
| Giới hạn | Chỉ phủ vài khái niệm của một buổi, không phủ cả bài · bản viết lại có thể lược mất sắc thái so với video gốc · ý cốt lõi do nhóm chọn, có thể lệch với điều giảng viên nhấn mạnh |

## Dataset 2 · Nhật ký hành vi trang pre-class (`data/preclass/` do BTC cấp)

| | |
|---|---|
| Dùng để làm gì | Đào bằng chứng pain (cách đếm và script: `evidence/data-mining.md`) — **không** đưa vào bản chạy thử, **không** gửi vào model |
| Từ đâu | Data BTC cấp, `data/preclass/` trong repo đề. Để local ở `data-btc/preclass/` (đã có trong `.gitignore`), **không commit nguyên file** |
| Xử lý những bước gì | BTC đã ẩn danh: không tên / email / SĐT / IP, mọi mã đã thay mới, không có bảng đối chiếu, chỉ giữ học viên. Nhóm: chỉ đọc, đổi giờ UTC → giờ VN (+7), lọc mẫu số theo 436 người có hoạt động · trong repo chỉ để số đã tổng hợp và vài dòng trích làm ví dụ |
| Số dòng / số đoạn | `learners.csv` 721 · `events.csv` 107.709 · `class_events.csv` 849 · `answers.csv` 3.776 · `chat.csv` 1.260 · `completed_items.csv` 2.472 · `rewards.csv` 228 (theo `data/preclass/README.md` của BTC) |
| Phiên bản / ngày lấy | Dữ liệu 05/11/2026 → 25/11/2026 (Day01 → Day13) · nhóm nhận 27/11/2026 |
| Nhãn | Thật (đã ẩn danh) |
| Giới hạn | **Không có câu chữ học viên viết**, chỉ có độ dài → không đọc được nội dung giải thích, phần "vì sao" phải lấy từ phỏng vấn · 721 tài khoản nhưng chỉ 436 người có hoạt động → chọn đúng mẫu số · chỉ một khoá, 13 ngày đầu, chưa chắc đại diện cho giai đoạn sau · một số trạng thái chấm đã gộp vào `bo_qua` |

**Luật dùng (BTC):** không cố đoán ai là ai · không xếp hạng học viên · không đăng lại nguyên file.
