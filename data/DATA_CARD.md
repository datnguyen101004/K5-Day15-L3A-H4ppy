# Data card — dữ liệu bản chạy thử dùng

> Bản đầu CP2 (27/11). Đủ ở CP3. Chấm ở rubric R4.
> Không commit nguyên tài liệu khoá, dữ liệu cá nhân thật hay nguyên file data BTC cấp — chỉ đoạn trích ngắn, bản viết lại, hoặc số đã tổng hợp.

## Dataset 1 · Đoạn bài khái niệm pre-class có mã đoạn (`data/passages.csv`)

| | |
|---|---|
| Dùng để làm gì | Nguồn sự thật cho công cụ `get_passage` (`codebase/tools.py`): AI đối chiếu lời giải thích của học viên với đoạn gốc, rồi hỏi vặn hoặc chốt kiến thức đúng · nguồn cho câu thử trong `eval/benchmark.csv` |
| Từ đâu | Codex soạn 5 đoạn minh họa dựa trên tên và nội dung khái niệm công khai trong PR #5, cùng một đoạn mẫu CP2 về dữ liệu huấn luyện và đánh giá (`A4-01`). |
| Xử lý những bước gì | Mỗi khái niệm có một đoạn ngắn chứa các ý cốt lõi. Mã khái niệm khớp đầu vào bộ đánh giá. Giữ mã `A4-01` để chạy demo cũ. Soạn trực tiếp, không sinh bằng script hoặc seed. |
| Số dòng / số đoạn | 6 đoạn |
| Phiên bản / ngày lấy | v1 · 27/11/2026 |
| Nhãn | `synthetic` · dữ liệu minh họa để chạy thử CP2 |
| Giới hạn | Chưa có người thứ hai đối chiếu với video hoặc tài liệu pre-class. Nhóm cần soát nội dung với bài gốc trước khi dùng để đánh giá model thật. |

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
