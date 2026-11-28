> Giờ, mốc, luật, rubric: xem `README.md`, `02-guide.md`, `03-rubric.md` trong repo đề (bộ đề BTC phát).

# H4ppy — Dạy lại bạn học AI: giải thích để hiểu bản chất (Track A4)

**Thành viên, lớp, track:** xem [TEAMS.md](TEAMS.md). **Điền TEAMS.md đúng format**: khi chấm và đánh giá, BTC quét file này để ghép điểm cho từng người.

*Lát cắt = phần nhỏ nhất làm xong được trong hackathon: một người dùng · một việc · một quyết định AI · một kết quả.*

---

## Nhóm làm gì, khung làm gì

| Nhóm quyết định và viết | Khung làm sẵn (không cần sửa) |
|---|---|
| Người dùng, pain, bằng chứng, impact (`evidence/`, `spec.md` §1–§2) | — |
| Hình dạng giải pháp, công cụ, prompt, luồng (`spec.md` §4, `codebase/agent.py`, `tools.py`, `ai.py`) | Ghi mọi lần gọi model / công cụ vào trace, cộng token (`codebase/tracing.py`) |
| Bộ câu thử, metric, chuẩn "đạt" (`eval/benchmark.csv`, `eval/metric_spec.yaml`, `spec.md` §7) | Kiểm đủ cột, đủ câu `kho` / `tu_choi`, đủ ≥1/3 câu từ người dùng / data thật (`run.py check`) |
| Chấm cột `pass` theo metric spec | Chạy cả bộ một lệnh, có run ID, model, token từng câu (`run.py eval`) · tính % đạt (`run.py score`) |
| Persona, số người dùng thật, giá model (`cost/personas.yaml`) | Sinh ~50 phiên, chạy thật qua bản chạy thử, tính chi phí / phiên, / task thành công, / tháng 3 kịch bản (`run.py simulate`) |

*Ví dụ track A (ví dụ cỡ, không phải lời giải):* nhóm viết công cụ `search_lesson` tra bài pre-class đã đánh mã đoạn, luồng "tra đoạn → model trả lời kèm mã đoạn, không có thì nói không có", metric "mọi khẳng định có mã đoạn đúng", persona "ôn dồn trước kiểm tra". Khung chạy 25 câu thử ra `run-1.csv`, nhóm chấm `pass`, `score` in % đạt; `simulate` chạy 50 phiên ra chi phí / task thành công cho hai model.

## Chạy trong 3 phút

Bộ khung cần **Python 3.10 trở lên** (Python 3.9 có sẵn trên macOS vẫn chạy được, chỉ in một dòng nhắc). **Không cần `pip install`.**

**Bước 1 — Mở cửa sổ lệnh ngay trong thư mục repo**

| Windows (PowerShell) | macOS |
|---|---|
| Mở thư mục repo bằng File Explorer → bấm vào thanh địa chỉ → gõ `powershell` → Enter | Mở **Terminal** (Cmd + Space, gõ "Terminal") → gõ `cd ` (có dấu cách) → kéo thả thư mục repo vào → Enter |

Gõ `dir` (Windows) hoặc `ls` (macOS / Linux): thấy `run.py` và `README.md` là đang đứng đúng chỗ.

**Bước 2 — Kiểm Python và chạy thử**

| Việc | Windows (PowerShell) | macOS / Linux |
|---|---|---|
| Kiểm Python | `python --version` (không được thì `py --version`) | `python3 --version` |
| Chạy bản chạy thử (chế độ giả, chưa gọi model) | `python run.py` | `python3 run.py` |
| Kiểm bộ câu thử | `python run.py check` | `python3 run.py check` |
| Tạo file `.env` để nối model | `copy .env.example .env` | `cp .env.example .env` |

- Windows: gõ `python` mà mở Microsoft Store hoặc báo không có lệnh → dùng `py`. Chưa có Python: cài từ python.org, **tick "Add python.exe to PATH"**, mở lại PowerShell.
- macOS: báo `command not found: python` là bình thường → dùng `python3`.
- `python run.py` in ra "[câu trả lời giả — chưa nối model] …" là khung chạy đúng. Nối model thật: [docs/connect-model.md](docs/connect-model.md).

