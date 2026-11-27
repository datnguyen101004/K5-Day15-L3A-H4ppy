"""Phiên dạy lại A4 trên dòng lệnh. Chạy bằng python run.py."""
import os
import sys

for _stream in (sys.stdout, sys.stderr, sys.stdin):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _where(e):
    """File (trong codebase/) gây lỗi khi nạp: SyntaxError có e.filename, lỗi khác lấy khung cuối của traceback."""
    import traceback
    path = getattr(e, "filename", None) or (traceback.extract_tb(e.__traceback__)[-1].filename if e.__traceback__ else "")
    if not path:
        return "codebase/"
    p = os.path.abspath(path)
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.relpath(p, base).replace(os.sep, "/") if p.startswith(base) else path

def main() -> int:
    try:
        import tracing
        from agent import study_turn
    except Exception as e:  # lỗi cú pháp, thiếu thư viện… trong codebase/
        print("Không nạp được codebase/ — lỗi ở %s: %s: %s" % (_where(e), type(e).__name__, e))
        print("Sửa lỗi rồi chạy lại. Cách nối model: docs/connect-model.md")
        return 1
    print("Nhập mã đoạn hoặc chủ đề pre-class. Ví dụ: A4-01 hoặc temperature_stability_not_truth.")
    print("Thoát bằng Ctrl+C hoặc Enter hai lần liên tiếp.")
    blank = 0
    transcript = []
    questions = ()
    while True:
        try:
            text = input("Giải thích > " if transcript else "Đoạn bài > ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if not text:
            blank += 1
            if blank >= 2:
                return 0
            continue
        blank = 0
        tracing.begin("app")
        try:
            output, waiting = study_turn("\n".join(transcript + [text]), questions)
        except NotImplementedError as e:
            tracing.end()
            print("Chưa nối model: %s" % e)
            return 1
        except Exception as e:  # lỗi gọi model: báo rồi cho hỏi tiếp
            tracing.end()
            print("[lỗi] %s: %s" % (type(e).__name__, e))
            continue
        s, _ = tracing.end()
        if not transcript and text.partition("=")[0].strip().casefold() == "doan":
            waiting = False  # Dòng theo định dạng benchmark là một lượt độc lập.
        transcript = transcript + [text] if waiting else []
        questions = questions + (output.partition("\n")[2],) if waiting else ()
        print(output)
        print("   (model: %s · gọi model %d lần · công cụ %d lần · token vào %d / ra %d)"
              % (", ".join(s["models"]) or "—", s["model_calls"], s["tool_calls"], s["tokens_in"], s["tokens_out"]))


if __name__ == "__main__":
    sys.exit(main())
