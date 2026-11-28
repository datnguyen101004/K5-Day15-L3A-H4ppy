# Tóm tắt mô phỏng simulate-2@20261128-125144

Do `python run.py simulate` sinh ra — không sửa tay. Chép bảng sang `cost/cost-estimate.md`.

| Persona | Số phiên mô phỏng | Lượt hỏi / phiên | Token vào / phiên | Token ra / phiên | Gọi model / phiên | Gọi công cụ / phiên |
|---|---:|---:|---:|---:|---:|---:|
| hoc_it | 15 | 1 | 1593 | 84 | 1.1 | 1.0 |
| hoc_vua | 29 | 1 | 1423 | 72 | 1.0 | 1.0 |
| hoc_nhieu | 6 | 3 | 4460 | 227 | 2.7 | 3.0 |

Tỉ lệ đạt dùng để tính: 21/23 (91%) — lượt run-2@20261128-115432

- Tỉ lệ đạt lấy từ lượt nhóm chọn: eval/run-2.csv (--rate-from). ⚠️ Lượt này chạy bằng qwen3.7-plus, mô phỏng đo trên mistral-medium-latest — khác model.

| Model (giá) | Chi phí / phiên | Chi phí / task thành công | Chi phí / câu hỏi đạt | Chi phí / tháng — thấp (144 người) | Chi phí / tháng — cơ sở (431 người) | Chi phí / tháng — cao (721 người) | Chi phí / người / tháng (cơ sở) |
|---|---:|---:|---:|---:|---:|---:|---:|
| gemini-3.1-flash-lite (vào 0.25 · ra 1.5 $/1M) | $0.00060 | $0.00066 | $0.00053 | $1.16 | $3.48 | $5.82 | $0.0081 |
| gemini-4-hydrogen (vào 1.5 · ra 7.5 $/1M) | $0.0035 | $0.0038 | $0.0031 | $6.70 | $20.05 | $33.55 | $0.0465 |

- Chi phí / task thành công = chi phí / phiên ÷ tỉ lệ đạt. Chi phí / câu hỏi đạt = chi phí / phiên ÷ số lượt hỏi trung bình mỗi phiên (1.2) ÷ tỉ lệ đạt — tỉ lệ đạt đo theo từng câu thử.
- Token đo trên model: mistral-medium-latest. Giá tính theo từng model trong bảng — model khác bộ tách token thì số token thật có thể lệch; ghi rõ "đo trên model X, tính giá model Y" trong cost/cost-estimate.md.
- Phiên lỗi (không tính vào trung bình): 0/50.
