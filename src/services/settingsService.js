// services/settingsService.js
const fs = require('fs');
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

    // Checkpointing first matters: in WAL mode, recent writes sit in
    // invoices.db-wal, not the main file — copying/downloading the file
    // without this first can silently miss the newest data.
    createBackup() {
        db.pragma('wal_checkpoint(FULL)');
        return db.dbPath;
    }

    restoreBackup(uploadedFilePath) {
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

        // Flush WAL before swapping the file out from under the live
        // connection — this process's connection isn't closed/reopened
        // here (see business-rules.md), so minimizing leftover WAL state
        // keeps the remainder of this session as clean as possible until
        // the app is restarted and re-opens fresh against the new file.
        db.pragma('wal_checkpoint(TRUNCATE)');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safetyCopyPath = `${db.dbPath}.before-restore-${timestamp}`;
        fs.renameSync(db.dbPath, safetyCopyPath);
        fs.renameSync(uploadedFilePath, db.dbPath);

        return { success: true, requiresRestart: true, safetyCopyPath };
    }
}

module.exports = new SettingsService();
