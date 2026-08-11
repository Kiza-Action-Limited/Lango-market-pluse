const crypto = require('crypto');

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(value[key])}`
  )).join(',')}}`;
};

const sha256 = (value) => crypto
  .createHash('sha256')
  .update(typeof value === 'string' ? value : stableStringify(value))
  .digest('hex');

const hashToken = (token) => sha256(String(token || '').trim());

module.exports = {
  stableStringify,
  sha256,
  hashToken,
};
