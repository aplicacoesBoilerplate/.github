"""Check the local SonarQube MCP connection without printing credentials."""

import json
import os
import queue
import subprocess
import sys
import threading


required = ("SONARQUBE_TOKEN", "SONARQUBE_URL", "SONARQUBE_PROJECT_KEY")
missing = [name for name in required if not os.environ.get(name)]
if missing:
    sys.exit("Missing MCP environment variables: " + ", ".join(missing))

command = [
    "docker.exe", "run", "--init", "--rm", "-i",
    "-e", "SONARQUBE_TOKEN", "-e", "SONARQUBE_URL",
    "-e", "SONARQUBE_PROJECT_KEY", "-e", "SONARQUBE_READ_ONLY=true",
    "sonarsource/sonarqube-mcp",
]
process = subprocess.Popen(
    command,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.DEVNULL,
    text=True,
    encoding="utf-8",
    bufsize=1,
)
messages = queue.Queue()


def collect_stdout():
    for line in process.stdout:
        try:
            messages.put(json.loads(line))
        except json.JSONDecodeError:
            continue


threading.Thread(target=collect_stdout, daemon=True).start()


def send(method, params=None, request_id=None):
    message = {"jsonrpc": "2.0", "method": method}
    if params is not None:
        message["params"] = params
    if request_id is not None:
        message["id"] = request_id
    process.stdin.write(json.dumps(message) + "\n")
    process.stdin.flush()


def receive(request_id):
    while True:
        try:
            response = messages.get(timeout=90)
        except queue.Empty:
            raise RuntimeError(f"MCP response timed out for request {request_id}")
        if response.get("id") == request_id:
            if "error" in response:
                raise RuntimeError(f"MCP returned an error for request {request_id}")
            return response.get("result", {})


try:
    send("initialize", {
        "protocolVersion": "2025-06-18",
        "capabilities": {},
        "clientInfo": {"name": "sonarqube-local-smoke", "version": "1.0"},
    }, 1)
    receive(1)
    send("notifications/initialized")
    send("tools/list", {}, 2)
    tools = receive(2).get("tools", [])
    quality_gate = next(
        (tool for tool in tools if tool["name"] == "get_project_quality_gate_status"),
        None,
    )
    if quality_gate is None:
        raise RuntimeError("Quality gate tool is unavailable")
    send("tools/call", {
        "name": "get_project_quality_gate_status",
        "arguments": {"projectKey": os.environ["SONARQUBE_PROJECT_KEY"]},
    }, 3)
    quality_gate_result = receive(3)
    if quality_gate_result.get("isError"):
        raise RuntimeError("Quality gate MCP call failed")
    print("MCP connected; project:", os.environ["SONARQUBE_PROJECT_KEY"])
    for item in quality_gate_result.get("content", []):
        if item.get("type") == "text":
            print("Quality gate:", item.get("text", ""))
finally:
    process.stdin.close()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.terminate()
        process.wait(timeout=10)
