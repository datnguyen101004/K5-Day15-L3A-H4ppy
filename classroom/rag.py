"""RAG cho lớp học tranh tài: đọc bộ slide (.pptx/.pdf/.md/.txt), cắt chunk và tìm kiếm BM25.

Chỉ dùng thư viện chuẩn; pypdf chỉ dùng để đọc .pdf (import lười, báo lỗi rõ nếu thiếu).
"""
import math
import os
import re
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DOCS_DIR = os.path.join(REPO_ROOT, "data", "slides")

SUPPORTED_EXT = (".pptx", ".pdf", ".md", ".txt")

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
# Từ dừng nhỏ: tiếng Việt + tiếng Anh cơ bản. So khớp ở dạng CÓ DẤU (NFC + casefold): bỏ dấu thì
# "để" trùng "dễ", "là" trùng "lạ", "mà" trùng "mã" — từ có nghĩa sẽ bị lọc nhầm.
STOPWORDS = {
    "và", "của", "là", "có", "được", "cho", "trong", "khi", "để", "các", "một",
    "những", "với", "từ", "đó", "này", "không", "thì", "đã", "sẽ", "về", "như",
    "theo", "ở", "tại", "bị", "đến", "ra", "lên", "xuống", "nào", "gì", "ai",
    "sao", "thế", "vậy", "nên", "rất", "cũng", "vẫn", "còn", "chỉ", "đây",
    "kia", "lại", "nữa", "rồi", "mà", "vì", "do", "bởi", "hơn", "đâu", "rằng",
    "mỗi", "thường", "luôn", "hay", "hoặc", "nhưng", "nếu", "thêm", "bằng",
    "the", "a", "an", "of", "to", "in", "and", "or", "is", "are", "was",
    "for", "on", "with", "as", "at", "by", "be", "it", "this", "that",
}

_WORD_RE = re.compile(r"\w+", re.UNICODE)


def docs_dir():
    """Thư mục tài liệu: biến môi trường CLASSROOM_DOCS_DIR hoặc data/slides của repo."""
    return os.environ.get("CLASSROOM_DOCS_DIR") or DEFAULT_DOCS_DIR


def _strip_diacritics(text):
    text = text.replace("đ", "d").replace("Đ", "D")
    nfkd = unicodedata.normalize("NFD", text)
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn")


# Âm tiết tiếng Việt viết không dấu: phụ âm đầu? + nguyên âm + âm cuối?. Từ Latin không khớp mẫu này
# (vd 'code', 'token', 'agent', 'workflow') mới được coi là thuật ngữ đơn.
_VI_SYLLABLE = re.compile(
    r"^(ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdghklmnprstvx])?[aeiouy]{1,3}(ng|nh|ch|[cmnpt]|[iouy])?$")


def _is_stop(word):
    return normalize(word) in STOPWORDS


def _is_latin_term(word, key):
    return word.isascii() and len(key) >= 4 and not key.isdigit() and not _VI_SYLLABLE.match(key)


def normalize(text):
    """Chuẩn hoá tiếng Việt: NFC + casefold."""
    return unicodedata.normalize("NFC", text).casefold()


def tokens(text):
    """Token hoá: trả về list token đã casefold và BỎ DẤU (để câu hỏi không dấu vẫn khớp)."""
    out = []
    for w in _WORD_RE.findall(normalize(text)):
        out.append(_strip_diacritics(w).casefold())
    return out


def content_tokens(text):
    """Token nội dung (loại từ dừng), kèm dạng hiển thị gốc để trích từ khoá."""
    out = []
    for w in _WORD_RE.findall(normalize(text)):
        stripped = _strip_diacritics(w).casefold()
        if w in STOPWORDS or len(stripped) < 2:
            continue
        out.append((stripped, w))
    return out


_SEGMENT_RE = re.compile(r"[,;:.!?()\[\]\n\u2013\u2014]|\s-\s")


def phrases(text):
    """Cụm then chốt của một câu tiếng Việt: cặp 2 âm tiết liền nhau trong cùng một vế câu, không
    chứa từ dừng (vd 'định sẵn', 'công cụ'), và thuật ngữ Latin ≥4 ký tự (vd 'workflow', 'token').
    Trả [(khoá bỏ dấu, dạng hiển thị gốc)], không trùng, giữ thứ tự."""
    out, seen = [], set()

    def add(key, display):
        if key not in seen:
            seen.add(key)
            out.append((key, display))

    for segment in _SEGMENT_RE.split(unicodedata.normalize("NFC", text)):
        words = _WORD_RE.findall(segment)
        keys = [_strip_diacritics(w).casefold() for w in words]
        for i, (w, k) in enumerate(zip(words, keys)):
            content = not _is_stop(w) and len(k) >= 2
            if content and _is_latin_term(w, k):
                add(k, w)
            if i + 1 < len(words):
                w2, k2 = words[i + 1], keys[i + 1]
                if content and not _is_stop(w2) and len(k2) >= 2:
                    add(f"{k} {k2}", f"{w} {w2}")
    return out


