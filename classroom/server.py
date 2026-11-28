"""HTTP server cho Lớp học tranh tài v2: ThreadingHTTPServer, chỉ thư viện chuẩn.

Routes theo hợp đồng coach-contract:
  GET  /api/docs                                danh sách tài liệu trong data/slides
  GET  /api/docs/{id}                           nội dung tài liệu (id URL-encode, có thể có /)
  GET  /api/docs/{id}/file                      byte gốc của PDF (chỉ máy cục bộ)
  GET  /api/docs/{id}/slides/{n}/suggestions    gợi ý thẻ cho slide n
  GET  /api/docs/{id}/topics                    các chủ đề của tài liệu
  POST /api/matches                             tạo trận (pha pick)
  POST /api/matches/{mid}/cards                 chọn 1-5 thẻ (pick -> question)
  POST /api/matches/{mid}/remind                nhắc bài 1 lần ở câu 3
  POST /api/matches/{mid}/next                  question -> scored -> question ... -> review
  GET  /api/matches/{mid}                       trạng thái trận
"""
import json
import os
import re
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import coach, match, quiz, rag, retrieval
from .coach import ApiError

MODEL_NOT_READY = ("Chế độ model đã bật nhưng codebase/ai.py chưa có phần gọi model (issue #11) — "
                   "chạy lại với --mode auto hoặc --mode offline để dùng chế độ không model.")

WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}

MATCHES = {}


def _docs_dir(server):
    return getattr(server, "docs_dir", None) or rag.docs_dir()


def _source_dir_label(sdir):
    root = os.path.realpath(rag.REPO_ROOT)
    real = os.path.realpath(sdir)
    try:
        return os.path.relpath(real, root)
    except ValueError:
        return sdir


def _get_doc(server, doc_id):
    """Deck của doc_id (có cache theo mtime); ném ApiError 404 nếu không có."""
    sdir = _docs_dir(server)
    path = rag.resolve_doc_path(sdir, doc_id)
    if path is None:
        raise ApiError(404, f"Không tìm thấy tài liệu '{doc_id}' — kiểm tra lại GET /api/docs "
                            f"(id là đường dẫn tương đối trong {_source_dir_label(sdir)}, dùng URL-encode).")
    cache = getattr(server, "doc_cache", None)
    if cache is None:
        cache = server.doc_cache = {}
    mtime = os.path.getmtime(path)
    hit = cache.get(doc_id)
    if hit and hit[0] == mtime:
        return hit[1]
    deck = rag.Deck.from_file(path, doc_id=doc_id)
    cache[doc_id] = (mtime, deck)
    return deck


def _doc_summary(d):
    ext = os.path.splitext(d.id)[1].lower().lstrip(".")
    return {"id": d.id, "title": d.title, "kind": ext, "slides": len(d.chunks)}


