#!/usr/bin/env python3
"""
Android Computer-Use Agent (CUA) smoke test for OpenCode Mobile.

Full onboarding showcase — drives an Android emulator via ADB using an LLM vision loop:
  screenshot → vision model → action → repeat

Demonstrates the complete first-run journey:
   1. App opens on connection screen (no saved connections)
   2. Configure opencode server URL
   3. Connect — session list loads
   4. Create new AI coding session
   5. Submit a real Python coding task (helloworld.py + helloworld_test.py)
   6. Watch opencode work (tool calls, file writes), wait for idle
   7. Verify output / success response
   8. Navigate to Settings — show model selection
   9. Screenshot settings screen

Requirements:
  pip install openai
  ADB in PATH with a connected device/emulator.

Usage:
  # Azure OpenAI (recommended — already configured via ~/.env.d/azure-openai.env)
  source ~/.env.d/azure-openai.env
  python scripts/android-cua-smoke.py --model gpt-5.4 --include-xml

  # OpenAI
  export OPENAI_API_KEY=sk-...
  python scripts/android-cua-smoke.py --model gpt-4o --include-xml

  # Run ONLY the onboarding showcase (default and primary flow):
  python scripts/android-cua-smoke.py --showcase

  # Custom goal (legacy / quick debugging):
  python scripts/android-cua-smoke.py --goal "Open settings and toggle dark mode"

  # Speed up for a demo video (tighter waits, fewer retries):
  python scripts/android-cua-smoke.py --speed-multiplier 0.5
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import threading
import re
import xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path

try:
    from openai import OpenAI, AzureOpenAI
except ImportError:
    sys.exit("openai package required: pip install openai")


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

APP_PACKAGE = "cc.agentlabs.opencode"

# Default opencode Tailscale dev server
DEFAULT_OPENCODE_URL = "http://100.108.64.76:4096"

# Coding task prompts sent to the AI coding session
TYPESCRIPT_TASK = (
    "Write a TypeScript hello world app. "
    "Create a file hello.ts that prints 'Hello, World!' to the console."
)

PYTHON_CODING_TASK = (
    "Write a Python hello world program. "
    "Create helloworld.py that prints 'Hello, World!' and a function greet(name) that returns a greeting string. "
    "Also create helloworld_test.py with pytest tests covering both print output and greet(). "
    "Make sure both files are well-formed and the tests pass."
)

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------

_step_counter = 0
_speed_multiplier = 1.0   # Set via --speed-multiplier; <1.0 = faster


def _sleep(seconds: float) -> None:
    """Interruptible sleep that respects the global speed multiplier."""
    time.sleep(max(0.2, seconds * _speed_multiplier))


# ---------------------------------------------------------------------------
# ADB helpers
# ---------------------------------------------------------------------------

def adb(*args: str) -> str:
    """Run an adb command and return stdout."""
    result = subprocess.run(
        ["adb", *args],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0 and "Error" in result.stderr:
        raise RuntimeError(f"adb {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def _bounds_center(bounds: str) -> tuple[int, int] | None:
    match = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
    if not match:
        return None
    x1, y1, x2, y2 = map(int, match.groups())
    return ((x1 + x2) // 2, (y1 + y2) // 2)


def current_foreground_package() -> str:
    """Return resumed foreground package name when available."""
    out = adb("shell", "dumpsys", "activity", "activities")
    for line in out.splitlines():
        if "mResumedActivity" not in line:
            continue
        match = re.search(r"\s([a-zA-Z0-9_\.]+)/", line)
        if match:
            return match.group(1)
    return ""


def ensure_app_foreground(package: str = APP_PACKAGE, retries: int = 3,
                          verbose: bool = True) -> bool:
    """Bring app to foreground before scenario start."""
    for attempt in range(retries):
        current = current_foreground_package()
        if current == package:
            return True

        adb("shell", "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1")
        _sleep(2.0)

        if verbose:
            seen = current or "unknown"
            print(f"  [prep] foreground package was '{seen}', launched '{package}' (attempt {attempt + 1}/{retries})")

    return current_foreground_package() == package


def maybe_dismiss_telemetry_consent(package: str = APP_PACKAGE,
                                    verbose: bool = True) -> bool:
    """Dismiss first-launch telemetry consent modal when present."""
    xml = ui_dump()
    if not xml:
        return False

    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return False

    consent_markers = (
        "help improve opencode",
        "share anonymous crash reports",
    )
    dismiss_markers = (
        "not now", "no thanks", "decline", "skip", "later",
        "don't allow", "dont allow", "deny", "continue without",
        "opt out", "cancel",
    )

    page_text = " ".join(
        " ".join(filter(None, [
            node.attrib.get("text", ""),
            node.attrib.get("content-desc", ""),
        ])).lower()
        for node in root.iter()
    )

    if not any(marker in page_text for marker in consent_markers):
        return False

    candidates = []
    for node in root.iter():
        clickable = node.attrib.get("clickable") == "true"
        if not clickable:
            continue

        label = " ".join(filter(None, [
            node.attrib.get("text", ""),
            node.attrib.get("content-desc", ""),
            node.attrib.get("resource-id", ""),
        ])).strip().lower()
        center = _bounds_center(node.attrib.get("bounds", ""))
        if not center:
            continue
        candidates.append((label, center))

    for label, (x, y) in candidates:
        if any(marker in label for marker in dismiss_markers):
            adb("shell", "input", "tap", str(x), str(y))
            _sleep(1.0)
            if verbose:
                print(f"  [prep] dismissed telemetry consent via '{label or 'button'}' at ({x}, {y})")
            return True

    if verbose:
        print("  [prep] telemetry consent detected but dismiss button was not found")
    return False


def screenshot_b64(label: str = "") -> str:
    """Capture emulator screenshot and return as base64 PNG. Retries on timeout."""
    global _step_counter
    _step_counter += 1
    suffix = f"_{label}" if label else ""
    debug_path = f"/tmp/cua_step_{_step_counter:03d}{suffix}.png"

    for attempt in range(3):
        try:
            result = subprocess.run(
                ["adb", "exec-out", "screencap", "-p"],
                capture_output=True, timeout=30,
            )
            if result.returncode == 0 and len(result.stdout) > 100:
                Path(debug_path).write_bytes(result.stdout)
                return base64.b64encode(result.stdout).decode()
        except subprocess.TimeoutExpired:
            if attempt < 2:
                _sleep(3)
                continue
            raise

    # Fallback: screencap on device then pull
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        path = f.name
    try:
        subprocess.run(["adb", "shell", "screencap", "-p", "/sdcard/_cua_screen.png"],
                       capture_output=True, timeout=30)
        subprocess.run(["adb", "pull", "/sdcard/_cua_screen.png", path],
                       capture_output=True, timeout=10)
        data = Path(path).read_bytes()
        Path(debug_path).write_bytes(data)
        return base64.b64encode(data).decode()
    finally:
        Path(path).unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Screen recording
# ---------------------------------------------------------------------------

def start_screen_recording(scenario_name: str) -> tuple:
    """Start ADB screen recording. Returns (thread, stop_event, remote_path)."""
    remote_path = f"/sdcard/cua_{scenario_name}.mp4"
    stop_event = threading.Event()

    def _record():
        try:
            subprocess.run(
                ["adb", "shell", f"screenrecord --time-limit 180 {remote_path}"],
                capture_output=True, timeout=200,
            )
        except Exception:
            pass

    thread = threading.Thread(target=_record, daemon=True)
    thread.start()
    _sleep(1.0)
    return thread, stop_event, remote_path


def stop_screen_recording(thread: threading.Thread, remote_path: str,
                          local_path: str) -> bool:
    """Stop recorder, pull video to local_path. Returns True on success."""
    subprocess.run(
        ["adb", "shell", "pkill", "-2", "screenrecord"],
        capture_output=True, timeout=10,
    )
    _sleep(2.0)
    thread.join(timeout=5)

    result = subprocess.run(
        ["adb", "pull", remote_path, local_path],
        capture_output=True, timeout=30,
    )
    if result.returncode == 0 and Path(local_path).exists():
        print(f"  [recording] saved to {local_path}")
        return True
    print(f"  [recording] pull failed: {result.stderr.decode(errors='replace').strip()}")
    return False


# ---------------------------------------------------------------------------
# ArchiveBox upload
# ---------------------------------------------------------------------------

def upload_to_archivebox(video_path: str, scenario_name: str) -> bool:
    """Upload video to ArchiveBox if ARCHIVEBOX_URL is configured."""
    url = os.environ.get("ARCHIVEBOX_URL", "").rstrip("/")
    api_key = os.environ.get("ARCHIVEBOX_API_KEY", "")
    if not url:
        print("  [archivebox] ARCHIVEBOX_URL not set — skipping upload")
        return False

    try:
        import urllib.request

        video_data = Path(video_path).read_bytes()
        boundary = "----CUAUploadBoundary"
        body_parts = []
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"url\"\r\n\r\nfile://{scenario_name}.mp4".encode())
        body_parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{scenario_name}.mp4\"\r\nContent-Type: video/mp4\r\n\r\n".encode()
            + video_data
        )
        body_parts.append(f"--{boundary}--\r\n".encode())
        body = b"\r\n".join(body_parts)

        headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(body)),
        }
        if api_key:
            headers["X-API-Key"] = api_key

        req = urllib.request.Request(f"{url}/api/v1/add", data=body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=60) as resp:
            print(f"  [archivebox] uploaded {scenario_name}.mp4 → {url} ({resp.status})")
            return True
    except Exception as exc:
        print(f"  [archivebox] upload failed: {exc}")
        return False


def ui_dump() -> str:
    """Dump UI hierarchy XML and return as string."""
    adb("shell", "uiautomator", "dump", "/sdcard/_cua_ui.xml")
    result = subprocess.run(
        ["adb", "pull", "/sdcard/_cua_ui.xml", "/tmp/_cua_ui.xml"],
        capture_output=True, timeout=10,
    )
    if result.returncode == 0:
        return Path("/tmp/_cua_ui.xml").read_text(errors="replace")
    return ""


def execute_action(action: dict) -> str:
    """Execute an action dict returned by the LLM. Returns status string."""
    act = action.get("type", "")

    if act == "tap":
        x, y = int(action["x"]), int(action["y"])
        adb("shell", "input", "tap", str(x), str(y))
        return f"tapped ({x}, {y})"

    elif act == "type":
        text = action.get("text", "")
        escaped = text.replace(" ", "%s").replace("&", "\\&").replace(";", "\\;")
        adb("shell", "input", "text", escaped)
        return f"typed '{text}'"

    elif act == "key":
        key = action.get("key", "")
        key_map = {
            "enter": "66", "back": "4", "home": "3",
            "delete": "67", "tab": "61",
        }
        code = key_map.get(key.lower(), key)
        adb("shell", "input", "keyevent", code)
        return f"pressed key {key}"

    elif act == "swipe":
        x1, y1 = int(action["x1"]), int(action["y1"])
        x2, y2 = int(action["x2"]), int(action["y2"])
        duration = int(action.get("duration", 300))
        adb("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration))
        return f"swiped ({x1},{y1})->({x2},{y2})"

    elif act == "send":
        # Auto-locate send button: rightmost clickable button in the bottom input bar.
        _, screen_h = get_screen_size()
        bottom_threshold = int(screen_h * 0.75)
        xml = ui_dump()
        matches = re.findall(r'clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
        bottom_buttons = [(int(x1), int(y1), int(x2), int(y2)) for x1, y1, x2, y2 in matches if int(y1) > bottom_threshold]
        if bottom_buttons:
            send_btn = max(bottom_buttons, key=lambda b: (b[0] + b[2]) // 2)
            cx = (send_btn[0] + send_btn[2]) // 2
            cy = (send_btn[1] + send_btn[3]) // 2
            adb("shell", "input", "tap", str(cx), str(cy))
            return f"send button tapped ({cx}, {cy})"
        screen_w, _ = get_screen_size()
        fx = screen_w - 80
        fy = screen_h - 120
        adb("shell", "input", "tap", str(fx), str(fy))
        return f"send button tapped (fallback {fx}, {fy})"

    elif act == "wait":
        secs = float(action.get("seconds", 2))
        _sleep(secs)
        return f"waited {secs}s"

    elif act == "screenshot":
        # Explicit screenshot action — agent wants to observe current state
        label = action.get("label", "observe")
        screenshot_b64(label)
        return f"screenshot taken ({label})"

    elif act == "done":
        return "DONE"

    elif act == "fail":
        return "FAIL: " + action.get("reason", "unknown")

    else:
        return f"unknown action: {act}"


# ---------------------------------------------------------------------------
# LLM CUA loop
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an Android phone automation agent. You control the device by issuing actions.

On each turn you receive a screenshot of the current Android screen.
Respond with a JSON object for ONE action to take next.

Available actions:
  {"type": "tap", "x": <int>, "y": <int>}
  {"type": "type", "text": "<string>"}
  {"type": "key", "key": "enter|back|home|delete|tab"}
  {"type": "swipe", "x1": <int>, "y1": <int>, "x2": <int>, "y2": <int>, "duration": <ms>}
  {"type": "send"}  -- tap the send/submit button (auto-locates via UI hierarchy)
  {"type": "wait", "seconds": <float>}
  {"type": "screenshot", "label": "<tag>"}  -- observe current state without acting
  {"type": "done", "summary": "<what was accomplished>"}
  {"type": "fail", "reason": "<why the goal cannot be achieved>"}

Rules:
- Issue exactly ONE action per turn as a JSON object. No markdown, no explanation outside JSON.
- Coordinates are in pixels relative to the screenshot dimensions.
- IMPORTANT: In this app, pressing "enter" inserts a newline — it does NOT send the message.
  To send a message use {"type": "send"} which auto-locates and taps the send/arrow button.
  IMPORTANT: ADB's "input text" command does NOT show the on-screen keyboard.
  Do NOT press "back" after typing — it will navigate away from the session instead of dismissing the keyboard.
  Just type your message, then use {"type": "send"} directly.
- Be efficient: skip unnecessary waits, tap directly on visible targets.
- When the goal is fully achieved respond with {"type": "done", "summary": "..."}.
- If genuinely stuck after 5+ attempts on the same element respond with {"type": "fail", ...}.
"""


