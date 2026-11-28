"""Chạy bằng: python -m classroom [--port 8765] [--no-browser]"""
import argparse

from .server import run


def main():
    parser = argparse.ArgumentParser(prog="python -m classroom",
                                     description="Lớp học tranh tài — lớp học 5 người với slide của bạn.")
    parser.add_argument("--port", type=int, default=8765, help="cổng HTTP (mặc định 8765)")
    parser.add_argument("--host", default="127.0.0.1", help="địa chỉ bind (mặc định 127.0.0.1)")
    parser.add_argument("--no-browser", action="store_true", help="không tự mở trình duyệt")
    parser.add_argument("--mode", choices=("auto", "offline", "model"), default="auto",
                        help="auto (mặc định): dùng model nếu .env có MODEL_PROVIDER khác fake, chưa có phần gọi "
                             "model thì chuyển sang offline; offline: luôn không model; "
                             "model: luôn dùng model (lỗi thì báo 502)")
    args = parser.parse_args()
    run(port=args.port, host=args.host, open_browser=not args.no_browser, mode=args.mode)


if __name__ == "__main__":
    main()
