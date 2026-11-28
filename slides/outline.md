# Dàn slide → lấy số từ file nào

> Làm ở guide bước 5.1. Luật: **không có bằng chứng thì không có slide** — mỗi trang ≥1 con số / trích dẫn có nguồn / kết quả đo.
> Xuất PDF thành `demo-slides.pdf` ở thư mục gốc repo, nộp tại CP4 14:30 Thứ Bảy 28/11. Nộp PDF, không nộp link.

| Trang (~5 phút tổng) | Nội dung | Nguồn |
|---|---|---|
| 1 · 30 giây | Nhóm, luồng A4 và bản mở rộng Lớp học tranh tài | `spec.md` §4, §10 · 3 phiếu trong `validation/log.md` |
| 2 · 55 giây | Người dùng, pain, impact và lý do không chọn trợ giảng hỏi đáp | `evidence/summary.md` · `spec.md` §2 |
| 3 · 90 giây | Giải pháp và demo live: B01 (thường, chốt đúng nguồn) và B05 (khó, hỏi vặn khi học viên đồng ý với ý sai) | `spec.md` §4 · `eval/benchmark.csv` |
| 4 · 65 giây | 23 câu, lượt 1 → 2; lượt 7 chấm nháp; điều kiện đo trên người thật còn thiếu | `eval/report.md` · `validation/log.md` |
| 5 · 60 giây | Chi phí / task thành công, 3 quy mô; quyết định làm tiếp và ưu tiên tuần sau | `cost/cost-estimate.md` · `validation/log.md` |

- [x] [Bản HTML](demo-slides.html) và [PDF 5 trang](../demo-slides.pdf).
- [x] [Video demo web `hackathon-demo.mp4` (3:29)](https://drive.google.com/file/d/1kzLabK15aN_Y1BEWBKOFemYfZozTXG80/view?usp=sharing) — đã mở được trình xem Drive khi chưa đăng nhập.
- [ ] Xác nhận clip dự phòng có đủ hai ca A4 B01/B05; clip demo web không mặc nhiên thay cho hai ca này.
- [ ] Chốt ai nói phần nào trước khi lên; tự kiểm bản demo trên máy trình chiếu.

**Cảnh quay 30 giây (CP3):** dùng luồng nộp A4, không mở `.env` trên màn hình. Chuẩn bị `python run.py` với model thật; nhập một ca B01 hoặc B05 từ `eval/benchmark.csv`, cho thấy kết quả và dòng `model`, số lần gọi và token khác 0. Đăng YouTube Unlisted hoặc Drive với quyền “ai có liên kết đều xem được”; mở URL trong cửa sổ ẩn danh trước khi dán vào form.

**Video dự phòng (CP4):** quay đủ hai ca B01 và B05, nói một câu về sự khác nhau giữa chốt có nguồn và hỏi vặn. Có thể tái sử dụng video CP3 nếu video đó cũng cho thấy cả hai ca. Gắn URL vào `README.md` sau khi kiểm quyền xem.

**Trước khi lên:** tải repo về một máy khác (hoặc thư mục mới), chạy theo mục "Chạy trong 3 phút" của `README.md` · `.env` có trên máy demo, đã gọi thử 1 câu trong vòng 1 giờ trước giờ demo · video dự phòng mở được bằng cửa sổ ẩn danh · biết bản chạy thử sẽ làm gì với **1 câu thử lạ** của giám khảo.