Trong README này lệnh viết là `python …`; máy nhóm cần `python3` hay `py` thì gõ thay.

## Lệnh

| Lệnh | Làm gì |
|---|---|
| `python run.py` | Chạy bản chạy thử (gõ đầu vào, nhận kết quả, kèm số lần gọi model / token) |
| `python run.py check` | Kiểm `eval/benchmark.csv` (6 cột, số câu, `kho` / `tu_choi`, mã `source`, ô trống, dòng mẫu) `eval/metric_spec.yaml` (≥3 metric điền đủ) và `TEAMS.md` (đúng format để BTC quét). Chỉ cảnh báo, không sửa file |
| `python run.py eval --try` | **Thử nối model:** chạy 3 câu đầu (`--try 5` = 5 câu) → `eval/run-try.csv`. Thấy "Nối model được" là xong. Không tính là một lượt |
| `python run.py eval` | Chạy cả bộ qua `codebase/agent.py` → `eval/run-1.csv` (lần sau `run-2.csv`…) + `traces/run-1.jsonl`. Mỗi dòng có run ID, model, số lần gọi model / công cụ, token. Model còn giả → chỉ ghi `run-mock.csv`; mọi câu lỗi → `run-error.csv`; Ctrl+C → `run-stopped.csv` — đều **không** được đánh số |
| `python run.py eval --fake` | Thử riêng bộ chạy, không gọi agent → `eval/run-fake.csv` |
| `python run.py score eval/run-1.csv` | Sau khi điền cột `pass` (1 / 0): in % đạt tổng và theo `type`. Còn ô trống → "CHƯA CHẤM XONG", không in % |
| `python run.py simulate --try` | Thử mô phỏng chi phí 10 phiên (làm trước CP3) → `cost/simulate-try.csv` |
| `python run.py simulate` | Mô phỏng chi phí khi dùng thật theo `cost/personas.yaml` (≥50 phiên) → `cost/simulate-N.csv` + `cost/simulate-N-summary.md` |
| `python run.py simulate --rate-from eval/run-2.csv` | Như trên, lấy tỉ lệ đạt từ đúng lượt chỉ định. Không ghi thì khung lấy lượt `run-N` mới nhất đã chấm, cùng model, và ghi rõ đã lấy lượt nào trong bản tóm tắt |

Gói miễn phí báo hết lượt: thêm `--wait 4` sau `eval` hoặc `simulate` (nghỉ 4 giây giữa hai lượt gọi). Sửa CSV bằng Excel: *File → Save As → CSV UTF-8*; Google Sheets: *Tệp → Tải xuống → CSV*.

**Lượt có lỗi kỹ thuật** (cột `error` có chữ): không sửa tay file đó, chạy lại thành lượt mới và ghi vào bảng các lượt ở `eval/README.md`. Không xoá file lượt nào.

Nhóm dùng stack khác (Node, Streamlit, notebook…): sửa hàm `run_app()` trong `run.py` để `python run.py` vẫn chạy được bản chạy thử, và giữ `answer()` trong `codebase/agent.py` để `eval`, `simulate` chạy được.

## Bản chạy thử — viết ở đâu

| File | Viết gì | Bước guide |
|---|---|---|
| `codebase/agent.py` | `answer(text)` — luồng chính, đúng hình dạng ở `spec.md` §4. Khung có sẵn một workflow 2 bước *ví dụ* | 3.2 |
| `codebase/tools.py` | Công cụ của bài toán, mỗi công cụ một hàm có `@tool` | 2.2, 3.2 |
| `codebase/ai.py` | `call_model(system, user)` — chỗ duy nhất gọi model. Chưa điền `.env` thì chạy **chế độ giả** | 3.3 |

