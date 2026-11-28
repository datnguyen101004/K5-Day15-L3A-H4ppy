"""Test cho classroom v2 (unittest, chỉ thư viện chuẩn). Fixture dựng trong thư mục tạm."""
import http.client
import itertools
import json
import os
import sys
import tempfile
import threading
import types
import unittest
import zipfile
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from classroom import coach, match, rag, server  # noqa: E402

SLIDES = [
    ("Bìa bài giảng Khoa học tự nhiên", ["Khoa học tự nhiên lớp 5"]),
    ("Nước và chu trình nước", [
        "Nước bao phủ khoảng bảy mươi mốt phần trăm bề mặt Trái Đất",
        "Chu trình nước gồm các giai đoạn bay hơi ngưng tụ và mưa rơi",
        "Nước ngọt chỉ chiếm một phần rất nhỏ tổng lượng nước trên hành tinh",
    ]),
    ("Quang hợp ở thực vật", [
        "Quang hợp là quá trình thực vật tạo chất dinh dưỡng từ ánh sáng mặt trời",
        "Diệp lục trong lá có màu xanh và hấp thụ năng lượng ánh sáng",
        "Sản phẩm của quá trình quang hợp là đường và khí oxy",
    ]),
    ("Hệ mặt trời", [
        "Mặt trời là ngôi sao nằm ở trung tâm của hệ mặt trời",
        "Có tám hành tinh quay quanh mặt trời theo quỹ đạo riêng",
        "Trái đất là hành tinh thứ ba tính từ mặt trời ra ngoài",
    ]),
    ("Cơ thể con người", [
        "Tim có nhiệm vụ bơm máu đi khắp toàn bộ cơ thể",
        "Phổi thực hiện trao đổi khí oxy và khí cacbonic với máu",
        "Hệ xương tạo khung đỡ và bảo vệ các cơ quan bên trong",
    ]),
    ("Vật lý cơ bản", [
        "Lực là tác nhân làm thay đổi trạng thái chuyển động của vật",
        "Khối lượng là đại lượng đặc trưng cho mức quán tính của vật",
        "Vận tốc được tính bằng quãng đường đi được chia cho thời gian",
    ]),
    ("Ứng dụng có trách nhiệm", [
        "Nên bắt đầu với quy mô nhỏ rồi đo kết quả trước khi mở rộng",
        "Ví dụ: một nhóm học sinh thử nghiệm chatbot ở một lớp trước tiên",
        "Lỗi thường gặp: không có giới hạn số bước nên hệ thống lặp vô hạn",
    ]),
    ("Ví dụ minh hoạ trong lớp", [
        "Ví dụ: một nhóm học sinh thử nghiệm chatbot trả lời bài tập ở một lớp trước",
        "Ví dụ: bạn Lan dùng bảng tính để theo dõi điểm danh mỗi tuần của cả lớp",
    ]),
]

MD_DECK = """# Bài giảng Lịch sử
## Thời kỳ Văn Lang
- Nhà nước Văn Lang ra đời khoảng thế kỷ thứ bảy trước công nguyên
- Người đứng đầu là vua Hùng
---
## Thời kỳ Bắc thuộc
- Việt Nam bị các triều đại phương Bắc đô hộ hơn một nghìn năm
- Các cuộc khởi nghĩa tiêu biểu như Hai Bà Trưng, Bà Triệu
"""


def _slide_xml(paragraphs):
    body = "".join(
        f'<a:p><a:r><a:t>{p}</a:t></a:r></a:p>' for p in paragraphs
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        f'<p:cSld><p:spTree><p:sp><p:txBody>{body}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
    )


def _write_pptx(path, slides):
    with zipfile.ZipFile(path, "w") as z:
        for i, (title, bullets) in enumerate(slides, start=1):
            z.writestr(f"ppt/slides/slide{i}.xml", _slide_xml([title] + bullets))


