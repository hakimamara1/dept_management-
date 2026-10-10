# Mobile companion app — LAN gateway

The Android app (`mobile/`, in progress) talks to the desktop over the shop Wi-Fi. The desktop remains the single
source of truth; the phone is a thin client over the same REST API the desktop UI uses.

## Architecture

```
Phone ──Wi-Fi──▶ mobile gateway  0.0.0.0:3001 (token-guarded) ─┐
                                                                ├▶ same Express app ▶ SQLite
Desktop UI ─────▶ loopback API   127.0.0.1:3000 (unchanged)  ──┘
```

The gateway (`src/services/mobileGatewayService.js`) is a **second listener** wrapping the existing app, so the
desktop's own API is untouched. It is **off by default**; the owner enables it in *Settings → الهاتف المحمول*.
If 3001 is busy it uses the next free port (shown in Settings and advertised over mDNS).

Request pipeline: private-network-only → `POST /api/mobile/pair` (public) → bearer-token guard →
`GET /api/mobile/handshake` → endpoint allow-list → OCR rate limit → idempotency → main app.

## Pairing and tokens

1. Settings → *إضافة هاتف* shows a QR containing a link `spiceerp://pair?d=<url-encoded JSON {app, v, name, port, hosts[], code}>` (the in-app scanner and the phone's own camera app both understand it). The code is 20 random characters,
   single-use, valid 5 minutes, burned after 5 wrong guesses; pairing attempts are rate-limited per IP.
2. The phone POSTs `{code, deviceName}` to `/api/mobile/pair` and receives a random 256-bit **token once**.
3. Only `SHA-256(token)` is stored (`mobile_devices`). *Settings → فصل* revokes a phone immediately.

## What a phone can reach

Allow-list (anything else → 403): `/api/invoices`, `/api/products`, `/api/suppliers`, `/api/customers`,
`/api/payments`, `/api/dashboard`, `/api/reports`, `/uploads` (all with a valid token).
**Never** reachable: `/api/settings` (restore/backup replace or export the whole database), `/api/accounting`,
`/api/mobile` admin routes (these also refuse any non-loopback caller on their own), and
`/api/products/merge` (an admin-style clean-up the phone never needs; matched case-insensitively because Express routes are).

## Idempotency (money safety)

Send `Idempotency-Key: <8–128 chars [A-Za-z0-9_-]>` on mutating requests. A retry with the same key replays the
first successful response (`Idempotent-Replay: true`) instead of executing twice; the same key on a different
method/path returns 422; an identical request still running returns 409. Keys are kept 24 h.

## Limits

- Phone works only while the desktop app is running and on the same network (v1 is online-only).
- Plain HTTP on the LAN: the token controls access but traffic is not encrypted.
- `POST /api/invoices/extract` (photo → AI) is limited to 10 per 10 minutes per phone.

## The phone app (`mobile/`)

React Native + Expo (SDK 57), Android only. Feature-based layout like the desktop: `src/modules/<feature>/{components,hooks,services}`,
shared UI/i18n/theme/API client in `src/shared/`. API types are imported **type-only** from
`desktop/src/shared/types/api.ts` (alias `@desktop-types/*`), so they cannot drift from the backend.
State: TanStack Query = server data, Zustand = connection/session + language, React state = forms.

### Pairing (user)
1. Desktop: *Settings → الهاتف المحمول → تفعيل*, then *إضافة هاتف* (QR).
2. Phone on the **same Wi-Fi**: open Spice ERP → it scans the QR (or tap the `spiceerp://` link).
3. If the desktop's IP changes later, the app finds it again over mDNS; if that fails use *Scan code again*.

### Build and run (developer)
```bash
cd mobile
npm install
export ANDROID_HOME=$HOME/Library/Android/sdk JAVA_HOME=$(/usr/libexec/java_home -v 17)
npx expo prebuild --platform android          # generates android/ (git-ignored)
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=x86_64   # emulator; use arm64-v8a for phones
adb install -r app/build/outputs/apk/debug/app-debug.apk
npx expo start --dev-client                    # JS comes from Metro in debug builds
```
mDNS discovery needs this development build (`react-native-zeroconf` is native) — it does not work in Expo Go.
Release APK for staff phones: `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` (sign with your own keystore).

`node mobile/scripts/contract-check.mjs <gateway-url> <pairing-code>` replays the phone's API calls (pair, read, draft invoice,
payments, retries) against a gateway — **only run it on a copy of the database**.

### Troubleshooting
- *Phone can't connect (Windows desktop):* Windows labels some Wi-Fi networks "Public" and blocks inbound traffic. Set the
  network to **Private**, or allow Spice ERP for Private networks when Windows asks. The installer adds the rules when it runs elevated.
- *Camera/QR won't scan:* tap the `spiceerp://…` link instead, or use the phone's own camera app.
- *"Desktop not reachable":* desktop app closed, different Wi-Fi, or mobile access disabled in Settings.
- *Phone shows "not paired":* the phone was removed in Settings → الهاتف المحمول; pair it again.
- Port 3001 busy? The gateway uses the next free port and shows it in Settings (and in the QR).

### Known limits (v1)
Online-only; HTTP on the LAN (token-protected, not encrypted); verdict sentences are Arabic-only (same as desktop);
over-payment on the supplier endpoint returns HTTP 500 with a clear message (existing desktop route behaviour).
