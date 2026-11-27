# Chi phí khi dùng thật

> Điền ở guide bước 4.2, nộp ở CP4 14:30 Thứ Bảy 28/11. Ôn lại: ngày 13, ngày 1, ngày 14 · lab ngày 13, lab ngày 14. Chấm ở rubric R6.
> Số **không điền tay**: điền `cost/personas.yaml` → `python run.py simulate` → chép bảng trong `cost/simulate-N-summary.md` vào đây.
> Lúc build dùng gói miễn phí vẫn tính theo **giá gói trả phí** — đây là chi phí cho lúc đưa vào dùng thật.

## 1. Đầu vào

- **Persona** (`cost/personas.yaml`): 3 kiểu — `hoc_it` 25% · 4 phiên/tháng · 1 lượt; `hoc_vua` 60% · 8 phiên/tháng · 1 lượt; `hoc_nhieu` 15% · 24 phiên/tháng · 3 lượt. Nguồn: khảo sát câu 3 (số bài/tuần) và câu 5 (số lượt trả lời bạn học AI), n = 20, `evidence/survey/results.csv`; trần 3 lượt theo `canvas.md` dòng 6; ×4 tuần/tháng và 1 phiên/bài *(tự ước tính)*
- **Số người dùng thật** 3 kịch bản: thấp 144 · cơ sở 431 · cao 721. Nguồn: `data/preclass` 05–25/11/2026 — 431 học viên mở video; 144 = 431 − 287 người mở video mà không gửi chat nào; 721 tổng tài khoản (`evidence/data-mining.md`)
- **Giá** ≥2 mức model (từ `further-reading/model-prices.md` của repo đề, BTC xem 25/11/2026): `gemini-3.1-flash-lite` (Nhỏ) 0.25 / 1.50 USD mỗi 1M token vào / ra · `gemini-4-hydrogen` (Lớn) 1.50 / 7.50 — link https://ai.google.dev/gemini-api/docs/pricing
- **Tỉ lệ đạt** dùng để tính: __/__ (__%) — lượt `run-__` (lượt 2) *(điền ở CP4)*
- Đo token trên model __, tính giá model `gemini-3.1-flash-lite` và `gemini-4-hydrogen` *(điền khi `codebase/ai.py` nối model thật)*

## 2. Kết quả mô phỏng

Lượt mô phỏng: `cost/simulate-__.csv` · run ID __ · __ phiên · seed __

*(dán bảng từ `cost/simulate-N-summary.md`)*

| Model | Chi phí / phiên | Chi phí / task thành công | / tháng — thấp | / tháng — cơ sở | / tháng — cao | / người / tháng (cơ sở) |
|---|---|---|---|---|---|---|
| | | | | | | |
| | | | | | | |

Chi phí / task thành công = chi phí trung bình mỗi phiên ÷ tỉ lệ đạt — **không coi như đạt 100%**.

## 3. So với impact

- Impact / người / tháng (`spec.md` §2): __
- Chi phí / người / tháng (cơ sở, model __): __
- **Kết luận một dòng — đáng làm không:** __

## 4. *(Muốn sâu hơn, không bắt buộc)*

- Bảng độ nhạy: model rẻ hơn · cache · cắt ngữ cảnh · giới hạn bước — mỗi cần gạt đổi chi phí bao nhiêu
- Chi phí ngoài model: hosting, lưu trữ, giờ công người duyệt
- Quy mô nào thì bài toán còn đáng làm