def bullet_ratios(bullets, answer):
    """Mức câu trả lời phủ từng ý (so khớp không dấu): [(ý, tỉ lệ 0..1)]. Cần ~40% số cụm then
    chốt của ý (tối thiểu 1, tối đa 3) để đạt 1.0; ít hơn thì được một phần."""
    have = {k for k, _ in phrases(answer)} | set(tokens(answer))  # tokens: âm tiết/từ đơn không dấu
    out = []
    for b in bullets:
        keys = [k for k, _ in phrases(b)]
        if not keys:
            continue
        need = min(3, max(1, round(len(keys) * 0.4)))
        out.append((b, min(1.0, sum(k in have for k in keys) / need)))
    return out


def bullet_coverage(bullets, answer):
    """Chia các ý thành (đã nêu đủ, còn thiếu) theo bullet_ratios."""
    covered, missing = [], []
    for b, ratio in bullet_ratios(bullets, answer):
        (covered if ratio >= 1.0 else missing).append(b)
    return covered, missing


def _chunk(slide, title, text, bullets):
    return {
        "slide": int(slide),
        "title": title.strip(),
        "text": text.strip(),
        "bullets": [b.strip() for b in bullets if b.strip()],
    }


def _parse_pptx(path):
    chunks = []
    with zipfile.ZipFile(path) as z:
        slides = []
        for name in z.namelist():
            m = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", name)
            if m:
                slides.append((int(m.group(1)), name))
        slides.sort()
        for idx, (_, name) in enumerate(slides, start=1):
            root = ET.fromstring(z.read(name))
            paragraphs = []
            for p in root.iter(A + "p"):
                text = "".join(t.text or "" for t in p.iter(A + "t")).strip()
                if text:
                    paragraphs.append(text)
            if not paragraphs:
                continue
            chunks.append(_chunk(idx, paragraphs[0], "\n".join(paragraphs), paragraphs[1:]))
    return chunks


_PAGE_NUM_RE = re.compile(r"^\d+\s*(?:/\s*\d+)?$")


def _clean_pdf_pages(pages_lines):
    """Làm sạch các trang PDF theo dòng:
    - bỏ dòng xuất hiện trên >= 50% số trang (header/footer lặp lại); khi so, mọi con số coi như nhau để
      dòng chân trang có gắn số trang ("Tài liệu · 2 / 20") vẫn được nhận ra (pypdf mới gộp hai phần này),
    - bỏ dòng chỉ là số trang dạng 'n / N' hoặc 'n',
    - nối dòng tiếp theo vào ý trước nếu dòng đó bắt đầu bằng chữ thường.
    pages_lines: list các list dòng thô của từng trang. Trả về list trang đã làm sạch.
    """
    n = len(pages_lines)
    if n == 0:
        return []

    def repeat_key(ln):
        return re.sub(r"\d+", "#", " ".join(normalize(ln).split()))

    freq = Counter()
    for lines in pages_lines:
        for key in {repeat_key(ln) for ln in lines}:
            if key:
                freq[key] += 1

    def keep(ln):
        key = " ".join(normalize(ln).split())
        if not key:
            return False
        if n > 1 and freq[repeat_key(ln)] * 2 >= n:  # xuất hiện trên >= 50% số trang
            return False
        if _PAGE_NUM_RE.match(key):  # chỉ là số trang
            return False
        return True

    cleaned = []
    for lines in pages_lines:
        merged = []
        for ln in lines:
            ln = ln.strip()
            if not keep(ln):
                continue
            if merged and ln[:1].islower():
                merged[-1] = merged[-1] + " " + ln
            else:
                merged.append(ln)
        cleaned.append(merged)
    return cleaned


def _parse_pdf(path):
    try:
        from pypdf import PdfReader
    except ImportError:
        raise RuntimeError(
            "Thiếu thư viện pypdf để đọc file .pdf — chạy: python -m pip install -r requirements.txt"
        )
    reader = PdfReader(path)
    pages_lines = [page.extract_text() or "" for page in reader.pages]
    pages_lines = [text.splitlines() for text in pages_lines]
    chunks = []
    for i, lines in enumerate(_clean_pdf_pages(pages_lines), start=1):
        lines = [ln for ln in lines if ln.strip()]
        if not lines:
            continue
        text = "\n".join(lines)
        chunks.append(_chunk(i, lines[0], text, lines[1:]))
    return chunks


def _parse_md(path):
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    # Cắt theo heading (#/##) hoặc dòng '---'; heading trở thành tiêu đề đoạn
    blocks = [[]]
    for line in raw.splitlines():
        s = line.strip()
        if s == "---" or re.match(r"^#{1,6}\s", s):
            if blocks[-1]:
                blocks.append([])
            if s != "---":
                blocks[-1].append(s)
            continue
        blocks[-1].append(line)
    chunks = []
    for block in blocks:
        lines = [ln.strip() for ln in block if ln.strip()]
        if not lines:
            continue
        chunks.append(_chunk(len(chunks) + 1, lines[0], "\n".join(lines), lines[1:]))
    return chunks


