"""RAG trên slide: chunk theo cấu trúc → embedding → PostgreSQL + pgvector; truy xuất hybrid.

- Chunk theo cấu trúc tài liệu: mỗi slide là một đoạn CHA (tiêu đề + mọi ý), mỗi gạch đầu dòng là một đoạn
  CON. Khi nhúng, đoạn con mang theo đầu đề "Tài liệu › Slide n: tiêu đề" để vector có ngữ cảnh.
- Truy xuất trên đoạn con (chính xác), trả kèm đoạn cha (ngữ cảnh) — small-to-big.
- Hybrid: ứng viên theo vector (pgvector, cosine) + theo từ khoá (Postgres full-text trên chữ đã bỏ dấu,
  các từ nối bằng OR), gộp bằng Reciprocal Rank Fusion. Chế độ không model chỉ dùng nhánh từ khoá;
  không có DATABASE_URL thì dùng BM25 trong bộ nhớ.
"""
import hashlib
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request

from . import coach, rag

EMBED_DIM = 1024        # mistral-embed
RRF_K = 60              # hằng số RRF chuẩn (Cormack et al. 2009)
CANDIDATES = 30         # số ứng viên mỗi nhánh trước khi gộp
EMBED_BATCH = 64
_TERM_RE = re.compile(r"^[a-z0-9_]+$")

SCHEMA = f"""
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS rag_documents (
    id          text PRIMARY KEY,
    title       text NOT NULL,
    signature   text NOT NULL,
    embed_model text,
    indexed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rag_chunks (
    id         bigserial PRIMARY KEY,
    doc_id     text NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    parent_id  bigint REFERENCES rag_chunks(id) ON DELETE CASCADE,
    level      text NOT NULL CHECK (level IN ('slide', 'bullet')),
    slide      int NOT NULL,
    position   int NOT NULL,
    heading    text NOT NULL,
    text       text NOT NULL,
    tsv        tsvector NOT NULL,
    embedding  vector({EMBED_DIM})
);
CREATE INDEX IF NOT EXISTS rag_chunks_doc ON rag_chunks (doc_id, level);
CREATE INDEX IF NOT EXISTS rag_chunks_tsv ON rag_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS rag_chunks_vec ON rag_chunks USING hnsw (embedding vector_cosine_ops);
"""

_HYBRID_SQL = """
WITH v AS (
    SELECT id, row_number() OVER (ORDER BY embedding <=> %(qv)s::vector) AS r,
           1 - (embedding <=> %(qv)s::vector) AS cos
    FROM rag_chunks
    WHERE doc_id = %(doc)s AND level = 'bullet' AND embedding IS NOT NULL AND %(use_vec)s
    ORDER BY embedding <=> %(qv)s::vector
    LIMIT %(n)s
), t AS (
    SELECT id, row_number() OVER (ORDER BY ts_rank_cd(tsv, q) DESC) AS r
    FROM rag_chunks, to_tsquery('simple', %(tq)s) AS q
    WHERE doc_id = %(doc)s AND level = 'bullet' AND %(use_kw)s AND tsv @@ q
    ORDER BY ts_rank_cd(tsv, q) DESC
    LIMIT %(n)s
)
SELECT c.slide, c.position, c.heading, c.text, p.text AS parent_text,
       COALESCE(1.0 / (%(k)s + v.r), 0) + COALESCE(1.0 / (%(k)s + t.r), 0) AS score,
       v.r AS vec_rank, t.r AS kw_rank, v.cos
FROM rag_chunks c
JOIN rag_chunks p ON p.id = c.parent_id
LEFT JOIN v ON v.id = c.id
LEFT JOIN t ON t.id = c.id
WHERE v.id IS NOT NULL OR t.id IS NOT NULL
ORDER BY score DESC, c.slide, c.position
LIMIT %(limit)s
"""


# ---------------------------------------------------------------------------
# Chunk theo cấu trúc
# ---------------------------------------------------------------------------
def structure_chunks(deck):
    """[(cha, [con…])] theo slide. Slide không có gạch đầu dòng thì chính nội dung slide là một đoạn con."""
    out = []
    for s in deck.chunks:
        text = coach._ws(s.get("text") or "")
        if not text or not coach.slide_informative(s):
            continue  # bỏ slide bìa / mục lục: không có kiến thức để truy xuất
        heading = f"{deck.title} › Slide {s['slide']}: {s['title']}"
        parent = {"slide": s["slide"], "level": "slide", "position": 0, "heading": heading, "text": text}
        bullets = [coach._ws(b).lstrip("-•* ").strip() for b in s.get("bullets") or []]
        bullets = [b for b in bullets if b] or [text]
        children = [{"slide": s["slide"], "level": "bullet", "position": i + 1, "heading": heading, "text": b}
                    for i, b in enumerate(bullets)]
        out.append((parent, children))
    return out


def _embed_input(chunk):
    return f"{chunk['heading']}\n{chunk['text']}"