class Handler(BaseHTTPRequestHandler):
    server_version = "ClassroomTranhTai/2.0"
    protocol_version = "HTTP/1.1"

    # ---------- helpers ----------
    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, status, message):
        self._send_json({"error": message}, status)

    def _send_file(self, path, ctype):
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        """Đọc hết body đúng một lần. Kết nối giữ mở (HTTP/1.1) nên body không đọc sẽ bị hiểu thành request sau."""
        if hasattr(self, "_body"):
            return self._body
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            data = json.loads(raw.decode("utf-8")) if raw.strip() else {}
            if not isinstance(data, dict):
                raise ValueError
        except (ValueError, UnicodeDecodeError):
            data = None
        self._body = data
        return data

    def _json_body(self):
        data = self._read_json_body()
        if data is None:
            raise ApiError(400, "Body phải là một JSON object hợp lệ (UTF-8).")
        return data

    def log_message(self, fmt, *args):  # gọn log, không spam terminal
        pass

    def _call_model(self):
        return getattr(self.server, "call_model", None)

    def _with_model(self, fn):
        """Chạy fn(call_model). Ở auto, nếu model báo NotImplementedError (chưa viết phần gọi model)
        thì chuyển cả server sang offline rồi chạy lại fn ở offline. Lỗi khác bay ra -> 502."""
        cm = self._call_model()
        try:
            return fn(cm)
        except NotImplementedError:
            if cm is None or self.server.mode_policy != "auto":
                raise
            self.server.fall_back_to_offline()
            return fn(None)

    # ---------- GET ----------
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        try:
            if path == "/":
                index = os.path.join(WEB_DIR, "index.html")
                if os.path.isfile(index):
                    self._send_file(index, "text/html; charset=utf-8")
                else:
                    self._send_error_json(404, "Chưa có classroom/web/index.html — frontend chưa sẵn sàng.")
                return
            if path.startswith("/static/"):
                rel = path[len("/static/"):]
                full = os.path.realpath(os.path.join(WEB_DIR, rel))
                web_root = os.path.realpath(WEB_DIR)
                if not full.startswith(web_root + os.sep) or not os.path.isfile(full):
                    self._send_error_json(404, "Không tìm thấy file tĩnh: /static/" + rel)
                    return
                ext = os.path.splitext(full)[1].lower()
                self._send_file(full, CONTENT_TYPES.get(ext, "application/octet-stream"))
                return
            if path == "/api/docs":
                sdir = _docs_dir(self.server)
                self._send_json({
                    "docs": [_doc_summary(d) for d in rag.list_docs(sdir)],
                    "source_dir": _source_dir_label(sdir),
                    "mode": "model" if self._call_model() else "offline",
                    "mode_note": self.server.mode_note,
                })
                return
            m = re.fullmatch(r"/api/docs/(.+)/slides/(\d+)/suggestions", path)
            if m:
                doc_id = urllib.parse.unquote(m.group(1))
                deck = _get_doc(self.server, doc_id)
                n = int(m.group(2))
                sugs = coach.suggestions_for(deck, n)
                if sugs is None:
                    raise ApiError(404, f"Tài liệu '{doc_id}' không có slide {n} — "
                                        f"xem số slide trong GET /api/docs/{urllib.parse.quote(doc_id)}.")
                self._send_json({"slide": n, "suggestions": sugs})
                return
            m = re.fullmatch(r"/api/docs/(.+)/topics", path)
            if m:
                doc_id = urllib.parse.unquote(m.group(1))
                deck = _get_doc(self.server, doc_id)
                topics = coach.topics(deck)
                self._send_json({"topics": topics})
                return
            m = re.fullmatch(r"/api/docs/(.+)/quiz", path)
            if m:
                deck = _get_doc(self.server, urllib.parse.unquote(m.group(1)))
                self._send_json(quiz.questions_for(deck, self.server.retriever(),
                                                   use_vectors=self._call_model() is not None))
                return
            m = re.fullmatch(r"/api/docs/(.+)/search", path)
            if m:
                deck = _get_doc(self.server, urllib.parse.unquote(m.group(1)))
                params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                q = (params.get("q") or [""])[0].strip()
                if not q:
                    raise ApiError(400, "Thiếu tham số 'q' — vd /api/docs/<doc>/search?q=agent là gì")
                try:
                    k = max(1, min(10, int((params.get("k") or ["5"])[0])))
                except ValueError:
                    raise ApiError(400, "'k' phải là số nguyên 1–10.")
                use_vec = self._call_model() is not None
                r = self.server.retriever()
                self._send_json({"query": q, "results": r.search(deck, q, k=k, use_vectors=use_vec),
                                 "retrieval": r.describe(use_vec)})
                return
            m = re.fullmatch(r"/api/docs/(.+)/file", path)
            if m:
                doc_id = urllib.parse.unquote(m.group(1))
                sdir = _docs_dir(self.server)
                fpath = rag.resolve_doc_path(sdir, doc_id)
                if fpath is None:
                    raise ApiError(404, f"Không tìm thấy tài liệu '{doc_id}'.")
                if not fpath.lower().endswith(".pdf"):
                    raise ApiError(404, f"Tài liệu '{doc_id}' không phải PDF — chỉ phục vụ file gốc của PDF.")
                self._send_file(fpath, "application/pdf")
                return
            m = re.fullmatch(r"/api/docs/(.+)", path)
            if m:
                doc_id = urllib.parse.unquote(m.group(1))
                deck = _get_doc(self.server, doc_id)
                ext = os.path.splitext(deck.id)[1].lower().lstrip(".")
                self._send_json({
                    "id": deck.id, "title": deck.title, "kind": ext,
                    "slides": [{"n": c["slide"], "title": c["title"],
                                "text": c["text"], "bullets": c["bullets"]} for c in deck.chunks],
                    "file_url": f"/api/docs/{urllib.parse.quote(deck.id)}/file" if ext == "pdf" else None,
                })
                return
            m = re.fullmatch(r"/api/matches/([A-Za-z0-9_-]+)", path)
            if m:
                mid = m.group(1)
                mstate = MATCHES.get(mid)
                if not mstate:
                    raise ApiError(404, f"Không tìm thấy trận '{mid}' — tạo trận mới bằng POST /api/matches.")
                self._send_json(mstate.state())
                return
            self._send_error_json(404, f"Không có route GET {path}.")
        except ApiError as e:
            self._send_error_json(e.status, e.message)
        except NotImplementedError:
            self._send_error_json(502, MODEL_NOT_READY)
        except RuntimeError as e:
            self._send_error_json(502, str(e))
        except BrokenPipeError:
            pass
        except Exception as e:  # pragma: no cover - phòng thủ
            self._send_error_json(500, f"Lỗi máy chủ nội bộ: {e}")

    # ---------- POST ----------
    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        self.__dict__.pop("_body", None)  # cùng một handler phục vụ nhiều request trên một kết nối
        self._read_json_body()
        try:
            if path == "/api/matches":
                self._post_create_match()
                return
            m = re.fullmatch(r"/api/matches/([A-Za-z0-9_-]+)/(cards|remind|next)", path)
            if m:
                self._post_match_action(m.group(1), m.group(2))
                return
            if path == "/api/quiz/grade":
                self._post_quiz_grade()
                return
            self._send_error_json(404, f"Không có route POST {path}.")
        except ApiError as e:
            self._send_error_json(e.status, e.message)
        except NotImplementedError:
            self._send_error_json(502, MODEL_NOT_READY)
        except RuntimeError as e:
            self._send_error_json(502, str(e))
        except BrokenPipeError:
            pass
        except Exception as e:  # pragma: no cover - phòng thủ
            self._send_error_json(500, f"Lỗi máy chủ nội bộ: {e}")

    def _post_quiz_grade(self):
        body = self._json_body()
        doc_id, qid = body.get("doc_id"), body.get("question_id")
        if not doc_id or not qid:
            raise ApiError(400, "Thiếu 'doc_id' hoặc 'question_id' — lấy danh sách câu ở GET /api/docs/<doc>/quiz.")
        deck = _get_doc(self.server, str(doc_id))
        result = self._with_model(lambda cm: quiz.grade(deck, str(qid), body.get("answer"),
                                                        self.server.retriever(), call_model=cm))
        self._send_json(result)

    def _get_match(self, mid):
        mstate = MATCHES.get(mid)
        if not mstate:
            raise ApiError(404, f"Không tìm thấy trận '{mid}' — tạo trận mới bằng POST /api/matches.")
        return mstate

    def _post_create_match(self):
        body = self._json_body()
        doc_id = body.get("doc_id")
        if not doc_id:
            raise ApiError(400, "Thiếu 'doc_id' trong body — chọn một tài liệu từ GET /api/docs.")
        rematch_of = body.get("rematch_of")
        old = self._get_match(str(rematch_of)) if rematch_of else None
        opponent = body.get("opponent") or (old.opponent if old else match.DEFAULT_OPPONENT)
        if opponent not in match.OPPONENTS:
            raise ApiError(400, f"Đối thủ '{opponent}' không có — 'opponent' phải là một trong: "
                                f"{', '.join(match.OPPONENTS)} (mặc định {match.DEFAULT_OPPONENT}).")
        deck = _get_doc(self.server, str(doc_id))
        variant = 0
        if old:
            if old.doc.id != deck.id:
                raise ApiError(400, f"Đấu lại chỉ trong cùng tài liệu — trận '{rematch_of}' thuộc '{old.doc.id}'.")
            topic = old.topic  # đấu lại: cùng chủ đề, không cần dựng lại danh sách chủ đề
            variant = old.variant + 1
        else:
            topics = coach.topics(deck)
            topic_id = body.get("topic_id")
            if topic_id:
                topic = next((t for t in topics if t["id"] == topic_id), None)
                if topic is None:
                    raise ApiError(404, f"Không tìm thấy chủ đề '{topic_id}' trong tài liệu '{doc_id}' — "
                                        f"xem GET /api/docs/{urllib.parse.quote(str(doc_id))}/topics.")
            elif topics:
                topic = topics[0]
            else:
                raise ApiError(400, f"Tài liệu '{doc_id}' chưa có chủ đề nào (không slide nào đủ nội dung để "
                                    f"gợi ý) — hãy thêm slide vào "
                                    f"{_source_dir_label(_docs_dir(self.server))} rồi tải lại.")
        mstate = match.create_match(
            deck, topic=topic, bot_name=str(body.get("bot_name") or "Bé Bot"),
            rematch_of=rematch_of, variant=variant, opponent=opponent,
            call_model=self._call_model(), seed=None, mode_note=self.server.mode_note)
        MATCHES[mstate.id] = mstate
        self._send_json(mstate.state(), 201)

    def _post_match_action(self, mid, action):
        mstate = self._get_match(mid)
        if action == "cards":
            body = self._json_body()
            cards = body.get("cards")
            if not isinstance(cards, list) or not cards:
                raise ApiError(400, "Thiếu hoặc sai 'cards' — gửi một mảng 1 đến 5 thẻ.")
            if len(cards) > match.MAX_CARDS:
                raise ApiError(400, f"Chỉ được mang tối đa {match.MAX_CARDS} thẻ vào trận "
                                    f"(gửi {len(cards)}).")
            for c in cards:
                if not isinstance(c, dict) or not c.get("title") or not c.get("content"):
                    raise ApiError(400, "Mỗi thẻ cần có 'title' và 'content' không rỗng.")
            state = self._with_model(lambda cm: mstate.set_cards(cards))
        elif action == "remind":
            body = self._json_body()
            card_id = body.get("card_id")
            if not card_id:
                raise ApiError(400, "Thiếu 'card_id' — chọn một thẻ bot của bạn đã mang theo.")
            state = mstate.remind(str(card_id))
        else:
            state = self._with_model(lambda cm: mstate.next())
        self._send_json(state)


