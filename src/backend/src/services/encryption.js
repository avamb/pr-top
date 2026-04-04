// Encryption Service
// Provides application-layer encryption with key versioning for key rotation.
// All sensitive data (Class A) is encrypted before storage using AES-256-GCM.
// Key versioning allows rotation: new data uses the latest key, old data
// remains readable with its original key version.

const crypto = require('crypto');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || 'dev-master-key-change-in-production';

/**
 * Derive an encryption key from the master key and key version.
 * Each key version produces a different derived key.
 */
function deriveKey(keyVersion) {
  // Use PBKDF2 to derive a 256-bit key from master key + version salt
  const salt = `prtop-key-v${keyVersion}`;
  return crypto.pbkdf2Sync(MASTER_KEY, salt, 100000, 32, 'sha256');
}

/**
 * Get the current active encryption key version from the database.
 * Returns the highest active key version.
 */
function getActiveKeyVersion() {
  const db = getDatabase();
  const result = db.exec(
    "SELECT key_version FROM encryption_keys WHERE status = 'active' ORDER BY key_version DESC LIMIT 1"
  );

  if (result.length === 0 || result[0].values.length === 0) {
    // No active key found, create version 1
    db.run("INSERT OR IGNORE INTO encryption_keys (key_version, status) VALUES (1, 'active')");
    saveDatabaseAfterWrite();
    return 1;
  }

  return result[0].values[0][0];
}

/**
 * Get the encryption key record ID for a given version.
 */
function getKeyId(keyVersion) {
  const db = getDatabase();
  const result = db.exec(
    'SELECT id FROM encryption_keys WHERE key_version = ?',
    [keyVersion]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  return result[0].values[0][0];
}

/**
 * Encrypt plaintext data using the current active key version.
 * Returns an object with encrypted data, IV, auth tag, and key version.
 *
 * @param {string} plaintext - The data to encrypt
 * @returns {{ encrypted: string, keyVersion: number, keyId: number }}
 */
function encrypt(plaintext) {
  const keyVersion = getActiveKeyVersion();
  const key = deriveKey(keyVersion);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Pack: version:iv:authTag:ciphertext (all base64 encoded)
  const packed = [
    keyVersion.toString(),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted
  ].join(':');

  const keyId = getKeyId(keyVersion);

  logger.debug(`Encrypted data with key version ${keyVersion}`);

  return {
    encrypted: packed,
    keyVersion,
    keyId
  };
}

/**
 * Decrypt data that was encrypted with any key version.
 * Extracts the key version from the packed data and uses the corresponding key.
 *
 * @param {string} packed - The packed encrypted data (version:iv:authTag:ciphertext)
 * @returns {string} Decrypted plaintext
 */
function decrypt(packed) {
  const parts = packed.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const [versionStr, ivB64, authTagB64, ciphertext] = parts;
  const keyVersion = parseInt(versionStr, 10);

  if (isNaN(keyVersion)) {
    throw new Error('Invalid key version in encrypted data');
  }

  const key = deriveKey(keyVersion);
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  logger.debug(`Decrypted data from key version ${keyVersion}`);

  return decrypted;
}

/**
 * Create a new encryption key version.
 * The old key version is marked as 'rotated', and the new version becomes 'active'.
 * Old data encrypted with previous versions can still be decrypted.
 *
 * @returns {{ newVersion: number, newKeyId: number }}
 */
function rotateKey() {
  const db = getDatabase();
  const currentVersion = getActiveKeyVersion();
  const newVersion = currentVersion + 1;

  // Mark current active key as rotated
  db.run(
    "UPDATE encryption_keys SET status = 'rotated', rotated_at = datetime('now') WHERE status = 'active'",
  );

  // Insert new key version
  db.run(
    "INSERT INTO encryption_keys (key_version, status) VALUES (?, 'active')",
    [newVersion]
  );

  saveDatabaseAfterWrite();

  const newKeyId = getKeyId(newVersion);

  logger.info(`Encryption key rotated: v${currentVersion} -> v${newVersion}`);

  return { newVersion, newKeyId };
}

/**
 * Get all encryption key versions and their statuses.
 */
function listKeyVersions() {
  const db = getDatabase();
  const result = db.exec(
    'SELECT id, key_version, status, created_at, rotated_at FROM encryption_keys ORDER BY key_version ASC'
  );

  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => ({
    id: row[0],
    key_version: row[1],
    status: row[2],
    created_at: row[3],
    rotated_at: row[4]
  }));
}

/**
 * Re-encrypt data from an old key version to the current active version.
 * Useful for migrating data after key rotation.
 */
function reEncrypt(packed) {
  const plaintext = decrypt(packed);
  return encrypt(plaintext);
}

module.exports = {
  encrypt,
  decrypt,
  rotateKey,
  getActiveKeyVersion,
  getKeyId,
  listKeyVersions,
  reEncrypt
};
