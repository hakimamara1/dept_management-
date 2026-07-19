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
const rebuildBin = path.join(__dirname, '../node_modules/.bin/electron-rebuild');

try {
    execFileSync(rebuildBin, [
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
    if (targetPlatform !== process.platform) {
        // node-gyp cannot cross-compile from source, and better-sqlite3 only
        // has a binary for this exact target if its GitHub release happens to
        // publish one for this Electron ABI — neither is guaranteed. See the
        // "Incident" section in docs/packaging.md.
        console.error(
            `\nCross-building better-sqlite3 for ${targetPlatform}/${targetArch} from ` +
            `${process.platform} failed (no prebuilt binary available and node-gyp can't ` +
            `cross-compile from source). This target must be built on a real ` +
            `${targetPlatform} machine or via .github/workflows/build-desktop.yml. ` +
            `See docs/packaging.md.\n`
        );
    }
    process.exit(1);
}
