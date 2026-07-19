#!/usr/bin/env node
// Rebuilds better-sqlite3 against Electron's ABI before packaging — see
// docs/packaging.md. `electron-rebuild --module-dir` proved unreliable at
// finding the root-level node_modules (an @electron/rebuild quirk in the
// installed version, not a config mistake) — running with the ROOT
// directory as cwd, with no --module-dir flag at all, is what actually
// works, so this script does that directly instead of fighting the flag.
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.join(__dirname, '../..');
const electronVersion = require(path.join(__dirname, '../node_modules/electron/package.json')).version;
const rebuildBin = path.join(__dirname, '../node_modules/.bin/electron-rebuild');

execFileSync(rebuildBin, ['-v', electronVersion, '-f', '-w', 'better-sqlite3'], {
    cwd: rootDir,
    stdio: 'inherit'
});
