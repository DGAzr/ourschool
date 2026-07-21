# OurSchool - Homeschool Management System
# Copyright (C) 2025 Dustan Ashley
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""Objective-match ranking for Paperless documents (pure functions).

Implements the design-handoff algorithm verbatim: a document scores 60 for
sharing the lesson's subject, plus 11 per distinct "hit" word (length > 3,
capped at 4 hits) that the lesson's objective+title shares with the
document's OCR keywords ∪ title words. The displayed percentage is
``clamp(round(score * 1.22), 46, 97)``.

Runs in Python over the cached ``paperless_documents`` rows — a
single-family library is hundreds of documents, not millions.
"""

import re
from typing import Iterable, List, Optional, Tuple

SUBJECT_SCORE = 60
HIT_SCORE = 11
MAX_HITS = 4
MIN_WORD_LEN = 4  # "len > 3" in the handoff
PCT_FACTOR = 1.22
PCT_MIN = 46
PCT_MAX = 97

_WORD_RE = re.compile(r"[a-z0-9']+")


def words(text: Optional[str]) -> set:
    """Lowercased distinct words of length > 3 from arbitrary text."""
    if not text:
        return set()
    return {w for w in _WORD_RE.findall(text.lower()) if len(w) >= MIN_WORD_LEN}


def score(
    doc_subject_id: Optional[int],
    doc_keywords: Optional[str],
    doc_title: Optional[str],
    lesson_subject_id: Optional[int],
    lesson_title: Optional[str],
    lesson_objective: Optional[str],
) -> int:
    """Raw match score for one document against one lesson."""
    total = 0
    if doc_subject_id is not None and doc_subject_id == lesson_subject_id:
        total += SUBJECT_SCORE
    doc_words = words(doc_keywords) | words(doc_title)
    lesson_words = words(lesson_objective) | words(lesson_title)
    hits = len(lesson_words & doc_words)
    total += min(hits, MAX_HITS) * HIT_SCORE
    return total


def match_pct(raw_score: int) -> int:
    """Displayed percentage for a raw score."""
    return max(PCT_MIN, min(PCT_MAX, round(raw_score * PCT_FACTOR)))


def rank_documents(
    docs: Iterable,
    lesson_subject_id: Optional[int],
    lesson_title: Optional[str],
    lesson_objective: Optional[str],
) -> List[Tuple[object, int, int]]:
    """Return ``[(doc, raw_score, match_pct)]`` sorted by score desc.

    ``docs`` are ``PaperlessDocument``-shaped objects (need ``subject_id``,
    ``keywords``, ``title``). Ties break on title for a stable order.
    """
    scored = [
        (
            doc,
            score(
                doc.subject_id,
                doc.keywords,
                doc.title,
                lesson_subject_id,
                lesson_title,
                lesson_objective,
            ),
        )
        for doc in docs
    ]
    scored.sort(key=lambda pair: (-pair[1], (pair[0].title or "").lower()))
    return [(doc, raw, match_pct(raw)) for doc, raw in scored]
