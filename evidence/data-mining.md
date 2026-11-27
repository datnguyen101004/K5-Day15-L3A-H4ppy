# Đào data — cách đếm và kết quả

> Repo chỉ chứa số đã tổng hợp và mã ẩn danh. File gốc nằm ở `data-btc/preclass/` (đã gitignore, không commit).

## 1. Cách đếm — viết TRƯỚC khi chạy

- Data dùng: `data/preclass/` của repo đề (`events.csv` 107.709 dòng, `chat.csv` 1.260 dòng, `class_events.csv` 849 dòng), sự kiện từ 05/11 đến 25/11/2026.
- Đếm gì, trên tập nào (đơn vị là học viên `hv`, trừ M4 đếm theo lượt trả lời):
  - **M1:** học viên đã thấy ≥1 tin của bạn học AI (`agent_message_shown` có `agent_id` bắt đầu bằng `classmate_`) nhưng chưa từng gửi tin nào tới bạn học AI (`chat.csv`, `agent_id` = `classmate_*`).
  - **M2:** học viên có `video_opened` nhưng không có dòng nào trong `chat.csv`.
  - **M3:** học viên có `video_opened` nhưng không có `answer_submitted` nào với `nguon = pre_post_post`.
  - **M4:** lượt `answer_submitted` có `nguon = pre_post_post` và `lan_thu = 1` mà `correct = false`.
- **Mẫu số:**
  - M1: học viên đã thấy tin bạn học AI.
  - M2, M3: học viên đã mở ≥1 video.
  - M4: số lượt trả lời lần thử 1.
- Script: `python evidence/count.py` (chỉ dùng thư viện chuẩn, mặc định đọc `data-btc/preclass`).

## 2. Đọc trước, đếm sau

Đã đọc dòng đầu và phân bố giá trị của `actor`/`type` (`events.csv`), `channel`/`kind`/`agent_id` (`chat.csv`) và `type` (`class_events.csv`). Các *kiểu* hành vi thấy được:
- Xem video: `video_opened`, `video_seeked`, `video_segments_flushed` (có `pauses`, `rate_changes`, `hidden_count`), `video_ended`, cùng `app_visibility_changed` (30.948 dòng, sự kiện phổ biến nhất).
- Bạn học AI chủ động chen vào: `agent_message_shown` gồm `teaching_assistant` và 4 vai `classmate_*` (note_taker, deep_thinker, inquisitive, clown).
- Học viên tự lên tiếng: `chat_sent`, có 1.260 tin, phần lớn hỏi trợ giảng (`video_question` 1.090 tin). Chỉ 107 tin gửi tới bạn học AI.
- Tự kiểm tra: `quiz_item_opened` 2.153, `quiz_item_dismissed` 2.099, `answer_submitted` 2.516.
- `class_events.csv` chỉ có `director_decided` (quyết định chen vào của hệ thống, có `expected_icap`) và `app_started`. File này không cho biết học viên lúng túng trên lớp, nên không dùng để đếm hậu quả.

## 3. Kết quả

| Đếm gì | x / N | % | Ghi chú |
|---|---|---|---|
| M1: thấy tin bạn học AI nhưng không đáp lại lần nào | 245/276 | 88,8% | Đếm theo tin: 8.100 tin bạn học AI hiện ra, học viên đáp lại 107 tin (1,3%) |
| M2: mở video nhưng không gửi chat nào | 287/431 | 66,6% | Tính cả chat với trợ giảng |
| M3: mở video nhưng không nộp câu kiểm tra pre/post nào | 354/431 | 82,1% | Không tự kiểm chứng mức hiểu trong hệ thống |
| M4: câu kiểm tra pre/post sai ở lần thử 1 | 399/1968 | 20,3% | Chỉ tính những người có làm bài |

## 4. ≥5 ví dụ cụ thể (mã ẩn danh)

Học viên thuộc M1 (đã thấy nhiều tin của bạn học AI nhưng không đáp lại lần nào):
1. `L0204`: 288 tin bạn học AI hiện ra, 0 lần đáp lại
2. `L0247`: 271 tin, 0 lần đáp lại
3. `L0597`: 248 tin, 0 lần đáp lại
4. `L0325`: 212 tin, 0 lần đáp lại
5. `L0526`: 206 tin, 0 lần đáp lại

## 5. Giới hạn của data

- Data cho biết học viên **làm gì**, không cho biết **vì sao**. Ví dụ: không đáp lại vì tin của bạn học AI rời rạc, vì không cần, hay vì đã hiểu rồi?
- `chat.csv` không chứa nội dung tin nhắn (cột `transcript` chỉ trỏ tới file transcript của video), nên không lấy được trích dẫn nguyên văn từ data.
- Không có dữ liệu buổi thực hành trên lớp, nên chưa đo được hậu quả "lúng túng khi vào lớp".
- M3 không phân biệt được "không làm bài" với "làm bài ở nơi khác".

→ Kiểm lại bằng khảo sát ≥20 học viên L3 ngoài nhóm (`evidence/survey/questions.md`): vì sao bỏ qua tin của bạn học AI, sau khi xem video tự kiểm mức hiểu bằng cách nào, và đã lúng túng ở buổi thực hành lần nào chưa.