- **Trước CP2:** để chế độ giả, công cụ trả dữ liệu giả — `python run.py` đi hết luồng là đủ.
- **Trước CP3:** nối model thật theo [docs/connect-model.md](docs/connect-model.md), `eval --try` thấy token > 0 rồi mới `eval`.
- Bộ chạy gửi **nguyên ô `input`** của câu thử vào `answer(text)`. Dữ liệu nền (bài học, thông báo, lịch…) để trong `data/`, đọc qua công cụ.

## Lớp học tranh tài (nhánh `feature/new-class`)

Bạn là **huấn luyện viên**: mở slide thật, nhận gợi ý ở đoạn quan trọng, sửa và lưu thành **thẻ** trong sổ tay, chọn tối đa 5 thẻ rồi để bot của bạn thi với 4 bạn (Minh, Hải, Vy, An) do cô Linh điều phối. Bot chỉ biết những thẻ bạn dạy; sau trận, cô Linh chỉ ra tiêu chí bot bỏ sót để bạn mở đúng slide bổ sung thẻ rồi "Đấu lại với câu mới".

```
python -m pip install -r requirements.txt   # chỉ cần nếu có slide PDF (pypdf)
python -m classroom                         # mở http://127.0.0.1:8765/ (thêm --no-browser, --port N, --mode auto|offline|model nếu cần)
python -m unittest tests/test_classroom.py  # kiểm đọc tài liệu, gợi ý, trận đấu, API
```

