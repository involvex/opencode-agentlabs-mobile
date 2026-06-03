#!/usr/bin/env bash
# readiness-check — verify OpenCode Mobile is PRODUCTION READY.
# Verdict is PRODUCTION READY only if every REQUIRED gate passes:
#   A app-health, B fdroid-selfhosted, C fdroid-mainline, D google-play, E web.
# Usage:
#   bash check.sh           full check
#   bash check.sh --quick   skip slow npm app-health gates
set -uo pipefail

APP_ID="cc.agentlabs.opencode"
SITE="https://dzianisv.github.io/opencode-mobile"
FDROID_INDEX="$SITE/fdroid/repo/index-v1.json"
RELEASES="https://github.com/dzianisv/opencode-mobile/releases/latest"
PLAY="https://play.google.com/store/apps/details?id=$APP_ID"
FDROID_MAINLINE="https://f-droid.org/packages/$APP_ID/"

CURL_OPTS=(--silent --show-error --location --max-time 20 --connect-timeout 8 --retry 1)

# Resolve repo root (script may be invoked from anywhere).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_DIR")"

QUICK=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
  esac
done

# ---- color (only if tty) ----
if [ -t 1 ]; then
  C_RST=$'\033[0m'; C_GRN=$'\033[32m'; C_RED=$'\033[31m'; C_YEL=$'\033[33m'; C_DIM=$'\033[2m'; C_BLD=$'\033[1m'
else
  C_RST=""; C_GRN=""; C_RED=""; C_YEL=""; C_DIM=""; C_BLD=""
fi

# ---- result accumulation ----
# Each gate appends "ID|STATUS|detail" ; REQUIRED gates listed in REQUIRED[].
declare -a RESULTS=()
declare -a REQUIRED=(A_typecheck A_test B_selfhosted B_release C_mainline D_play E_landing E_guide E_privacy E_sitemap E_robots E_og E_fdroidqr E_apkqr)

record() { # id status detail
  RESULTS+=("$1|$2|$3")
}

print_line() { # status gate detail
  local s="$1" gate="$2" detail="$3" tag color
  case "$s" in
    PASS)    tag="[PASS]";    color="$C_GRN" ;;
    FAIL)    tag="[FAIL]";    color="$C_RED" ;;
    WARN)    tag="[WARN]";    color="$C_YEL" ;;
    UNKNOWN) tag="[UNKNOWN]"; color="$C_YEL" ;;
    *)       tag="[????]";    color="$C_RST" ;;
  esac
  printf "  %s%-9s%s %-22s %s—%s %s\n" "$color" "$tag" "$C_RST" "$gate" "$C_DIM" "$C_RST" "$detail"
}

have() { command -v "$1" >/dev/null 2>&1; }

# HTTP status helper. Echoes the numeric code, or "000" on network failure.
http_code() {
  curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" "$1" 2>/dev/null || echo "000"
}

section() { printf "\n%s%s%s\n" "$C_BLD" "$1" "$C_RST"; }

echo "${C_BLD}OpenCode Mobile — Production Readiness Check${C_RST}"
echo "${C_DIM}app id: $APP_ID    mode: $([ $QUICK -eq 1 ] && echo quick || echo full)    $(date -u '+%Y-%m-%dT%H:%M:%SZ')${C_RST}"

# =====================================================================
# A. App health
# =====================================================================
section "A. App health (build + tests)"
if [ $QUICK -eq 1 ]; then
  record A_typecheck WARN "skipped (--quick)"
  record A_test      WARN "skipped (--quick)"
  print_line WARN "typecheck" "skipped (--quick)"
  print_line WARN "test"      "skipped (--quick)"
elif ! have npm; then
  record A_typecheck UNKNOWN "npm not installed"
  record A_test      UNKNOWN "npm not installed"
  print_line UNKNOWN "typecheck" "npm not installed"
  print_line UNKNOWN "test"      "npm not installed"
else
  # typecheck
  if npm --prefix "$REPO_ROOT" run typecheck >/tmp/rc_typecheck.log 2>&1; then
    record A_typecheck PASS "npm run typecheck clean"
    print_line PASS "typecheck" "npm run typecheck clean"
  else
    record A_typecheck FAIL "tsc errors (see /tmp/rc_typecheck.log)"
    print_line FAIL "typecheck" "tsc errors (see /tmp/rc_typecheck.log)"
  fi
  # test
  if npm --prefix "$REPO_ROOT" test >/tmp/rc_test.log 2>&1; then
    record A_test PASS "npm test green"
    print_line PASS "test" "npm test green"
  else
    record A_test FAIL "test failures (see /tmp/rc_test.log)"
    print_line FAIL "test" "test failures (see /tmp/rc_test.log)"
  fi
fi

# =====================================================================
# B. F-Droid — self-hosted repo LIVE  (REQUIRED)
# =====================================================================
section "B. F-Droid — self-hosted repo (REQUIRED)"
idx_body="$(curl "${CURL_OPTS[@]}" "$FDROID_INDEX" 2>/dev/null)"
idx_rc=$?
if [ $idx_rc -ne 0 ] || [ -z "$idx_body" ]; then
  record B_selfhosted UNKNOWN "could not fetch index-v1.json (network?)"
  print_line UNKNOWN "fdroid-selfhosted" "could not fetch index-v1.json (network?)"
