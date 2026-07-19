# Packaging (Windows/macOS installers)

## Why this exists

This app runs today as two processes: the Electron shell (`desktop/`) and a
separate Express + better-sqlite3 backend (repo root's `src/`), spawned as
a child process by Electron's main process (`desktop/electron/main/backend-process.ts`).
In dev, that child is launched with the system `node` binary against the
repo's own `src/app.js`, and its data (`invoices.db`, uploaded photos,
`.env`) lives right next to the source code. None of that works once the
app is installed on someone else's machine:

- They won't have Node.js installed — the backend can't depend on a system
  `node` binary being on `PATH`.
- `better-sqlite3` is a **native** module. Electron bundles its own Node/V8
  build with a different ABI than whatever Node the developer used to
  `npm install` — the compiled `.node` binary must be rebuilt specifically
  for Electron's ABI, or the packaged app crashes trying to load it.
- An installed app's own directory is read-only at runtime (macOS
  Gatekeeper enforces this even for unsigned apps; Windows convention does
  too) — the database/uploads/`.env` can't keep living next to the code.

## How it's solved

### 1. Centralized, relocatable data paths (`src/config/paths.js`)

Every place that used to compute its own `path.join(__dirname, '../data/...')`
(`config/database.js`, `app.js`, `routes/invoices.js`, `routes/settings.js`,
`services/invoiceProcessor.js`) now imports `DATA_DIR`/`UPLOADS_DIR`/
`DB_PATH`/`ENV_PATH` from this one module instead. It reads
`process.env.APP_DATA_DIR`:

- **Unset (dev, `npm run dev`)** → resolves to the exact same repo-relative
  paths as before (`src/data/...`, repo-root `.env`) — zero behavior change.
- **Set (packaged app)** → `backend-process.ts` sets it to
  `app.getPath('userData')` (e.g. `~/Library/Application Support/spice-erp-desktop`
  on macOS, `%APPDATA%/spice-erp-desktop` on Windows) before spawning the
  backend, so all writable data lives outside the read-only app bundle.

`src/app.js` also seeds a placeholder `.env` (just the commented
`REPLICATE_API_TOKEN=` template, no real token) into that location on
first run if one doesn't exist yet — so a fresh install has one
discoverable, editable file for the Replicate API key, without needing to
reach into the app bundle's internals. There is still no Settings-UI field
for this token — deliberately, see `business-rules.md`/ADR history.

### 2. Backend runs on Electron's own Node, not a system install

