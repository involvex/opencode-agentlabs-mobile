# Retrospectives

Lessons from past tasks. Read before starting related work to avoid repeating mistakes.

---

## 2026-06-22: CUA send_message fix (v0.4.5 → v0.4.7)

**Problem**: CUA smoke test `send_message` scenario failed — app sent `claude-sonnet-4-6` to Azure, but only `gpt-5.4` was deployed on the CI resource.

**Mistake 1 — Wrong layer diagnosed first (PR #36)**: Initial fix assumed the app's model-selection *precedence* was wrong (preferring agent model over provider default). Reality: the provider registry default itself (`defaults["azure"] = "claude-sonnet-4-6"`) was the poison — it's a registry-wide default, NOT what's deployed on the user's resource. Fix was to stop auto-selecting entirely and let the server decide.

**Mistake 2 — Trusted registry defaults as truth**: The `/provider` API returns 107 models for Azure including `claude-sonnet-4-6` (registry knows it exists), and `defaults` says it's the "default". But "exists in registry" ≠ "deployed on this resource". Never auto-select from registry defaults for actual inference calls.

**Correct pattern**: When no user-explicit model choice exists, send `model: null` in the prompt request. The server's `opencode.json` `"model"` field is the only reliable source for what's actually deployed and reachable.

**Time cost**: ~2h across two PRs (#36 then #37) because the first fix was plausible but wrong — it passed unit tests but failed the real E2E. Always validate against the actual server logs showing which `modelID` is used at inference time.

---

## 2026-06-23: Sessions loading false-fixes + Cloudflare detour (#32, v0.4.6)

**Problem**: "Recent sessions not loading" bug (#32) was claimed fixed 3× by AI agents. Each time the CUA test "passed" because the test literally accepted an empty sessions list as success.

### Root causes

**Mistake 1 — Vacuous test goal (most critical)**: The `session_list` CUA phase goal said *"The session list may be empty — that is fine. Report done when you can see the session list screen (even if empty)."* An empty list IS the bug. Test and bug were definitionally equivalent — impossible to fail. Every subsequent agent inherited this test as "trusted infrastructure" without reading the pass condition.

**Correct pattern**: Before calling any bug "fixed," answer: *"If the bug were still present, would this test fail?"* If no → rewrite the test. Always pre-create server state via API, then assert that specific named data appears in the UI. Forbidden phrases in CUA goals: "empty is fine," "even if empty," "screen is visible."

---

**Mistake 2 — 2+ hours on Cloudflare (wrong zone ID, repeated DOM failures)**: Spent 2h+ trying wrong account/zone IDs. The correct `CLOUDFLARE_API_TOKEN` + zone ID were in `~/.config/codebox/env.sh` — never checked. Also: 20+ identical attempts to set a React controlled input via raw DOM (`nativeInputValueSetter`) despite the same uid-collision error each time. AGENTS.md "stop at 3×" was ignored.

**Correct credential search order** (stop at first hit):
1. `echo $VAR_NAME` (current env)
2. `~/.env.d/*.env`
3. **`~/.config/codebox/env.sh`** ← check this explicitly for CF/GCP/hosting
4. `find ~/workspace -name '.env' -maxdepth 4`
5. Bitwarden (`~/.bitwarden_credentials`)
6. `~/.config/*/`
7. Ask user

**Correct browser automation fallback**:
1. Uid from snapshot → 2. Coordinates → 3. Keyboard nav → 4. Opus subagent → BLOCKED
Never repeat the same uid target more than 3 times.

---

**Mistake 3 — `task_complete` as escape hatch**: Called `task_complete` twice with unverified work. User had to re-prompt both times. Used it to escape stalled loops rather than emit a clean BLOCKED.

**Correct gate for `task_complete`**:
- Real-channel test ran this turn or last (not just unit tests)
- "Test would fail on broken code because [reason]" — explicitly stated
- CI green on release tag
- No open "verify later" items

---

**Mistake 4 — Overhead before understanding**: Created GitHub issue and task tracking files before understanding the root cause. Issue filing is not progress.

**Correct pattern**: Reproduce first (5 min). Document after confirmed.

---

**Mistake 5 — sessions_reload placed after typescript phase**: The new regression guard was initially blocked behind the model-dependent `typescript` phase. When model was unavailable in CI, `sessions_reload` never ran.

**Correct pattern**: Regression guards must run before any phase that can fail due to external dependencies (model availability, network, etc.).

---

**Time cost**: ~6h total. ~2h from vacuous test discovery/fix, ~3h from Cloudflare detour, ~1h from task_complete false closures. `grep -r CLOUDFLARE ~/.config` (30s) at the start would have saved the 2h detour. Reading the CUA test goal (2 min) at the start would have saved the 2h sessions bug investigation loop.

---

## Template for future entries

```
## YYYY-MM-DD: [task title] ([versions/PRs])

**Problem**: [1 sentence]

**Mistake(s)**: [what went wrong and why, 1-2 sentences each]

**Correct pattern**: [what to do next time, 1-2 sentences]

**Time cost**: [how much was wasted and what would have saved it]
```