else
  version=""
  if have python3; then
    version="$(printf '%s' "$idx_body" | python3 -c '
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    sys.exit(2)
pkg="'"$APP_ID"'"
pkgs=d.get("packages",{})
if pkg not in pkgs and pkg not in d.get("apps",{}) and not any(
    (a.get("packageName")==pkg) for a in (d.get("apps",[]) if isinstance(d.get("apps"),list) else [])):
    sys.exit(3)
vs=pkgs.get(pkg)
ver=""
if isinstance(vs,list) and vs:
    ver=vs[0].get("versionName","")
print(ver)
' 2>/dev/null)"
    py_rc=$?
  elif have jq; then
    if printf '%s' "$idx_body" | jq -e --arg p "$APP_ID" '.packages[$p] // empty' >/dev/null 2>&1; then
      version="$(printf '%s' "$idx_body" | jq -r --arg p "$APP_ID" '.packages[$p][0].versionName // ""' 2>/dev/null)"
      py_rc=0
    else
      py_rc=3
    fi
  else
    # no parser: substring fallback
    if printf '%s' "$idx_body" | grep -q "$APP_ID"; then py_rc=0; version="?"; else py_rc=3; fi
  fi

  if [ "${py_rc:-1}" -eq 0 ]; then
    record B_selfhosted PASS "serves $APP_ID${version:+ v$version}"
    print_line PASS "fdroid-selfhosted" "serves $APP_ID${version:+ v$version}"
  elif [ "${py_rc:-1}" -eq 2 ]; then
    record B_selfhosted FAIL "index-v1.json did not parse as JSON"
    print_line FAIL "fdroid-selfhosted" "index-v1.json did not parse as JSON"
  else
    record B_selfhosted FAIL "$APP_ID not present in self-hosted index"
    print_line FAIL "fdroid-selfhosted" "$APP_ID not present in self-hosted index"
  fi
fi

# direct APK / releases
rel_code="$(http_code "$RELEASES")"
if [ "$rel_code" = "000" ]; then
  record B_release UNKNOWN "releases/latest unreachable"
  print_line UNKNOWN "fdroid-apk-release" "releases/latest unreachable"
elif [ "$rel_code" -ge 200 ] && [ "$rel_code" -lt 400 ]; then
  record B_release PASS "releases/latest HTTP $rel_code"
  print_line PASS "fdroid-apk-release" "releases/latest HTTP $rel_code"
else
  record B_release FAIL "releases/latest HTTP $rel_code"
  print_line FAIL "fdroid-apk-release" "releases/latest HTTP $rel_code"
fi

# =====================================================================
# C. F-Droid — MAINLINE published  (REQUIRED, headline)
# =====================================================================
section "C. F-Droid — MAINLINE on f-droid.org (REQUIRED · headline)"
play_mainline_code="$(http_code "$FDROID_MAINLINE")"
if [ "$play_mainline_code" = "000" ]; then
  record C_mainline UNKNOWN "f-droid.org unreachable"
  print_line UNKNOWN "fdroid-mainline" "f-droid.org unreachable"
elif [ "$play_mainline_code" = "200" ]; then
  record C_mainline PASS "LIVE on f-droid.org (HTTP 200)"
  print_line PASS "fdroid-mainline" "LIVE on f-droid.org (HTTP 200)"
elif [ "$play_mainline_code" = "404" ]; then
  record C_mainline FAIL "not yet published on f-droid.org (HTTP 404 — MR not merged)"
  print_line FAIL "fdroid-mainline" "not yet published on f-droid.org (HTTP 404 — MR not merged)"
else
  record C_mainline FAIL "unexpected HTTP $play_mainline_code"
  print_line FAIL "fdroid-mainline" "unexpected HTTP $play_mainline_code"
fi

# =====================================================================
# D. Google Play — PUBLISHED  (REQUIRED, headline)
# =====================================================================
section "D. Google Play — PUBLISHED (REQUIRED · headline)"
play_code="$(http_code "$PLAY")"
if [ "$play_code" = "000" ]; then
  record D_play UNKNOWN "play.google.com unreachable"
  print_line UNKNOWN "google-play" "play.google.com unreachable"
elif [ "$play_code" = "200" ]; then
  record D_play PASS "PUBLISHED on Google Play (HTTP 200)"
  print_line PASS "google-play" "PUBLISHED on Google Play (HTTP 200)"
elif [ "$play_code" = "404" ]; then
  record D_play FAIL "not public — in review/draft (HTTP 404)"
  print_line FAIL "google-play" "not public — in review/draft (HTTP 404)"
else
  record D_play FAIL "unexpected HTTP $play_code"
  print_line FAIL "google-play" "unexpected HTTP $play_code"
fi