def _write_pdf(path, pages_text):
    """PDF tối thiểu hợp lệ (1 font Helvetica, mỗi trang một dòng text) để pypdf đọc được."""
    objs = {}
    font_num = 3
    page_nums, content_nums = [], []
    nxt = 4
    for text in pages_text:
        cnum = nxt; nxt += 1
        content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("latin-1")
        objs[cnum] = b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream"
        pnum = nxt; nxt += 1
        page_nums.append(pnum)
        content_nums.append(cnum)
        objs[pnum] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_num} 0 R >> >> /Contents {cnum} 0 R >>"
        ).encode()
    objs[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objs[2] = ("<< /Type /Pages /Kids [%s] /Count %d >>"
               % (" ".join(f"{p} 0 R" for p in page_nums), len(page_nums))).encode()
    objs[3] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    out = [b"%PDF-1.4\n"]
    offsets = {}
    for i in range(1, nxt):
        offsets[i] = sum(len(x) for x in out)
        out.append(f"{i} 0 obj\n".encode() + objs[i] + b"\nendobj\n")
    xref_pos = sum(len(x) for x in out)
    out.append(f"xref\n0 {nxt}\n".encode())
    out.append(b"0000000000 65535 f \n")
    for i in range(1, nxt):
        out.append(f"{offsets[i]:010d} 00000 n \n".encode())
    out.append(f"trailer\n<< /Size {nxt} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode())
    with open(path, "wb") as f:
        f.write(b"".join(out))


class DocsFixtureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        ddir = os.path.join(cls.tmp.name, "docs")
        os.makedirs(os.path.join(ddir, "slides"))
        _write_pptx(os.path.join(ddir, "slides", "khoa-hoc.pptx"), SLIDES)
        _write_pdf(os.path.join(ddir, "slides", "agent.pdf"),
                   ["Agent slide mot", "Agent slide hai", "Agent slide ba"])
        with open(os.path.join(ddir, "lich-su.md"), "w", encoding="utf-8") as f:
            f.write(MD_DECK)
        cls.old_env = os.environ.get("CLASSROOM_DOCS_DIR")
        os.environ["CLASSROOM_DOCS_DIR"] = ddir
        cls.ddir = ddir
        coach.clear_suggestion_cache()

    @classmethod
    def tearDownClass(cls):
        if cls.old_env is None:
            os.environ.pop("CLASSROOM_DOCS_DIR", None)
        else:
            os.environ["CLASSROOM_DOCS_DIR"] = cls.old_env
        cls.tmp.cleanup()

    def doc(self, name="slides/khoa-hoc.pptx"):
        return rag.list_docs(self.ddir) and next(
            d for d in rag.list_docs(self.ddir) if d.id == name)


class TestParsing(DocsFixtureTest):
    def test_pptx_parsing(self):
        deck = self.doc()
        self.assertEqual(deck.id, "slides/khoa-hoc.pptx")
        self.assertEqual(deck.title, "khoa-hoc")
        self.assertEqual(len(deck.chunks), 8)
        self.assertEqual(deck.chunks[2]["title"], "Quang hợp ở thực vật")
        self.assertEqual(len(deck.chunks[2]["bullets"]), 3)
        self.assertIn("Diệp lục", deck.chunks[2]["text"])

    def test_md_parsing(self):
        deck = self.doc("lich-su.md")
        self.assertEqual(len(deck.chunks), 3)  # heading và '---' đều cắt đoạn
        self.assertEqual(deck.chunks[0]["title"], "# Bài giảng Lịch sử")
        self.assertEqual(deck.chunks[1]["title"], "## Thời kỳ Văn Lang")
        self.assertEqual(deck.chunks[1]["bullets"][0],
                         "- Nhà nước Văn Lang ra đời khoảng thế kỷ thứ bảy trước công nguyên")

    def test_pdf_parsing_and_list_docs_recursive(self):
        docs = rag.list_docs(self.ddir)
        self.assertEqual(sorted(d.id for d in docs),
                         ["lich-su.md", "slides/agent.pdf", "slides/khoa-hoc.pptx"])
        pdf = next(d for d in docs if d.id.endswith(".pdf"))
        self.assertEqual(pdf.title, "agent")
        self.assertGreaterEqual(len(pdf.chunks), 1)

    def test_list_docs_empty_and_missing_dir(self):
        with tempfile.TemporaryDirectory() as empty:
            self.assertEqual(rag.list_docs(empty), [])
        with tempfile.TemporaryDirectory() as missing:
            gone = os.path.join(missing, "docs")
            self.assertEqual(rag.list_docs(gone), [])
            self.assertTrue(os.path.isdir(gone))  # tạo lười

    def test_resolve_doc_path_traversal(self):
        self.assertIsNone(rag.resolve_doc_path(self.ddir, "../secret.txt"))
        self.assertIsNone(rag.resolve_doc_path(self.ddir, "slides/../../etc/passwd"))
        self.assertIsNone(rag.resolve_doc_path(self.ddir, "nope.pdf"))
        self.assertIsNotNone(rag.resolve_doc_path(self.ddir, "slides/khoa-hoc.pptx"))


class TestSearch(DocsFixtureTest):
    def test_bm25_with_and_without_diacritics(self):
        deck = self.doc()
        for q in ("quang hợp ở thực vật là gì", "quang hop o thuc vat la gi"):
            top = deck.search(q, k=1)
            self.assertEqual(top[0][0]["slide"], 3, f"query: {q}")
        top = deck.search("hanh tinh thu ba", k=1)
        self.assertEqual(top[0][0]["slide"], 4)


class TestCleanPdfPages(unittest.TestCase):
    def test_header_footer_pagenum_and_join(self):
        pages = [
            ["AI Agent · tài liệu tự học", "Quang hợp ở thực vật", "là quá trình tạo dinh dưỡng", "1 / 20"],
            ["AI Agent · tài liệu tự học", "Hệ mặt trời", "gồm tám hành tinh quay quanh", "2 / 20"],
            ["AI Agent · tài liệu tự học", "3", "Cơ thể con người", "3 / 20"],
        ]
        cleaned = rag._clean_pdf_pages(pages)
        # footer lặp (3/3 trang >= 50%) và số trang bị loại
        for lines in cleaned:
            self.assertNotIn("AI Agent · tài liệu tự học", lines)
            self.assertFalse(any(rag._PAGE_NUM_RE.match(l) for l in lines))
        # dòng bắt đầu bằng chữ thường được nối vào ý trước
        self.assertIn("Quang hợp ở thực vật là quá trình tạo dinh dưỡng", cleaned[0])
        self.assertIn("Hệ mặt trời gồm tám hành tinh quay quanh", cleaned[1])
        # dòng chỉ là số ("3") cũng bị bỏ
        self.assertEqual(cleaned[2], ["Cơ thể con người"])

    def test_repeated_line_threshold(self):
        # dòng trên 1/3 trang (< 50%) thì giữ lại
        pages = [["T1", "Ý một", "Ghi chú chung"], ["T2", "Ý hai"], ["T3", "Ý ba"]]
        self.assertIn("Ghi chú chung", rag._clean_pdf_pages(pages)[0])
        # dòng trên đúng 50% số trang (2/4) thì bị loại
        pages4 = [["A", "chung"], ["B", "chung"], ["C", "khác"], ["D", "khác"]]
        self.assertNotIn("chung", rag._clean_pdf_pages(pages4)[0])

    def test_bullet_coverage_by_phrases(self):
        bullets = ["Workflow: các bước do người viết code định sẵn",
                   "Agent tự quyết định thứ tự bước và công cụ cần gọi",
                   "Workflow dễ dự đoán, rẻ và dễ đo hơn"]
        # diễn đạt lại, không dấu, chỉ nêu ý 1 và 3
        covered, missing = rag.bullet_coverage(
            bullets, "workflow thi cac buoc dinh san tu truoc, de du doan va de do")
        self.assertEqual(covered, [bullets[0], bullets[2]])
        self.assertEqual(missing, [bullets[1]])
        # câu trả lời lạc đề không được tính ý nào
        covered, _ = rag.bullet_coverage(bullets, "Quang hợp tạo ra oxy từ ánh sáng")
        self.assertEqual(covered, [])
        # từ dừng không thành cụm then chốt
        self.assertNotIn("hơn", [d for _, d in rag.phrases("rẻ và dễ đo hơn")])


class TestSuggestions(DocsFixtureTest):
    def test_at_most_two_per_slide_and_none_on_cover(self):
        deck = self.doc()
        for c in deck.chunks:
            sugs = coach.suggestions_for(deck, c["slide"])
            self.assertLessEqual(len(sugs), 2)
        self.assertEqual(coach.suggestions_for(deck, 1), [])  # slide bìa

    def test_excerpts_verbatim_and_types(self):
        deck = self.doc()
        slide7 = next(c for c in deck.chunks if c["slide"] == 7)
        text = coach.slide_text(slide7)
        sugs = coach.suggestions_for(deck, 7)
        self.assertTrue(sugs)
        types = set()
        for s in sugs:
            self.assertIn(s["excerpt"], text)  # chuỗi con nguyên văn (đã chuẩn hoá khoảng trắng)
            self.assertIn(s["card"]["type"], coach.CARD_TYPES)
            self.assertTrue(s["id"].startswith("s_"))
            self.assertTrue(s["linh_says"])
            types.add(s["card"]["type"])
        # slide 7 có đủ cả rule / example / mistake rõ dấu hiệu -> top 2 phải có type hợp lý
        self.assertTrue(types)
        # phân loại trực tiếp các ý có dấu hiệu rõ
        self.assertEqual(coach.classify_bullet(
            "Nên bắt đầu với quy mô nhỏ rồi đo kết quả trước khi mở rộng")[0], "rule")
        self.assertEqual(coach.classify_bullet(
            "Ví dụ: một nhóm học sinh thử nghiệm chatbot ở một lớp trước tiên")[0], "example")
        self.assertEqual(coach.classify_bullet(
            "Lỗi thường gặp: không có giới hạn số bước nên hệ thống lặp vô hạn")[0], "mistake")
        self.assertEqual(coach.classify_bullet(
            "Quang hợp là quá trình thực vật tạo chất dinh dưỡng")[0], "concept")

    def test_card_titles(self):
        card = coach.card_from_excerpt("Workflow: các bước do người viết code định sẵn", "concept")
        self.assertEqual(card["title"], "Workflow là gì")
        self.assertEqual(card["content"], "Workflow: các bước do người viết code định sẵn")
        card = coach.card_from_excerpt(
            "Nguyên tắc: bắt đầu bằng workflow, chỉ chuyển sang agent khi cần", "rule")
        self.assertEqual(card["title"], "Bắt đầu bằng workflow")
        says = coach.linh_says("rule", "Nguyên tắc: bắt đầu bằng workflow, chỉ chuyển sang agent",
                               "Workflow và agent")
        self.assertIn("“Workflow và agent”", says)

    def test_topics(self):
        deck = self.doc()
        topics = coach.topics(deck)
        self.assertTrue(topics)
        for t in topics:
            self.assertTrue(t["id"].startswith("t_"))
            self.assertGreaterEqual(len(t["slides"]), 2)
            self.assertLessEqual(len(t["slides"]), 3)
            # các slide liên tiếp
            self.assertEqual(t["slides"], list(range(t["slides"][0], t["slides"][-1] + 1)))

    def test_opponent_decks(self):
        deck = self.doc()
        topic = coach.topics(deck)[0]
        decks = coach.opponent_decks(deck, topic)
        self.assertEqual(set(decks), {"minh", "hai", "vy", "an"})
        for bid, cards in decks.items():
            self.assertLessEqual(len(cards), 5)
            for c in cards:
                self.assertFalse(c["own"])
                self.assertEqual(c["source"]["doc_id"], deck.id)
                self.assertIn(c["source"]["excerpt"], coach.slide_text(
                    next(x for x in deck.chunks if x["slide"] == c["source"]["slide"])))
        # vy ưu tiên concept/rule
        vy_types = {c["type"] for c in decks["vy"]}
        self.assertTrue(vy_types <= {"concept", "rule"} or len(decks["vy"]) == 5)

    def test_opponent_decks_are_distinct_and_have_specialties(self):
        deck = self.doc()
        doc_types = {s["card"]["type"] for c in deck.chunks
                     for s in coach.suggestions_for(deck, c["slide"])}
        self.assertIn("mistake", doc_types)
        self.assertIn("example", doc_types)
        topics = coach.topics(deck)
        self.assertTrue(topics)
        for topic in topics:
            decks = coach.opponent_decks(deck, topic)
            holders = Counter(c["id"] for cards in decks.values() for c in cards)
            self.assertLessEqual(max(holders.values()), 2)  # mỗi thẻ tối đa 2 bot
            ids = {b: {c["id"] for c in cards} for b, cards in decks.items()}
            for a, b in itertools.combinations(ids, 2):
                self.assertLessEqual(len(ids[a] & ids[b]), 2, f"{a} và {b} trùng quá nhiều thẻ")
            self.assertTrue(any(c["type"] == "mistake" for c in decks["hai"]))
            self.assertTrue(any(c["type"] == "example" for c in decks["an"]))

    def test_mistake_label_needs_consequence_context(self):
        # chỉ có chữ "lỗi" / "sai" là chưa đủ để thành "lỗi thường gặp"
        self.assertEqual(coach.classify_bullet(
            "Trả lỗi rõ ràng để agent tự sửa được, không trả chuỗi rỗng")[0], "rule")
        self.assertEqual(coach.classify_bullet(
            "Mức tự động cao hay thấp tuỳ vào cái giá của một lần sai")[0], "rule")
        # có ngữ cảnh nguyên nhân / hậu quả thì là lỗi thường gặp
        self.assertEqual(coach.classify_bullet(
            "Mô tả công cụ mơ hồ là nguyên nhân phổ biến khiến agent gọi sai công cụ")[0], "mistake")
        self.assertEqual(coach.classify_bullet(
            "Bộ nhớ sai hoặc cũ khiến agent tự tin dùng thông tin lỗi thời")[0], "mistake")
        self.assertEqual(coach.classify_bullet(
            "Không có giới hạn số bước, agent có thể lặp vô hạn và đốt chi phí")[0], "mistake")
        # tiêu đề slide "kiểu lỗi thường gặp" áp cho mọi ý của slide
        self.assertEqual(coach.classify_bullet(
            "Lặp vô hạn: gọi đi gọi lại một công cụ mà không tiến triển",
            "Các kiểu lỗi thường gặp")[0], "mistake")


class TestOfflineMatch(DocsFixtureTest):
    def _match(self, seed=7, cards=None):
        deck = self.doc()
        topic = coach.topics(deck)[0]
        m = match.create_match(deck, topic=topic, bot_name="Bé Bot", seed=seed)
        if cards is None:
            cards = [{
                "id": "c_mine", "title": "Quy tắc nhỏ", "own": True,
                "content": "Nên bắt đầu với quy mô nhỏ rồi đo kết quả trước khi mở rộng",
                "type": "rule",
            }]
        m.set_cards(cards)
        return m

    def _play_full(self, m):
        s = m.state()
        for _ in range(7):  # q0 scored, q1, q1 scored, q2, q2 scored, review
            if s["phase"] == "review":
                break
            s = m.next()
        return s

    def test_full_match_pick_to_review(self):
        m = self._match()
        s = m.state()
        self.assertEqual(s["phase"], "question")
        self.assertEqual(s["qindex"], 0)
        self.assertEqual(s["questions"][0]["kind"], "recall")
        self.assertTrue(s["questions"][0]["sample"])
        self.assertEqual(s["questions"][0]["dimension"], "correctness")
        self.assertNotIn("rubric", s["questions"][0])  # rubric chỉ hiện ở pha review
        self.assertEqual(s["questions"][0]["answers"], [])
        s = m.next()
        self.assertEqual(s["phase"], "scored")
        ans = s["questions"][0]["answers"]
        self.assertEqual([a["by"] for a in ans], ["vy", "player"])  # 1 đấu 1: đối thủ mặc định Vy nói trước
        for a in ans:
            self.assertIn("score", a)
            self.assertTrue(0 <= a["score"] <= 10)
            self.assertTrue(a["comment"])
            own = {c["id"] for c in m.contestants[a["by"]]["_cards"]}
            self.assertTrue({u["id"] for u in a["used_cards"]} <= own)
        s = m.next()
        self.assertEqual((s["phase"], s["qindex"]), ("question", 1))
        self.assertEqual(s["questions"][1]["kind"], "apply")
        self.assertEqual(s["questions"][1]["dimension"], "application")
        s = m.next()
        self.assertEqual(s["phase"], "scored")
        self.assertEqual([a["by"] for a in s["questions"][1]["answers"]], ["player", "vy"])  # đổi lượt
        q2_answers = {a["by"]: a["text"] for a in s["questions"][1]["answers"]}
        s = m.next()
        self.assertEqual((s["phase"], s["qindex"]), ("question", 2))
        q3 = s["questions"][2]
        self.assertEqual(q3["kind"], "rebuttal")
        self.assertIsNone(q3["target"])
        self.assertEqual({t["by"]: t["text"] for t in q3["targets"]}, q2_answers)  # hiện trước khi phản biện
        s = m.next()
        self.assertEqual(s["phase"], "scored")
        # phản biện chéo: mỗi bot phản biện câu 2 của bot kia
        for a in s["questions"][2]["answers"]:
            other = "player" if a["by"] == "vy" else "vy"
            self.assertEqual(a["target"], {"by": other, "text": q2_answers[other]})
        s = m.next()
        self.assertEqual(s["phase"], "review")
        self.assertIsNotNone(s["review"])
        ranking = s["review"]["ranking"]
        self.assertEqual(len(ranking), 2)
        self.assertEqual([r["rank"] for r in ranking], [1, 2])
        scores = {c["id"]: c["score"] for c in s["contestants"]}
        expected = ("win" if scores["player"] > scores["vy"]
                    else "lose" if scores["player"] < scores["vy"] else "draw")
        self.assertEqual(s["review"]["result"], expected)
        # rubric chỉ lộ ở review
        self.assertIn("rubric", s["questions"][0])
        # gaps tổng kết kiến thức còn thiếu: câu hỏi đã hỏi + đoạn slide nguyên văn, không có thẻ nháp viết sẵn
        questions = {q["index"]: q["text"] for q in s["questions"]}
        for g in s["review"]["gaps"]:
            self.assertEqual(g["doc_id"], m.doc.id)
            slide = next(c for c in m.doc.chunks if c["slide"] == g["slide"])
            self.assertIn(g["excerpt"], coach.slide_text(slide))
            self.assertEqual(g["question"], questions[g["qindex"]])
            self.assertIn(g["type"], coach.CARD_TYPES)
            self.assertNotIn("draft_card", g)
        gap_excerpts = [g["excerpt"] for g in s["review"]["gaps"]]
        self.assertEqual(len(gap_excerpts), len(set(gap_excerpts)))  # không lặp lại cùng một đoạn

    def test_bot_answers_only_use_own_card_text(self):
        m = self._match()
        m.next()
        for q in m.state()["questions"]:
            for a in q["answers"]:
                own = {c["id"]: c for c in m.contestants[a["by"]]["_cards"]}
                used = [own[u["id"]] for u in a["used_cards"]]
                # mỗi thẻ dùng phải xuất hiện nguyên văn trong câu trả lời (trừ khi minh cắt ngắn)
                if a["by"] != "minh":
                    for c in used:
                        self.assertIn(c["content"], a["text"])
                self.assertTrue({u["id"] for u in a["used_cards"]} <= set(own))

    def test_persona_phrasing_uses_and_reports_exact_cards(self):
        oc = match.OfflineCoach(self.doc(), __import__("random").Random(1))
        ex = {"id": "e", "title": "Thử nhỏ", "content": "Ví dụ: nhóm thử chatbot ở một lớp", "type": "example",
              "source": {"slide": 7}}
        rule = {"id": "r", "title": "Quy tắc", "content": "Nên bắt đầu nhỏ", "type": "rule",
                "source": {"slide": 7}}
        q = {"kind": "apply"}
        text, used = oc._compose("an", [rule, ex], q)
        self.assertIn("Ví dụ trong thẻ “Thử nhỏ”", text)
        self.assertEqual([c["id"] for c in used], ["e", "r"])
        text, used = oc._compose("an", [rule], q)  # không có thẻ ví dụ: nói thật
        self.assertIn("chưa có thẻ ví dụ", text)
        self.assertEqual([c["id"] for c in used], ["r"])
        text, used = oc._compose("minh", [rule, ex], q)
        self.assertEqual(text, "Nên bắt đầu nhỏ.")
        self.assertEqual([c["id"] for c in used], ["r"])
        text, used = oc._compose("vy", [rule, ex], q)
        self.assertIn("(theo slide 7)", text)
        self.assertEqual(len(used), 2)

    def test_rebuttal_grading_distinguishes_quality(self):
        missed = [
            {"criterion": "Agent tự quyết định thứ tự bước", "slide": 3,
             "excerpt": "Agent: mô hình tự quyết định thứ tự bước và công cụ cần gọi"},
            {"criterion": "Workflow dễ dự đoán", "slide": 3,
             "excerpt": "Workflow dễ dự đoán, rẻ và dễ đo hơn"},
        ]
        covered = [{"criterion": "Workflow là các bước định sẵn", "slide": 3,
                    "excerpt": "Workflow: các bước do người viết code định sẵn, mô hình chỉ điền vào từng bước"}]
        ctx = {"missed": missed, "covered": covered}

        def score(text):
            return match.OfflineCoach._grade_rebuttal(ctx, text)[0]

        both = score("Bạn còn thiếu: agent tự quyết định thứ tự bước và công cụ cần gọi. "
                     "Workflow thì dễ dự đoán, rẻ và dễ đo hơn.")
        one = score("Bạn còn thiếu: agent tự quyết định thứ tự bước và công cụ cần gọi.")
        generic = score("Bạn trả lời chưa hay lắm, thiếu nhiều ý.")
        nitpick = score("Bạn sai khi nói workflow là các bước do người viết code định sẵn, "
                        "mô hình chỉ điền vào từng bước.")
        self.assertGreater(both, one)
        self.assertGreater(one, generic)
        self.assertGreater(generic, nitpick)
        self.assertEqual(both, 10)

    def test_opponent_choice(self):
        deck = self.doc()
        topic = coach.topics(deck)[0]
        m = match.create_match(deck, topic=topic, opponent="hai", seed=2)
        s = m.state()
        self.assertEqual([c["id"] for c in s["contestants"]], ["player", "hai"])
        self.assertEqual(s["opponent"], "hai")
        self.assertLessEqual(len(s["contestants"][1]["cards"]), match.MAX_CARDS)
        self.assertEqual(match.create_match(deck, topic=topic).state()["opponent"], "vy")
        with self.assertRaises(coach.ApiError) as cm:
            match.create_match(deck, topic=topic, opponent="ai_do")
        self.assertEqual(cm.exception.status, 400)


    def test_remind_once_then_409(self):
        m = self._match()
        # chỉ hợp lệ ở câu 3
        with self.assertRaises(coach.ApiError) as cm:
            m.remind("c_mine")
        self.assertEqual(cm.exception.status, 409)
        m.next(); m.next(); m.next(); m.next()  # tới question câu 3
        self.assertEqual(m.state()["qindex"], 2)
        s = m.remind("c_mine")
        self.assertEqual(s["reminder"], {"available": False, "card_id": "c_mine"})
        with self.assertRaises(coach.ApiError) as cm:
            m.remind("c_mine")
        self.assertEqual(cm.exception.status, 409)
        # card_id không có trong sổ tay -> 400
        m2 = self._match(seed=8)
        m2.next(); m2.next(); m2.next(); m2.next()
        with self.assertRaises(coach.ApiError) as cm:
            m2.remind("khong_co")
        self.assertEqual(cm.exception.status, 400)

    def test_irrelevant_card_gets_unsure_and_no_doc_phrases(self):
        deck = self.doc()
        topic = coach.topics(deck)[0]
        m = match.create_match(deck, topic=topic, seed=7)
        m.set_cards([{
            "id": "c_lienquan", "title": "Tim", "own": True,
            "content": "Tim có nhiệm vụ bơm máu đi khắp toàn bộ cơ thể người",
            "type": "concept",
        }])
        s = m.next()
        ans = next(a for a in s["questions"][0]["answers"] if a["by"] == "player")
        self.assertIsNotNone(ans["unsure"])
        # câu trả lời không mượn chữ chỉ có trong tài liệu (ngoài thẻ của mình)
        doc_only = "quang hợp"
        self.assertNotIn(rag.normalize(doc_only), rag.normalize(ans["text"]))

    def test_rematch_same_topic_different_question(self):
        m1 = self._match(seed=11)
        s1 = self._play_full(m1)
        m2 = match.create_match(m1.doc, topic=m1.topic, rematch_of=m1.id, variant=1, seed=12)
        m2.set_cards([{"id": "c_mine", "title": "Quy tắc nhỏ", "content": "Nên bắt đầu nhỏ rồi đo",
                       "type": "rule"}])
        s2 = m2.state()
        self.assertEqual(s2["rematch_of"], m1.id)
        self.assertEqual(s2["topic"]["id"], s1["topic"]["id"])
        m2.next(); s2 = m2.next()  # mở câu 2
        self.assertNotEqual(s2["questions"][1]["text"], s1["questions"][1]["text"])

    def test_cards_validation(self):
        deck = self.doc()
        topic = coach.topics(deck)[0]
        m = match.create_match(deck, topic=topic, seed=1)
        with self.assertRaises(coach.ApiError) as cm:
            m.set_cards([])
        self.assertEqual(cm.exception.status, 400)
        with self.assertRaises(coach.ApiError) as cm:
            m.set_cards([{"id": f"c{i}", "title": "t", "content": "c", "type": "rule"}
                         for i in range(6)])
        self.assertEqual(cm.exception.status, 400)
        with self.assertRaises(coach.ApiError) as cm:
            m.set_cards([{"id": "c", "title": "t", "content": "c", "type": "sai"}])
        self.assertEqual(cm.exception.status, 400)


class TestModelCoach(DocsFixtureTest):
    def _match_with_stub(self, stub):
        deck = self.doc()
        m = match.Match(deck, topic=coach.topics(deck)[0], call_model=stub, seed=3)
        m.set_cards([{"id": "mine1", "title": "Thẻ của mình", "content": "Nội dung thẻ của bot",
                      "type": "rule", "own": True, "source": None}])
        return deck, m

    @staticmethod
    def _question_stub():
        def stub(system, user):
            if "Sổ tay của bạn" in user:  # lượt trả lời của bot
                return {"text": json.dumps({
                    "answer": "Theo thẻ của mình: nội dung thẻ của bot.",
                    "used_card_ids": ["mine1", "the_khac_cua_bot_khac"],
                    "unsure": None,
                }), "model": "stub", "tokens_in": 1, "tokens_out": 1}
            if '"grades"' in user:  # lượt chấm của cô Linh: chấm cả hai câu trả lời một lần
                return {"text": json.dumps({"grades": [
                    {"by": "vy", "score": 99, "comment": "ok", "covered": [0, 42]},
                    {"by": "player", "score": -5, "comment": "ok", "covered": []}]}),
                    "model": "stub", "tokens_in": 0, "tokens_out": 0}
            # cô Linh soạn câu 1 và câu 2 trong một lượt gọi
            return {"text": "```json\n" + json.dumps({
                "recall": {"text": "Câu hỏi nhớ?", "rubric": []},
                "apply": {"text": "Câu hỏi áp dụng?", "rubric": []}}) + "\n```",
                "model": "stub", "tokens_in": 0, "tokens_out": 0}
        return stub

    def test_used_card_ids_outside_own_cards_dropped(self):
        deck, m = self._match_with_stub(self._question_stub())
        mc = match.ModelCoach(deck, self._question_stub(), __import__("random").Random(1))
        ans = mc.answer(m, 0, "player")
        self.assertEqual([u["id"] for u in ans["used_cards"]], ["mine1"])

    def test_invalid_json_raises_runtime_error(self):
        def stub(system, user):
            if "Sổ tay của bạn" in user:
                return {"text": "khong phai json", "model": "stub", "tokens_in": 0, "tokens_out": 0}
            return self._question_stub()(system, user)
        deck, m = self._match_with_stub(stub)
        mc = match.ModelCoach(deck, stub, __import__("random").Random(1))
        with self.assertRaises(RuntimeError):
            mc.answer(m, 0, "vy")

    def test_grade_clamps_and_filters_criteria(self):
        deck, m = self._match_with_stub(self._question_stub())
        mc = match.ModelCoach(deck, self._question_stub(), __import__("random").Random(1))
        v = mc.grade_all(m, 0, [{"by": "vy", "text": "tra loi"}, {"by": "player", "text": "tra loi"}])
        self.assertEqual([x["score"] for x in v], [10, 0])
        n = len(m.questions[0]["_rubric"])
        self.assertTrue(all(0 <= i < n for i in v[0]["covered_idx"]))  # chỉ số tiêu chí ngoài phạm vi bị bỏ

    def test_one_model_call_for_questions_1_and_2(self):
        calls = []

        def stub(system, user):
            calls.append(user)
            return self._question_stub()(system, user)
        deck, m = self._match_with_stub(stub)
        n_q = sum(1 for u in calls if "Soạn 2 câu hỏi" in u)
        m.next(); m.next()  # chấm câu 1, mở câu 2
        self.assertEqual(m.questions[1]["text"], "Câu hỏi áp dụng?")
        self.assertEqual(sum(1 for u in calls if "Soạn 2 câu hỏi" in u), n_q)  # câu 2 không gọi model lần nữa


class TestServer(DocsFixtureTest):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.server = server.make_server(port=0, host="127.0.0.1", docs_dir=cls.ddir, mode="offline")
        cls.port = cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        super().tearDownClass()

    def _req(self, method, path, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"} if payload else {}
        conn.request(method, path, body=payload, headers=headers)
        resp = conn.getresponse()
        raw = resp.read()
        conn.close()
        return resp.status, resp.getheader("Content-Type"), raw

    def test_docs_and_empty_dir(self):
        status, _, raw = self._req("GET", "/api/docs")
        self.assertEqual(status, 200)
        data = json.loads(raw)
        self.assertEqual(data["mode"], "offline")
        ids = [d["id"] for d in data["docs"]]
        self.assertIn("slides/khoa-hoc.pptx", ids)
        self.assertIn("slides/agent.pdf", ids)
        agent = next(d for d in data["docs"] if d["id"] == "slides/agent.pdf")
        self.assertEqual(agent["kind"], "pdf")
        # thư mục rỗng -> docs: []
        with tempfile.TemporaryDirectory() as empty:
            srv = server.make_server(port=0, docs_dir=empty, mode="offline")
            t = threading.Thread(target=srv.serve_forever, daemon=True)
            t.start()
            try:
                conn = http.client.HTTPConnection("127.0.0.1", srv.server_port, timeout=10)
                conn.request("GET", "/api/docs")
                r = conn.getresponse()
                self.assertEqual(json.loads(r.read())["docs"], [])
                conn.close()
            finally:
                srv.shutdown()
                srv.server_close()

    def test_doc_detail_suggestions_topics_and_pdf_file(self):
        q = urllib_quote("slides/khoa-hoc.pptx")
        status, _, raw = self._req("GET", f"/api/docs/{q}")
        self.assertEqual(status, 200)
        data = json.loads(raw)
        self.assertEqual(len(data["slides"]), 8)
        self.assertIsNone(data["file_url"])
        status, _, raw = self._req("GET", f"/api/docs/{q}/slides/1/suggestions")
        self.assertEqual(json.loads(raw)["suggestions"], [])
        status, _, raw = self._req("GET", f"/api/docs/{q}/slides/3/suggestions")
        self.assertEqual(status, 200)
        self.assertLessEqual(len(json.loads(raw)["suggestions"]), 2)
        status, _, raw = self._req("GET", f"/api/docs/{q}/topics")
        self.assertTrue(json.loads(raw)["topics"])
        # file gốc của PDF
        status, ctype, raw = self._req("GET", "/api/docs/slides%2Fagent.pdf/file")
        self.assertEqual(status, 200)
        self.assertEqual(ctype, "application/pdf")
        self.assertTrue(raw.startswith(b"%PDF"))
        # path traversal bị chặn
        status, _, raw = self._req("GET", "/api/docs/..%2F..%2FREADME.md/file")
        self.assertEqual(status, 404)
        # doc không có -> 404
        status, _, raw = self._req("GET", "/api/docs/khong-co.pptx")
        self.assertEqual(status, 404)
        self.assertIn("error", json.loads(raw))

    def test_keep_alive_connection_and_error_shapes(self):
        """Một kết nối HTTP/1.1 dùng lại cho nhiều request: body mỗi request phải được đọc hết."""
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)

        def call(method, path, body=None):
            payload = json.dumps(body).encode("utf-8") if body is not None else None
            conn.request(method, path, body=payload,
                         headers={"Content-Type": "application/json"} if payload else {})
            r = conn.getresponse()
            return r.status, json.loads(r.read())

        try:
            st, state = call("POST", "/api/matches", {"doc_id": "slides/khoa-hoc.pptx"})
            self.assertEqual(st, 201)
            mid = state["id"]
            st, _ = call("POST", f"/api/matches/{mid}/cards",
                         {"cards": [{"id": "c1", "title": "t", "content": "Nên bắt đầu nhỏ", "type": "rule"}]})
            self.assertEqual(st, 200)
            st, body = call("POST", f"/api/matches/{mid}/remind", {"card_id": "c1"})  # chưa tới câu 3
            self.assertEqual(st, 409)
            self.assertIn("error", body)
            st, body = call("POST", f"/api/matches/{mid}/next")
            self.assertEqual(st, 200)
            st, body = call("POST", "/api/matches", {})  # thiếu doc_id
            self.assertEqual(st, 400)
            st, body = call("POST", "/api/matches", {"doc_id": "khong-co.pdf"})
            self.assertEqual(st, 404)
            st, body = call("POST", f"/api/matches/m_khongco/next")
            self.assertEqual(st, 404)
        finally:
            conn.close()

    def test_full_match_over_http(self):
        q = urllib_quote("slides/khoa-hoc.pptx")
        _, _, raw = self._req("GET", f"/api/docs/{q}/topics")
        topic_id = json.loads(raw)["topics"][0]["id"]
        status, _, raw = self._req("POST", "/api/matches",
                                   {"doc_id": "slides/khoa-hoc.pptx", "topic_id": topic_id,
                                    "bot_name": "Bé Bot"})
        self.assertEqual(status, 201)
        mid = json.loads(raw)["id"]
        self.assertEqual(json.loads(raw)["phase"], "pick")
        # chọn quá 5 thẻ -> 400
        status, _, raw = self._req("POST", f"/api/matches/{mid}/cards",
                                   {"cards": [{"id": f"c{i}", "title": "t", "content": "c",
                                               "type": "rule"} for i in range(6)]})
        self.assertEqual(status, 400)
        status, _, raw = self._req("POST", f"/api/matches/{mid}/cards",
                                   {"cards": [{"id": "c1", "title": "Quy tắc nhỏ",
                                               "content": "Nên bắt đầu với quy mô nhỏ rồi đo kết quả",
                                               "type": "rule", "own": True}]})
        self.assertEqual(status, 200)
        state = json.loads(raw)
        self.assertEqual(state["phase"], "question")
        # sai pha: cards ở pha question -> 409
        status, _, _ = self._req("POST", f"/api/matches/{mid}/cards",
                                 {"cards": [{"id": "c1", "title": "t", "content": "c", "type": "rule"}]})
        self.assertEqual(status, 409)
        # đi tới review
        for _ in range(6):
            status, _, raw = self._req("POST", f"/api/matches/{mid}/next")
            self.assertEqual(status, 200)
            state = json.loads(raw)
        self.assertEqual(state["phase"], "review")
        # GET trạng thái
        status, _, raw = self._req("GET", f"/api/matches/{mid}")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["review"]["ranking"][0]["rank"], 1)
        # trận không có -> 404
        status, _, _ = self._req("GET", "/api/matches/m_khongco")
        self.assertEqual(status, 404)
        # rematch: cùng chủ đề, câu mới
        status, _, raw = self._req("POST", "/api/matches",
                                   {"doc_id": "slides/khoa-hoc.pptx", "rematch_of": mid})
        self.assertEqual(status, 201)
        mid2 = json.loads(raw)["id"]
        self.assertEqual(json.loads(raw)["topic"]["id"], state["topic"]["id"])
        self._req("POST", f"/api/matches/{mid2}/cards",
                  {"cards": [{"id": "c1", "title": "t", "content": "Nên bắt đầu nhỏ", "type": "rule"}]})
        _, _, raw = self._req("POST", f"/api/matches/{mid2}/next")
        _, _, raw = self._req("POST", f"/api/matches/{mid2}/next")
        s2 = json.loads(raw)
        self.assertNotEqual(s2["questions"][1]["text"], state["questions"][1]["text"])


class TestModePolicy(DocsFixtureTest):
    """--mode auto|offline|model và việc tự chuyển sang offline khi chưa có phần gọi model (issue #11)."""

    def _serve(self, mode, stub):
        coach.clear_suggestion_cache()  # cache gợi ý model của test khác không được lọt vào đây
        srv = server.make_server(port=0, docs_dir=self.ddir, mode=mode, call_model=stub)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (srv.shutdown(), srv.server_close()))

        def req(method, path, body=None):
            conn = http.client.HTTPConnection("127.0.0.1", srv.server_port, timeout=10)
            conn.request(method, path, body=json.dumps(body).encode() if body is not None else None,
                         headers={"Content-Type": "application/json"} if body is not None else {})
            r = conn.getresponse()
            data = json.loads(r.read())
            conn.close()
            return r.status, data
        return srv, req

    @staticmethod
    def _not_implemented(calls):
        def stub(system, user):
            calls.append(1)
            raise NotImplementedError("chưa viết phần gọi model thật")
        return stub

    _CARDS = {"cards": [{"id": "c1", "title": "t", "content": "Nên bắt đầu nhỏ", "type": "rule"}]}

    def test_auto_falls_back_to_offline_when_model_not_implemented(self):
        calls = []
        srv, req = self._serve("auto", self._not_implemented(calls))
        st, docs = req("GET", "/api/docs")
        self.assertEqual((st, docs["mode"], docs["mode_note"]), (200, "model", None))
        # gợi ý slide, chủ đề, tạo trận: chạy theo luật, không gọi model
        st, _ = req("GET", "/api/docs/slides%2Fkhoa-hoc.pptx/slides/3/suggestions")
        self.assertEqual(st, 200)
        st, state = req("POST", "/api/matches", {"doc_id": "slides/khoa-hoc.pptx"})
        self.assertEqual((st, state["mode"], state["mode_note"]), (201, "model", None))
        self.assertEqual(calls, [])
        # cô Linh ra đề qua model báo NotImplementedError -> chuyển offline và làm lại đúng request này
        st, state = req("POST", f"/api/matches/{state['id']}/cards", self._CARDS)
        self.assertEqual((st, state["phase"], state["mode"]), (200, "question", "offline"))
        self.assertIn("MODEL_PROVIDER=", state["mode_note"])
        self.assertIn("issue #11", state["mode_note"])
        self.assertTrue(state["questions"][0]["sample"])
        n_calls = len(calls)
        st, docs = req("GET", "/api/docs")
        self.assertEqual((st, docs["mode"]), (200, "offline"))
        self.assertIn("chế độ không model", docs["mode_note"])
        # mọi request sau dùng offline, không gọi model nữa
        st, state = req("POST", f"/api/matches/{state['id']}/next")
        self.assertEqual((st, state["phase"]), (200, "scored"))
        self.assertEqual(len(calls), n_calls)

    def test_other_model_errors_are_502_and_do_not_switch(self):
        def boom(system, user):
            raise RuntimeError("Model trả về JSON hỏng")
        srv, req = self._serve("auto", boom)
        st, state = req("POST", "/api/matches", {"doc_id": "slides/khoa-hoc.pptx"})
        self.assertEqual(st, 201)
        st, body = req("POST", f"/api/matches/{state['id']}/cards", self._CARDS)
        self.assertEqual(st, 502)
        self.assertIn("JSON hỏng", body["error"])
        st, docs = req("GET", "/api/docs")
        self.assertEqual((docs["mode"], docs["mode_note"]), ("model", None))

    def test_model_mode_never_switches(self):
        calls = []
        srv, req = self._serve("model", self._not_implemented(calls))
        st, state = req("POST", "/api/matches", {"doc_id": "slides/khoa-hoc.pptx"})
        self.assertEqual(st, 201)
        st, body = req("POST", f"/api/matches/{state['id']}/cards", self._CARDS)
        self.assertEqual(st, 502)
        self.assertIn("issue #11", body["error"])
        st, docs = req("GET", "/api/docs")
        self.assertEqual((docs["mode"], docs["mode_note"]), ("model", None))

    def test_offline_mode_never_calls_model(self):
        calls = []
        srv, req = self._serve("offline", self._not_implemented(calls))
        st, state = req("POST", "/api/matches", {"doc_id": "slides/khoa-hoc.pptx"})
        self.assertEqual((st, state["mode"], state["mode_note"]), (201, "offline", None))
        st, docs = req("GET", "/api/docs")
        self.assertEqual((docs["mode"], docs["mode_note"]), ("offline", None))
        self.assertEqual(calls, [])

    def test_invalid_mode_rejected(self):
        with self.assertRaises(ValueError):
            server.make_server(port=0, docs_dir=self.ddir, mode="loạn")


def urllib_quote(s):
    import urllib.parse
    return urllib.parse.quote(s, safe="")


if __name__ == "__main__":
    unittest.main()
