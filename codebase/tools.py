"""Công cụ của bài toán — NHÓM VIẾT. Điền ở guide bước 2.2 (thiết kế) và 3.2 (code).

Mỗi công cụ là một hàm Python có @tool. Docstring ghi đúng 4 ý như sơ đồ ở spec.md §4:
    tên · input · output · có tác động ra ngoài không (gửi tin, sửa dữ liệu, chấm điểm…)
Khung tự ghi mỗi lần gọi công cụ vào trace (tên, input, output rút gọn, thời gian, lỗi).

Số công cụ, kiểu công cụ do thiết kế của nhóm quyết định — có bài chỉ cần một công cụ tra cứu.
Công cụ có tác động ra ngoài: KHÔNG tự làm. Trả về bản nháp chờ người duyệt (guide bước 2.2, "chỗ người duyệt").
Dữ liệu công cụ đọc (bài mẫu, thông báo mẫu, lịch…): để trong data/ và mô tả ở data/DATA_CARD.md.
"""
from __future__ import annotations

import csv
import unicodedata
from pathlib import Path

from tracing import tool


PASSAGES = Path(__file__).resolve().parents[1] / "data" / "passages.csv"


def _normalize(value: str) -> str:
    return " ".join(unicodedata.normalize("NFC", value).casefold().split())


@tool
def get_passage(query: str) -> dict | None:
    """get_passage. Input: mã đoạn hoặc chủ đề. Output: {code, text} hoặc None.
    Chỉ đọc dữ liệu cục bộ, không tác động ra ngoài.
    """
    key = _normalize(query)
    if not key:
        return None
    with PASSAGES.open(encoding="utf-8-sig", newline="") as source:
        for passage in csv.DictReader(source):
            if key in (_normalize(passage["code"]), _normalize(passage["topic"])):
                return {"code": passage["code"], "text": passage["text"]}
    return None
