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

A phone may call **exactly the method + path combinations the app uses** — about 30 of them — and nothing else
(`PHONE_ROUTES` in `src/services/mobileGatewayService.js`). Matching is strict: case-sensitive, no trailing slash, numeric ids.

| Area | Allowed |
|---|---|
| Reports | `GET /api/reports/debt-analysis` |
| Suppliers | list, one, ledger; `POST …/payments` |
| Customers | list, one, statement; `POST …/payments` |
| Products | list (+`?barcode=`), search, one, buy & sold price history; create, edit, sale price |
| Purchase invoices | pending list, review, scan (`/extract`), edit line / notes / supplier, add line, approve, delete (Pending Review only — enforced by the backend) |
| Expiry | list, create, edit, set status, delete |
| Pairing | `POST /api/mobile/pair` (code), `GET …/handshake`, `POST …/unpair` (a phone revokes only itself) |

**Never** reachable: `/api/settings` (restore/backup replace or export the whole database), `/api/accounting`, `/api/mobile`
admin routes (also loopback-only on their own), `/uploads`, `/api/dashboard`, creating/editing/deleting suppliers or customers,
balance adjustments, customer sales invoices, product merge. A token that leaks — or malware on the phone — can only do
what the app can do. `mobile/scripts/contract-check.mjs` asserts the refusals as well as the successes.

Other protections: private-network source addresses only; one revocable 256-bit token per phone (only its SHA-256 is stored);
pairing codes are single-use, expire in 5 minutes and are burned after 5 wrong guesses; failed-token attempts are throttled per
address; OCR is rate-limited per phone (it costs money); money writes carry an idempotency key.

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
2. Phone on the **same Wi-Fi**: open Spice ERP → it scans the QR. (A `spiceerp://` link asks you to confirm first; only
   private addresses are accepted — a QR pointing at a public address is refused.)
3. If the desktop's IP changes later, the app finds it again over mDNS; if that fails use *Scan code again*.

### Build and run (developer)
```bash
cd mobile
npm install
export ANDROID_HOME=$HOME/Library/Android/sdk JAVA_HOME=$(/usr/libexec/java_home -v 17)
npx expo prebuild --platform android          # generates android/ (git-ignored); re-run after changing app.json/plugins
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=x86_64   # emulator dev client
adb install -r app/build/outputs/apk/debug/app-debug.apk
npx expo start --dev-client                    # JS comes from Metro in debug builds
```
The dev client contains the native modules Expo Go lacks (mDNS discovery, notifications). In **Expo Go** the app still runs, but
without auto-discovery and expiry reminders (both degrade gracefully).

### Release APK (staff phones)
One-time: a release keystore lives in `mobile/credentials/` (**git-ignored — back it up**: `spice-erp-release.jks` +
`signing.properties`; if it is lost, phones must uninstall before a differently-signed update can be installed).
`plugins/withReleaseSigning.js` wires it into every `prebuild`.

```bash
cd mobile && npx expo prebuild --platform android --clean --no-install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
# → android/app/build/outputs/apk/release/app-release.apk  (signed, runs on phones and emulators)
```
To ship an update: bump `expo.version` and `expo.android.versionCode` in `app.json`, rebuild, send the file.

**Installing on a phone:** copy the APK to the phone (USB, WhatsApp, Drive…), open it, and allow *Install unknown apps* for
that app when Android asks. Updates install over the existing app and keep the pairing (same signing key, same package).

`node mobile/scripts/contract-check.mjs <gateway-url> <pairing-code> [desktop-loopback-url]` replays the phone's calls (pair,
read, payments, retries, refusals, revoke) — **only run it on a copy of the database**.

### Real-phone checklist (what an emulator cannot prove)
1. Pair by QR from the desktop's pairing dialog; pair again by the `spiceerp://` link (confirmation appears).
2. Kill the desktop app → "desktop not reachable"; start it again → recovers without re-pairing (mDNS finds a changed IP).
3. Scan a real supplier invoice → review → pick supplier → match lines → approve; compare totals with the PC.
4. Expiry: scan a real product barcode (the product must have that barcode saved); add a batch due tomorrow and confirm the
   09:00 reminder; tap it → opens the Expiry tab.
5. Record a payment while switching Wi-Fi off/on mid-request → exactly one row afterwards.
6. Switch the app to French and English: layout flips, numbers show "DA", the verdict sentences follow.
7. Dark mode (phone setting) on Home, Products detail and Expiry.

### Troubleshooting
- *Phone can't connect (Windows desktop):* Windows labels some Wi-Fi networks "Public" and blocks inbound traffic. Set the
  network to **Private**, or allow Spice ERP for Private networks when Windows asks. The installer adds the rules when it runs elevated.
- *Camera/QR won't scan:* tap the `spiceerp://…` link instead, or use the phone's own camera app.
- *"Desktop not reachable":* desktop app closed, different Wi-Fi, or mobile access disabled in Settings.
- *Phone shows "not paired":* the phone was removed in Settings → الهاتف المحمول; pair it again.
- Port 3001 busy? The gateway uses the next free port and shows it in Settings (and in the QR).

### Known limits (v1)
- Online-only: no offline queue. The phone works while the desktop app is running on the same network.
- HTTP on the LAN: token-protected, not encrypted (an option for v2 is TLS with a pinned certificate).
- Reminders are local to the phone and reflect the data it last loaded — there is no push without an internet relay.
- Sold-price history is attributed to a product **by name** (sales lines are free text by design) — approximate.
- Over-payment on the supplier endpoint returns HTTP 500 with a clear message (existing desktop route behaviour); the app
  stops it earlier with its own check.
- Not verified on Windows hardware: the installer's firewall rule (macOS development machine). Use the troubleshooting steps if
  the phone cannot connect.
- The desktop's own loopback API (port 3000) is unauthenticated with open CORS — pre-existing, outside this feature, but worth
  restricting to the Electron app's origin in a future hardening pass.