def call_llm(client, model: str, system: str, history: list) -> str:
    """Call LLM via OpenAI-compatible API with retry on rate limit."""
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system}] + history,
                max_completion_tokens=300,
                temperature=0,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                wait = 15 * (attempt + 1)
                print(f"  [rate limited, retrying in {wait}s...]")
                time.sleep(wait)
                continue
            raise


def make_client(model: str):
    """Create OpenAI client. Supports AZURE_OPENAI_*, AZURE_DEV_AI_*, OPENAI_API_KEY, GEMINI_API_KEY, XAI_API_KEY."""
    if os.environ.get("AZURE_OPENAI_API_KEY"):
        azure_model = os.environ.get("AZURE_OPENAI_MODEL", "gpt-5.4")
        return AzureOpenAI(
            api_key=os.environ["AZURE_OPENAI_API_KEY"],
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
        ), azure_model
    if os.environ.get("AZURE_DEV_AI_API_KEY"):
        base_url = os.environ.get("AZURE_DEV_AI_BASE_URL", "https://vibe-dev-ai.cognitiveservices.azure.com/openai/v1")
        azure_model = os.environ.get("AZURE_DEV_AI_MODEL", "gpt-4o-2024-11-20")
        return OpenAI(api_key=os.environ["AZURE_DEV_AI_API_KEY"], base_url=base_url), azure_model
    if os.environ.get("OPENAI_API_KEY"):
        base = os.environ.get("OPENAI_BASE_URL")
        return OpenAI(base_url=base) if base else OpenAI(), model
    if os.environ.get("XAI_API_KEY"):
        return OpenAI(
            api_key=os.environ["XAI_API_KEY"],
            base_url="https://api.x.ai/v1",
        ), "grok-2-vision-1212"
    if os.environ.get("GEMINI_API_KEY"):
        return OpenAI(
            api_key=os.environ["GEMINI_API_KEY"],
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        ), "gemini-2.0-flash"
    sys.exit("Set AZURE_OPENAI_API_KEY, AZURE_DEV_AI_API_KEY, OPENAI_API_KEY, XAI_API_KEY, or GEMINI_API_KEY")


