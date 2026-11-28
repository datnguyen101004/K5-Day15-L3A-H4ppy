# Data card — dữ liệu bản chạy thử dùng

> Bản đầu CP2 (27/11). Đủ ở CP3. Chấm ở rubric R4.
> Không commit nguyên tài liệu khoá, dữ liệu cá nhân thật hay nguyên file data BTC cấp — chỉ đoạn trích ngắn, bản viết lại, hoặc số đã tổng hợp.

## Dataset 1 · Đoạn bài khái niệm pre-class có mã đoạn (`data/passages.csv`)

| | |
|---|---|
| Dùng để làm gì | Nguồn sự thật cho công cụ `get_passage` (`codebase/tools.py`): AI đối chiếu lời giải thích của học viên với đoạn gốc, rồi hỏi vặn hoặc chốt kiến thức đúng · nguồn cho câu thử trong `eval/benchmark.csv` |
| Từ đâu | 5 mã đoạn là `kc_code` (mã ý kiến thức) có thật trong `data/preclass/answers.csv`; mỗi đoạn viết lại ngắn theo đúng ý mà mã đó và câu ôn cuối ngày của bài nhắm tới (bảng nguồn bên dưới). `A4-01` do nhóm tự viết cho demo CP2, không gắn bài pre-class nào. Không chép nguyên văn tài liệu khoá |
| Xử lý những bước gì | Mỗi mã một đoạn 2–4 câu, chỉ chứa ý cốt lõi để đối chiếu · mã đoạn giữ nguyên `kc_code` để khớp benchmark (#9) và agent (#11) · soạn tay, không sinh bằng script / seed |
| Số dòng / số đoạn | 6 đoạn (5 gắn bài pre-class + `A4-01`) |
| Phiên bản / ngày lấy | v1 · 27/11/2026 · nguồn mã: `data/preclass` 05–25/11/2026 |
| Nhãn | Viết lại theo ý kiến thức của khoá (5 đoạn) · `synthetic` (`A4-01`) — **không phải bằng chứng pain** |
| Giới hạn | **Chưa đối chiếu câu chữ với video / lời giảng pre-class** — data BTC chỉ có mã và tên bài, không có nội dung bài; người có tài khoản pre-class cần mở đúng bài ở bảng dưới để soát trước khi chạy lượt 2 · mỗi bài chỉ lấy 1 ý kiến thức, không phủ cả bài |

**Nguồn từng đoạn** (đếm trong `data/preclass/answers.csv`, dòng `nguon = pre_post_post`):

| Mã đoạn | Bài pre-class (`lesson_id`) · module | Câu ôn cuối ngày có cùng mã (`ref`) · số lần trả lời |
|---|---|---|
| `A4-01` | — (nhóm tự viết, demo CP2) | — |
| `chatbot_is_app_around_model` | `program-day01:ai-llm-foundation` · module-1 | `d01-on-chatbot-la-ung-dung` · 41 |
| `temperature_stability_not_truth` | `program-day01:ai-llm-foundation` · module-1 | `d01-on-temperature-khong-sua-sai` · 36 |
| `react_reasoning_acting_pattern` | `program-day03:chatbot-to-agentic-agent` · module-1 | `d03-on-buoc-quan-sat` · 18 |
| `cot_task_fit` | `program-day04:prompt-engineering-tool-calling` · module-1 | `d04-on-cot-hai` · 27 |
| `threshold_by_error_cost` | `program-day05:ai-product-thinking-and-requirement` · module-1 | `d05-on-chon-nguong` · 15 |

## Dataset 1b · Câu kiểm tra trước / sau phiên (`data/check_questions.csv`)

| | |
|---|---|
| Dùng để làm gì | Đo metric `tra_loi_dung_sau_phien` (`eval/metric_spec.yaml`, chỉ số về học của A4): học viên trả lời câu `truoc` trước phiên, câu `sau` sau phiên. **Agent không đọc file này** |
| Từ đâu | Nhóm tự viết, mỗi câu bám đúng ý trong đoạn cùng mã ở `data/passages.csv` |
| Xử lý những bước gì | Mỗi mã đoạn 2 câu trắc nghiệm 3 lựa chọn, cùng ý kiến thức nhưng khác tình huống (câu `sau` là áp dụng, không lặp lại câu `truoc`) · đáp án xếp đều A/B/C (4/4/4) để không đoán được theo vị trí · kiểm cấu trúc bằng assert (12 câu, đủ cặp, đáp án hợp lệ) |
| Số dòng / số đoạn | 12 câu (6 mã × 2) |
| Phiên bản / ngày lấy | v1 · 28/11/2026 |
| Nhãn | `synthetic` (nhóm tự viết) |
| Giới hạn | Chưa có người thứ hai soát độ khó · hai câu "tương đương" chỉ theo nhận định của nhóm, chưa đo thật độ khó của từng câu · trắc nghiệm 3 lựa chọn có 1/3 xác suất đoán đúng → phải báo kèm số câu `truoc` để thấy mức nền |

## Dataset 2 · Nhật ký hành vi trang pre-class (`data/preclass/` do BTC cấp)

| | |
|---|---|
| Dùng để làm gì | Đào bằng chứng pain (cách đếm và script: `evidence/data-mining.md`) — **không** đưa vào bản chạy thử, **không** gửi vào model |
| Từ đâu | Data BTC cấp, `data/preclass/` trong repo đề. Để local ở `data-btc/preclass/` (đã có trong `.gitignore`), **không commit nguyên file** |
| Xử lý những bước gì | BTC đã ẩn danh: không tên / email / SĐT / IP, mọi mã đã thay mới, không có bảng đối chiếu, chỉ giữ học viên. Nhóm: chỉ đọc, đổi giờ UTC → giờ VN (+7), lọc mẫu số theo 436 người có hoạt động · trong repo chỉ để số đã tổng hợp và vài dòng trích làm ví dụ |
| Số dòng / số đoạn | `learners.csv` 721 · `events.csv` 107.709 · `class_events.csv` 849 · `answers.csv` 3.776 · `chat.csv` 1.260 · `completed_items.csv` 2.472 · `rewards.csv` 228 (theo `data/preclass/README.md` của BTC) |
| Phiên bản / ngày lấy | Dữ liệu 05/11/2026 → 25/11/2026 (Day01 → Day13) · nhóm nhận 27/11/2026 |
| Nhãn | Thật (đã ẩn danh) |
| Giới hạn | **Không có câu chữ học viên viết**, chỉ có độ dài → không đọc được nội dung giải thích, phần "vì sao" phải lấy từ phỏng vấn · 721 tài khoản nhưng chỉ 436 người có hoạt động → chọn đúng mẫu số · chỉ một khoá, 13 ngày đầu, chưa chắc đại diện cho giai đoạn sau · một số trạng thái chấm đã gộp vào `bo_qua` |

**Luật dùng (BTC):** không cố đoán ai là ai · không xếp hạng học viên · không đăng lại nguyên file.

## Dataset 3 · Khảo sát học viên L3 (`evidence/survey/results.csv`)

| | |
|---|---|
| Dùng để làm gì | Bằng chứng pain (`evidence/summary.md`) · số người / số lần cho persona chi phí (`cost/personas.yaml`: câu 3, câu 5) — **không** đưa vào bản chạy thử |
| Từ đâu | Google Form, gửi qua group Zalo pre-class · mở 18:16, chốt 18:38 ngày 27/11/2026 (`evidence/survey/questions.md`) |
| Xử lý những bước gì | Bản xuất đã xoá mọi cột nhận ra người trả lời; bản gốc tên `raw-*` để local, đã gitignore · lọc phiếu hợp lệ = học viên L3A / L3B đã từng xem pre-class (`evidence/survey/count_survey.py`) |
| Số dòng / số đoạn | 21 phiếu · 20 hợp lệ (13 L3A, 7 L3B) · bỏ 1 phiếu lab coach |
| Phiên bản / ngày lấy | 27/11/2026 |
| Nhãn | Thật (tự khai, ẩn danh) |
| Giới hạn | Mẫu nhỏ, tự chọn (người trong group Zalo, thời gian mở 22 phút) → lệch về người hay tương tác · tự khai, nhớ lại "lần gần nhất" · **cần đối chiếu với bản gốc `raw-*`**: câu 10 của phiếu S4 trùng gần nguyên văn với một câu *mẫu hư cấu* do trợ lý AI viết khi nhóm soạn khảo sát — chưa xác nhận đây là câu trả lời thật thì chưa dùng làm trích dẫn |


## Dataset 4 · Bộ slide tự học về AI agent (`data/slides/ai-agent.pdf`)

| | |
|---|---|
| Dùng để làm gì | Tài liệu đầu vào của "Lớp học tranh tài" (`classroom/`): hiện slide, gợi ý thẻ, ra đề trong trận, nối câu hỏi phỏng vấn ở Kiểm tra cuối |
| Từ đâu | Nhóm tự soạn với trợ lý AI (28/11/2026), **không** phải slide BTC cấp; nội dung là kiến thức phổ thông về agent (workflow, tool calling, ReAct, bộ nhớ, RAG, guardrail, đánh giá, chi phí) |
| Xử lý những bước gì | Dựng thành PDF 20 trang, mỗi trang 1 tiêu đề + các gạch đầu dòng · app đọc bằng `pypdf`, bỏ đầu trang / chân trang lặp lại |
| Số dòng / số đoạn | 20 slide, 81 gạch đầu dòng (đếm bằng `classroom/rag.py`) |
| Phiên bản / ngày lấy | v1 · 28/11/2026 |
| Nhãn | `synthetic` (nhóm tự viết) |
| Giới hạn | Chưa được giảng viên soát nội dung · viết gọn kiểu slide, không phải bài giảng thật của lớp → chất lượng gợi ý / câu hỏi đo trên bộ này chưa chắc giữ nguyên với slide BTC |
