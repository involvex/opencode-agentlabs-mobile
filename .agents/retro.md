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

## Template for future entries

```
## YYYY-MM-DD: [task title] ([versions/PRs])

**Problem**: [1 sentence]

**Mistake(s)**: [what went wrong and why, 1-2 sentences each]

**Correct pattern**: [what to do next time, 1-2 sentences]

**Time cost**: [how much was wasted and what would have saved it]
```
