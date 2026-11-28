# Dàn slide → lấy số từ file nào

> Làm ở guide bước 5.1. Luật: **không có bằng chứng thì không có slide** — mỗi trang ≥1 con số / trích dẫn có nguồn / kết quả đo.
> Xuất PDF thành `demo-slides.pdf` ở thư mục gốc repo, nộp tại CP4 14:30 Thứ Bảy 28/11. Nộp PDF, không nộp link.

| Trang (~5 phút tổng) | Nội dung | Nguồn |
|---|---|---|
| 1 · 30 giây | Giới thiệu nhóm H4ppy và ý chính: học viên tự giải thích cho bạn học AI. Nếu nhắc web Lớp học tranh tài, nói rõ đó là bản mở rộng; 3/3 phiếu muốn dùng web để ôn, không phải kết quả đo học A4. | `spec.md` §4, §10 · `validation/log.md` |
| 2 · 55 giây | Khảo sát: 14/20 phải hỏi hoặc xem lại, khoảng 9 phút/lần. Nhật ký: 2.099/2.153 lượt câu hỏi xen video bị bỏ qua; 354/431 học viên mở video nhưng không nộp câu ôn. Khoảng 680 giờ/tháng là ước tính quy mô vấn đề (302 × 15 × 9 phút), không phải thời gian công cụ đã tiết kiệm. | `evidence/summary.md` · `spec.md` §2 |
| 3 · 90 giây | Chạy `python run.py` để diễn hai ca độc lập cùng một ý hiểu nhầm: B05 (“ừ đúng rồi”, AI hỏi lại) và B01 (giải thích ứng dụng giữ lịch sử, AI chốt kèm mã `chatbot_is_app_around_model`). Chỉ ra giới hạn 2 lượt hỏi lại; vẫn sai thì sửa theo đoạn bài. Lời thoại trên slide được rút gọn, không đọc như bản ghi nguyên văn. | `spec.md` §4 · `eval/benchmark.csv` |
| 4 · 65 giây | Lượt 1: 20/23 đã soát. Lượt 2: CSV ghi 21/23, B23 còn tranh luận. Lượt 7: 23/23 chấm nháp; từ chối đúng 5/5, không xác nhận ý sai 7/7, giữ giới hạn hỏi 2/2. Ví dụ cải tiến: B19 không còn được khen hiểu đúng chỉ vì đoán. Chưa kết luận đạt vì chưa có phép đo với học viên. | `eval/report.md` · `validation/log.md` |
| 5 · 60 giây | Chi phí model mô phỏng 50 phiên; hai mức giá cho chi phí mỗi phiên thành công $0,00066 và $0,0038, tính theo 21/23 của CSV lượt 2. Quy mô 144/431/721 học viên: $1,16–$6,70 / $3,48–$20,05 / $5,82–$33,55 mỗi tháng. Ưu tiên đo số đúng trước → sau ở ≥5 phiên, ≥3 học viên L3 ngoài nhóm, ≥3 đoạn bài; mục tiêu ≥80% phiên có câu trả lời đúng sau phiên. | `cost/cost-estimate.md` · `validation/log.md` |

- [x] [Bản HTML](demo-slides.html) và [PDF 5 trang](../demo-slides.pdf).
- Xuất lại PDF: mở bản HTML trong Chrome/Edge, in **Lưu dưới dạng PDF**, bật **Đồ họa nền**, tắt **Đầu trang và chân trang**. Bản in tự dàn 5 trang 16:9, không kèm nút chuyển trang.
- [x] [Video demo web `hackathon-demo.mp4` (3:29)](https://drive.google.com/file/d/1kzLabK15aN_Y1BEWBKOFemYfZozTXG80/view?usp=sharing) — đã mở được trình xem Drive khi chưa đăng nhập.
- [ ] Xác nhận clip dự phòng có đủ hai ca A4 B01/B05; clip demo web không mặc nhiên thay cho hai ca này.
- [ ] Chốt ai nói phần nào trước khi lên; tự kiểm bản demo trên máy trình chiếu.

**Cảnh quay 30 giây (CP3):** dùng luồng nộp A4, không mở `.env` trên màn hình. Chuẩn bị `python run.py` với model thật; nhập một ca B01 hoặc B05 từ `eval/benchmark.csv`, cho thấy kết quả và dòng `model`, số lần gọi và token khác 0. Đăng YouTube Unlisted hoặc Drive với quyền “ai có liên kết đều xem được”; mở URL trong cửa sổ ẩn danh trước khi dán vào form.

**Video dự phòng (CP4):** quay đủ hai ca B01 và B05, nói một câu về sự khác nhau giữa chốt có nguồn và hỏi vặn. Có thể tái sử dụng video CP3 nếu video đó cũng cho thấy cả hai ca. Gắn URL vào `README.md` sau khi kiểm quyền xem.

**Trước khi lên:** tải repo về một máy khác (hoặc thư mục mới), chạy theo mục "Chạy trong 3 phút" của `README.md` · `.env` có trên máy demo, đã gọi thử 1 câu trong vòng 1 giờ trước giờ demo · video dự phòng mở được bằng cửa sổ ẩn danh · biết bản chạy thử sẽ làm gì với **1 câu thử lạ** của giám khảo.

