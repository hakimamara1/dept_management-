#!/usr/bin/env node
// Restores the repo-root node_modules/better-sqlite3 to the host's plain
// Node ABI after a packaging run mutated it for Electron — needed on a
// developer's own machine so `npm run dev` (system Node) keeps working.
// Meaningless in CI: a GitHub Actions runner is destroyed right after the
// job finishes, and there's no dev backend running in it to restore for.
// Skipping it there also avoids a real but irrelevant failure (CI runners
// commonly lack a prebuild for their exact Node version, and node-gyp then
// fails to find a supported Visual Studio install on Windows runners) that
// would otherwise mask the fact that the actual installer already built
// successfully.
const { execFileSync } = require('child_process');

if (process.env.CI) {
    console.log('restore-native: skipping (CI environment, no local dev backend to restore for)');
    process.exit(0);
}

execFileSync('npm', ['--prefix', '..', 'run', 'rebuild:dev'], { stdio: 'inherit' });
