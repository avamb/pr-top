// Automated Database Backup Service
// Creates encrypted, compressed snapshots of the SQLite database
// with configurable retention policy and restore capability.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');

const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(__dirname, '../../backups');
const BACKUP_RETENTION_COUNT = parseInt(process.env.BACKUP_RETENTION_COUNT || '30', 10);
const ENCRYPTION_KEY = process.env.ENCRYPTION_MASTER_KEY || 'dev-master-key-change-in-production';

// Derive a 32-byte key from the master key for AES-256
function deriveKey() {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info(`[BACKUP] Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Create an encrypted, compressed backup of the database
 * @returns {{ success: boolean, filename?: string, size?: number, error?: string }}
 */
function backup() {
  try {
    ensureBackupDir();

    // Save current state to disk first
    saveDatabaseAfterWrite();

    // Export database to buffer
    const db = getDatabase();
    const data = db.export();
    const rawBuffer = Buffer.from(data);

    // Compress with gzip
    const compressed = zlib.gzipSync(rawBuffer, { level: 9 });

    // Encrypt with AES-256-CBC
    const iv = crypto.randomBytes(16);
    const key = deriveKey();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);

    // Write: [16 bytes IV][encrypted data]
    const output = Buffer.concat([iv, encrypted]);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
    const filename = `prtop_backup_${timestamp}.db.gz.enc`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, output);

    const stats = fs.statSync(filepath);

    logger.info(`[BACKUP] Created backup: ${filename} (${formatSize(stats.size)}, raw ${formatSize(rawBuffer.length)})`);

    // Record in audit log
    try {
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (0, 'database_backup', 'system', 0, ?, datetime('now'))",
        [JSON.stringify({ filename, size: stats.size, raw_size: rawBuffer.length })]
      );
      saveDatabaseAfterWrite();
    } catch (auditErr) {
      logger.warn(`[BACKUP] Failed to log backup audit: ${auditErr.message}`);
    }

    // Apply retention policy
    applyRetention();

    return { success: true, filename, size: stats.size, raw_size: rawBuffer.length };
  } catch (error) {
    logger.error(`[BACKUP] Backup failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Restore database from an encrypted backup file
 * @param {string} filename - The backup filename to restore
 * @returns {{ success: boolean, error?: string }}
 */
function restore(filename) {
  try {
    const filepath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(filepath)) {
      return { success: false, error: 'Backup file not found' };
    }

    // Validate filename to prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return { success: false, error: 'Invalid filename' };
    }

    const data = fs.readFileSync(filepath);

    if (data.length < 17) {
      return { success: false, error: 'Backup file is too small or corrupted' };
    }

    // Extract IV and encrypted data
    const iv = data.slice(0, 16);
    const encrypted = data.slice(16);

    // Decrypt
    const key = deriveKey();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted;
    try {
      decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (decryptErr) {
      return { success: false, error: 'Decryption failed - wrong encryption key or corrupted file' };
    }

    // Decompress
    let rawData;
    try {
      rawData = zlib.gunzipSync(decrypted);
    } catch (unzipErr) {
      return { success: false, error: 'Decompression failed - corrupted backup' };
    }

    // Create a safety backup of current database before restoring
    const safetyResult = backup();
    if (safetyResult.success) {
      // Rename the safety backup to indicate it's a pre-restore snapshot
      const safetyPath = path.join(BACKUP_DIR, safetyResult.filename);
      const preRestoreName = safetyResult.filename.replace('prtop_backup_', 'pre_restore_');
      const preRestorePath = path.join(BACKUP_DIR, preRestoreName);
      try {
        fs.renameSync(safetyPath, preRestorePath);
      } catch (renameErr) {
        // Non-fatal
      }
    }

    // Write the restored data to the database file
    const dbUrl = process.env.DATABASE_URL || 'sqlite:./data/prtop.db';
    const relativePath = dbUrl.replace('sqlite:', '');
    const dbPath = path.resolve(__dirname, '../../', relativePath);

    fs.writeFileSync(dbPath, rawData);

    logger.info(`[BACKUP] Database restored from: ${filename} (${formatSize(rawData.length)})`);

    // Record restore in audit (note: this writes to the RESTORED database)
    try {
      const db = getDatabase();
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (0, 'database_restored', 'system', 0, ?, datetime('now'))",
        [JSON.stringify({ filename, size: rawData.length })]
      );
      saveDatabaseAfterWrite();
    } catch (auditErr) {
      // The restored DB may not have the audit_logs table - non-fatal
    }

    return { success: true, filename, size: rawData.length };
  } catch (error) {
    logger.error(`[BACKUP] Restore failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * List available backup files
 * @returns {{ backups: Array<{filename, size, created_at}>, total_size: number }}
 */
function listBackups() {
  ensureBackupDir();

  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db.gz.enc'))
      .sort()
      .reverse(); // newest first

    const backups = files.map(filename => {
      const filepath = path.join(BACKUP_DIR, filename);
      const stats = fs.statSync(filepath);
      // Extract date from filename: prtop_backup_2026-03-13_17-30-00-000.db.gz.enc
      let created_at = stats.birthtime.toISOString();
      const dateMatch = filename.match(/prtop_backup_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/);
      if (dateMatch) {
        const dateStr = dateMatch[1];
        const timeStr = dateMatch[2].replace(/-/g, ':');
        created_at = `${dateStr}T${timeStr}Z`;
      }
      return {
        filename,
        size: stats.size,
        size_formatted: formatSize(stats.size),
        created_at
      };
    });

    const total_size = backups.reduce((sum, b) => sum + b.size, 0);

    return {
      backups,
      count: backups.length,
      total_size,
      total_size_formatted: formatSize(total_size),
      retention_limit: BACKUP_RETENTION_COUNT,
      backup_dir: BACKUP_DIR
    };
  } catch (error) {
    logger.error(`[BACKUP] List backups failed: ${error.message}`);
    return { backups: [], count: 0, total_size: 0, total_size_formatted: '0 B' };
  }
}

/**
 * Apply retention policy: delete oldest backups beyond the retention limit
 */
function applyRetention() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('prtop_backup_') && f.endsWith('.db.gz.enc'))
      .sort(); // oldest first

    if (files.length <= BACKUP_RETENTION_COUNT) return;

    const toDelete = files.slice(0, files.length - BACKUP_RETENTION_COUNT);
    for (const file of toDelete) {
      const filepath = path.join(BACKUP_DIR, file);
      fs.unlinkSync(filepath);
      logger.info(`[BACKUP] Retention: deleted old backup ${file}`);
    }

    logger.info(`[BACKUP] Retention applied: deleted ${toDelete.length} old backups, kept ${BACKUP_RETENTION_COUNT}`);
  } catch (error) {
    logger.warn(`[BACKUP] Retention cleanup failed: ${error.message}`);
  }
}

/**
 * Get backup status summary (for admin dashboard)
 */
function getBackupStatus() {
  const list = listBackups();
  const lastBackup = list.backups.length > 0 ? list.backups[0] : null;
  return {
    last_backup: lastBackup ? lastBackup.created_at : null,
    last_backup_size: lastBackup ? lastBackup.size_formatted : null,
    backup_count: list.count,
    total_size: list.total_size_formatted,
    retention_limit: BACKUP_RETENTION_COUNT,
    backup_dir: BACKUP_DIR
  };
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

module.exports = {
  backup,
  restore,
  listBackups,
  getBackupStatus,
  applyRetention
};
