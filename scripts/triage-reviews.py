#!/usr/bin/env python3
"""
Play Store review triage script.

Fetches recent Play Store reviews via the Android Publisher API and creates
GitHub issues for low-rated or bug-report reviews so they enter the normal
fix cycle without manual monitoring.

Required env vars:
  GOOGLE_SERVICE_ACCOUNT_JSON  — full JSON key for the service account
  GH_TOKEN                     — GitHub token with issues:write scope
  PACKAGE_NAME                 — Android package (cc.agentlabs.opencode)
  DAYS_BACK                    — how many days back to look (default 7)
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta

import google.auth
from google.oauth2 import service_account
from googleapiclient.discovery import build

REPO = os.environ.get("GITHUB_REPOSITORY", "dzianisv/opencode-mobile")
PACKAGE_NAME = os.environ.get("PACKAGE_NAME", "cc.agentlabs.opencode")
DAYS_BACK = int(os.environ.get("DAYS_BACK", "7"))
GH_TOKEN = os.environ.get("GH_TOKEN", "")

SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]


def get_service():
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not raw:
        print("GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping.")
        sys.exit(0)
    info = json.loads(raw)
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("androidpublisher", "v3", credentials=creds, cache_discovery=False)


def fetch_reviews(service):
    cutoff = datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)
    results = []
    token = None
    while True:
        resp = service.reviews().list(
            packageName=PACKAGE_NAME,
            maxResults=100,
            **({"token": token} if token else {}),
        ).execute()
        for review in resp.get("reviews", []):
            comment = review.get("comments", [{}])[0].get("userComment", {})
            ts = int(comment.get("lastModified", {}).get("seconds", 0))
            if not ts:
                continue
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            if dt < cutoff:
                continue
            results.append({
                "review_id": review.get("reviewId", ""),
                "author": review.get("authorName", "anonymous"),
                "rating": comment.get("starRating", 0),
                "text": comment.get("text", ""),
                "date": dt.strftime("%Y-%m-%d"),
                "lang": comment.get("reviewerLanguage", "en"),
            })
        token = resp.get("tokenPagination", {}).get("nextPageToken")
        if not token:
            break
    return results


def issue_exists(title_prefix: str) -> bool:
    """Check if a GitHub issue with this title prefix already exists."""
    result = subprocess.run(
        [
            "gh", "issue", "list",
            "--repo", REPO,
            "--search", title_prefix,
            "--state", "open",
            "--json", "title",
        ],
        capture_output=True,
        text=True,
        env={**os.environ, "GH_TOKEN": GH_TOKEN},
    )
    if result.returncode != 0:
        return False
    issues = json.loads(result.stdout or "[]")
    return any(title_prefix.lower() in i["title"].lower() for i in issues)


def create_issue(review: dict):
    stars = "⭐" * review["rating"]
    title = f"[Play Store Review] {review['rating']}★ from {review['author']} on {review['date']}"
    body = f"""**Rating**: {stars} ({review['rating']}/5)
**Author**: {review['author']}
**Date**: {review['date']}
**Language**: {review['lang']}
**Review ID**: `{review['review_id']}`

---

> {review['text']}

---

*This issue was automatically created by the [monitor-reviews workflow](/.github/workflows/monitor-reviews.yml). 
Reply to the user in Play Console if applicable.*

**Labels**: `user-feedback`, `play-store-review`
"""
    subprocess.run(
        [
            "gh", "issue", "create",
            "--repo", REPO,
            "--title", title,
            "--body", body,
            "--label", "user-feedback",
        ],
        check=True,
        env={**os.environ, "GH_TOKEN": GH_TOKEN},
    )
    print(f"  ✅ Created issue: {title}")


def main():
    print(f"Fetching Play Store reviews for {PACKAGE_NAME} (last {DAYS_BACK} days)...")
    service = get_service()
    reviews = fetch_reviews(service)
    print(f"Found {len(reviews)} review(s) in window.")

    # Triage: create issues for 1-3 star reviews (potential bugs/problems)
    actionable = [r for r in reviews if r["rating"] <= 3]
    print(f"Actionable (≤3★): {len(actionable)}")

    for review in actionable:
        title_prefix = f"Play Store Review] {review['rating']}★ from {review['author']} on {review['date']}"
        if issue_exists(title_prefix):
            print(f"  ⏭ Already exists: {review['author']} {review['date']}")
            continue
        create_issue(review)
        time.sleep(1)  # avoid GitHub API rate limit

    # Summary
    avg = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0
    print(f"\nSummary: {len(reviews)} reviews, avg rating {avg:.1f}★, {len(actionable)} issues created/checked.")


if __name__ == "__main__":
    main()