`backend-process.ts`: when `app.isPackaged`, the child process is launched
with `process.execPath` (Electron's own binary) and `ELECTRON_RUN_AS_NODE=1`
instead of a bare `'node'` command — no system Node.js install required on
the end user's machine. The entry path also switches from a path relative
to this repo's folder layout to `path.join(process.resourcesPath, 'backend/app.js')`.

### 3. The backend is bundled as `extraResources`

`desktop/package.json`'s electron-builder `build.extraResources` copies
the **root-level** `src/` (minus its own `data/` — a packaged app must
start with a fresh, empty database, never ship the developer's own dev
data), `node_modules`, and `package.json` into `resources/backend/` at
package time — matching the path `backendEntryPath()` expects.

### 4. Native rebuild — `better-sqlite3`

`desktop/scripts/rebuild-native.js` invokes `electron-rebuild` with the
**root** directory as its working directory (where `better-sqlite3`
actually lives, since the backend is a sibling of `desktop/`, not nested
inside it), reading the installed Electron version automatically instead
of hardcoding it. (`electron-rebuild`'s own `--module-dir` flag proved
unreliable at locating a node_modules outside the invoking package's own
directory in the installed version — this sidesteps that rather than
fighting it.) This recompiles the native addon against Electron's ABI **for
an explicit target platform/arch**, passed as CLI args (`darwin`/`win32`
+ arch) — see the incident below for why the target must always be
explicit. `npm run rebuild:native:mac` / `rebuild:native:win` wrap this
with the right target baked in; a bare `rebuild:native` falls back to the
host platform for ad hoc local use only.

Because this rebuilds the **shared** root `node_modules/better-sqlite3` in
place (the same folder the dev backend's system-Node process loads), every
`dist:mac`/`dist:win` run also runs `restore:native` (`npm rebuild
better-sqlite3` at the repo root) afterward, so `npm run dev` keeps working
without a manual fix-up step.

A same-named `desktop/scripts/verify-native-binary.js` runs right after
the rebuild and before `electron-builder` packages anything: it reads the
resulting `.node` file's magic bytes and asserts they match the target
platform (PE for `win32`, Mach-O for `darwin`), failing the build loudly
if not. This exists specifically to catch the incident below before it
can ship again, rather than relying on remembering to pass the right
flags every time.

#### Incident: Windows installer shipped a macOS binary

An earlier version of `rebuild-native.js` called `electron-rebuild` with
no `--platform`/`--arch` flags, so it silently rebuilt `better-sqlite3`
for the **host** platform (this dev machine → macOS) regardless of which
installer was being packaged. `electron-builder`'s own automatic native
dependency rebuild (visible in its build log as "installing native
dependencies") did **not** catch this: tracing `app-builder-lib`'s
`installOrRebuild`, its scope is `desktop/`'s own `package.json`
dependency tree (`appDir`/`projectDir`/`workspaceRoot`) — `better-sqlite3`
is a **root-level** dependency used by `src/`, not by `desktop/`, so
electron-builder never rebuilds it at all. `extraResources` then copied
that macOS-compiled `node_modules` verbatim into the Windows package.
Result: the installed Windows app crashed on launch with
`better_sqlite3.node is not a valid Win32 application` /
`ERR_DLOPEN_FAILED` — the backend never bound to port 3000, so the
renderer showed "Unable to reach server."

Fixed by making the rebuild target explicit per platform (`rebuild:native:mac`/
`rebuild:native:win`, above) and adding the `verify-native-binary.js` guard
so a future regression **fails the build loudly instead of shipping a
broken binary**. That guard immediately proved itself: once the rebuild
step was forced to genuinely target `win32`/`x64` from this macOS machine,
it failed outright rather than silently reusing the host binary —

```
prebuild-install warn install No prebuilt binaries found
  (target=<electron-version> runtime=electron arch=x64 libc= platform=win32)
node-gyp does not support cross-compiling native modules from source.
```

`better-sqlite3`'s install script is `prebuild-install || node-gyp
rebuild`, but that only helps if a prebuilt binary exists for this exact
Electron version/platform/arch combination on GitHub — for a
newly-released Electron version, it may not yet, and `node-gyp` flatly
refuses to compile a Windows binary from source on macOS (no cross
C/C++ toolchain, and it doesn't try to use `wine`). **So the earlier
"successful" `npm run dist:win` run never actually cross-built
anything — it silently kept the host macOS binary the whole time,
which was the original bug.** Genuine cross-building only works when
a matching prebuild happens to exist; it cannot be relied on.

**Correction — building natively on Windows CI did not fix this by
itself.** The `windows-latest` leg of `.github/workflows/build-desktop.yml`
hit the exact same `"No prebuilt binaries found"` failure, because the gap
isn't cross-compilation — it's a genuine version mismatch between the two
pinned dependencies:

- `desktop/package.json` pinned `electron@43.1.1`, whose Node-ABI is **148**
  (`require('node-abi').getAbi('43.1.1', 'electron')`).
- The locked `better-sqlite3@12.11.1` (root `package.json`) has never
  published a prebuilt binary for ABI 148, on **any** platform — confirmed
  by listing every asset in its `v12.11.1` GitHub release; the highest
  Electron ABI it ships is 146. (A newer `v12.12.0` release does add ABI
  148, including win32-x64, but as of this writing it isn't published to
  the npm registry yet — `npm view better-sqlite3@12.12.0` 404s — so
  bumping the semver range isn't currently an option.)

So on **any** platform, native or cross-built, `prebuild-install` was
guaranteed to fail to find a binary and fall through to `node-gyp`
compiling from source — which is what actually broke, both locally and in
CI.

**Fix**: pin `desktop/package.json`'s `electron` devDependency to
`^42.7.0` instead (ABI 146) — a version that `better-sqlite3@12.11.1` *has*
a prebuilt binary for on every platform, including win32-x64. Verified
locally: `npm run rebuild:native:win` now logs `installed prebuilt module:
better-sqlite3` / `✔ Rebuild Complete` (previously: `No prebuilt binaries
found`), and `verify-native-binary.js` confirms the resulting file is a
genuine `PE32+ ... for MS Windows` binary. No source compile, no
toolchain, no cross-compile question involved at all — the prebuilt
binary is just downloaded. The desktop app itself only uses long-stable
Electron APIs (`app`, `BrowserWindow`, `shell`, `contextBridge`), so the
42.x pin has no functional impact. Revisit this pin once `better-sqlite3`
publishes an npm release with ABI-148 prebuilds.

### 5. Icon

`desktop/build/icon.png` — a placeholder (flat brand-teal rounded square
with a plain "S" monogram, generated programmatically, not hand-designed
artwork). electron-builder derives both the macOS `.icns` and Windows
`.ico` from this single 1024×1024 source at package time. **Replace this
file with real artwork whenever it's ready** — no other config changes
needed, electron-builder picks up the same `build/icon.png` path for both
platforms.

## Building

```bash
cd desktop
npm run dist:mac   # macOS .dmg + .zip in desktop/dist/
npm run dist:win   # Windows NSIS installer in desktop/dist/
npm run dist       # both
```

## Known limitations of this first pass

- **Unsigned.** No Apple Developer Program membership or Windows
  code-signing certificate is wired in. macOS Gatekeeper will block/warn
  on first launch (right-click → Open bypasses it, once); Windows
  SmartScreen shows an "unrecognized app" warning ("More info" → "Run
  anyway" bypasses it, once). Add proper signing later by supplying
  certificates and the corresponding electron-builder `mac.identity`/
  `win.certificateFile` config — not attempted here since it needs paid
  accounts this pass didn't assume access to.
- **No auto-update.** Updating means downloading and reinstalling a new
  version manually. Adding `electron-updater` later is additive — doesn't
  require redoing any of the above.
- **Building the Windows target from macOS is not reliable** and should
  not be treated as the release path — see the "Incident" section above.
  `better-sqlite3` needs a prebuilt win32 binary to exist for the exact
  Electron version in use; `node-gyp` cannot compile one from source on
  macOS. Use `.github/workflows/build-desktop.yml`'s `windows-latest` leg
  (or a real Windows machine) to produce Windows installers — that always
  works because the native rebuild happens on the target OS itself.
  (Separately, an earlier attempt at cross-building also hit a transient
  10-minute network timeout fetching NSIS packaging tooling, unrelated to
  the native-module issue — a plain retry got past that particular step,
  but it doesn't change the point above: the resulting binary wasn't
  actually Windows-compatible regardless.)
