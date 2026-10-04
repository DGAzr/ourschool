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
import time

import httpx

MAX_RESPONSE_BYTES = 32 * 1024 * 1024
MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024

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
        self.api_version = 10
        self.server_version = None
        self.request_count = 0
        self.response_bytes = 0
        self.before_request = None
        self.deadline = None
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={
                "Authorization": f"Token {token}",
                "Accept": "application/json; version=10",
            },
            timeout=TIMEOUT_SECONDS,
            follow_redirects=False,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "PaperlessClient":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # -- low-level ---------------------------------------------------------

    def _get(self, path: str, params: Optional[dict] = None) -> httpx.Response:
        if self.before_request:
            self.before_request()
        try:
            request = self._client.build_request("GET", path, params=params)
            response = self._client.send(request, stream=True)
            self.request_count += 1
            chunks = []
            size = 0
            try:
                for chunk in response.iter_bytes():
                    if self.deadline is not None and time.monotonic() > self.deadline:
                        raise PaperlessError(
                            "Paperless sync exceeded its time limit; retry or narrow the scope."
                        )
                    size += len(chunk)
                    if size > MAX_RESPONSE_BYTES:
                        raise PaperlessError(
                            "Paperless response exceeded the size limit."
                        )
                    chunks.append(chunk)
                response._content = b"".join(chunks)
                self.response_bytes += size
            finally:
                response.close()
            if response.status_code == 406 and self.api_version == 10:
                self.api_version = 9
                self._client.headers["Accept"] = "application/json; version=9"
                return self._get(path, params)
            version = response.headers.get("x-api-version")
            # This header advertises the server's default API, not necessarily
            # the negotiated request version (e.g. API 9 served by a v10 server).
            if version is not None and (not version.isdigit() or int(version) < 9):
                raise PaperlessError(
                    "Paperless returned an unsupported API version.", status=400
                )
            self.server_version = response.headers.get("x-version", self.server_version)
        except httpx.HTTPError as exc:
            raise PaperlessError(
                "Could not reach Paperless server. Check its address and availability.",
                status=502,
            ) from exc
        if response.status_code in (401, 403):
            raise PaperlessError("Paperless rejected the API token.", status=400)
        if response.status_code >= 300:
            raise PaperlessError(
                f"Paperless returned HTTP {response.status_code} for {path}.",
                status=502,
            )
        return response

    def _get_json(self, path: str, params: Optional[dict] = None) -> dict:
        response = self._get(path, params=params)
        try:
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Expected an object")
            return payload
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
        seen_queries = set()
        seen_ids = set()
        expected_count = None
        for page in range(MAX_PAGES):
            query_key = str(httpx.QueryParams(page_params))
            if query_key in seen_queries:
                raise PaperlessError("Paperless pagination did not advance.")
            seen_queries.add(query_key)
            payload = self._get_json(path, params=page_params)
            results, count, next_url = (
                payload.get("results"),
                payload.get("count"),
                payload.get("next"),
            )
            if (
                not isinstance(results, list)
                or not isinstance(count, int)
                or isinstance(count, bool)
                or count < 0
                or "next" not in payload
                or (next_url is not None and not isinstance(next_url, str))
            ):
                raise PaperlessError(
                    "Paperless returned an invalid paginated response."
                )
            if expected_count is None:
                expected_count = count
            elif count != expected_count:
                raise PaperlessError(
                    "Paperless inventory changed during pagination; retry sync."
                )
            for item in results:
                if (
                    not isinstance(item, dict)
                    or type(item.get("id")) is not int
                    or item["id"] < 1
                    or item["id"] in seen_ids
                ):
                    raise PaperlessError(
                        "Paperless returned invalid or repeated document identifiers."
                    )
                if path != "/api/documents/" and not isinstance(item.get("name"), str):
                    raise PaperlessError("Paperless returned invalid catalog metadata.")
                fields = (params or {}).get("fields", "")
                if "title" in fields:
                    required = ("title", "tags", "modified", "document_type")
                    if (
                        any(k not in item for k in required)
                        or not isinstance(item["title"], str)
                        or not isinstance(item["modified"], str)
                        or (
                            item["document_type"] is not None
                            and type(item["document_type"]) is not int
                        )
                        or not isinstance(item["tags"], list)
                        or any(type(t) is not int or t < 1 for t in item["tags"])
                    ):
                        raise PaperlessError(
                            "Paperless returned incomplete document metadata."
                        )
                if fields == "id,content" and (
                    "content" not in item
                    or not isinstance(item["content"], (str, type(None)))
                ):
                    raise PaperlessError("Paperless returned incomplete OCR metadata.")
                seen_ids.add(item["id"])
            yield from results
            if not next_url:
                if len(seen_ids) != expected_count:
                    raise PaperlessError(
                        "Paperless inventory was incomplete; cleanup was skipped."
                    )
                return
            if not results:
                raise PaperlessError(
                    "Paperless pagination returned an empty intermediate page."
                )
            query = urlsplit(next_url).query
            if not query:
                raise PaperlessError(
                    "Paperless pagination omitted its next-page query."
                )
            # Omitted filters can be restored, but changed filters/projections
            # would invalidate absence detection for this inventory.
            next_params = httpx.QueryParams(query)
            original_params = httpx.QueryParams(
                {"page_size": PAGE_SIZE, **(params or {})}
            )
            if any(
                key in next_params
                and next_params.get_list(key) != original_params.get_list(key)
                for key in original_params
            ):
                raise PaperlessError(
                    "Paperless pagination changed the inventory filters."
                )
            page_params = httpx.QueryParams(page_params).merge(next_params)
        self.truncated = True

    # -- API surface --------------------------------------------------------

    def test(self) -> dict:
        """Validate the connection; return counts plus the full tag/doctype
        lists (id, name, document_count) that feed the sync-scope pickers.
        Family-scale servers have a few dozen of each, so the full lists are
        cheap to carry on every test."""
        documents = self._get_json(
            "/api/documents/", params={"page_size": 1, "fields": "id"}
        )
        if (
            type(documents.get("count")) is not int
            or documents["count"] < 0
            or not isinstance(documents.get("results"), list)
        ):
            raise PaperlessError("Paperless returned an invalid document count.")
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
            "api_version": self.api_version,
            "server_version": self.server_version,
            "document_count": documents["count"],
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
        params: dict = {"ordering": "id"}
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
        if (
            mime not in {"image/png", "image/jpeg", "image/webp"}
            or len(response.content) > MAX_THUMBNAIL_BYTES
        ):
            raise PaperlessError("Paperless returned an invalid thumbnail.")
        return response.content, mime

    def stream_content(
        self, paperless_id: int, kind: str = "preview", headers: Optional[dict] = None
    ):
        """Open a streaming response for a document's content.

        ``kind`` is ``preview`` (inline PDF) or ``download`` (original file).
        Returns the underlying ``httpx.Response`` opened in streaming mode;
        the caller must ``.close()`` it (or iterate it to completion).
        """
        if kind not in ("preview", "download"):
            raise ValueError(f"Unknown content kind: {kind}")
        try:
            request = self._client.build_request(
                "GET",
                f"/api/documents/{paperless_id}/{kind}/",
                headers={"Accept-Encoding": "identity", **(headers or {})},
            )
            response = self._client.send(request, stream=True)
        except httpx.HTTPError as exc:
            raise PaperlessError(
                "Could not reach Paperless server. Check its address and availability.",
                status=502,
            ) from exc
        if response.status_code >= 300 and response.status_code != 416:
            response.close()
            status = (
                409
                if response.status_code in (401, 403)
                else 404 if response.status_code == 404 else 502
            )
            raise PaperlessError(
                f"Paperless returned HTTP {response.status_code} for document "
                f"{paperless_id} {kind}.",
                status=status,
            )
        return response


def create_client(url: str, token: str) -> PaperlessClient:
    """Factory for :class:`PaperlessClient` — the test-injection seam."""
    return PaperlessClient(url, token)
