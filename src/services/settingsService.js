// services/settingsService.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../config/database');

const SQLITE_MAGIC = 'SQLite format 3\0';

class SettingsService {
    getBusinessProfile() {
        return db.stmts.businessProfile.get.get();
    }

    updateBusinessProfile({ businessName, address, phone, email, taxNumber, commercialRegister }) {
        const existing = this.getBusinessProfile();
        db.stmts.businessProfile.update.run(
            businessName !== undefined ? businessName || null : existing.business_name,
            address !== undefined ? address || null : existing.address,
            phone !== undefined ? phone || null : existing.phone,
            email !== undefined ? email || null : existing.email,
            taxNumber !== undefined ? taxNumber || null : existing.tax_number,
            commercialRegister !== undefined ? commercialRegister || null : existing.commercial_register
        );
        return this.getBusinessProfile();
    }

    updateLogo(logoPath) {
        db.stmts.businessProfile.updateLogo.run(logoPath);
        return this.getBusinessProfile();
    }

    // Uses SQLite's online backup API (db.backupTo -> better-sqlite3's
    // .backup()) instead of "checkpoint, then hand the live file to
    // res.download()". A checkpoint-then-copy has a real gap: the app keeps
    // serving requests while the file streams over HTTP, and any write that
    // lands in that gap is silently missing from the download. The backup
    // API takes a consistent snapshot directly, safe against concurrent
    // writers, into a throwaway temp path the route streams from — the live
    // invoices.db is never touched or blocked.
    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(os.tmpdir(), `spice-erp-backup-${timestamp}.db`);
        await db.backupTo(backupPath);
        return backupPath;
    }

    async restoreBackup(uploadedFilePath) {
        const header = Buffer.alloc(16);
        const fd = fs.openSync(uploadedFilePath, 'r');
        try {
            fs.readSync(fd, header, 0, 16, 0);
        } finally {
            fs.closeSync(fd);
        }
        if (header.toString('utf8') !== SQLITE_MAGIC) {
            fs.unlinkSync(uploadedFilePath);
            throw new Error('الملف المرفوع ليس قاعدة بيانات SQLite صالحة');
        }

        // Close the connection before touching the file on disk — renaming
        // a file better-sqlite3 still has open works on macOS/Linux (the fd
        // just keeps pointing at the detached inode) but throws EBUSY/EPERM
        // on Windows, and even where it doesn't throw, the live connection
        // would keep silently writing to the orphaned old file instead of
        // the restored one until the caller manually restarts. Closing
        // first makes the swap atomic from the connection's point of view.
        db.checkpointAndClose();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safetyCopyPath = `${db.dbPath}.before-restore-${timestamp}`;
        fs.renameSync(db.dbPath, safetyCopyPath);
        fs.renameSync(uploadedFilePath, db.dbPath);

        return { success: true, requiresRestart: true, safetyCopyPath };
    }
}

module.exports = new SettingsService();