@lru_cache(maxsize=1)
def get_screen_size() -> tuple[int, int]:
    """Return (width, height) of the connected device screen. Cached."""
    try:
        out = adb("shell", "wm", "size")
        for line in out.splitlines():
            if "size:" in line.lower():
                dims = line.split(":")[-1].strip()
                w, h = dims.split("x")
                return int(w), int(h)
    except Exception:
        pass
    return 1080, 1920


def run_cua_step(goal: str, max_steps: int = 30, model: str = "gpt-4o",
                 include_ui_xml: bool = False, verbose: bool = True,
                 step_label: str = "", action_delay: float = 0.8) -> dict:
    """Run the CUA loop for a single goal until done/fail/max_steps.

    Args:
        goal: Natural-language instruction for this step.
        max_steps: Hard cap on LLM turns.
        model: Vision model deployment name.
        include_ui_xml: Append UI hierarchy XML to each prompt turn.
        verbose: Print action log.
        step_label: Short name shown in logs/screenshot filenames.
        action_delay: Seconds to pause after each action (scaled by speed_multiplier).
    """
    client, model = make_client(model)
    history = []
    screen_w, screen_h = get_screen_size()
    label_prefix = f"[{step_label}] " if step_label else ""

    for step in range(1, max_steps + 1):
        img_b64 = screenshot_b64(label=f"{step_label}_{step:02d}" if step_label else f"{step:03d}")

        content: list = [
            {
                "type": "text",
                "text": (
                    f"{label_prefix}Step {step}/{max_steps}. "
                    f"Screen: {screen_w}x{screen_h}px. "
                    f"Goal: {goal}\n"
                    "What action should I take next?"
                ),
            },
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}", "detail": "high"}},
        ]

        if include_ui_xml:
            xml = ui_dump()
            if xml:
                content.append({"type": "text", "text": f"UI hierarchy (truncated to 4000 chars):\n{xml[:4000]}"})

        history.append({"role": "user", "content": content})

        reply = call_llm(client, model, SYSTEM_PROMPT, history)
        history.append({"role": "assistant", "content": reply})

        # Parse action — tolerate markdown fences and multi-object responses
        try:
            clean = reply.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            m = re.search(r'\{[^{}]*\}', clean)
            action = json.loads(m.group(0)) if m else json.loads(clean)
        except json.JSONDecodeError:
            if verbose:
                print(f"  {label_prefix}[step {step}] Failed to parse: {reply[:120]}")
            continue

        result = execute_action(action)
        if verbose:
            print(f"  {label_prefix}[step {step}] {action.get('type', '?')} -> {result}")

        if result == "DONE":
            return {"status": "success", "steps": step, "summary": action.get("summary", "")}
        if result.startswith("FAIL"):
            return {"status": "fail", "steps": step, "reason": action.get("reason", "")}

        # Trim history to keep context manageable
        if len(history) > 14:
            history = history[-14:]

        _sleep(action_delay)

    return {"status": "timeout", "steps": max_steps}


