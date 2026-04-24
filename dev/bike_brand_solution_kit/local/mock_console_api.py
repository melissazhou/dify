"""Small local console API for bike brand demo UI smoke tests.

The real implementation is registered in ``api/controllers/console``. This
script reuses the same service layer through stdlib HTTP so local frontend
validation can continue when the full Dify API dependency sync is unavailable.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Mapping
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from services.bike_brand_solution_kit_service import (  # noqa: E402
    ASSET_SECTIONS,
    BikeBrandSolutionKitError,
    BikeBrandSolutionKitService,
    ChatRequest,
    FeedbackRequest,
)


class MockConsoleApiHandler(BaseHTTPRequestHandler):
    service = BikeBrandSolutionKitService()

    def do_OPTIONS(self) -> None:
        self._send_json({"ok": True})

    def do_GET(self) -> None:
        path = urlparse(self.path).path.rstrip("/")

        if path == "/console/api/ping":
            self._send_json({"result": "pong"})
            return

        if path == "/console/api/bike-brand/solution-kit/summary":
            self._send_json(self.service.get_summary())
            return

        asset_prefix = "/console/api/bike-brand/solution-kit/assets/"
        if path.startswith(asset_prefix):
            section = path.removeprefix(asset_prefix)
            if section not in ASSET_SECTIONS:
                self._send_json({"message": f"Unknown asset section: {section}"}, HTTPStatus.NOT_FOUND)
                return
            self._send_json(self.service.get_assets(section))  # type: ignore[arg-type]
            return

        self._send_json({"message": f"Unknown GET route: {path}"}, HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        path = urlparse(self.path).path.rstrip("/")
        payload = self._read_json()

        try:
            if path == "/console/api/bike-brand/assistant/chat":
                self._send_json(self.service.chat(ChatRequest(**self._body_payload(payload))))
                return

            if path == "/console/api/bike-brand/assistant/feedback":
                self._send_json(self.service.feedback(FeedbackRequest(**self._body_payload(payload))))
                return
        except BikeBrandSolutionKitError as exc:
            self._send_json({"message": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        except Exception as exc:
            self._send_json({"message": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        self._send_json({"message": f"Unknown POST route: {path}"}, HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args: Any) -> None:
        sys.stdout.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))

    def _read_json(self) -> Mapping[str, Any]:
        length = int(self.headers.get("content-length") or "0")
        if length <= 0:
            return {}

        raw = self.rfile.read(length)
        if not raw:
            return {}

        parsed = json.loads(raw.decode("utf-8"))
        if not isinstance(parsed, Mapping):
            raise ValueError("Request JSON must be an object.")
        return parsed

    @staticmethod
    def _body_payload(payload: Mapping[str, Any]) -> Mapping[str, Any]:
        body = payload.get("body")
        if isinstance(body, Mapping):
            return body
        return payload

    def _send_json(self, payload: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        if hasattr(payload, "model_dump"):
            payload = payload.model_dump(mode="json")

        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(int(status))
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        origin = self.headers.get("Origin") or "http://localhost:3100"
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Credentials", "true")
        requested_headers = self.headers.get("Access-Control-Request-Headers")
        self.send_header(
            "Access-Control-Allow-Headers",
            requested_headers or "Content-Type, Authorization, X-Requested-With, X-CSRF-Token",
        )
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the bike brand mock console API.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=5001, type=int)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), MockConsoleApiHandler)
    print(f"bike brand mock console API listening on http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
