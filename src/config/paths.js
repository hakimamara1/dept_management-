// config/paths.js
/**
 * Single source of truth for where writable data lives. In dev, this
 * resolves to the exact same repo-relative paths every file used to
 * compute independently (APP_DATA_DIR is unset) — zero behavior change.
 * In a packaged app, electron/main/backend-process.ts sets APP_DATA_DIR to
 * Electron's per-user `userData` directory before spawning this process,
 * since the app bundle itself is read-only at runtime. See docs/packaging.md.
 */
const path = require('path');

// Two different roots in dev, because they always were: data lived inside
// src/ (this file is src/config/paths.js, so one level up is src/), while
// .env lived at the repo root — one level above src/, i.e. two levels up
// from here. In a packaged app there's no repo-root/src distinction left,
// so APP_DATA_DIR collapses both onto the same writable userData directory.
const DATA_ROOT = process.env.APP_DATA_DIR || path.join(__dirname, '..');
const ENV_ROOT = process.env.APP_DATA_DIR || path.join(__dirname, '../..');

module.exports = {
    DATA_DIR: path.join(DATA_ROOT, 'data'),
    UPLOADS_DIR: path.join(DATA_ROOT, 'data/uploads'),
    DB_PATH: path.join(DATA_ROOT, 'data/invoices.db'),
    ENV_PATH: path.join(ENV_ROOT, '.env')
};