# =====================================================================
# E. Web presence  (REQUIRED)
# =====================================================================
section "E. Web presence (REQUIRED)"
check_url() { # id label url
  local id="$1" label="$2" url="$3" code
  code="$(http_code "$url")"
  if [ "$code" = "000" ]; then
    record "$id" UNKNOWN "$label unreachable"
    print_line UNKNOWN "$label" "unreachable ($url)"
  elif [ "$code" = "200" ]; then
    record "$id" PASS "$label HTTP 200"
    print_line PASS "$label" "HTTP 200"
  else
    record "$id" FAIL "$label HTTP $code"
    print_line FAIL "$label" "HTTP $code ($url)"
  fi
}
check_url E_landing  "landing"      "$SITE/"
check_url E_guide    "guide"        "$SITE/guide/"
check_url E_privacy  "privacy"      "$SITE/privacy/"
check_url E_sitemap  "sitemap.xml"  "$SITE/sitemap.xml"
check_url E_robots   "robots.txt"   "$SITE/robots.txt"
check_url E_og       "og.png"       "$SITE/og.png"
check_url E_fdroidqr "fdroid-qr.png" "$SITE/fdroid-qr.png"
check_url E_apkqr    "apk-qr.png"   "$SITE/apk-qr.png"

# =====================================================================
# F. Repo discoverability  (nice-to-have, WARN only)
# =====================================================================
section "F. Repo discoverability (nice-to-have)"
if ! have gh; then
  print_line WARN "gh-repo-meta" "gh not installed — skipped"
elif ! gh auth status >/dev/null 2>&1; then
  print_line WARN "gh-repo-meta" "gh unauthenticated — skipped"
else
  meta="$(gh repo view dzianisv/opencode-mobile --json repositoryTopics,homepageUrl 2>/dev/null)"
  if [ -z "$meta" ]; then
    print_line WARN "gh-repo-meta" "could not read repo metadata"
  else
    if have jq; then
      topics="$(printf '%s' "$meta" | jq -r '[.repositoryTopics[]?.name] | join(",")' 2>/dev/null)"
      home="$(printf '%s' "$meta" | jq -r '.homepageUrl // ""' 2>/dev/null)"
    elif have python3; then
      topics="$(printf '%s' "$meta" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(",".join(t.get("name","") for t in d.get("repositoryTopics") or []))' 2>/dev/null)"
      home="$(printf '%s' "$meta" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("homepageUrl") or "")' 2>/dev/null)"
    else
      topics="(install jq/python3 to parse)"; home=""
    fi
    if [ -n "$topics" ] || [ -n "$home" ]; then
      print_line PASS "gh-repo-meta" "topics=[${topics:-none}] homepage=${home:-none}"
    else
      print_line WARN "gh-repo-meta" "no topics/homepage set"
    fi
  fi
fi

# =====================================================================
# Summary / verdict
# =====================================================================
status_of() { # id -> echoes status, "MISSING" if not recorded
  local id="$1" r
  for r in "${RESULTS[@]}"; do
    case "$r" in "$id|"*) printf '%s' "${r#*|}" | cut -d'|' -f1; return;; esac
  done
  echo "MISSING"
}

declare -a FAILING=()
declare -a SKIPPED=()
for id in "${REQUIRED[@]}"; do
  st="$(status_of "$id")"
  if [ "$st" = "PASS" ]; then
    continue
  fi
  # In --quick mode the app-health gates are intentionally skipped (WARN);
  # don't list them as "failing", but they still block a PRODUCTION READY verdict.
  if [ $QUICK -eq 1 ] && [ "$st" = "WARN" ] && { [ "$id" = "A_typecheck" ] || [ "$id" = "A_test" ]; }; then
    SKIPPED+=("$id")
    continue
  fi
  FAILING+=("$id($st)")
done

section "Headline gates"
print_line "$(status_of D_play)"     "GOOGLE PLAY"      "$([ "$(status_of D_play)"     = PASS ] && echo PUBLISHED || echo 'NOT published')"
print_line "$(status_of C_mainline)" "F-DROID MAINLINE" "$([ "$(status_of C_mainline)" = PASS ] && echo PUBLISHED || echo 'NOT published')"

echo
echo "=============================================================="
if [ ${#FAILING[@]} -eq 0 ] && [ ${#SKIPPED[@]} -eq 0 ]; then
  echo "${C_GRN}${C_BLD}  PRODUCTION READY ✅${C_RST}"
  echo "${C_DIM}  All required gates passed — both stores live, app + site healthy.${C_RST}"
  echo "=============================================================="
  exit 0
elif [ ${#FAILING[@]} -eq 0 ] && [ ${#SKIPPED[@]} -gt 0 ]; then
  # All checked required gates passed, but --quick skipped app-health.
  echo "${C_YEL}${C_BLD}  LIVE GATES PASS — run full check to confirm PRODUCTION READY ⚠${C_RST}"
  echo "${C_DIM}  Skipped in --quick mode: ${SKIPPED[*]} (run without --quick).${C_RST}"
  echo "=============================================================="
  exit 1
else
  echo "${C_RED}${C_BLD}  NOT READY ❌${C_RST}"
  echo "  Failing required gates:"
  for f in "${FAILING[@]}"; do echo "    - $f"; done
  echo "=============================================================="
  exit 1
fi