# ---------------------------------------------------------------------------
# Onboarding showcase — structured multi-phase flow
# ---------------------------------------------------------------------------

# Banner printed before each named phase so the video is narrated by log output
PHASE_BANNERS = {
    "connect":      "STEP 1-2: Opening app — configuring server connection",
    "session_list": "STEP 3:   Connected — viewing session list",
    "new_session":  "STEP 4:   Creating a new AI coding session",
    "typescript":   "STEP 5-6: Submitting TypeScript task — watching opencode work",
    "verify":       "STEP 7:   Verifying task output / success response",
    "settings":     "STEP 8-9: Navigating to Settings — showing model selection",
}


def _banner(key: str) -> None:
    line = "=" * 64
    msg = PHASE_BANNERS.get(key, key)
    print(f"\n{line}")
    print(f"  {msg}")
    print(f"{line}\n")


def run_onboarding_showcase(
    opencode_url: str = DEFAULT_OPENCODE_URL,
    model: str = "gpt-5.4",
    include_ui_xml: bool = False,
    verbose: bool = True,
    max_steps_per_phase: int = 20,
) -> dict:
    """Execute the full first-run onboarding journey.

    Each phase is a focused CUA sub-goal. Phases are run sequentially.
    Returns a summary dict with per-phase results.
    """

    results: dict[str, dict] = {}

    def _run(key: str, goal: str, max_steps: int | None = None) -> bool:
        """Run one phase. Returns True if succeeded."""
        _banner(key)
        steps = max_steps or max_steps_per_phase
        r = run_cua_step(
            goal=goal,
            max_steps=steps,
            model=model,
            include_ui_xml=include_ui_xml,
            verbose=verbose,
            step_label=key,
            action_delay=0.7,
        )
        results[key] = r
        ok = r["status"] == "success"
        icon = "OK" if ok else "FAIL"
        print(f"\n  [{icon}] Phase '{key}': {r['status']} in {r['steps']} steps")
        if r.get("summary"):
            print(f"         {r['summary']}")
        if r.get("reason"):
            print(f"         reason: {r['reason']}")
        return ok

    # -----------------------------------------------------------------------
    # Phase 1-2: Open app, configure server connection
    # -----------------------------------------------------------------------
    ok = _run(
        "connect",
        goal=(
            f"You are on the OpenCode mobile app. "
            "The screen shows either a connection screen (first launch) or an empty connections list. "
            "Your goal: add a new connection to the opencode server. "
            "Look for an 'Add Connection', '+', or 'New Connection' button and tap it. "
            f"In the URL / Host field type '{opencode_url}'. "
            "Leave username and password blank. "
            "Tap 'Save', 'Connect', or 'Done' to save the connection. "
            "Report done when you can see the connection has been saved or the app navigated away from the add-connection form."
        ),
        max_steps=max_steps_per_phase,
    )
    if not ok:
        return {"status": "fail", "phase": "connect", "results": results}

    _sleep(2.0)

    # -----------------------------------------------------------------------
    # Phase 3: Connect to server — view session list
    # -----------------------------------------------------------------------
    ok = _run(
        "session_list",
        goal=(
            "The connection has been saved. "
            "Now tap on the saved connection entry to connect to the server. "
            "Wait up to 10 seconds for the session list screen to appear. "
            "The session list may be empty (no sessions yet) — that is fine. "
            "Report done when you can see the session list screen (even if empty)."
        ),
        max_steps=15,
    )
    if not ok:
        return {"status": "fail", "phase": "session_list", "results": results}

    _sleep(1.5)

    # -----------------------------------------------------------------------
    # Phase 4: Create new session
    # -----------------------------------------------------------------------
    ok = _run(
        "new_session",
        goal=(
            "You are on the sessions list screen. "
            "Tap the '+' button (usually top-right) to create a new AI coding session. "
            "Wait up to 5 seconds for the new session / chat screen to open. "
            "Report done once you see a text input field at the bottom of the screen "
            "(the session chat/input view is open)."
        ),
        max_steps=12,
    )
    if not ok:
        return {"status": "fail", "phase": "new_session", "results": results}

    _sleep(1.0)

    # -----------------------------------------------------------------------
    # Phase 5-6: Type TypeScript task and wait for opencode to complete
    # -----------------------------------------------------------------------
    ok = _run(
        "typescript",
        goal=(
            f"You are inside a new OpenCode session (chat view with a text input at the bottom). "
            f"Tap the text input field. "
            f"Type this exact message: {TYPESCRIPT_TASK!r} "
            "Do NOT press back (it navigates away). "
            "Use the send action to submit. "
            "After sending, wait and watch — opencode will show tool calls and file writes as it works. "
            "Wait up to 90 seconds total for the session to go idle/complete "
            "(no new activity for at least 5 seconds, or a completion indicator appears). "
            "Re-check every 15 seconds by looking at the screen. "
            "Report done when opencode appears to have finished (idle, no spinners, last message is a summary or file was created)."
        ),
        max_steps=25,
    )
    if not ok:
        return {"status": "fail", "phase": "typescript", "results": results}

    _sleep(2.0)

    # -----------------------------------------------------------------------
    # Phase 7: Verify output / success
    # -----------------------------------------------------------------------
    ok = _run(
        "verify",
        goal=(
            "The opencode session has finished. "
            "Look at the chat to confirm the TypeScript hello world task succeeded. "
            "You should see: a mention of 'hello.ts', 'Hello, World!', a file creation tool call, "
            "or a success summary from the assistant. "
            "Take a clear screenshot showing the result. "
            "Report done with a brief summary of what you see as evidence of success. "
            "Report fail only if the screen clearly shows an error with no recovery."
        ),
        max_steps=8,
    )
    # Verify phase is informational — continue even on uncertain result
    _sleep(1.5)

    # -----------------------------------------------------------------------
    # Phase 8-9: Navigate to Settings, show model selection
    # -----------------------------------------------------------------------
    _run(
        "settings",
        goal=(
            "Navigate to the Settings screen of the OpenCode mobile app. "
            "Look for a gear icon, 'Settings' tab in the bottom navigation bar, "
            "or a hamburger menu that contains Settings. Tap it. "
            "Once on the Settings screen, look for a 'Model' or 'AI Model' option and tap it "
            "to show the model selection list. "
            "Take a screenshot showing the model list or model setting. "
            "You do NOT need to change the model — just show it is accessible. "
            "Report done when the settings/model screen is visible in a screenshot."
        ),
        max_steps=15,
    )

    # Overall status: success if connect + session + typescript all succeeded
    critical = ["connect", "session_list", "new_session", "typescript"]
    failed_critical = [k for k in critical if results.get(k, {}).get("status") != "success"]
    overall = "success" if not failed_critical else "partial"
    return {"status": overall, "phase_results": results}


