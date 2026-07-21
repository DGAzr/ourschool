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

"""HTTP client for a Paperless-NGX server (read-only).

This module is the single seam between OurSchool and the Paperless API
(https://docs.paperless-ngx.com/api/): everything else — sync, routers,
tests — obtains a client via :func:`create_client` and never constructs
:class:`PaperlessClient` directly, so tests monkeypatch one symbol to inject
a fake (same philosophy as ``app/core/image_storage.py``).

OurSchool only ever reads from Paperless; no method here issues a write.
"""

from typing import Iterator, Optional, Sequence, Tuple
from urllib.parse import urlsplit

import httpx

# Bound the number of paginated requests a single call may issue, so a
# misbehaving server can't hold a synchronous endpoint forever. Hitting the
# bound flips ``PaperlessClient.truncated`` so the sync layer can refuse to
# treat a partial listing as the whole library.
MAX_PAGES = 200
PAGE_SIZE = 100
TIMEOUT_SECONDS = 15


class PaperlessError(Exception):
    """A Paperless request failed.

    ``status`` mirrors the upstream HTTP status when there was a response
    (401/403 → bad credentials) and is 502 for transport-level failures
    (unreachable host, timeout). Routers map it onto the API response.
    """

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


class PaperlessClient:
    """Thin wrapper over the Paperless-NGX REST API."""

    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        # Sticky: any paginated call that stopped at MAX_PAGES with results
        # remaining sets this. Clients are one-shot (one per sync/request
        # context), so it never needs resetting.
        self.truncated = False
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={"Authorization": f"Token {token}"},
            timeout=TIMEOUT_SECONDS,
            follow_redirects=True,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "PaperlessClient":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # -- low-level ---------------------------------------------------------

    def _get(self, path: str, params: Optional[dict] = None) -> httpx.Response:
        try:
            response = self._client.get(path, params=params)
        except httpx.HTTPError as exc:
            raise PaperlessError(
                f"Could not reach Paperless server: {exc}", status=502
            ) from exc
        if response.status_code in (401, 403):
            raise PaperlessError("Paperless rejected the API token.", status=400)
        if response.status_code >= 400:
            raise PaperlessError(
                f"Paperless returned HTTP {response.status_code} for {path}.",
                status=502,
            )
        return response

    def _get_json(self, path: str, params: Optional[dict] = None) -> dict:
        response = self._get(path, params=params)
        try:
            return response.json()
        except ValueError as exc:
            raise PaperlessError(
                f"Paperless returned a non-JSON response for {path} — is the "
                "URL pointing at a Paperless-NGX server?",
                status=502,
            ) from exc

    def _iter_paginated(
        self, path: str, params: Optional[dict] = None
    ) -> Iterator[dict]:
        page_params = {"page_size": PAGE_SIZE, **(params or {})}
        payload = self._get_json(path, params=page_params)
        yield from payload.get("results", [])
        pages = 1
        while payload.get("next") and pages < MAX_PAGES:
            # ``next`` is an absolute URL whose scheme/host/prefix are
            # whatever Paperless believes about itself — behind a reverse
            # proxy without PAPERLESS_URL set that is often an unreachable
            # http:// or internal address. Pagination never changes the
            # endpoint, so keep only its query string and re-issue the
            # original path against our configured base_url.
            query = urlsplit(payload["next"]).query
            payload = self._get_json(path, params=httpx.QueryParams(query))
            yield from payload.get("results", [])
            pages += 1
        if payload.get("next"):
            self.truncated = True

    # -- API surface --------------------------------------------------------

    def test(self) -> dict:
        """Validate the connection; return counts plus the full tag/doctype
        lists (id, name, document_count) that feed the sync-scope pickers.
        Family-scale servers have a few dozen of each, so the full lists are
        cheap to carry on every test."""
        documents = self._get_json("/api/documents/", params={"page_size": 1})
        tags = [
            {
                "id": t["id"],
                "name": t["name"],
                "document_count": t.get("document_count") or 0,
            }
            for t in self.iter_tags()
        ]
        doctypes = [
            {
                "id": d["id"],
                "name": d["name"],
                "document_count": d.get("document_count") or 0,
            }
            for d in self.iter_document_types()
        ]
        return {
            "document_count": documents.get("count", 0),
            "tag_count": len(tags),
            "document_type_count": len(doctypes),
            "tags": tags,
            "document_types": doctypes,
        }

    def iter_tags(self) -> Iterator[dict]:
        return self._iter_paginated("/api/tags/")

    def iter_document_types(self) -> Iterator[dict]:
        return self._iter_paginated("/api/document_types/")

    def iter_correspondents(self) -> Iterator[dict]:
        return self._iter_paginated("/api/correspondents/")

    def iter_documents(
        self,
        with_content: bool = True,
        tag_ids: Optional[Sequence[int]] = None,
        doctype_ids: Optional[Sequence[int]] = None,
    ) -> Iterator[dict]:
        """Yield document metadata dicts.

        ``tag_ids``/``doctype_ids`` narrow the listing server-side
        (``tags__id__in`` / ``document_type__id__in``; comma-separated ids
        are OR'd within a param). Callers pass at most one axis per call —
        the sync layer unions the two streams itself.

        The sync layer always sweeps lean (``with_content=False``) and pulls
        OCR content separately via :meth:`iter_documents_content` for the
        documents that actually changed.
        """
        params: dict = {"ordering": "-added"}
        if tag_ids:
            params["tags__id__in"] = ",".join(str(i) for i in tag_ids)
        if doctype_ids:
            params["document_type__id__in"] = ",".join(str(i) for i in doctype_ids)
        if not with_content:
            # Paperless >= 2.x supports trimming content from list payloads.
            params["fields"] = (
                "id,title,archive_serial_number,correspondent,document_type,"
                "tags,page_count,created,added,modified"
            )
        return self._iter_paginated("/api/documents/", params=params)

    def iter_documents_content(self, paperless_ids: Sequence[int]) -> Iterator[dict]:
        """Yield ``{id, content}`` payloads for the given document ids.

        Chunked ``id__in`` list queries so a steady-state sync only downloads
        OCR text for documents that are new or changed since the last sweep.
        """
        ids = list(paperless_ids)
        for start in range(0, len(ids), PAGE_SIZE):
            chunk = ids[start : start + PAGE_SIZE]
            yield from self._iter_paginated(
                "/api/documents/",
                params={
                    "id__in": ",".join(str(i) for i in chunk),
                    "fields": "id,content",
                },
            )

    def get_thumbnail(self, paperless_id: int) -> Tuple[bytes, str]:
        """Return ``(bytes, mime_type)`` for a document's thumbnail."""
        response = self._get(f"/api/documents/{paperless_id}/thumb/")
        mime = response.headers.get("content-type", "image/webp").split(";")[0]
        return response.content, mime

    def stream_content(self, paperless_id: int, kind: str = "preview"):
        """Open a streaming response for a document's content.

        ``kind`` is ``preview`` (inline PDF) or ``download`` (original file).
        Returns the underlying ``httpx.Response`` opened in streaming mode;
        the caller must ``.close()`` it (or iterate it to completion).
        """
        if kind not in ("preview", "download"):
            raise ValueError(f"Unknown content kind: {kind}")
        try:
            request = self._client.build_request(
                "GET", f"/api/documents/{paperless_id}/{kind}/"
            )
            response = self._client.send(request, stream=True)
        except httpx.HTTPError as exc:
            raise PaperlessError(
                f"Could not reach Paperless server: {exc}", status=502
            ) from exc
        if response.status_code >= 400:
            response.close()
            status = 400 if response.status_code in (401, 403) else 502
            raise PaperlessError(
                f"Paperless returned HTTP {response.status_code} for document "
                f"{paperless_id} {kind}.",
                status=status,
            )
        return response


def create_client(url: str, token: str) -> PaperlessClient:
    """Factory for :class:`PaperlessClient` — the test-injection seam."""
    return PaperlessClient(url, token)
