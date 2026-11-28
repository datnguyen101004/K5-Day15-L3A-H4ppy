# Khai báo dùng AI

README của nhóm có mục "Dùng AI vào việc gì" (2–3 dòng, bắt buộc). Ghi chi tiết vào bảng dưới đây.

> Luật của đề: dùng AI để làm bài thoải mái, nhưng **ai không giải thích được phần có tên mình thì phần đó nhận 0 điểm**. Khai thiếu không bị trừ; giấu mới bị.

| Việc | Công cụ AI | AI làm gì | Người kiểm/sửa gì | Ai phụ trách |
|---|---|---|---|---|
| Code bản chạy thử A4 | Chưa có ghi nhận công cụ soạn mã cho các commit này | `codebase/agent.py`, `tools.py` và tích hợp model có lịch sử ở #3, #11 | Người phụ trách xác nhận phần AI hỗ trợ, nếu có; không suy ra từ tên người commit | Phạm Đức Hồng Đức |
| Prompt / thiết kế lời gọi mô hình A4 | `qwen3.7-plus` chạy suy luận, không đồng nghĩa đã dùng để soạn prompt | Đối chiếu giải thích với đoạn gốc và sinh câu hỏi về sự đánh đổi ở lượt 7 | Đã lưu prompt trong code và trace trong repo; lượt 2 và 7 còn chờ duyệt điểm | Phạm Đức Hồng Đức |
| Đào data (viết script đếm, gợi ý nhãn) | Claude (coding agent) | Viết `evidence/count.py` (đếm M1–M4 trên `data/preclass/`) và `evidence/survey/count_survey.py`; đề xuất cách đếm ở `evidence/data-mining.md` §1 | Chạy lại cả hai script ra cùng số; đọc lại 21 phiếu trong `evidence/survey/results.csv`, lọc ra 20 phiếu hợp lệ (bỏ 1 phiếu lab coach), khớp số của script | Phạm Nguyễn Tất Đạt |
| Rà câu hỏi phỏng vấn / khảo sát | Claude (coding agent) | Soạn nháp 11 câu khảo sát theo `evidence/survey/TEMPLATE.md`, chỉ hỏi hành vi đã xảy ra, không nhắc giải pháp | Nhóm sửa trước khi đưa lên Google Form; câu trả lời do học viên thật điền | Phạm Nguyễn Tất Đạt |
| Viết câu thử (benchmark) | Claude Opus (Co-Authored-By trong commit `be7f8aa`) | Hỗ trợ soạn bộ thử 14 câu và metric ở CP2 | Bộ thử có cột `source`; hai người đã chấm thử độc lập 5 output (xem `eval/second-grader.md`) | Ngô Gia Bảo |
| Soạn đoạn bài minh hoạ | Codex | Soạn 5 đoạn viết lại theo mã ý kiến thức trong `data/passages.csv` | Không dùng seed; chưa có xác nhận đã soát các đoạn với bài giảng gốc (xem `data/DATA_CARD.md`) | Nguyễn Ngọc Toàn |
| Chấm cột `pass` bằng LLM (nếu có) | Không dùng | — | Phiếu chấm thử 5 output do 2 người chấm tay, khớp 5/5 (`eval/second-grader.md`) | — |
| Slide, văn bản | Claude (coding agent) | Soạn nháp `evidence/summary.md`, `evidence/data-mining.md`, `spec.md` §0–§3, §6, `canvas.md` dòng 4 | Người phụ trách đọc lại, đối chiếu mọi số với script và `evidence/survey/results.csv` | Phạm Nguyễn Tất Đạt |
| Rà soát hồ sơ CP1–CP4 | Codex | Đối chiếu lịch sử Track/chuẩn đạt, trích dẫn ẩn danh, báo cáo eval, mô phỏng và ghi nhận dùng thử | Không chấm thay thành viên nhóm, không điền phiên học chưa có, không sửa benchmark hay bản chạy | Nhóm H4ppy |

**Không dùng AI để:** tạo người được phỏng vấn, trích dẫn, câu trả lời khảo sát; sửa kết quả các lượt đã chạy (`eval/run-*.csv`, `cost/simulate-*.csv`, `traces/`).
