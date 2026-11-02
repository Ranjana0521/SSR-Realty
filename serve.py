import http.server
import json
import mimetypes
import os
import sys

# Ensure proper mimetypes for webapp
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")

listings_file = os.path.join(os.path.dirname(__file__), "data", "listings.json")
try:
    with open(listings_file, "r", encoding="utf-8") as f:
        listings = json.load(f)
except Exception:
    listings = []

class WonacreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin and disable stale caching for fast development
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_GET(self):
        if self.path == "/" or self.path == "":
            self.path = "/index.html"
        if self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({
                "geminiConfigured": False,
                "listingCount": len(listings)
            }).encode("utf-8"))
            return
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/chat":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
            try:
                data = json.loads(body)
                msg = data.get("message", "").lower()
            except Exception:
                msg = ""

            # Filter listings based on query keywords
            matched_ids = []
            for item in listings:
                if any(kw in msg for kw in [item.get("locality", "").lower(), item.get("type", "").lower(), "all", "show", "bhk", "villa", "apartment"]):
                    matched_ids.append(item.get("id"))
            if not matched_ids and listings:
                matched_ids = [listings[0].get("id"), listings[1].get("id")] if len(listings) > 1 else [listings[0].get("id")]

            reply = f"I found {len(matched_ids)} matching properties in Wonacre AI inventory. You can refine by locality, configuration, or budget."

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({
                "reply": reply,
                "filters": {},
                "listingIds": matched_ids[:3],
                "mode": "preview"
            }).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 4173))
    host = "127.0.0.1"
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.ThreadingHTTPServer((host, port), WonacreHandler)
    print(f"WONACRE AI local server running at http://localhost:{port}")
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")