# ---------------------------------------------------------------------------
# Legacy smoke scenarios (kept for backwards compat / --scenario flag)
# ---------------------------------------------------------------------------

SMOKE_SCENARIOS = [
    {
        "name": "coding_task",
        "goal": (
            "You see the OpenCode mobile app. Tap the '+' button (top-right) to create a new session. "
            "Tap the text input at the bottom. "
             f"Type this exact task: {PYTHON_CODING_TASK!r} "
            "Do NOT press back (it navigates away). "
            "Use the send action to submit the task. "
            "After sending, wait and watch — opencode will think and then produce code. "
            "Wait up to 120 seconds total for the session to complete "
            "(look for file creation messages, a summary from assistant, or 'idle' status). "
            "Re-check every 15 seconds by looking at the screen. "
            "Take a screenshot showing the final result (the completed code or success summary). "
            "Report success if you see evidence of both helloworld.py and helloworld_test.py being created. "
            "Report failure only if the screen clearly shows an error with no recovery."
        ),
    },
    {
        "name": "verify_session_list",
        "goal": (
            "You see the OpenCode mobile app. Tap the '+' button (top-right) to create a new session. "
            "Wait 2 seconds for the session to be created. "
            "Navigate back to the sessions list by tapping the 'Sessions' tab or pressing back. "
            "Wait 3 seconds for the session list to load. "
            "Report success if you can see at least one session entry in the list. "
            "Report failure if the sessions list appears empty or shows an error message."
        ),
    },
]


