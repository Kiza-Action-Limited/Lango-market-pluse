const crypto = require('crypto');

const algorithm = 'aes-256-gcm';
const ivLength = 16;
const saltLength = 64;
const tagLength = 16;

/**
 * Derive key from password using PBKDF2
 */
const deriveKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
};

/**
 * Encrypt text
 * @param {string} text - Plain text
 * @param {string} password - Secret password (from env)
 * @returns {string} Encrypted string (iv:salt:authTag:encrypted)
 */
const encrypt = (text, password = process.env.ENCRYPTION_KEY) => {
  const iv = crypto.randomBytes(ivLength);
  const salt = crypto.randomBytes(saltLength);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${salt.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

/**
 * Decrypt text
 * @param {string} encryptedData - Format: iv:salt:authTag:encrypted
 * @param {string} password - Secret password
 * @returns {string} Plain text
 */
const decrypt = (encryptedData, password = process.env.ENCRYPTION_KEY) => {
  const [ivHex, saltHex, authTagHex, encryptedHex] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const salt = Buffer.from(saltHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};

/**
 * Hash sensitive data (e.g., ID numbers) for lookup without storing plain text
 */
const hashForLookup = (data, salt = process.env.HASH_SALT) => {
  return crypto.createHmac('sha256', salt).update(data).digest('hex');
};

module.exports = { encrypt, decrypt, hashForLookup };