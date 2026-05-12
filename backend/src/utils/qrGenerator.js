const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Generate QR code as data URL
 * @param {Object} payload - Data to encode
 * @returns {Promise<string>} data:image/png;base64...
 */
const generateQR = async (payload) => {
  const stringData = JSON.stringify(payload);
  return await QRCode.toDataURL(stringData, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 300,
  });
};

/**
 * Generate a secure hash for QR content (integrity check)
 */
const generateHash = (data, secret = process.env.QR_SECRET) => {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex');
};

/**
 * Verify QR content integrity
 */
const verifyQR = (payload, hash) => {
  const computedHash = generateHash(payload);
  return computedHash === hash;
};

module.exports = { generateQR, generateHash, verifyQR };