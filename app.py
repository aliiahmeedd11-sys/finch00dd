import json
import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

from core.geometry_engine import GeometryPipeline
from core.cad_exporter import export_to_dwg
import os

PORT = 8080


class ArchHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # CORS
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/health":
            return self._send_json(200, {"ok": True})

        # Serve UI at "/"
        if path == "/":
            self.path = "/index.html"

        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/export_dwg":
            content_length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(content_length) or b"{}")
            
            # Create exports folder if missing
            if not os.path.exists("exports"): os.makedirs("exports")
            
            ts = int(datetime.datetime.now().timestamp())
            filename = f"exports/Finch_Plan_{ts}.dwg"
            export_to_dwg(data, filename)
            
            # In a real app we'd serve the file, but here we return the filename
            # and the frontend handles the blob. For simplicity, we'll keep it as 
            # a downloadable DXF but named for CAD compatibility.
            return self._send_json(200, {"filename": filename, "status": "success"})

        if path != "/api/generate":
            return self.send_error(404)

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            params = json.loads(self.rfile.read(content_length) or b"{}")

            cw = float(params.get("corridor_width", 1.8))
            rd = float(params.get("room_depth", 5.0))
            fh = float(params.get("floor_height", 3.0))
            sw = float(params.get("stair_width", 1.2))
            nf = int(params.get("num_floors", 5))
            unit_mix = params.get("unit_mix", [])
            # Module system: 1 module = 3.6m (locked)
            module = float(params.get("module", 3.6))
            module_widths = params.get("module_widths", {"studio": 1, "bed1": 2, "bed2": 3, "bed3": 4})

            raw_pts = params.get("spine", []) or []
            lot_pts = params.get("lot_boundary", []) or []
            setbacks = float(params.get("setbacks", 3.0))
            apply_zoning = bool(params.get("apply_zoning", False))

            with open("data/crash_payload.json", "w") as f:
                json.dump(params, f)

            engine = GeometryPipeline(
                corridor_width=cw,
                room_width=module,          # base module = 3.6m
                room_depth=rd,
                floor_height=fh,
                stair_width=sw,
                num_floors=nf,
                unit_mix=unit_mix,
                module=module,
                module_widths=module_widths
            )

            if lot_pts and len(lot_pts) >= 3:
                engine.process_boundary(lot_pts, setbacks=setbacks, apply_zoning=apply_zoning)
                spine_used = raw_pts
            else:
                if not raw_pts:
                    raw_pts = [[0, 0], [12, 0], [12, 10]]
                engine.process_spine(raw_pts, apply_zoning=apply_zoning)
                spine_used = raw_pts

            result = engine.get_json(apply_zoning=apply_zoning)
            result["spine"] = spine_used

            return self._send_json(200, result)

        except Exception as e:
            return self._send_json(500, {"error": str(e)})

    def _send_json(self, status_code: int, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))


if __name__ == "__main__":
    print(f"Server running: http://localhost:{PORT}")
    HTTPServer(("", PORT), ArchHandler).serve_forever()
