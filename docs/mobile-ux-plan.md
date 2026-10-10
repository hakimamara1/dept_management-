# Mobile app — UX redesign + new screens (implementation plan)

Branch: `feature/mobile-app` · Status: **plan, nothing built yet** · Scope: `mobile/` + small backend additions.

## 1. What you asked for → what we do

| # | Your request | Decision (confirmed with you) |
|---|---|---|
| 1 | Better UI / UX | Focus: **fewer taps / clearer navigation** and a **more polished look and feel** |
| 2 | Products screen: sell price, buy price, price history with diagrams | List + detail with a buy-vs-sell chart. Sell history = **real prices from sales invoices** |
| 3 | Products: manage | **View + create + edit** (name, unit, barcode, category, default sale price) |
| 4 | Expiry tracking screen | Pick product → batch no., dates, quantity. Also **create product on the spot**, **barcode scan**, **phone reminder** before expiry |
| 5 | Fix: scan invoice → can't continue on the phone | Reproduce on a device, fix, and make the review/approve step obvious (see §3) |
| 6 | Merge suppliers + customers | One **Parties** screen. **Payments only** — no sale invoices, no balance adjustments on the phone |
| 7 | Navigation | **5 tabs**: Home · Invoices · Parties · Products · Expiry. Settings = gear icon in the header |

## 2. What I found in the code (these shape the plan)

- **Review + approve already exists on the phone** (`mobile/src/app/(tabs)/invoices/[id].tsx`): supplier picker, line matching, Approve. The Approve button stays **disabled** until a supplier is chosen and every line is matched, and the reasons are only small yellow text. After a scan the supplier is always empty (the backend refuses to auto-pick one). This part is a *usability* gap.
- **You told me the phone never opens the review screen after a scan.** Reading the code, the success path looks correct (`router.replace('/invoices/<id>')`), and the server returns `{ invoiceId }`. The scan flow was **never run end-to-end on a real device** (camera + AI call), so this is the first thing to reproduce, not guess.
- **Buy price history exists**: `GET /api/products/:id/price-history` (points + min/max/avg/trend). **Product list** (`GET /api/products`) already returns last purchase price, average cost, default sale price and stock.
- **Sales lines are free text** — `sales_invoice_items` has only `product_name`, no link to `products` (a deliberate rule in the schema). So "real sold prices per product" can only be found by **matching the name** (product name + aliases, Arabic-normalized). It is an approximation and the chart will say so. I do **not** propose to add a product link to sales lines (it breaks that rule).
- **Expiry backend exists** (`/api/expiration-batches`: list, create, edit, status, expiring/expired reports) but the phone gateway's allow-list does **not** include it yet — one line to add.
- **Sale price edit** and **product create** endpoints exist already.
- Charts: we already have our own SVG charts; a multi-line dated chart is a small addition (no new library).

## 3. The scan → review fix (do first)

1. **Reproduce**: use the gallery path (`scan?uri=`) and the camera on the emulator/real phone against a **scratch database** with the desktop's AI key, one real invoice photo. Watch: request sent? response? navigation?
2. Likely suspects to check, in order: navigation done inside a per-call mutation callback (can be dropped if the screen re-renders/unmounts during the 1–2 minute wait) → move it to the hook level + an effect; multipart upload through the gateway (headers/size); a rate-limit / idempotency replay edge case; the app going to background while the AI is reading.
3. **Make it robust whatever the cause**: when the upload ends (success, timeout, or network drop) the app always refreshes the *pending invoices* list and, if an invoice was created, opens it. A timed-out scan can never "disappear" — it shows up in Invoices → Pending Review.
4. **Review screen UX** (so approving on the phone is easy):
   - a 3-step checklist at the top: **Supplier ✓ · Lines matched 3/5 · Ready**,
   - one-tap **"Use <supplier>"** chip when the AI-read supplier name matches a known supplier,
   - unmatched lines are highlighted and open the match sheet directly; "Match all suggestions" shortcut,
   - sticky bottom **Approve** bar with the total and the reason when disabled.