- **Tài liệu:** app đọc `data/slides/` (quét đệ quy, nhận `.pdf`, `.pptx`, `.md`, `.txt`). Sẵn có `data/slides/ai-agent.pdf` — bộ 20 slide về AI agent do nhóm tự soạn (xem `data/DATA_CARD.md`, Dataset 4). Slide do BTC cấp thì để ở `data-btc/` (gitignore, không commit) và chạy với `CLASSROOM_DOCS_DIR=data-btc`. Không có file nào thì giao diện báo thiếu tài liệu — chép file rồi bấm "Tải lại".
- **Luồng:** Học slide (cô Linh đánh số 0–2 đoạn quan trọng mỗi slide theo luật, không gọi model; mỗi đoạn có một **thẻ trống** cùng số — người chơi tự đặt tiêu đề và tự viết nội dung) → Sổ tay (lưu ở trình duyệt, khoá `lhtt.notebook.v1`) → Đấu trường (chọn chủ đề 2–3 slide, ≤5 thẻ, 3 câu: nhớ lại, áp dụng tình huống mới, phản biện; 1 lượt "Nhắc bài" ở câu 3) → Xem lại trận: **Kiến thức bot còn thiếu** tổng kết từng ý bot chưa trả lời được (câu hỏi, ý còn thiếu, câu nguyên văn của slide); người chơi đọc rồi bấm "Sửa thẻ cho bot" để tự viết lại thẻ bot đã dùng hoặc thêm thẻ mới → đấu lại.
- **Hướng dẫn và Kiểm tra cuối:** nút **Hướng dẫn** ở góc trên làm tối màn hình, khoanh sáng từng nút và cô Linh giải thích (phím ← → Esc), tự chuyển tab nhưng không làm mới trận đang chơi. Tab **Kiểm tra cuối** dùng câu hỏi phỏng vấn trong `classroom/quiz_bank.json`: chép nguyên văn từ [landedjobs/ai-interview-questions](https://github.com/landedjobs/ai-interview-questions) (MIT), chỉ lấy câu nhãn "Reported", ghi công ty và nguồn đúng như bộ tổng hợp, kèm bản tự dịch. Câu được nối với slide bằng RAG hybrid (xem mục RAG bên dưới) kèm điều kiện slide khớp nhất chứa ít nhất 40% từ khoá; đáp án chấm theo gạch đầu dòng nguyên văn của slide (`classroom/quiz.py`, `GET /api/docs/<doc>/quiz`, `POST /api/quiz/grade`).
- **Chế độ AI (`--mode`):** `model` = cô Linh và các bot dùng model qua `codebase/ai.py::call_model` (JSON nghiêm ngặt; trích dẫn kiểm là chuỗi con của slide, thẻ bot dùng kiểm là tập con thẻ của chính nó; mọi lỗi model — sai key, mất mạng, JSON hỏng, chưa viết phần gọi model — trả HTTP 502 kèm lời giải thích). `offline` = **chế độ không model**, không bao giờ gọi model. `auto` (mặc định) = dùng model nếu `.env` có `MODEL_PROVIDER` khác `fake`; riêng khi `call_model` báo `NotImplementedError` (nhóm chưa viết phần gọi model, issue #11) thì server tự chuyển hẳn sang offline cho mọi request sau, làm lại request đang dở, in một dòng ra terminal và đặt `mode_note` (trong `GET /api/docs` và MatchState) để giao diện báo lý do; lỗi khác không tự chuyển. Chế độ không model: gợi ý theo dấu hiệu tiếng Việt (định nghĩa, quy tắc, ví dụ, lỗi cần ngữ cảnh hậu quả), câu hỏi dựng từ mẫu (ghi "Câu hỏi mẫu"), bot trả lời bằng nội dung thẻ của mình (BM25 + cụm then chốt trong `classroom/rag.py`) và nói rõ phần chưa chắc, cô Linh chấm theo độ phủ tiêu chí. Giao diện ghi rõ đang ở chế độ nào.
- **Nối model thật:** dùng chung `codebase/ai.py` với luồng A4 (cấu hình theo `.env.example` và `docs/connect-model.md`). Đang dùng Mistral qua API kiểu OpenAI: `OPENAI_API_BASE=https://api.mistral.ai/v1`, `MODEL_NAME=mistral-medium-latest`. Trận là 1 đấu 1: bot của bạn gặp một trong Minh / Vy / Hải / An.
- **RAG trên slide (`classroom/retrieval.py`):** chunk theo cấu trúc — mỗi slide một đoạn cha (tiêu đề + mọi ý), mỗi gạch đầu dòng một đoạn con mang đầu đề "Tài liệu › Slide n: tiêu đề" (bỏ slide bìa/mục lục) → nhúng bằng `EMBED_MODEL` (`mistral-embed`, 1024 chiều) → lưu PostgreSQL + pgvector (`DATABASE_URL`; HNSW cosine + `tsvector` bỏ dấu, GIN). Truy xuất hybrid: 30 ứng viên theo vector + 30 theo full-text (OR các từ), gộp bằng Reciprocal Rank Fusion (k=60), trả đoạn con kèm đoạn cha. Chỉ mục được dựng ở luồng nền khi server chạy và chỉ làm lại khi slide hoặc model embedding đổi. Chế độ không model chỉ dùng nhánh từ khoá; không có `DATABASE_URL` thì dùng BM25 trong bộ nhớ. Dùng ở: ô **Tìm trong slide** (tab Học slide, `GET /api/docs/<doc>/search?q=`) và **Kiểm tra cuối** (ghép câu phỏng vấn với slide, chọn ý chấm). Chạy Postgres cục bộ: lệnh `docker run … pgvector/pgvector:pg16` trong `.env.example`; cài gói: `python -m pip install -r requirements.txt` (`pypdf`, `psycopg[binary]`).
- **RAG của Bé Bot trong Đấu trường (`classroom/bot_rag.py`):** BM25 chỉ tìm trên nội dung 1–5 thẻ được chọn vào trận, không tra slide gốc, thẻ đối thủ hay thẻ khác trong sổ tay. Ở chế độ model, model chỉ chọn ID đoạn trả lời; server trích nguyên văn và gắn `[n]` cho từng câu. Mở **Trích dẫn từ thẻ** để xem đoạn gốc, tên thẻ và số slide nếu thẻ có nguồn. Không có đoạn hỗ trợ thì Bé Bot báo chưa đủ kiến thức, nhận 0 điểm; sau trận xem các ý còn thiếu để bổ sung thẻ.
- **Chấm Bé Bot:** chạy `python -m classroom --mode model` để cô Linh chấm theo nghĩa của câu trả lời, không đòi trùng chữ trên slide. Đúng ý được đủ điểm tiêu chí, đúng một phần được nửa điểm; chỉ nhắc từ khoá hoặc sai ý không được điểm. Mỗi ý được tính phải có đoạn trích kiểm được từ thẻ bot đã dùng. Không có trích dẫn thì 0 điểm. `--mode offline` chỉ đối chiếu cụm từ, không dùng để kiểm thử khả năng chấm diễn đạt tương đương.
- **Số slide trong mọi lời giải thích:** nhận xét chấm điểm của cô Linh (trận đấu, phản biện, Kiểm tra cuối) luôn ghi số slide — prompt model bắt buộc dẫn "theo slide n", và `coach.with_slide_refs` tự thêm "(Theo slide …)" nếu nhận xét chưa nhắc slide nào.
- **Code:** `classroom/rag.py` (đọc tài liệu, BM25), `retrieval.py` (RAG Postgres), `coach.py` (gợi ý, chủ đề, thẻ đối thủ), `match.py` (trận đấu), `quiz.py` (Kiểm tra cuối), `server.py` (API) + `web/` (HTML/CSS/JS thuần, cảnh 3D bằng three.js tải từ CDN; không tải được thì vẫn chơi ở 2D).

## Phần nào thật, phần nào giả

| Thành phần | Thật / Giả | Ghi chú |
|---|---|---|
| Lời gọi AI ở quyết định trung tâm | **Thật** | `qwen3.7-plus` qua Alibaba Cloud Token Plan. Token lấy từ `usage` của API. |
| Tra cứu đoạn bài `get_passage` | **Thật** | Đọc đoạn gốc từ `data/passages.csv`, gồm các đoạn diễn giải pre-class và đoạn minh họa CP2 `A4-01`. |
| Chạy thử ngoại tuyến | **Giả** | `MODEL_PROVIDER=fake` chạy kịch bản cố định với token 0. |

## Dùng AI vào việc gì

2–3 dòng (bắt buộc): nhóm dùng công cụ AI nào để làm gì, người kiểm lại phần nào. Chi tiết: [docs/ai-usage.md](docs/ai-usage.md). Coding agent đọc [AGENTS.md](AGENTS.md).

- **Claude (coding agent, đọc `AGENTS.md`)**: viết script đếm `evidence/count.py`, `evidence/survey/count_survey.py`; soạn nháp bộ câu khảo sát, `evidence/summary.md`, `spec.md` §0–§3, §6. Commit bộ câu thử / metric (`be7f8aa`) và data card (`e060b13`) có ghi Co-Authored-By Claude. Người phụ trách từng phần chạy lại script, đối chiếu số với data / khảo sát và sửa văn bản trước khi merge.
- **Codex**: soạn 5 đoạn bài minh họa trong `data/passages.csv` (nhãn `synthetic`, `data/DATA_CARD.md`); nhóm soát nội dung.
- Không dùng AI để tạo câu trả lời khảo sát, trích dẫn hay kết quả chạy. Chi tiết từng việc: [docs/ai-usage.md](docs/ai-usage.md).

## File mẫu — điền ở bước nào

| File | Điền ở bước guide | Mốc |
|---|---|---|
| `TEAMS.md` | 1.0 | CP1 · **đúng format**, BTC quét khi chấm |
| `canvas.md` | 1.4 | CP1, cập nhật CP2 |
| `evidence/hypothesis.md` | 1.1 | trước khi tìm bằng chứng |
| `evidence/data-mining.md` · `evidence/interviews/TEMPLATE.md` → `P1.md`… · `evidence/survey/TEMPLATE.md` | 1.2 | bắt đầu sau Zoom, xong CP3 |
| `evidence/summary.md` | 1.2 | CP3 |
| `spec.md` | §0–§2: 1.1–1.3 · §3–§5: 2.1–2.3 · §7: 2.4 · §8: 4.2 · §10: suốt | §7 chốt CP2 · §0–§7 CP3 · đủ CP4 |
| `data/DATA_CARD.md` | 2.4 | bản đầu CP2 |
| `eval/benchmark.csv` · `eval/metric_spec.yaml` | 2.4 | ≥10 câu + metric chốt CP2 · 20–30 câu CP3 |
| `codebase/` | 3.2, 3.3 | khung CP2 · AI thật CP3 |
| `eval/report.md` · `eval/README.md` | 4.1 (README mục 1–4 từ 2.4) | CP4 |
| `cost/personas.yaml` · `cost/cost-estimate.md` | 4.2 | thử 10 phiên CP3 · đủ CP4 |
| `validation/log.md` *(bonus)* | 4.3 | CP4 |
| `slides/outline.md` → `demo-slides.pdf` | 5.1 | CP4 |
| `reflection/TEMPLATE.md` → `reflection/<ten>.md` | 5.3 | 23:59 Thứ Bảy 28/11 |
| `AGENTS.md` · `docs/ai-usage.md` | khi dùng coding agent / AI | suốt |

## Bảy hạng mục bắt buộc — nằm ở file nào

| # | Hạng mục | File |
|---|---|---|
| 1 | Bằng chứng pain | `evidence/` (tổng hợp ở `evidence/summary.md`) |
| 2 | Impact có số | `spec.md` §2 |
| 3 | Thiết kế giải pháp | `spec.md` §4 |
| 4 | Bản chạy thử làm trọn lát cắt | `codebase/` · lệnh ở mục "Lệnh" |
| 5 | Định nghĩa "tốt" + bộ câu thử | `data/DATA_CARD.md` · `eval/` |
| 6 | Mô phỏng chi phí khi dùng thật | `cost/` |
| 7 | Slide + demo + video dự phòng | [PDF 5 trang](demo-slides.pdf) · [bản trình chiếu HTML](slides/demo-slides.html) · [video demo Lớp học tranh tài (3:29)](https://drive.google.com/file/d/1kzLabK15aN_Y1BEWBKOFemYfZozTXG80/view?usp=sharing) |
| + | *Bonus:* người dùng thử | [Phản hồi 3 phiếu và các lỗi đã xử lý](validation/log.md#người-dùng-thử-bonus) · không thay số đo học tập trước/sau |

## Rà soát theo checkpoint

| Mốc | Hồ sơ có thể kiểm tra | Còn cần làm |
|---|---|---|
| CP1 | [TEAMS](TEAMS.md) đủ 4 người, [Canvas](canvas.md) đủ 7 dòng, repo GitHub công khai. Bản CP1 trong lịch sử là `671d804`. | Commit CP1 ghi 17:35 ngày 27/11, sau mốc 17:00 ghi trong Canvas; repo không xác nhận thời điểm gửi form. |
| CP2 | Bản `55ec6ca`: Track A4, chuẩn đạt §7, 14 câu thử, 5 metric, Data Card bản đầu và bằng chứng đầu; [hai người chấm thử](eval/second-grader.md) khớp 5/5. | Giữ nguyên Track, dòng chuẩn đạt và `eval/metric_spec.yaml`. |
| CP3 | [Tổng hợp bằng chứng](evidence/summary.md): đào data, 20 phiếu pain hợp lệ và 5 trích dẫn nguyên văn đã đối chiếu; [lượt 1](eval/run-1.csv) 20/23, [trace model thật](traces/run-1.jsonl). Đã có bản thử mô phỏng 10 phiên. | Video web hiện dài 3:29. Cần đoạn 30 giây thể hiện lượt gọi AI thật của bản chạy thử A4 để nộp CP3. |
| CP4 | [Lượt 2 và lượt 7](eval/report.md), [mô phỏng 50 phiên](cost/cost-estimate.md), `spec.md` §9–§10, [PDF 5 trang](demo-slides.pdf), [3 phiếu dùng thử web](validation/log.md) và video demo web ở trên. | Xác nhận điểm B23 lượt 2; đo A4 trước/sau theo issue #26; xác nhận video dự phòng có hai ca B01/B05; mỗi thành viên xác nhận [reflection của mình](reflection/). |
