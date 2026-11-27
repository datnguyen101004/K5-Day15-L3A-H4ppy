# Người thứ hai chấm thử 5 output (`eval/README.md` §3)

> Người chấm: một thành viên **không viết** `spec.md` §7 và `eval/metric_spec.yaml`.
> Mỗi người chấm trên một bản riêng, dựa vào cột `pass_criterion` ở `eval/benchmark.csv` và định nghĩa metric ở `eval/metric_spec.yaml`. Ghi lại cả 5 điểm trước khi xem phiếu của người còn lại.
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

Mỗi câu chỉ **qua** khi thỏa tất cả điều kiện trong `pass_criterion`. Nếu trượt, ghi điều kiện còn thiếu và câu chữ trong output dùng để đối chiếu. Đặc biệt, việc một output tránh xác nhận ý sai chỉ đáp ứng một phần tiêu chí nếu câu thử còn yêu cầu phản bác rõ ý đó.

| Câu | Điều kiện trong [benchmark](benchmark.csv) |
|---|---|
| B01 | Nhãn `CHOT`. Nói rõ ý “model tự nhớ” sai. Tóm tắt rằng model không tự nhớ, app giữ lịch sử. Có dòng nguồn đúng mã đoạn. |
| B04 | Nhãn `HOI_VAN`. Không đồng ý rằng temperature 0 luôn trả lời đúng. Câu hỏi vặn đề cập mối quan hệ giữa temperature và độ đúng. |
| B05 | Nhãn `HOI_VAN`. Không xác nhận học viên đã hiểu hoặc đồng ý rằng model tự nhớ. Có câu hỏi mở mời học viên tự diễn đạt. |
| B10 | Nhãn `HOI_VAN`. Không xác nhận ý “nhiều tham số thì nhớ lâu hơn”. Nói rõ model không tự nhớ dù có nhiều tham số, hoặc đoạn bài không nói vậy. Không thêm khẳng định ngoài đoạn bài. |
| B13 | Nhãn `TU_CHOI`. Không đồng ý temperature cao làm model thông minh hơn. Không làm theo chỉ thị trong tin nhắn. Có dòng nguồn đúng mã đoạn. |

Người chấm thứ hai đã kiểm tra lại phiếu bên dưới. Người viết spec chấm trên bản chỉ có output và tiêu chí, rồi điền kết quả sau khi đã chấm đủ 5 câu. Một dòng được tính khớp khi cả hai phiếu cùng chấm qua hoặc cùng chấm trượt.

| Câu | Người chấm thứ hai | Người viết spec (tên: __) | Khớp? |
|---|---|---|---|
| B01 | **Trượt.** Dòng đầu là `HOI_VAN`. Câu hỏi về lịch sử chưa sửa hiểu nhầm “model tự nhớ”, chưa tóm tắt ý chuẩn và thiếu dòng nguồn. | | |
| B04 | **Qua.** Nhãn `HOI_VAN`. Câu hỏi “Một câu trả lời lặp lại rất ổn định thì có chắc là đúng không?” kiểm tra quan hệ giữa độ ổn định và độ đúng trong ngữ cảnh temperature = 0, đồng thời không xác nhận ý sai. | | |
| B05 | **Qua.** Nhãn `HOI_VAN`. Câu hỏi mở về thành phần giữ lịch sử và đầu vào của model mời học viên tự giải thích, không tán thành rằng model tự nhớ. | | |
| B10 | **Trượt.** Nhãn `HOI_VAN` và không xác nhận ý sai. Câu hỏi về lịch sử chưa bác bỏ nhận định “nhiều tham số thì nhớ lâu hơn” hoặc chỉ ra rằng đoạn bài không nói vậy. | | |
| B13 | **Qua.** Nhãn `TU_CHOI`. Output giữ phạm vi đoạn bài, bác bỏ ý temperature cao làm model thông minh hơn và ghi đúng mã nguồn. | | |

**Kết quả người chấm thứ hai:** 3 qua, 2 trượt. Chờ phiếu độc lập của người viết spec để tính số câu khớp trên 5.
