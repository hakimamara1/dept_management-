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

1. Settings → *إضافة هاتف* shows a QR: `{app, v, name, port, hosts[], code}`. The code is 20 random characters,
   single-use, valid 5 minutes, burned after 5 wrong guesses; pairing attempts are rate-limited per IP.
2. The phone POSTs `{code, deviceName}` to `/api/mobile/pair` and receives a random 256-bit **token once**.
3. Only `SHA-256(token)` is stored (`mobile_devices`). *Settings → فصل* revokes a phone immediately.

## What a phone can reach

Allow-list (anything else → 403): `/api/invoices`, `/api/products`, `/api/suppliers`, `/api/customers`,
`/api/payments`, `/api/dashboard`, `/api/reports`, `/uploads` (all with a valid token).
**Never** reachable: `/api/settings` (restore/backup replace or export the whole database), `/api/accounting`,
`/api/mobile` admin routes (these also refuse any non-loopback caller on their own).

## Idempotency (money safety)

Send `Idempotency-Key: <8–128 chars [A-Za-z0-9_-]>` on mutating requests. A retry with the same key replays the
first successful response (`Idempotent-Replay: true`) instead of executing twice; the same key on a different
method/path returns 422; an identical request still running returns 409. Keys are kept 24 h.

## Limits

- Phone works only while the desktop app is running and on the same network (v1 is online-only).
- Plain HTTP on the LAN: the token controls access but traffic is not encrypted.
- `POST /api/invoices/extract` (photo → AI) is limited to 10 per 10 minutes per phone.