def _connect_and_verify_sessions_goal(url: str) -> str:
    return (
        f"You see the OpenCode mobile app. "
        "Go to the Connections tab (bottom navigation bar). "
        "If a connection to the server already exists, tap it to make it active and skip to the next step. "
        "Otherwise tap '+' or 'Add Connection', "
        f"enter the URL '{url}', leave username/password blank, tap Save or Connect. "
        "Wait 3 seconds. "
        "Now navigate to the Sessions tab (bottom navigation bar). "
        "Wait 5 seconds for sessions to load. "
        "If the sessions list is empty or shows 'No sessions yet', tap the '+' button "
        "(top-right) to create a new session, wait 3 seconds, then navigate back to the "
        "Sessions tab and wait 3 seconds for the list to refresh. "
        "Report SUCCESS if you see at least one session listed (a session title is visible). "
        "Report FAILURE if the sessions list is still empty, shows 'No sessions yet', or shows an error."
    )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="OpenCode Mobile Android CUA smoke test — full onboarding showcase",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full onboarding showcase (default, recommended for demo video):
  source ~/.env.d/azure-openai.env
  python scripts/android-cua-smoke.py --model gpt-5.4 --include-xml

  # Speed up for a faster demo (0.5 = half the wait times):
  python scripts/android-cua-smoke.py --speed-multiplier 0.5

  # Legacy single-goal mode:
  python scripts/android-cua-smoke.py --goal "Open settings"

  # Legacy named scenario:
  python scripts/android-cua-smoke.py --scenarios send_message,verify_session_list
