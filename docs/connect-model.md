# Nối model cho bản chạy thử A4

CP3 dùng `qwen3.7-plus` qua Alibaba Cloud Token Plan Singapore. `MODEL_PROVIDER=openai`
chọn giao thức Chat Completions tương thích OpenAI. Python 3.10+ dùng thư viện chuẩn.

## Cấu hình

Chép `.env.example` thành `.env` và điền key của gói Token Plan vào `API_KEY`.
Dùng chính endpoint và tên model trong file mẫu.

```dotenv
MODEL_PROVIDER=openai
MODEL_NAME=qwen3.7-plus
OPENAI_API_BASE=https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1
API_KEY=
```

Nếu `.env` hiện có `LLM_PROVIDER` hoặc `OPENAI_API_KEY`, code dùng các biến đó khi
`MODEL_PROVIDER` hoặc `API_KEY` tương ứng để trống. Biến môi trường của tiến trình
được ưu tiên hơn cùng biến trong `.env`. Chọn `MODEL_PROVIDER=fake` để thử luồng
ngoại tuyến với token 0. Nếu không đặt provider nào, repo dùng chế độ giả.

Backend gửi JSON tới `OPENAI_API_BASE/chat/completions`. Nếu dùng OpenAI trực tiếp,
để trống `OPENAI_API_BASE` và đặt model hỗ trợ JSON mode cùng key OpenAI.
Với Qwen trên Alibaba Cloud, tắt chế độ suy nghĩ để nhận JSON dùng cho quyết định dạy lại.
`@model_call` ghi model trả về cùng `usage.prompt_tokens` và `usage.completion_tokens` từ API.

## Thử kết nối

1. Chạy `python run.py`, nhập mã đoạn như `chatbot_is_app_around_model` rồi giải thích.
   Dòng thống kê hiển thị model và số token vào/ra theo từng lượt.
2. Chạy `python run.py eval --try`. Ba dòng đầu phải có token > 0. Khung ghi vào
   `eval/run-try.csv` và `traces/run-try.jsonl`. Hai file thử này được Git bỏ qua.
3. Chạy `python run.py eval` khi bắt đầu lượt đánh giá chính thức.

| Triệu chứng | Kiểm tra |
|---|---|
| HTTP 401 / 403 | Key phải thuộc đúng gói và endpoint. |
| HTTP 400 / 404 | Kiểm tra mã model có trong gói và hỗ trợ JSON mode. |
| HTTP 429 | Kiểm tra giới hạn của gói. Dùng `--wait 4` để giãn cách các câu khi chạy eval. |
| Token bằng 0 | Kiểm tra provider trong biến môi trường và `.env`. Chế độ giả luôn ghi token 0. |

Nếu mô phỏng chi phí theo bảng giá của model khác, ghi rõ tên model đo token
và tên model dùng để tính giá trong `cost/cost-estimate.md`.

Xem [hướng dẫn tích hợp Token Plan](https://www.alibabacloud.com/help/en/model-studio/more-tools).
