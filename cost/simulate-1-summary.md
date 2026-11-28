# Tóm tắt mô phỏng simulate-1@20261128-123454

Do `python run.py simulate` sinh ra — không sửa tay. Chép bảng sang `cost/cost-estimate.md`.

| Persona | Số phiên mô phỏng | Lượt hỏi / phiên | Token vào / phiên | Token ra / phiên | Gọi model / phiên | Gọi công cụ / phiên |
|---|---:|---:|---:|---:|---:|---:|
| hoc_it | 15 | 1 | 977 | 54 | 0.9 | 1.0 |
| hoc_vua | 29 | 1 | 873 | 45 | 0.8 | 1.0 |
| hoc_nhieu | 6 | 3 | 2777 | 158 | 2.7 | 3.0 |

Tỉ lệ đạt dùng để tính: 20/23 (87%) — lượt run-1@20261128-094231

- Tỉ lệ đạt lấy từ lượt nhóm chọn: eval/run-1.csv (--rate-from). ⚠️ Lượt này chạy bằng qwen3.7-plus, mô phỏng đo trên mistral-medium-latest — khác model.

| Model (giá) | Chi phí / phiên | Chi phí / task thành công | Chi phí / câu hỏi đạt | Chi phí / tháng — thấp (144 người) | Chi phí / tháng — cơ sở (431 người) | Chi phí / tháng — cao (721 người) | Chi phí / người / tháng (cơ sở) |
|---|---:|---:|---:|---:|---:|---:|---:|
| gemini-3.1-flash-lite (vào 0.25 · ra 1.5 $/1M) | $0.00038 | $0.00043 | $0.00035 | $0.7335 | $2.20 | $3.67 | $0.0051 |
| gemini-4-hydrogen (vào 1.5 · ra 7.5 $/1M) | $0.0022 | $0.0025 | $0.0020 | $4.22 | $12.63 | $21.12 | $0.0293 |

- Chi phí / task thành công = chi phí / phiên ÷ tỉ lệ đạt. Chi phí / câu hỏi đạt = chi phí / phiên ÷ số lượt hỏi trung bình mỗi phiên (1.2) ÷ tỉ lệ đạt — tỉ lệ đạt đo theo từng câu thử.
- Token đo trên model: mistral-medium-latest. Giá tính theo từng model trong bảng — model khác bộ tách token thì số token thật có thể lệch; ghi rõ "đo trên model X, tính giá model Y" trong cost/cost-estimate.md.
- Phiên lỗi (không tính vào trung bình): 0/50.
