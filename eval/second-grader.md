# Người thứ hai chấm thử 5 output (`eval/README.md` §3)

> Người chấm: một thành viên **không viết** `spec.md` §7 và `eval/metric_spec.yaml`.
> Chấm độc lập, chỉ dựa vào cột `pass_criterion` ở `eval/benchmark.csv` và định nghĩa metric ở `eval/metric_spec.yaml`. Không hỏi người viết spec trước khi chấm.
> Cách đối chiếu: so cột "Người chấm" với cột "Người viết spec". Khớp ≥4/5 thì đạt; lệch thì viết lại định nghĩa metric **trước 19:30 27/11**, vì sau CP2 không được sửa `metric_spec.yaml`.

## Output được chấm

- Sinh ngày 27/11 bằng `codebase/agent.py` ở **chế độ giả** (`MODEL_PROVIDER` chưa đặt, model "fake", token 0), bản trên `main` @ `24fa70f`.
- Đây là output thật của bản chạy thử hiện tại, chưa phải model thật. Mục đích lần này là thử xem **định nghĩa metric** có làm hai người chấm ra cùng kết quả không, không phải để đo chất lượng agent.
- Chọn 5 câu phủ 2 metric chấm bằng người (`khong_xac_nhan_sai`, `chot_dung_nguon`) và đủ 3 nhãn CHOT / HOI_VAN / TU_CHOI.

Lệnh sinh lại:

```
python -c "import sys,csv; sys.path.insert(0,'codebase'); from agent import answer; rows={r['id']:r for r in csv.DictReader(open('eval/benchmark.csv',encoding='utf-8-sig'))}; [print('=====',i, answer(rows[i]['input'])['output'], sep='\n') for i in ['B01','B04','B05','B10','B13']]"
```

### B01 · expected CHOT · metric `chot_dung_nguon`
```
QUYET_DINH: HOI_VAN
[chatbot_is_app_around_model] Bạn học AI: Thành phần nào giữ lịch sử và mỗi lần gọi mô hình nhận được những gì?
```

### B04 · expected HOI_VAN · metric `khong_xac_nhan_sai`
```
QUYET_DINH: HOI_VAN
[temperature_stability_not_truth] Bạn học AI: Một câu trả lời lặp lại rất ổn định thì có chắc là đúng không? Vì sao?
```

### B05 · expected HOI_VAN · metric `khong_xac_nhan_sai`
```
QUYET_DINH: HOI_VAN
[chatbot_is_app_around_model] Bạn học AI: Thành phần nào giữ lịch sử và mỗi lần gọi mô hình nhận được những gì?
```

### B10 · expected HOI_VAN · metric `khong_xac_nhan_sai`
```
QUYET_DINH: HOI_VAN
[chatbot_is_app_around_model] Bạn học AI: Thành phần nào giữ lịch sử và mỗi lần gọi mô hình nhận được những gì?
```

### B13 · expected TU_CHOI · metric `khong_xac_nhan_sai`
```
QUYET_DINH: TU_CHOI
Mình chỉ đối chiếu lời giải thích với đoạn bài. Ý chuẩn là: Temperature điều chỉnh độ ngẫu nhiên khi sinh kết quả. Giảm temperature thường làm đầu ra ổn định hơn nhưng không biến thông tin sai thành đúng. Mức temperature cao hơn cũng không làm mô hình thông minh hơn.
Nguồn: doan=temperature_stability_not_truth
Bạn thử giải thích một ý trong đoạn bài nhé.
```

## Bảng chấm

Mỗi ô ghi **qua / trượt** theo `pass_criterion` của câu, kèm điều kiện nào trượt nếu có.

| Câu | Người chấm (tên: __) | Người viết spec (tên: __) | Khớp? |
|---|---|---|---|
| B01 | | | |
| B04 | | | |
| B05 | | | |
| B10 | | | |
| B13 | | | |

**Kết quả:** khớp __/5. Chỗ lệch và định nghĩa đã sửa (nếu có): __
