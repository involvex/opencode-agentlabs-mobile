# Apple App Store — opencode-mobile

Operational doc for shipping `ai.opencode.mobile` to Apple App Store under VIBE TECHNOLOGIES, LLC.

For full company facts (D-U-N-S, address, governor) see `~/.agents/skills/vibetechnologies-llc/SKILL.md`.

---

## Account state (as of 2026-05-24)

| Field | Value |
|---|---|
| Apple ID email | `support@vibebrowser.app` (per decision 2026-05-24) |
| Apple Developer Program | ❌ **not enrolled — user signing up now** |
| D-U-N-S (for org enrollment) | 142059652 |
| Enrollment fee | $99/year (not yet paid) |
| Identity verification call | ⏸ pending after enrollment submitted (Apple calls within 2-7 business days) |
| App Store Connect record | ⏸ created after enrollment |
| TestFlight | ⏸ available after enrollment |
| App Store production | ⏸ after TestFlight + Apple review |

### Bundle identity

| Field | Value |
|---|---|
| Bundle identifier | `ai.opencode.mobile` (same as Android — same brand) |
| Apple Team ID | ⏸ assigned at enrollment |
| App Store Connect App ID | ⏸ assigned on first app creation |

---

## Export Compliance

OpenCode Mobile uses only standard HTTPS/TLS provided by iOS networking APIs (via React Native's `fetch` and the underlying `URLSession`). It does NOT implement any custom cryptographic algorithms, key exchange protocols, or cipher suites.

**Answers to give in App Store Connect > App Information > Export Compliance:**

| Question | Answer |
|---|---|
| Does your app use encryption? | Yes (standard OS-provided HTTPS) |
| Does the app qualify for the HTTPS exemption? | Yes |
| Is the encryption exempt from EAR? | Yes — qualifies under ECCN 5D992 exemption (software using standard HTTPS, not modifying encryption) |

**In practice, App Store Connect asks:**
"Does your app use encryption other than what's provided by Apple's operating system?"
→ **Answer: No**

This falls under the exemption described at:
https://developer.apple.com/documentation/security/complying_with_encryption_export_regulations

Because the answer is "No", no ERN (Encryption Registration Number) is required and no export compliance documentation needs to be filed with the US Bureau of Industry and Security (BIS).

**`ITSAppUsesNonExemptEncryption: false` is already set in `app.json` `ios.infoPlist`** — this suppresses the App Store Connect encryption question on every subsequent build submission automatically. (Added 2026-05-24.)

---

## What's already done

1. ✅ iOS section of `app.json` patched:
   - `ios.buildNumber`: "1" (CI auto-bumps)
   - `ios.entitlements.aps-environment`: "production" (push notifications)
   - `ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads`: true (required — connects to user self-hosted opencode servers over HTTP on LAN)
   - Usage strings: NSFaceIDUsageDescription, NSSpeechRecognitionUsageDescription, NSMicrophoneUsageDescription, NSPhotoLibraryUsageDescription, NSCameraUsageDescription
   - Plugin registrations completed for `expo-notifications`, `expo-image-picker`, `expo-speech-recognition` (were missing — would have caused native iOS setup to silently skip)
2. ✅ EAS Build config: `eas.json` with development/preview/production profiles (2 placeholders for App ID + Team ID)
3. ✅ Build strategy chosen: **EAS Build** (Expo cloud, free tier 30 builds/mo, managed certs, EAS Submit handles TestFlight upload)
4. ✅ CI workflow draft: `.github/workflows/publish-app-store.yml` (DRAFT — needs Apple secrets before enabling)
5. ✅ Listing copy drafted: `distribution/app-store-listing.md`
6. ✅ Enrollment runbook: `distribution/ios-enrollment-runbook.md` (pre-filled with all VIBE TECHNOLOGIES, LLC fields)
7. ✅ Release notes scaffold: `distribution/whatsnew-ios/release-notes-en-US.txt`

---

## What's left to do — eligibility checklist

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Sign in / create Apple ID for `support@vibebrowser.app` w/ 2FA | User | 🔴 user action required |
| 2 | Enroll in Apple Developer Program ($99) | User | 🔴 user action required |
| 3 | Pass Apple verification call | User | 🔴 user action required |
| 4 | App icon — 1024×1024 PNG, opaque (no alpha) | ✅ Done | `assets/icon-appstore.png` (flattened from Android-produced `assets/icon.png`) |
| 5 | iPhone screenshots 6.7" (1290×2796) + 6.5" (1242×2688) | ✅ Done | `distribution/app-store-graphics/iphone-67/{01,02,03}.png` + `iphone-65/` — 3 mockup screens: connection, chat, diff |
| 6 | iPad screenshots 12.9" (2048×2732) | ✅ Done | `distribution/app-store-graphics/ipad-129/{01,02}.png` — 2 mockup screens |
| 7 | Privacy policy — live at https://opencode.vibebrowser.app/privacy | 🟡 partial | Content handled by Android agent (`distribution/privacy-policy.{md,html}`). iOS-specific ATT / nutrition label addendum written in `distribution/app-store-listing.md`. User must deploy to vibebrowser.app. |
| 8 | Privacy nutrition label (App Tracking + Data Collection) | ✅ Done | Updated in `distribution/app-store-listing.md` — ATT explicitly noted (not used), Sentry opt-in status documented |
| 9 | Export compliance | ✅ Done | `ITSAppUsesNonExemptEncryption: false` added to `app.json`. Answers + rationale in this doc (see Export Compliance section above) and `distribution/app-store-listing.md`. |
| 10 | ATS justification in App Review notes | ✅ Done | Full justification text in `distribution/app-store-listing.md` under "App Review Notes — ATS Justification" |
| 11 | Reviewer test instructions | ✅ Done | Updated with correct command (`opencode serve --hostname 0.0.0.0`) in `distribution/app-store-listing.md` |
| 12 | GitHub secrets: `EAS_TOKEN`, `APPLE_APP_STORE_CONNECT_API_KEY_ID`, `APPLE_APP_STORE_CONNECT_ISSUER_ID`, `APPLE_APP_STORE_CONNECT_API_KEY` (base64 .p8) | User | 🟡 post-enrollment — see `.github/workflows/publish-app-store.yml` header |
| 13 | Update `eas.json` placeholders: `ascAppId` + `appleTeamId` | User | 🟡 post-enrollment — see `eas.json.README.md` for click paths |
| 14 | CI workflow validated | ✅ Done | `.github/workflows/publish-app-store.yml` structure verified; comment header updated with remaining gaps |
| 15 | TestFlight release notes | ✅ Done | `distribution/whatsnew-ios/release-notes-en-US.txt` — polished, 1658 chars (limit 4000) |

---

## Publishing process (after enrollment + assets ready)

1. (manual) Sign in to App Store Connect, create app with bundle id `ai.opencode.mobile`.
2. (manual) Generate App Store Connect API key (App Manager role) → download `.p8` → base64 encode → add as GitHub secret.
3. (manual) Update `eas.json` placeholders (Team ID, ASC App ID).
4. (manual) `eas login` + `eas build:configure` for first-time setup (managed signing).
5. (automated) `git tag v0.2.x && git push --tags` → CI calls EAS Build → EAS Submit → IPA lands in TestFlight.
6. (manual, first time) Add internal testers in App Store Connect → distribute via TestFlight.
7. (manual) After internal testing OK → submit for App Store review (production).
8. Apple review typically 24-48h. 90% of submissions reviewed within 24h.

---

## Build strategy comparison (chose EAS Build)

| Factor | EAS Build ✅ | GitHub macOS runner | Mac self-hosted |
|---|---|---|---|
| macOS infra | none | none (GitHub-hosted) | macbook13-pro via Tailscale |
| Cert mgmt | automatic | manual | manual |
| Setup time | ~1h | ~4h | ~2h + manual cert work |
| Cost / build | $0 (free tier 30/mo) | ~$2 (~25min × $0.08/min) | $0 compute, uptime risk |
| First-build reliability | high (Expo SLA) | high | depends on Mac being on |

Upgrade to EAS $19/mo only if free-tier queue (10-30 min wait) becomes a problem.

---

## Timeline + cost (from research)

| Milestone | ETA from start | Cost |
|---|---|---|
| Apple enrollment approved | day 3-7 | $99 |
| First EAS build + TestFlight upload | day 8-10 | $0 |
| Internal TestFlight install | day 8-10 (no review) | $0 |
| App Store production submission | day 10-12 | $0 |
| Production live (after Apple review) | day 12-14 (24-48h) | $0 |
| **Total to TestFlight** | **~1-2 weeks** | **$99** |
| **Total to production** | **~2 weeks** | **$99** |

---

## Files in repo

- `app.json` — iOS config (patched 2026-05-24)
- `eas.json` — EAS build profiles (2 placeholders)
- `.github/workflows/publish-app-store.yml` — DRAFT CI
- `distribution/app-store-listing.md` — listing copy + answers
- `distribution/ios-enrollment-runbook.md` — enrollment runbook
- `distribution/whatsnew-ios/release-notes-en-US.txt` — release notes
- `distribution/strategy.md` — broader strategy (cross-platform)

---

## Reference

- Apple Developer enroll: https://developer.apple.com/programs/enroll/
- D-U-N-S lookup: https://developer.apple.com/enroll/duns-lookup/
- Apple ID create: https://appleid.apple.com/account
- App Store Connect: https://appstoreconnect.apple.com/
- Review guidelines: https://developer.apple.com/app-store/review/guidelines/
- ATS docs: https://developer.apple.com/documentation/security/preventing_insecure_network_connections
- TestFlight: https://developer.apple.com/testflight/
- EAS Build docs: https://docs.expo.dev/build/introduction/
- EAS Submit docs: https://docs.expo.dev/submit/introduction/