""",
    )

    # Showcase mode (new default)
    parser.add_argument(
        "--showcase",
        action="store_true",
        default=True,
        help="Run the full onboarding showcase (default). Demonstrates connect → session → TypeScript task → settings.",
    )
    parser.add_argument(
        "--opencode-url",
        default=None,
        help=f"OpenCode server URL (default: {DEFAULT_OPENCODE_URL}).",
    )

    # Speed control
    parser.add_argument(
        "--speed-multiplier",
        type=float,
        default=1.0,
        metavar="FACTOR",
        help="Scale all wait/sleep durations. 0.5 = twice as fast, 2.0 = twice as slow. Default: 1.0",
    )

    # Model / verbosity
    parser.add_argument("--model", default="gpt-4o", help="Vision model deployment name.")
    parser.add_argument("--max-steps", type=int, default=20, help="Max LLM steps per phase (showcase) or total (legacy).")
    parser.add_argument("--include-xml", action="store_true", help="Include UI hierarchy XML in LLM context (more accurate, more tokens).")
    parser.add_argument("--quiet", action="store_true")

    # Legacy / compat flags
    parser.add_argument("--goal", help="Legacy: single custom goal (disables showcase).")
    parser.add_argument(
        "--scenarios",
        help="Legacy: comma-separated scenario names to run (disables showcase). "
             "Valid: connect_and_verify_sessions, send_message, multi_turn, verify_session_list.",
    )
    parser.add_argument(
        "--skip-connect-scenario", action="store_true",
        help="Legacy: skip the connect-and-verify regression scenario.",
    )
    parser.add_argument(
        "--only-connect-scenario", action="store_true",
        help="Legacy: run ONLY the connect-and-verify-sessions scenario.",
    )

    args = parser.parse_args()

    # Apply speed multiplier globally
    global _speed_multiplier
    _speed_multiplier = args.speed_multiplier
    if args.speed_multiplier != 1.0:
        print(f"[speed] multiplier={args.speed_multiplier} — all waits scaled accordingly")

    # Verify ADB
    try:
        devices = adb("devices")
        if "device" not in devices.split("\n", 1)[-1]:
            sys.exit("No ADB device connected. Start emulator first.")
    except FileNotFoundError:
        sys.exit("adb not found in PATH")

    connect_url = args.opencode_url or os.environ.get("OPENCODE_URL") or DEFAULT_OPENCODE_URL

    # -----------------------------------------------------------------------
    # Determine run mode: showcase vs. legacy scenarios
    # -----------------------------------------------------------------------
    use_legacy = bool(args.goal or args.scenarios or args.only_connect_scenario)

    if not use_legacy:
        # ----------------------------------------------------------------
        # NEW DEFAULT: Full onboarding showcase
        # ----------------------------------------------------------------
        print("\n" + "=" * 64)
        print("  OpenCode Mobile — Full Onboarding Showcase")
        print(f"  Server: {connect_url}")
        print(f"  Model:  {args.model}")
        print(f"  Speed:  {_speed_multiplier}x")
        print("=" * 64)

        rec_thread, _stop_ev, remote_path = start_screen_recording("onboarding_showcase")
        local_video = "/tmp/cua_onboarding_showcase.mp4"

        try:
            if not ensure_app_foreground(verbose=not args.quiet):
                print("[prep] warning: could not confirm app in foreground")
            maybe_dismiss_telemetry_consent(verbose=not args.quiet)
            ensure_app_foreground(verbose=not args.quiet)

            result = run_onboarding_showcase(
                opencode_url=connect_url,
                model=args.model,
                include_ui_xml=args.include_xml,
                verbose=not args.quiet,
                max_steps_per_phase=args.max_steps,
            )
        finally:
            stop_screen_recording(rec_thread, remote_path, local_video)
            upload_to_archivebox(local_video, "onboarding_showcase")

        print("\n" + "=" * 64)
        print(f"  Showcase result: {result['status'].upper()}")
        if local_video and Path(local_video).exists():
            print(f"  Video: {local_video}")
        print("=" * 64)

        # Print per-phase summary table
        phase_results = result.get("phase_results", {})
        if phase_results:
            print("\n  Phase breakdown:")
            for phase, pr in phase_results.items():
                icon = "PASS" if pr["status"] == "success" else "FAIL"
                print(f"    [{icon}] {phase:20s}  {pr['status']:8s}  {pr['steps']} steps")

        sys.exit(0 if result["status"] == "success" else 1)

    # -----------------------------------------------------------------------
    # LEGACY MODE: named/custom scenarios
    # -----------------------------------------------------------------------
    connect_scenario = {
        "name": "connect_and_verify_sessions",
        "goal": _connect_and_verify_sessions_goal(connect_url),
    }

    if args.scenarios:
        catalog = {connect_scenario["name"]: connect_scenario}
        for s in SMOKE_SCENARIOS:
            catalog[s["name"]] = s
        requested = [n.strip() for n in args.scenarios.split(",") if n.strip()]
        unknown = [n for n in requested if n not in catalog]
        if unknown:
            sys.exit(f"Unknown scenario(s): {', '.join(unknown)}. Valid: {', '.join(catalog.keys())}")
        scenarios = [catalog[n] for n in requested]
    elif args.only_connect_scenario:
        scenarios = [connect_scenario]
    else:
        scenarios = [{"name": "custom", "goal": args.goal}] if args.goal else list(SMOKE_SCENARIOS)
        if not args.goal and not args.skip_connect_scenario:
            scenarios.append(connect_scenario)

    results = []
    for scenario in scenarios:
        if not args.quiet:
            print(f"\n{'='*60}")
            print(f"Scenario: {scenario['name']}")
            print(f"Goal: {scenario['goal'][:80]}...")
            print(f"{'='*60}")

        rec_thread, _stop_ev, remote_path = start_screen_recording(scenario["name"])
        local_video = f"/tmp/cua_{scenario['name']}.mp4"

        try:
            if not ensure_app_foreground(verbose=not args.quiet):
                print(f"  [prep] warning: could not confirm {APP_PACKAGE} in foreground")
            maybe_dismiss_telemetry_consent(verbose=not args.quiet)
            ensure_app_foreground(verbose=not args.quiet)

            result = run_cua_step(
                goal=scenario["goal"],
                max_steps=args.max_steps,
                model=args.model,
                include_ui_xml=args.include_xml,
                verbose=not args.quiet,
                step_label=scenario["name"],
            )
        finally:
            stop_screen_recording(rec_thread, remote_path, local_video)
            upload_to_archivebox(local_video, scenario["name"])

        result["scenario"] = scenario["name"]
        result["video"] = local_video if Path(local_video).exists() else None
        results.append(result)

        if not args.quiet:
            print(f"\nResult: {result['status']} in {result['steps']} steps")
            if result.get("video"):
                print(f"Video:  {result['video']}")
            if result.get("summary"):
                print(f"Summary: {result['summary']}")
            if result.get("reason"):
                print(f"Reason: {result['reason']}")

    failed = [r for r in results if r["status"] != "success"]
    if failed:
        print(f"\n{'!'*60}")
        print(f"FAILED: {len(failed)}/{len(results)} scenarios")
        sys.exit(1)
    else:
        print(f"\nAll {len(results)} scenarios passed.")


if __name__ == "__main__":
    main()
