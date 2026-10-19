"""Local-only SNI/proxy smoke with an isolated Caddy and stdlib test upstreams.

Runs on Docker Desktop (host.docker.internal). No production DNS, secrets, trust
store or services are changed. Internal test certificates do NOT prove public TLS,
and the TURN echo upstream does NOT prove real TURN allocations/media relaying.
"""
import http.client
import base64
import hashlib
import json
import ipaddress
import socket
import socketserver
import ssl
import subprocess
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE = "livekit/caddyl4:v2.11.3@sha256:9dd090159a6042a907dbff0ce9dda27a21d2a559dc7b03b60a8e6b1b60b8348e"


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True, stderr=subprocess.STDOUT).strip()


def free_port():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


class Echo(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.sendall(self.request.recv(1024))


def serve_http(label):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.headers.get("Upgrade", "").lower() == "websocket":
                key = self.headers["Sec-WebSocket-Key"]
                accept = base64.b64encode(hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()).decode()
                self.send_response(101)
                self.send_header("Upgrade", "websocket")
                self.send_header("Connection", "Upgrade")
                self.send_header("Sec-WebSocket-Accept", accept)
                self.end_headers()
                return
            body = json.dumps({"service": label, "path": self.path,
                               "forwarded": self.headers.get("X-Forwarded-For")}).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_):
            pass
    return ThreadingHTTPServer(("127.0.0.1", 0), Handler)


def main():
    name = "pda-meeting-edge-probe-" + uuid.uuid4().hex[:12]
    servers = [serve_http(label) for label in ("frontend", "backend", "media")]
    turn = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Echo)
    servers.append(turn)
    for server in servers:
        threading.Thread(target=server.serve_forever, daemon=True).start()
    ports = [server.server_address[1] for server in servers]
    http_port, tls_port = free_port(), free_port()
    config = json.loads((ROOT / "ops/caddy/meeting.json").read_text(encoding="utf-8"))
    hosts = ["app.meeting.test", "www.meeting.test", "media.meeting.test", "turn.meeting.test"]
    config["apps"]["tls"]["automation"] = {"policies": [{"subjects": hosts, "issuers": [{"module": "internal"}]}]}
    config["apps"]["pki"] = {"certificate_authorities": {"local": {"install_trust": False}}}
    serialized = json.dumps(config)
    for old, port in zip(("frontend:3000", "backend:8080", "livekit:7880", "livekit:5349"), ports):
        serialized = serialized.replace(old, f"host.docker.internal:{port}")
    artifact = ROOT / ".local" / name
    artifact.mkdir(parents=True, exist_ok=False)
    path = artifact / "config.json"
    path.write_text(serialized, encoding="utf-8")
    # Test certificates only; never use this context to verify a real deployment.
    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    tls.check_hostname = False
    tls.verify_mode = ssl.CERT_NONE

    def get(host, uri="/", spoof=False, websocket=False):
        with socket.create_connection(("127.0.0.1", tls_port), timeout=5) as raw:
            with tls.wrap_socket(raw, server_hostname=host) as stream:
                header = "X-Forwarded-For: 198.51.100.77\r\n" if spoof else ""
                if websocket:
                    header += "Upgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: cHJvYmUtcHJvYmUtcHJvYmU=\r\n"
                connection = "Upgrade" if websocket else "close"
                stream.sendall(f"GET {uri} HTTP/1.1\r\nHost: {host}\r\n{header}Connection: {connection}\r\n\r\n".encode())
                response = http.client.HTTPResponse(stream)
                response.begin()
                return response.status, dict(response.getheaders()), response.read()

    try:
        args = ["run", "-d", "--name", name, "--memory", "128m", "--cpus", "0.25",
                "-p", f"127.0.0.1:{http_port}:80", "-p", f"127.0.0.1:{tls_port}:443",
                "--mount", f"type=bind,source={path},target=/etc/caddy/probe.json,readonly",
                "--tmpfs", "/data"]
        for key, value in zip(("SITE_ADDRESS", "WWW_ADDRESS", "MEDIA_ADDRESS", "TURN_ADDRESS"), hosts):
            args.extend(["-e", f"{key}={value}"])
        docker(*args, IMAGE, "run", "--config", "/etc/caddy/probe.json")
        deadline = time.monotonic() + 30
        while True:
            try:
                status, _, body = get(hosts[0], spoof=True)
                if status == 200:
                    break
            except (OSError, ssl.SSLError, http.client.HTTPException):
                pass
            if time.monotonic() > deadline:
                raise RuntimeError("Local edge did not become ready (check its ignored logs artifact)")
            time.sleep(0.5)
        result = json.loads(body)
        assert result["service"] == "frontend", result
        assert result["forwarded"] not in (None, "127.0.0.1", "198.51.100.77"), "Client IP lost or spoof accepted"
        assert "198.51.100.77" not in result["forwarded"], "Spoofed prefix survived in forwarded chain"
        ipaddress.ip_address(result["forwarded"])
        assert json.loads(get(hosts[0], "/api/v1/probe")[2])["service"] == "backend"
        assert get(hosts[0], "/api/v1/ws", websocket=True)[0] == 101
        assert get(hosts[1], "/calendar?project=test")[0] == 308
        assert get(hosts[1], "/calendar?project=test")[1]["Location"] == "https://app.meeting.test/calendar?project=test"
        marker = "probe-not-a-real-token-" + uuid.uuid4().hex
        assert json.loads(get(hosts[2], "/?access_token=" + marker)[2])["service"] == "media"
        assert get(hosts[2], "/rtc", websocket=True)[0] == 101
        with socket.create_connection(("127.0.0.1", tls_port), timeout=5) as raw:
            with tls.wrap_socket(raw, server_hostname=hosts[3]) as stream:
                stream.sendall(b"turn-routing-probe")
                assert stream.recv(1024) == b"turn-routing-probe"
        request = http.client.HTTPConnection("127.0.0.1", http_port, timeout=5)
        request.request("GET", "/calendar", headers={"Host": hosts[0]})
        response = request.getresponse()
        assert response.status == 308
        assert response.getheader("Location") == "https://app.meeting.test/calendar"
        request.close()
        assert marker not in docker("logs", name), "Media query appeared in edge logs"
        print("PASS: HTTPS, API, API/media WebSocket upgrade, www/HTTP redirects, SNI media/TURN, client-IP preservation/spoof rejection, media log redaction")
    finally:
        try:
            (artifact / "edge.log").write_text(docker("logs", name), encoding="utf-8")
        finally:
            subprocess.run(["docker", "rm", "-f", name], capture_output=True, check=False)
            for server in servers:
                server.shutdown()
                server.server_close()


if __name__ == "__main__":
    main()
