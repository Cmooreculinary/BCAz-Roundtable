"""Run the launch gate against a disposable local HTTPS API.

Usage: python check_launch.py
Install requirements.txt and requirements-dev.txt in the active environment first.
No production database, uploads, credentials, or external bridges are used.
"""

import os
import secrets
import socket
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path


def main() -> int:
    backend = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix="roundtable-launch-") as directory:
        root = Path(directory)
        cert, key = root / "localhost.crt", root / "localhost.key"
        subprocess.run(
            [
                "openssl",
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-nodes",
                "-keyout",
                str(key),
                "-out",
                str(cert),
                "-days",
                "1",
                "-subj",
                "/CN=localhost",
                "-addext",
                "subjectAltName=DNS:localhost,IP:127.0.0.1",
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env = os.environ.copy()
        for variable in (
            "TWILIO_ACCOUNT_SID",
            "TWILIO_AUTH_TOKEN",
            "TWILIO_FROM_NUMBER",
            "RESEND_API_KEY",
            "ANTHROPIC_API_KEY",
            "VAPID_PRIVATE_KEY",
            "VAPID_PUBLIC_KEY",
        ):
            env[variable] = ""
        env.update(
            JWT_SECRET=secrets.token_urlsafe(48),
            ADMIN_PASSWORD=secrets.token_urlsafe(24),
            ADMIN_EMAIL="admin@roundtable.app",
            TEST_PASSWORD=secrets.token_urlsafe(24),
            TEST_USER_PASSWORD=secrets.token_urlsafe(24),
            AUTH_RATE_LIMIT="1000",
            CORS_ORIGINS="https://localhost:3000",
            SQLITE_PATH=str(root / "database.sqlite3"),
            UPLOAD_ROOT=str(root / "uploads"),
            MAX_UPLOAD_BYTES="1024",
            REACT_APP_BACKEND_URL=f"https://localhost:{port}",
            REQUESTS_CA_BUNDLE=str(cert),
            PYTHONPATH=str(backend),
            NO_PROXY="localhost,127.0.0.1",
        )
        with (root / "server.log").open("w+") as log:
            server = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "app:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(port),
                    "--ssl-keyfile",
                    str(key),
                    "--ssl-certfile",
                    str(cert),
                ],
                cwd=backend,
                env=env,
                stdout=log,
                stderr=log,
            )
            try:
                context = ssl.create_default_context(cafile=str(cert))
                ready = False
                for _ in range(50):
                    if server.poll() is not None:
                        break
                    try:
                        with urllib.request.urlopen(
                            f"https://localhost:{port}/api/", context=context, timeout=1
                        ):
                            ready = True
                            break
                    except (OSError, urllib.error.URLError):
                        time.sleep(0.2)
                if not ready:
                    log.seek(0)
                    print(log.read(), file=sys.stderr)
                    return 1
                result = subprocess.run(
                    [
                        sys.executable,
                        "-m",
                        "pytest",
                        "-o",
                        "addopts=",
                        "-q",
                        "tests/test_iteration_18.py",
                        "tests/test_iteration_19.py",
                        "tests/test_roundtable_api.py",
                        "tests/test_file_security.py",
                        "tests/test_cross_origin_auth.py",
                        "tests/test_launch_security.py",
                        "tests/test_sqlite_integrity.py",
                    ],
                    cwd=backend,
                    env=env,
                )
                return result.returncode
            finally:
                server.terminate()
                try:
                    server.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()


if __name__ == "__main__":
    raise SystemExit(main())
