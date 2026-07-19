#!/usr/bin/env node
// Guards against shipping a native binary compiled for the wrong platform
// inside a packaged installer (see docs/packaging.md — this exact bug
// shipped a macOS-compiled better_sqlite3.node inside a Windows build).
// Reads the file's magic bytes and asserts they match the target platform
// instead of trusting that the preceding rebuild step actually targeted it.
const fs = require('fs');
const path = require('path');

const [, , targetPlatform = process.platform] = process.argv;

const binaryPath = path.join(
    __dirname, '../..', 'node_modules/better-sqlite3/build/Release/better_sqlite3.node'
);

const magicByPlatform = {
    win32: { bytes: [0x4d, 0x5a], label: 'PE (Windows)' },
    darwin: { bytes: null, label: 'Mach-O (macOS)' },
    linux: { bytes: [0x7f, 0x45, 0x4c, 0x46], label: 'ELF (Linux)' }
};

const MACHO_MAGICS = [
    [0xcf, 0xfa, 0xed, 0xfe],
    [0xfe, 0xed, 0xfa, 0xcf],
    [0xca, 0xfe, 0xba, 0xbe]
];

if (!fs.existsSync(binaryPath)) {
    console.error(`verify-native-binary: ${binaryPath} does not exist`);
    process.exit(1);
}

const fd = fs.openSync(binaryPath, 'r');
const header = Buffer.alloc(4);
fs.readSync(fd, header, 0, 4, 0);
fs.closeSync(fd);

const expected = magicByPlatform[targetPlatform];
if (!expected) {
    console.error(`verify-native-binary: unknown target platform "${targetPlatform}"`);
    process.exit(1);
}

const matches = targetPlatform === 'darwin'
    ? MACHO_MAGICS.some((magic) => magic.every((b, i) => header[i] === b))
    : expected.bytes.every((b, i) => header[i] === b);

if (!matches) {
    console.error(
        `verify-native-binary: better_sqlite3.node does NOT look like a ${expected.label} binary ` +
        `(target platform "${targetPlatform}", header bytes: ${header.toString('hex')}). ` +
        `The native rebuild did not target the right platform — refusing to package. See docs/packaging.md.`
    );
    process.exit(1);
}

console.log(`verify-native-binary: OK — better_sqlite3.node matches ${expected.label} for target "${targetPlatform}"`);