### Phase 0 result (done)

**Root cause found and fixed.** In Expo SDK 57 the global `fetch` rejects React Native's old `{ uri, name, type }` file part
("Unsupported FormDataPart implementation"), so the photo was **never sent**. The app then showed the generic, wrongly worded
"Desktop not reachable", and nothing was created on the desktop. Fix: the photo is attached as an `expo-file-system` `File`
(a standards Blob) in `mobile/src/modules/invoices/services/invoices.api.ts`.

Also changed in Phase 0:
- Navigation to the review screen moved from a per-call callback to an effect (cannot be dropped during the long AI wait).
- After a network error / timeout the scan error screen says the photo may have arrived and offers **Open pending invoices**.
- Error messages are translated (ar / fr / en) through one helper; the raw cause is kept in `ApiError.detail` and logged in dev.
- The camera-permission text on the scan screen no longer says "pairing code".
- `expo-file-system` is now declared in `mobile/package.json`.

**Verified on the Android emulator** (virtual camera → upload → AI step stubbed with a 25 s delay → review → choose supplier →
match both lines → approve): invoice became *Approved* and the supplier balance rose by the invoice total. Not covered: the real
AI call (stubbed, no paid call made), a real phone camera.

### Phases 1–3 result (done)

- **Phase 1 – shell and foundation:** bottom bar is now **Home · Invoices · Accounts** (Products and Expiry are added in
  phases 4–5, so no empty tabs ship). Settings moved to a gear in the header of every main tab, with a connection dot. New shared
  parts: `ScreenHeader`, `Skeleton`/`SkeletonRows` (replace spinners), `EmptyBlock` with icon + action, `Badge`/`IconBubble`,
  card elevation and radius/spacing tokens. Home is a launcher: Scan invoice · Pending invoices (count badge) · Record payment.
- **Phase 2 – Accounts:** suppliers and customers in **one** list (All / Suppliers / Customers, search, largest balance first,
  "we owe" vs "owes us" in words + colour). One detail screen per account with the balance, **one action (record payment)** and
  the ledger. Customer sale invoices, their editor and "adjust balance" are **removed from the phone** (backend untouched).
- **Phase 3 – review screen:** readiness checklist (Supplier · Lines n/m · Ready), one-tap **"Use <supplier>"** when the
  AI-read name matches a known supplier (Arabic-normalised; refuses when ambiguous), **Accept all suggestions** and
  **Create unmatched as new products** (confirmation), unmatched lines flagged with their suggestion, and a **sticky approve bar**
  with the total and the reason when disabled.
- Deferred to phase 6 (needs the dev-client rebuild that phase 5 triggers anyway): haptic feedback, dark-mode pass.

### Phase 4 result (done): Products

- **New tab Products** (bar is now Home · Invoices · Accounts · Products). List with search, sort by name / margin / stock,
  buy and sale price on every row, and an add button.
- **Detail:** last buy price, average cost, sale price, margin (formula shown), a **dated chart of buy price vs real sold
  price** (range 3 m / 6 m / 1 y / all, tap a point to read it; line style + marker shape + legend, so it does not depend on
  colour), cheapest supplier, and the last purchases / sales as tables.
- **Actions:** edit sale price (shows the resulting margin and warns when below cost), edit catalogue fields, create product
  (warns on a name that already exists). Every save carries an idempotency key.
- **Backend (read-only additions):** `GET /api/products/:id` and `GET /api/products/:id/sales-price-history` (sales lines are
  attributed to a product by normalized name or alias — approximate, Final invoices only; no schema change).
- **Gateway:** `/api/products/merge` is now denied for phones (case-insensitive, so `/MERGE` cannot slip through).
- `contract-check.mjs` covers all of the above (create replay, price update, histories, merge blocked).
- Deep links to a detail screen keep the list underneath (`initialRouteName: 'index'` on every tab stack).

### Phase 5 result (done): Expiry