def _parse_txt(path):
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", raw) if p.strip()]
    chunks = []
    cur, cur_len = [], 0
    for p in paragraphs:
        if cur and cur_len + len(p) > 600:
            text = "\n".join(cur)
            chunks.append(_chunk(len(chunks) + 1, cur[0].splitlines()[0], text, cur[1:]))
            cur, cur_len = [], 0
        cur.append(p)
        cur_len += len(p)
    if cur:
        text = "\n".join(cur)
        chunks.append(_chunk(len(chunks) + 1, cur[0].splitlines()[0], text, cur[1:]))
    return chunks


_PARSERS = {".pptx": _parse_pptx, ".pdf": _parse_pdf, ".md": _parse_md, ".txt": _parse_txt}


class Deck:
    """Một bộ slide đã chunk + chỉ mục BM25."""

    def __init__(self, deck_id, title, chunks, path=None):
        self.id = deck_id
        self.title = title
        self.chunks = chunks
        self.path = path
        self._doc_tokens = [tokens(c["text"]) for c in chunks]
        self._tf = [Counter(toks) for toks in self._doc_tokens]
        n = len(chunks)
        df = Counter()
        for tf in self._tf:
            df.update(tf.keys())
        self._idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}
        self._avgdl = (sum(len(t) for t in self._doc_tokens) / n) if n else 0.0

    @classmethod
    def from_file(cls, path, doc_id=None, title=None):
        ext = os.path.splitext(path)[1].lower()
        parser = _PARSERS[ext]
        chunks = parser(path)
        return cls(doc_id or os.path.basename(path),
                   title or os.path.splitext(os.path.basename(path))[0],
                   chunks, path=path)

    # ---------- BM25 ----------
    def _bm25(self, query_toks, idx, k1=1.5, b=0.75):
        q_terms = set(query_toks)
        tf = self._tf[idx]
        dl = len(self._doc_tokens[idx])
        score = 0.0
        for t in q_terms:
            f = tf.get(t, 0)
            if not f:
                continue
            idf = self._idf.get(t, math.log(1 + len(self.chunks)))
            score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / (self._avgdl or 1.0)))
        return score

    def search(self, query, k=3):
        """BM25 search -> [(chunk, score)] giảm dần theo điểm."""
        q_toks = tokens(query)
        scored = [(self.chunks[i], self._bm25(q_toks, i)) for i in range(len(self.chunks))]
        scored = [s for s in scored if s[1] > 0]
        scored.sort(key=lambda s: (-s[1], s[0]["slide"]))
        return scored[:k]


def bm25_scores(query, texts, k1=1.5, b=0.75):
    """BM25 của `query` với từng văn bản trong `texts` (token nội dung: bỏ từ dừng, bỏ dấu).
    Trả list điểm cùng thứ tự `texts`; 0.0 nghĩa là không trùng từ nội dung nào."""
    q_terms = {k for k, _ in content_tokens(query)}
    docs = [[k for k, _ in content_tokens(t)] for t in texts]
    n = len(docs)
    df = Counter()
    for d in docs:
        df.update(set(d))
    idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}
    avgdl = (sum(len(d) for d in docs) / n) if n else 0.0
    scores = []
    for d in docs:
        tf = Counter(d)
        s = 0.0
        for t in q_terms:
            f = tf.get(t, 0)
            if f:
                s += idf[t] * (f * (k1 + 1)) / (f + k1 * (1 - b + b * len(d) / (avgdl or 1.0)))
        scores.append(s)
    return scores


def _iter_doc_files(sdir):
    """Duyệt đệ quy thư mục tài liệu: yield (doc_id theo POSIX, đường dẫn đầy đủ)."""
    for root, dirs, files in os.walk(sdir):
        dirs.sort()
        for name in sorted(files):
            if name.lower().endswith(SUPPORTED_EXT):
                full = os.path.join(root, name)
                rel = os.path.relpath(full, sdir).replace(os.sep, "/")
                yield rel, full


def list_docs(sdir=None):
    """Liệt kê các tài liệu trong thư mục (đệ quy; tạo thư mục nếu thiếu). Trả về [] nếu trống."""
    sdir = sdir or docs_dir()
    if not os.path.isdir(sdir):
        try:
            os.makedirs(sdir, exist_ok=True)
        except OSError:
            return []
        return []
    docs = []
    for rel, full in _iter_doc_files(sdir):
        try:
            docs.append(Deck.from_file(full, doc_id=rel))
        except RuntimeError:
            raise
        except Exception:
            continue  # file lỗi: bỏ qua, không làm sập cả danh sách
    return docs


def resolve_doc_path(sdir, doc_id):
    """Đường dẫn thật của doc_id trong sdir (chặn path traversal); None nếu không hợp lệ."""
    if not doc_id or doc_id.startswith("/") or "\\" in doc_id or ".." in doc_id.split("/"):
        return None
    root = os.path.realpath(sdir)
    full = os.path.realpath(os.path.join(root, *doc_id.split("/")))
    if full == root or not full.startswith(root + os.sep):
        return None
    if not os.path.isfile(full) or not full.lower().endswith(SUPPORTED_EXT):
        return None
    return full
