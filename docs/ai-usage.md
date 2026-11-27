# Khai báo dùng AI

README của nhóm có mục "Dùng AI vào việc gì" (2–3 dòng, bắt buộc). Ghi chi tiết vào bảng dưới đây.

> Luật của đề: dùng AI để làm bài thoải mái, nhưng **ai không giải thích được phần có tên mình thì phần đó nhận 0 điểm**. Khai thiếu không bị trừ; giấu mới bị.

| Việc | Công cụ AI | AI làm gì | Người kiểm/sửa gì | Ai phụ trách |
|---|---|---|---|---|
| Code bản chạy thử | __ | __ | __ | Phạm Đức Hồng Đức (tự khai) |
| Prompt / thiết kế lời gọi mô hình | __ | __ | __ | Phạm Đức Hồng Đức (tự khai, issue #11) |
| Đào data (viết script đếm, gợi ý nhãn) | Claude (coding agent) | Viết `evidence/count.py` (đếm M1–M4 trên `data/preclass/`) và `evidence/survey/count_survey.py`; đề xuất cách đếm ở `evidence/data-mining.md` §1 | Chạy lại cả hai script ra cùng số; đọc lại 21 phiếu trong `evidence/survey/results.csv`, lọc ra 20 phiếu hợp lệ (bỏ 1 phiếu lab coach), khớp số của script | Phạm Nguyễn Tất Đạt |
| Rà câu hỏi phỏng vấn / khảo sát | Claude (coding agent) | Soạn nháp 11 câu khảo sát theo `evidence/survey/TEMPLATE.md`, chỉ hỏi hành vi đã xảy ra, không nhắc giải pháp | Nhóm sửa trước khi đưa lên Google Form; câu trả lời do học viên thật điền | Phạm Nguyễn Tất Đạt |
| Viết câu thử (benchmark) | Claude Opus (Co-Authored-By trong commit `be7f8aa`) | __ | Mỗi câu thử có `source`; câu thử AI viết được ghi rõ | Ngô Gia Bảo (tự khai) |
| Sinh data `synthetic` (nếu có) | Codex | Soạn 5 đoạn bài minh họa trong `data/passages.csv` (`data/DATA_CARD.md`) | Seed: không dùng · kiểm tay __ dòng | Nguyễn Ngọc Toàn (tự khai) |
| Chấm cột `pass` bằng LLM (nếu có) | Không dùng | — | Phiếu chấm thử 5 output do 2 người chấm tay, khớp 5/5 (`eval/second-grader.md`) | — |
| Slide, văn bản | Claude (coding agent) | Soạn nháp `evidence/summary.md`, `evidence/data-mining.md`, `spec.md` §0–§3, §6, `canvas.md` dòng 4 | Người phụ trách đọc lại, đối chiếu mọi số với script và `evidence/survey/results.csv` | Phạm Nguyễn Tất Đạt |

**Không dùng AI để:** tạo người được phỏng vấn, trích dẫn, câu trả lời khảo sát; sửa kết quả các lượt đã chạy (`eval/run-*.csv`, `cost/simulate-*.csv`, `traces/`).