- **New tab Expiry** (bar: Home · Invoices · Accounts · Products · Expiry). Count chips (All / Expired / ≤ 7 d / ≤ 30 d / Later /
  Closed), search by product, batch number or barcode, and urgency groups. Days are counted by **calendar date** on the phone
  (the server's value truncates a fractional day), with correct Arabic number forms (يومين / أيام / يوماً).
- **Add / edit batch:** product by search, **barcode scan** or **create on the spot**; batch number; expiry with the system
  calendar and quick picks (+1 m / +3 m / +6 m / +1 y); optional manufacturing date, quantity, location, notes. Validation mirrors
  the server (expiry after manufacturing).
- **Batch actions:** mark sold, discard, reopen, edit, delete (confirmation). Idempotency keys on every write.
- **Reminders (local notifications):** 09:00 at 30 / 7 / 1 days before expiry, one notification per day and offset listing how
  many batches (so a big catalogue produces a handful, not hundreds; capped at 48). Rebuilt from the latest data each time the
  list loads; permission is asked once, in context; on/off switch in Settings; tapping opens the Expiry tab.
  **Limit:** no server push exists on a LAN, so reminders reflect what the phone last loaded.
- **Home:** an "expiring soon" strip when something is expired or due within 7 days.
- **Backend (additive):** `GET /api/products?barcode=` (exact match); gateway allow-list now includes `/api/expiration-batches`.
- **Needed a dev-client rebuild** for `expo-notifications` and `@react-native-community/datetimepicker`.
- `contract-check.mjs` covers barcode lookup, batch create replay, validation, update, status transitions (date-derived states
  are not user-settable), delete.

### Phase 6 result (done): hardening and release

**Security pass (findings → fixes, all verified by `contract-check.mjs`, 61 checks):**
- The gateway allowed whole modules (e.g. all of `/api/products`, `/uploads`, supplier/customer create/delete, adjustments).
  It is now an **exact method + path table of what the app calls**; everything else is refused, case/trailing-slash variants included.
- Failed-token attempts are throttled per address; a phone that unpairs **revokes itself on the desktop** too.
- A pairing **link** could silently pair the phone with any server. It now asks for confirmation, and only private
  addresses (10.x / 172.16–31.x / 192.168.x / link-local / `*.local`) are accepted at all.
- `allowBackup` is off (the token was already excluded from backups).
- Pre-existing, **not changed**: the desktop's loopback API is unauthenticated with open CORS (flagged in `docs/mobile.md`).

**Release:** signed APK `mobile/dist/Spice-ERP-1.0.0.apk` (arm64-v8a + x86_64, ~90 MB, v1.0.0 / versionCode 1), release key in the
git-ignored `mobile/credentials/`; icon, adaptive icon, splash, notification icon; Gradle memory raised by a config plugin
(release builds ran out of Metaspace at the generated default). Smoke-tested on the emulator as a standalone release build:
pair-by-link with confirmation, live data, 10 expiry reminders scheduled, unpair → device gone on the desktop, update over the
installed app, refused link explained.

**Polish:** the debt-verdict sentences and all numbers/dates now follow ar / fr / en (Arabic output regression-checked as
identical; fr/en show "DA"); dark mode verified on Home, Expiry and the price chart; haptic success feedback; version in Settings.

**Not verified here (needs your hands):** a real phone (camera, barcode, mDNS across a real router, reminder delivery at 09:00),
and the Windows installer's firewall rule — see the checklist in `docs/mobile.md`.

## 4. New / changed screens

### Parties (replaces Suppliers + Customers tabs)
- One list with a segmented filter **All · Suppliers · Customers**, search, and a badge + balance colour per row.
- Detail: balance, ledger, **Record payment** (supplier payment / customer collection) — same two-step confirm + idempotency as today.
- Removed from the phone: customer sale-invoice drafts (new / edit / approve) and "adjust balance". Backend untouched; old drafts stay on the PC.

### Products (new tab)
- List: search, sort (name / margin / stock), row = name, **buy** (last), **sell** (default), margin %, stock.
- Detail: KPI tiles (last buy, average cost, sale price, margin), **dated line chart: buy price vs real sold price**, range filter (3 m / 6 m / 1 y / all), supplier breakdown, recent purchases and sales table.
- Actions: edit fields, **change sale price** (confirm sheet), create product (duplicate-name warning).
- Backend: **one new read endpoint** `GET /api/products/:id/sales-price-history` (name-matched, read-only).

### Expiry (new tab)
- Grouped by urgency: **Expired · ≤ 7 days · ≤ 30 days · Later**; counters on top; search/filter.
- Add batch: product search (or **scan barcode**, or **create product**), batch no., manufacturing + expiry date, quantity, location, notes.
- Batch actions: edit, **mark sold**, **mark discarded**, delete — reusing existing statuses.
- **Phone reminders** (local notifications): scheduled for 30 / 7 / 1 days before expiry and rebuilt each time the app syncs. Limit: works only with data the phone last loaded (no internet push in v1).

### Home / navigation / look and feel
- Home becomes the launcher: **quick actions** (Scan invoice · Record payment · Add expiry batch · Search product) + the existing debt verdict, plus an "expiring soon" strip.
- Header with gear (Settings) and connection dot on every tab; consistent back behaviour.
- Visual refresh: token pass (spacing scale, type scale, radii, elevation), icon set per tab and action, **skeleton loaders** instead of spinners, pull-to-refresh everywhere, haptic feedback on confirm, empty states with an action, **dark mode** verified on every screen, 48 dp touch targets.
- All new strings in **ar / fr / en**; RTL checked on every screen.

## 5. Phases (each ends with something you can see and test)

| Phase | Work | Done when |
|---|---|---|
| 0 | Reproduce + fix scan → review; robustness changes | A real photo scanned on the phone opens its review; a killed connection still lands in Pending Review |
| 1 | Navigation (5 tabs, gear header), design tokens, shared components (skeleton, empty state, segmented, chart) | All current screens show in the new shell with no regression |
| 2 | Parties merge; remove invoice/adjust flows from the phone | One screen lists both; payment recorded once for supplier and for customer |
| 3 | Review screen UX (checklist, supplier suggestion, sticky approve) | A scanned invoice is approved fully on the phone, balance + stock match the PC |
| 4 | Products: list, detail, charts, create/edit/sale price; sales-history endpoint | Prices and chart match the PC for 3 sample products |
| 5 | Expiry: allow-list, list, add/manage, barcode, create product, reminders (needs a **rebuilt dev client** for the notifications module) | A batch added on the phone shows on the PC and back; reminder fires on the emulator |
| 6 | Polish + QA: dark mode, three languages, contract-check additions, emulator walkthrough, real-phone test, release APK | Checklist in §7 is green |

## 6. Risks and things to confirm

1. **Sell-price history is name-matched** (§2). Products sold under a different spelling won't appear. Acceptable? The alternative is a schema change that the project's own rule forbids.
2. **Real-phone testing is required** for camera, barcode scan, auto-discovery and notifications — the emulator can't fully cover them.
3. **Removing sale invoices from the phone** is a feature removal. Existing drafts stay on the PC. (Easy to restore later; the backend is unchanged.)
4. **New native module** (notifications) → one dev-client rebuild; Expo Go cannot run the app anyway (mDNS module).
5. Editing prices / creating products from a phone is higher risk than reading: every write gets a confirm step + idempotency key, and a duplicate-name warning.

## 7. Verification

- Backend: `contract-check.mjs` extended (products list/history/sales-history, expiry CRUD via gateway, allow-list still blocks backup/restore).
- Emulator walkthrough of every screen in ar (RTL), fr, en, light and dark.
- Scan flow with one real invoice photo on a scratch DB; compare totals with the PC review page.
- Regression: desktop dashboard / suppliers / invoices / payments unchanged (loopback API untouched); `tsc --noEmit` for desktop and mobile.