MODES = ("auto", "offline", "model")


class ClassroomServer(ThreadingHTTPServer):
    """Giữ chính sách chế độ AI: offline (luôn không model), model (luôn model, lỗi -> 502),
    auto (model nếu .env có MODEL_PROVIDER khác fake; chưa có phần gọi model thì chuyển hẳn sang offline)."""

    def __init__(self, address, docs_dir, mode="auto", call_model=None):
        if mode not in MODES:
            raise ValueError(f"mode phải là một trong {', '.join(MODES)} (nhận '{mode}').")
        super().__init__(address, Handler)
        self.docs_dir = docs_dir or rag.docs_dir()
        self.doc_cache = {}
        self.mode_policy = mode
        self.mode_note = None
        self._fallback_lock = threading.Lock()
        self._retriever = None
        self._retriever_lock = threading.Lock()
        if mode == "offline":
            self.call_model = None
        elif call_model is not None:
            self.call_model = call_model
        elif mode == "model" or coach.model_mode():
            self.call_model = coach.ai_call_model()
        else:
            self.call_model = None

    def fall_back_to_offline(self):
        """auto: codebase/ai.py chưa có phần gọi model -> offline cho mọi request sau (kể cả các trận đang mở)."""
        with self._fallback_lock:
            if self.call_model is None:
                return
            self.call_model = None
            self.mode_note = (f"Đang chạy chế độ không model: .env đặt MODEL_PROVIDER={coach.model_provider()} "
                              f"nhưng codebase/ai.py chưa có phần gọi model (issue #11).")
            print(f"[classroom] {self.mode_note} Chuyển hẳn sang offline.", flush=True)
            for m in list(MATCHES.values()):
                m.use_offline(self.mode_note)

    def retriever(self):
        """Bộ truy xuất RAG dùng chung, tạo khi cần lần đầu (test không dùng RAG thì không chạm Postgres)."""
        with self._retriever_lock:
            if self._retriever is None:
                self._retriever = retrieval.Retriever()
            return self._retriever

    def index_all_in_background(self):
        """Đánh chỉ mục RAG cho mọi tài liệu ở luồng nền để lượt tìm đầu tiên không phải chờ nhúng."""
        def work():
            r = self.retriever()
            for deck in rag.list_docs(self.docs_dir):
                try:
                    r.ensure_indexed(deck, use_vectors=self.call_model is not None)
                except Exception as exc:  # lỗi mạng / API: lần tìm sau sẽ thử lại
                    print(f"[classroom] Chưa đánh chỉ mục RAG được '{deck.id}': {exc}", flush=True)
            print(f"[classroom] RAG: {r.describe(self.call_model is not None)}", flush=True)
        threading.Thread(target=work, name="rag-index", daemon=True).start()


def make_server(port=8765, host="127.0.0.1", docs_dir=None, mode="auto", call_model=None):
    """mode: auto | offline | model. call_model: hàm thay cho codebase/ai.py::call_model (dùng khi test)."""
    return ClassroomServer((host, port), docs_dir, mode=mode, call_model=call_model)


def run(port=8765, host="127.0.0.1", docs_dir=None, open_browser=True, mode="auto"):
    server = make_server(port=port, host=host, docs_dir=docs_dir, mode=mode)
    url = f"http://{host}:{server.server_port}/"
    print(f"Lớp học tranh tài đang chạy tại: {url}")
    print(f"Tài liệu: {server.docs_dir} · Chế độ: --mode {mode} → "
          f"{'model' if server.call_model else 'offline (không model)'}")
    server.index_all_in_background()
    if open_browser:
        import webbrowser
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
