# Chi phí khi dùng thật

> Điền ở guide bước 4.2, nộp ở CP4 14:30 Thứ Bảy 28/11. Ôn lại: ngày 13, ngày 1, ngày 14 · lab ngày 13, lab ngày 14. Chấm ở rubric R6.
> Số **không điền tay**: điền `cost/personas.yaml` → `python run.py simulate` → chép bảng trong `cost/simulate-N-summary.md` vào đây.
> Lúc build dùng gói miễn phí vẫn tính theo **giá gói trả phí** — đây là chi phí cho lúc đưa vào dùng thật.

## 1. Đầu vào

- **Persona** (`cost/personas.yaml`): 3 kiểu — `hoc_it` 25% · 4 phiên/tháng · 1 lượt; `hoc_vua` 60% · 8 phiên/tháng · 1 lượt; `hoc_nhieu` 15% · 24 phiên/tháng · 3 lượt. Nguồn: khảo sát câu 3 (số bài/tuần) và câu 5 (số lượt trả lời bạn học AI), n = 20, `evidence/survey/results.csv`; trần 3 lượt theo `canvas.md` dòng 6; ×4 tuần/tháng và 1 phiên/bài *(tự ước tính)*
- **Số người dùng thật** 3 kịch bản: thấp 144 · cơ sở 431 · cao 721. Nguồn: `data/preclass` 05–25/11/2026 — 431 học viên mở video; 144 = 431 − 287 người mở video mà không gửi chat nào; 721 tổng tài khoản (`evidence/data-mining.md`)
- **Giá** ≥2 mức model (từ `further-reading/model-prices.md` của repo đề, BTC xem 25/11/2026): `gemini-3.1-flash-lite` (Nhỏ) 0.25 / 1.50 USD mỗi 1M token vào / ra · `gemini-4-hydrogen` (Lớn) 1.50 / 7.50 — link https://ai.google.dev/gemini-api/docs/pricing
- **Tỉ lệ đạt** dùng để tính: 20/23 (87%) — lượt `run-1@20261128-094231` (**lượt 1, tạm thời**: lượt 2 — issue #24 — chưa chạy; có `run-2.csv` thì chạy lại `python run.py simulate --rate-from eval/run-2.csv` thành `simulate-2`, không sửa `simulate-1`)
- **Đo token trên model `mistral-medium-latest`, tính giá model `gemini-3.1-flash-lite` và `gemini-4-hydrogen`.** Hai lệch cần biết: (1) bộ tách token của Gemini khác Mistral nên số token thật có thể lệch; (2) tỉ lệ đạt đo trên `qwen3.7-plus` (model chạy eval lượt 1), không phải trên Mistral hay Gemini

## 2. Kết quả mô phỏng

Lượt mô phỏng: `cost/simulate-1.csv` · run ID `simulate-1@20261128-123454` · 50 phiên (0 phiên lỗi) · seed 42 · tóm tắt: `cost/simulate-1-summary.md`, trace: `traces/simulate-1.jsonl`

*(dán bảng từ `cost/simulate-N-summary.md`)*

| Model | Chi phí / phiên | Chi phí / task thành công | / tháng — thấp | / tháng — cơ sở | / tháng — cao | / người / tháng (cơ sở) |
|---|---|---|---|---|---|---|
| gemini-3.1-flash-lite (vào 0.25 · ra 1.5 $/1M) | $0.00038 | $0.00043 | $0.7335 | $2.20 | $3.67 | $0.0051 |
| gemini-4-hydrogen (vào 1.5 · ra 7.5 $/1M) | $0.0022 | $0.0025 | $4.22 | $12.63 | $21.12 | $0.0293 |

Token đo được mỗi phiên (từ `simulate-1-summary.md`): `hoc_it` 977 vào / 54 ra (1 lượt) · `hoc_vua` 873 / 45 (1 lượt) · `hoc_nhieu` 2.777 / 158 (3 lượt). Mỗi lượt ≈ 1 lần gọi model + 1 lần gọi `get_passage`.

Chi phí / task thành công = chi phí trung bình mỗi phiên ÷ tỉ lệ đạt — **không coi như đạt 100%**.

## 3. So với impact

- Impact / người / tháng (`spec.md` §2): ≈ 15 lần × 9 phút = **135 phút (≈ 2,25 giờ) hỏi lại / xem lại** mỗi học viên gặp pain
- Chi phí / người / tháng (cơ sở, 431 người): **$0.0051** (`gemini-3.1-flash-lite`) · **$0.0293** (`gemini-4-hydrogen`) — tức chưa tới 3 xu Mỹ / người / tháng ngay cả với model Lớn
- **Kết luận một dòng — đáng làm không:** Đáng làm về chi phí model: cả khoá (431 người) tốn $2.20–$12.63 / tháng, rất nhỏ so với ≈ 680 giờ học viên / tháng có thể tiết kiệm — nhưng impact đó chỉ thành thật khi metric học `tra_loi_dung_sau_phien` (issue #26) cho thấy học viên học được; chi phí model không phải điểm nghẽn, chất lượng học mới là điểm nghẽn

## 4. *(Muốn sâu hơn, không bắt buộc)*

- Bảng độ nhạy: model rẻ hơn · cache · cắt ngữ cảnh · giới hạn bước — mỗi cần gạt đổi chi phí bao nhiêu
- Chi phí ngoài model: hosting, lưu trữ, giờ công người duyệt
- Quy mô nào thì bài toán còn đáng làm
