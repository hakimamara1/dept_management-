#!/usr/bin/env node
// Rebuilds better-sqlite3 against Electron's ABI before packaging — see
// docs/packaging.md. `electron-rebuild --module-dir` proved unreliable at
// finding the root-level node_modules (an @electron/rebuild quirk in the
// installed version, not a config mistake) — running with the ROOT
// directory as cwd, with no --module-dir flag at all, is what actually
// works, so this script does that directly instead of fighting the flag.
//
// Target platform/arch are explicit CLI args (defaulting to the host)
// because this rebuilds the SAME shared root node_modules used for every
// packaged target — omitting them silently rebuilds for the host platform
// regardless of which installer you're about to package (this shipped a
// macOS binary inside a Windows installer once; see docs/packaging.md).
const path = require('path');
const { execFileSync } = require('child_process');

const [, , targetPlatform = process.platform, targetArch = process.arch] = process.argv;

const rootDir = path.join(__dirname, '../..');
const electronVersion = require(path.join(__dirname, '../node_modules/electron/package.json')).version;
// Invoke @electron/rebuild's actual entry point via `node`, not the .bin
// shim path directly: on macOS/Linux, node_modules/.bin/electron-rebuild
// is a symlink to a shebang script the OS knows how to exec, but Windows
// has no shebang support — executing that same extensionless path there
// throws ENOENT before electron-rebuild's own logic ever runs (proven via
// a real GitHub Actions Windows run; see docs/packaging.md). Resolving
// and running the JS entry point directly works identically everywhere.
const rebuildEntry = path.join(__dirname, '../node_modules/@electron/rebuild/lib/cli.js');

try {
    execFileSync(process.execPath, [
        rebuildEntry,
        '-v', electronVersion,
        '-f',
        '-w', 'better-sqlite3',
        '--platform', targetPlatform,
        '--arch', targetArch
    ], {
        cwd: rootDir,
        stdio: 'inherit'
    });
} catch (err) {
    console.error(err.stack || err);

    if (targetPlatform !== process.platform) {
        console.error(`
Cross-building better-sqlite3 for ${targetPlatform}/${targetArch} failed...
`);
    }
    process.exit(1);
}
