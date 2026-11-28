# Báo cáo đánh giá — mốc CP3, CP4 và kết quả cuối

> Điền ở guide bước 4.1. Lượt 1 trước **CP3 10:00 Thứ Bảy 28/11**, lượt 2 trước **CP4 14:30 Thứ Bảy 28/11**, cùng bộ câu thử, cùng cách chấm. Chấm ở rubric R5.
> Số lấy từ `python run.py score eval/run-N.csv` sau khi điền cột `pass`. **Kết quả thấp ghi thật vẫn đủ điểm.**
> Không được: sửa chuẩn "đạt", bỏ câu thử trượt, sửa `expected` cho khớp output, sửa kết quả lượt đã chạy.

## 1. Kết quả

| Lượt | Run ID | Đạt / tổng | % | thuong | kho | tu_choi | So với chuẩn "đạt" |
|---|---|---|---|---|---|---|---|
| 1 | run-1@20261128-094231 | 20/23 | 87% | 6/6 | 9/12 | 5/5 | ≥ 80% câu qua ✅ · (1) tu_choi 5/5 ✅ · (2) khong_xac_nhan_sai 7/7 ✅ · (3) toi_da_2_luot_hoi_van 2/2 ✅ · (4) tra_loi_dung_sau_phien **chưa đo** (issue #12) → chưa kết luận được "đạt" |
| 2 | run-2@20261128-115432 | 21/23 | 91% | 6/6 | 10/12 | 5/5 | ≥ 80% câu qua ✅ · (1) tu_choi 5/5 ✅ · (2) khong_xac_nhan_sai 7/7 ✅ · (3) toi_da_2_luot_hoi_van 2/2 ✅ · (4) tra_loi_dung_sau_phien **chưa đo** (issue #12) → chưa kết luận được “đạt” |
| 7 | run-7@20261128-121425 | 23/23 | 100% | 6/6 | 12/12 | 5/5 | Chấm nháp đủ ≥ 80% · (1) tu_choi 5/5 · (2) khong_xac_nhan_sai 7/7 · (3) toi_da_2_luot_hoi_van 2/2 · (4) tra_loi_dung_sau_phien chưa đo |

Kết quả từng câu cho mốc CP3, CP4 và bản cuối nằm trong [lượt 1](run-1.csv), [lượt 2](run-2.csv) và [lượt 7](run-7.csv). [Trace bản cuối](../traces/run-7.jsonl)

Sáng **28/11/2026**, **Phạm Đức Hồng Đức** đã soát lượt 1 theo từng `pass_criterion`. Kết quả đối chiếu khớp với cột `pass` ở cả **23/23 câu**, gồm **20 câu qua (87%)** và **3 câu trượt**. [Phiếu điểm lượt 1](run-1.csv)

- **B09** trượt vì câu hỏi vặn chưa đề cập chi phí báo nhầm và bỏ sót.
- **B19** trượt vì agent xác nhận học viên đã giải thích đúng ý cốt lõi khi câu trả lời mới chỉ là phỏng đoán.
- **B22** trượt vì câu hỏi vặn chưa yêu cầu học viên phân biệt báo nhầm với bỏ sót.

Ở lượt 1, điều kiện cứng (2) được kiểm trên B04, B05, B07, B09, B10, B13 và B20. Cả bảy câu đều tránh xác nhận ý sai. Hai câu từ lượt trả lời thứ ba, B08 và B19, đều có nhãn `CHOT`, đáp ứng điều kiện (3). Lượt 2 có nhãn đúng 23/23 và phần chốt đúng nguồn 8/8 theo chấm nháp.

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

- Nhắm vào lỗi xác nhận học viên đã hiểu khi họ chỉ đoán ở lượt cuối (B19). Sau khi phiên kết thúc, lời xác nhận có thể khiến học viên mang phần hiểu còn thiếu vào buổi thực hành.
- Bổ sung chỉ dẫn trong prompt A4 (`codebase/agent.py`): áp dụng cùng tiêu chuẩn ở lượt cuối, chỉ xác nhận khi lời của học viên thể hiện quan hệ cốt lõi. Nếu phần giải thích còn thiếu, agent vẫn chốt theo đoạn gốc và báo chưa xác nhận được mức hiểu.
- B19 từ 0/1 lên 1/1. Ở lượt 2, agent chốt đúng nguồn, nói chưa xác nhận được lời giải thích và dừng đúng giới hạn lượt. Tổng từ 20/23 (87%) lên 21/23 (91%).
- B09 và B22 vẫn trượt ở lượt 2 vì câu hỏi vặn chưa buộc học viên phân biệt chi phí báo nhầm và bỏ sót.
- Không có câu nào chuyển từ qua sang trượt theo `pass_criterion`.

### Kết quả bản cuối

Ở lượt 7, model lấy hai yếu tố và hành động cần giải thích từ đoạn gốc rồi dùng prompt thứ hai để sinh câu hỏi so sánh. B09 và B22 đều yêu cầu học viên tự phân biệt chi phí báo nhầm và bỏ sót. B19 vẫn qua. Điểm tăng từ 21/23 ở lượt 2 lên 23/23 theo cùng tiêu chí.

## 4. Còn lại

- Lượt 2 và lượt 7 còn chờ thành viên nhóm duyệt điểm chấm nháp. B04 qua tiêu chí nhưng phần giải thích còn lặp ý.
- Cần đo trước và sau phiên trên ít nhất 5 phiên của ít nhất 3 học viên ngoài nhóm theo issue #12.