def _search_text(text):
    """Chữ để đánh chỉ mục full-text: bỏ dấu, casefold (câu hỏi gõ không dấu vẫn khớp)."""
    return " ".join(rag.tokens(text))


def _tsquery(query):
    terms = []
    for key, _ in rag.content_tokens(query):
        if _TERM_RE.match(key) and key not in terms:
            terms.append(key)
    return " | ".join(terms)


# ---------------------------------------------------------------------------
# Embedding (API kiểu OpenAI, cùng endpoint/key với codebase/ai.py)
# ---------------------------------------------------------------------------
def embed_model():
    coach._load_ai()  # nạp .env
    return os.environ.get("EMBED_MODEL", "").strip() or None


_QUERY_CACHE = {}


def embed_texts(texts):
    ai = coach._load_ai()
    model = embed_model()
    if not model:
        raise RuntimeError("Chưa đặt EMBED_MODEL trong .env — RAG chỉ tìm theo từ khoá.")
    vectors = []
    for i in range(0, len(texts), EMBED_BATCH):
        batch = texts[i:i + EMBED_BATCH]
        req = urllib.request.Request(
            f"{ai.API_BASE}/embeddings",
            data=json.dumps({"model": model, "input": batch}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {ai.API_KEY}"})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.load(resp)
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"API embedding trả HTTP {exc.code} — kiểm EMBED_MODEL và key trong .env.") from None
        except urllib.error.URLError as exc:
            raise RuntimeError("Không kết nối được API embedding.") from exc
        items = sorted(data.get("data") or [], key=lambda d: d.get("index", 0))
        if len(items) != len(batch) or any(len(d.get("embedding") or []) != EMBED_DIM for d in items):
            raise RuntimeError(f"API embedding trả sai số vector hoặc số chiều (cần {EMBED_DIM}).")
        vectors.extend(d["embedding"] for d in items)
    return vectors


def embed_query(text):
    key = (embed_model(), text)
    if key not in _QUERY_CACHE:
        _QUERY_CACHE[key] = embed_texts([text])[0]
    return _QUERY_CACHE[key]


def _vec_literal(vec):
    return "[" + ",".join(f"{x:.7f}" for x in vec) + "]"


# ---------------------------------------------------------------------------
# Kho PostgreSQL
# ---------------------------------------------------------------------------
def database_url():
    coach._load_ai()  # nạp .env
    return os.environ.get("DATABASE_URL", "").strip() or None


class PgStore:
    def __init__(self, url):
        import psycopg  # chỉ cần khi có DATABASE_URL
        self._psycopg = psycopg
        self.url = url
        self._lock = threading.Lock()
        with self._connect() as conn:
            conn.execute(SCHEMA)

    def _connect(self):
        return self._psycopg.connect(self.url, autocommit=True, connect_timeout=5)

    def signature(self, doc_id):
        with self._connect() as conn:
            row = conn.execute("SELECT signature FROM rag_documents WHERE id = %s", (doc_id,)).fetchone()
        return row[0] if row else None

    def replace(self, deck, signature, model, groups, vectors):
        """Xoá chỉ mục cũ của tài liệu rồi ghi lại toàn bộ trong một giao dịch."""
        vec_iter = iter(vectors) if vectors is not None else None
        with self._lock, self._connect() as conn, conn.transaction():
            conn.execute("DELETE FROM rag_documents WHERE id = %s", (deck.id,))
            conn.execute("INSERT INTO rag_documents (id, title, signature, embed_model) VALUES (%s, %s, %s, %s)",
                         (deck.id, deck.title, signature, model))
            for parent, children in groups:
                pid = conn.execute(
                    "INSERT INTO rag_chunks (doc_id, level, slide, position, heading, text, tsv) "
                    "VALUES (%s, 'slide', %s, 0, %s, %s, to_tsvector('simple', %s)) RETURNING id",
                    (deck.id, parent["slide"], parent["heading"], parent["text"],
                     _search_text(parent["heading"] + " " + parent["text"]))).fetchone()[0]
                for c in children:
                    vec = _vec_literal(next(vec_iter)) if vec_iter is not None else None
                    conn.execute(
                        "INSERT INTO rag_chunks (doc_id, parent_id, level, slide, position, heading, text, tsv, embedding) "
                        "VALUES (%s, %s, 'bullet', %s, %s, %s, %s, to_tsvector('simple', %s), %s::vector)",
                        (deck.id, pid, c["slide"], c["position"], c["heading"], c["text"],
                         _search_text(c["heading"] + " " + c["text"]), vec))

    def search(self, doc_id, query, qvec, k):
        tq = _tsquery(query)
        params = {"doc": doc_id, "qv": _vec_literal(qvec) if qvec else _vec_literal([0.0] * EMBED_DIM),
                  "use_vec": qvec is not None, "tq": tq or "khong_co_tu_khoa", "use_kw": bool(tq),
                  "n": CANDIDATES, "k": RRF_K, "limit": k}
        with self._connect() as conn:
            rows = conn.execute(_HYBRID_SQL, params).fetchall()
        return [{"slide": r[0], "position": r[1], "heading": r[2], "text": r[3], "parent_text": r[4],
                 "score": float(r[5]), "vec_rank": r[6], "kw_rank": r[7],
                 "cosine": float(r[8]) if r[8] is not None else None} for r in rows]


# ---------------------------------------------------------------------------
# Bộ truy xuất dùng chung cho server
# ---------------------------------------------------------------------------
class Retriever:
    """Một bộ truy xuất cho cả server. Có DATABASE_URL → Postgres hybrid; không có hoặc lỗi kết nối →
    BM25 trong bộ nhớ trên cùng các đoạn con (ghi lý do vào self.note)."""

    def __init__(self):
        self.note = None
        self.store = None
        self._lock = threading.Lock()
        self._ready = {}  # doc_id -> signature đã kiểm
        url = database_url()
        if url:
            try:
                self.store = PgStore(url)
            except Exception as exc:  # thiếu psycopg, sai mật khẩu, DB chưa chạy…
                self.note = f"Không dùng được PostgreSQL ({type(exc).__name__}) — RAG dùng BM25 trong bộ nhớ."
                print(f"[classroom] {self.note}", flush=True)
        else:
            self.note = "Chưa đặt DATABASE_URL — RAG dùng BM25 trong bộ nhớ."

    @property
    def backend(self):
        return "postgres" if self.store else "memory"

    def describe(self, use_vectors):
        """Mô tả ngắn cho giao diện: đang truy xuất bằng gì."""
        if not self.store:
            return {"backend": "memory", "method": "bm25", "note": self.note}
        model = embed_model() if use_vectors else None
        return {"backend": "postgres", "method": "hybrid-rrf" if model else "keyword",
                "embed_model": model, "note": None if model else "Chế độ không model: chỉ tìm theo từ khoá."}

    def prewarm(self, queries):
        """Nhúng sẵn nhiều câu truy vấn trong một lượt gọi (vd cả ngân hàng câu hỏi Kiểm tra cuối)."""
        if not self.store or not embed_model():
            return
        model = embed_model()
        todo = list(dict.fromkeys(coach._ws(q) for q in queries if (model, coach._ws(q)) not in _QUERY_CACHE))
        for q, vec in zip(todo, embed_texts(todo) if todo else []):
            _QUERY_CACHE[(model, q)] = vec

    @staticmethod
    def _signature(deck, model):
        h = hashlib.sha256()
        for parent, children in structure_chunks(deck):
            h.update(parent["heading"].encode("utf-8"))
            for c in children:
                h.update(b"\x00" + c["text"].encode("utf-8"))
        return f"{h.hexdigest()[:16]}|{model or 'none'}"

    def ensure_indexed(self, deck, use_vectors):
        """Đánh chỉ mục tài liệu nếu chưa có hoặc slide / model embedding đã đổi. Trả về True nếu đã làm mới."""
        if not self.store:
            return False
        model = embed_model() if use_vectors else None
        sig = self._signature(deck, model)
        with self._lock:
            if self._ready.get((deck.id, model)) == sig:
                return False
            stored = self.store.signature(deck.id)
            # đã có chỉ mục kèm vector thì chế độ không model vẫn dùng lại được (nhánh từ khoá)
            if stored == sig or (not use_vectors and stored and stored.split("|")[0] == sig.split("|")[0]):
                self._ready[(deck.id, model)] = sig
                return False
            groups = structure_chunks(deck)
            vectors = None
            if model:
                t0 = time.perf_counter()
                vectors = embed_texts([_embed_input(c) for _, children in groups for c in children])
                print(f"[classroom] Đã nhúng {len(vectors)} đoạn của '{deck.id}' bằng {model} "
                      f"({time.perf_counter() - t0:.1f}s).", flush=True)
            self.store.replace(deck, sig, model, groups, vectors)
            self._ready[(deck.id, model)] = sig
            return True

    def search(self, deck, query, k=5, use_vectors=False):
        """Top-k đoạn con liên quan nhất kèm đoạn cha: [{slide, position, heading, text, parent_text, score, …}]."""
        query = coach._ws(query or "")
        if not query:
            return []
        if self.store:
            self.ensure_indexed(deck, use_vectors)
            qvec = embed_query(query) if use_vectors else None
            return self.store.search(deck.id, query, qvec, k)
        return self._search_memory(deck, query, k)

    @staticmethod
    def _search_memory(deck, query, k):
        flat = [(p, c) for p, children in structure_chunks(deck) for c in children]
        scores = rag.bm25_scores(query, [c["heading"] + " " + c["text"] for _, c in flat])
        ranked = sorted(zip(scores, flat), key=lambda x: (-x[0], x[1][1]["slide"], x[1][1]["position"]))
        return [{"slide": c["slide"], "position": c["position"], "heading": c["heading"], "text": c["text"],
                 "parent_text": p["text"], "score": s, "vec_rank": None, "kw_rank": i + 1, "cosine": None}
                for i, (s, (p, c)) in enumerate(ranked[:k]) if s > 0]
