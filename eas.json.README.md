# eas.json — Post-Enrollment Fill-in Guide

Two placeholders in `eas.json` must be filled after Apple Developer Program enrollment is approved.
Do NOT fill them before enrollment — the values don't exist yet.

---

## Placeholder: `REPLACE_WITH_APP_STORE_CONNECT_APP_ID`

**What it is**: The numeric App ID assigned when you create the app record in App Store Connect.
Also called "Apple ID" of the app (not your Apple ID account — confusingly named).
Example value: `6478291034`

**Where to find it** (after enrollment + app creation):

1. Open https://appstoreconnect.apple.com/ and sign in with `support@vibebrowser.app`
2. Click **My Apps** in the top navigation
3. Click on **OpenCode** (the app you created)
4. In the left sidebar click **App Information** under the General section
5. Scroll down to the **General Information** section
6. Copy the value next to **Apple ID** — this is your `ascAppId`

**Replace in `eas.json`**:
```json
"ascAppId": "REPLACE_WITH_APP_STORE_CONNECT_APP_ID"
```
→
```json
"ascAppId": "6478291034"   // use your actual number
```

---

## Placeholder: `REPLACE_WITH_APPLE_TEAM_ID`

**What it is**: Your Apple Developer Team ID — a 10-character alphanumeric string.
Example value: `ABC1234DEF`

**Where to find it** (after enrollment):

1. Open https://developer.apple.com/account/ and sign in with `support@vibebrowser.app`
2. Click your name / account icon in the top right → **Membership details**
3. Your **Team ID** is listed under the team name

Alternatively, in App Store Connect:
1. Open https://appstoreconnect.apple.com/
2. Click your profile icon (top right) → **View Profile**
3. The Team ID is shown in the Developer Profile section

**Replace in `eas.json`**:
```json
"appleTeamId": "REPLACE_WITH_APPLE_TEAM_ID"
```
→
```json
"appleTeamId": "ABC1234DEF"   // use your actual Team ID
```

---

## Other fields already set

| Field | Value | Notes |
|---|---|---|
| `appleId` | `appstore@vibebrowser.app` | The Apple ID used for App Store Connect login — update if different |
| `distribution` (production ios) | `store` | Correct for App Store / TestFlight submissions |
| `buildType` (production android) | `app-bundle` | Correct for Play Store AAB submissions |
| `autoIncrement` | `false` | Build number is bumped by the CI workflow (github.run_number), not EAS |
| `cli.version` | `>= 13.0.0` | Requires EAS CLI 13 or later; CI installs `eas-cli@13` |

---

## After filling in the placeholders

1. Commit the updated `eas.json` to the repo.
2. Add the GitHub Actions secrets (see `.github/workflows/publish-app-store.yml` header for the exact list).
3. Tag a release: `git tag v0.2.3 && git push --tags`
4. The CI workflow will build the IPA via EAS and submit it to TestFlight automatically.

---

*This file is safe to commit. It contains no secrets — only navigation instructions.*
