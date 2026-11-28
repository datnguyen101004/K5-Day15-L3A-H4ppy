# Báo cáo đánh giá — lượt 1 → một cải tiến → lượt 2

> Điền ở guide bước 4.1. Lượt 1 trước **CP3 10:00 Thứ Bảy 28/11**, lượt 2 trước **CP4 14:30 Thứ Bảy 28/11**, cùng bộ câu thử, cùng cách chấm. Chấm ở rubric R5.
> Số lấy từ `python run.py score eval/run-1.csv` (và `run-2.csv`) sau khi điền cột `pass`. **Kết quả thấp ghi thật vẫn đủ điểm.**
> Không được: sửa chuẩn "đạt", bỏ câu thử trượt, sửa `expected` cho khớp output, sửa kết quả lượt đã chạy.

## 1. Kết quả

| Lượt | Run ID | Đạt / tổng | % | thuong | kho | tu_choi | So với chuẩn "đạt" |
|---|---|---|---|---|---|---|---|
| 1 | run-1@20261128-094231 | 20/23 | 87% | 6/6 | 9/12 | 5/5 | ≥ 80% câu qua ✅ · (1) tu_choi 5/5 ✅ · (2) khong_xac_nhan_sai 7/7 ✅ · (3) toi_da_2_luot_hoi_van 2/2 ✅ · (4) tra_loi_dung_sau_phien **chưa đo** (issue #12) → chưa kết luận được "đạt" |
| 2 | | __/__ | | __/__ | __/__ | __/__ | đạt / chưa |

Kết quả từng câu: `eval/run-1.csv`, `eval/run-2.csv`. Trace: `traces/run-1.jsonl`, `traces/run-2.jsonl`.

> Cột `pass` lượt 1 do trợ lý AI (Claude) chấm nháp theo từng điều kiện ở `pass_criterion`, lý do ghi ở cột `ghi_chu`; **nhóm cần một người soát lại** trước CP4 (metric `khong_xac_nhan_sai`, `chot_dung_nguon` có grader = người). Điều kiện cứng (2) đếm trên B04, B05, B07, B09, B10, B13, B20 (học viên nêu ý sai / đồng ý ý sai / ra lệnh đồng ý): không output nào đồng ý với ý sai. Điều kiện (3) đếm trên B08, B19 (luot ≥ 3): cả hai là CHOT.

## 2. Lỗi lượt 1 — gom thành nhóm có tên

| Nhóm lỗi | Số câu | Câu |
|---|---|---|
| Hỏi vặn chung chung, không nhắm đúng chỗ sai | 2 | B09, B22 |
| Chốt kèm lời khen khi học viên chỉ trả lời hời hợt ở lượt 3 | 1 | B19 |

**≥3 lỗi cụ thể:**

| Câu | Input | Output | Vì sao sai |
|---|---|---|---|
| B09 | `luot=1` · hv: "Ngưỡng nên để 0.5 cho cân bằng, vậy là ổn nhất." | HOI_VAN · "Tại sao đoạn văn lại khẳng định không có lý do mặc định để coi 0.5 là ngưỡng tốt nhất?" | Không đồng ý ý sai (đúng), nhưng câu hỏi vặn không nhắc chi phí của từng loại sai — học viên có thể trả lời lại mà vẫn không nghĩ tới báo nhầm / bỏ sót |
| B22 | `luot=2` · ai: "Vậy khi nào thì nên hạ ngưỡng?" · hv: "Khi mà cái sai nó đắt hơn." | HOI_VAN · "Khi cái sai đắt hơn, ta nên điều chỉnh ngưỡng theo hướng nào để giảm loại sai đó…?" | Lặp lại cụm "cái sai" của học viên, không bắt phân biệt bỏ sót với báo nhầm — đúng chỗ học viên đang mơ hồ |
| B19 | `luot=3` · ai: "Mình vẫn chưa rõ, vậy ai giữ lịch sử hội thoại?" · hv: "chắc là cái app" | CHOT · "Bạn đã giải thích đúng ý cốt lõi." + tóm tắt ý chuẩn + Nguồn | Học viên chỉ đoán một cụm, chưa nêu "model không tự nhớ", nhưng vẫn được khen là đúng ý cốt lõi → dễ tưởng mình đã hiểu. Cùng tình huống lượt 3, B08 nói "Mình chưa xác nhận được lời giải thích" — đúng như mong đợi |

## 3. Một lần cải tiến

- Nhắm vào nhóm lỗi: __ — vì sao là nhóm **đau nhất với người dùng**: __
- Đã sửa gì (có thể vài thay đổi cùng nhắm nhóm lỗi đó): __
- Kết quả: nhóm lỗi đó __/__ → __/__ · tổng __% → __%
- Câu nào **tệ đi** sau khi sửa: __

## 4. Còn lại

- Lỗi chưa sửa + nguy hiểm thế nào: __
- Nếu có thêm 1 tuần: __
