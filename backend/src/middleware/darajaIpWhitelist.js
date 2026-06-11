const parseList = () => (process.env.DARAJA_ALLOWED_IPS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.ip || req.socket?.remoteAddress || '');
  return ip.split(',')[0].trim().replace(/^::ffff:/, '');
};

const ipv4ToInt = (ip) => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return null;
  return parts.reduce((acc, part) => ((acc << 8) + part) >>> 0, 0);
};

const matchesRange = (clientIp, entry) => {
  const client = ipv4ToInt(clientIp);
  if (client == null) return false;

  if (!entry.includes('/')) return clientIp === entry;

  const [rangeIp, prefixText] = entry.split('/');
  const range = ipv4ToInt(rangeIp);
  const prefix = Number(prefixText);
  if (range == null || Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (client & mask) === (range & mask);
};

module.exports = (req, res, next) => {
  const allowed = parseList();

  if (!allowed.length && process.env.NODE_ENV !== 'production') {
    return next();
  }

  const clientIp = getClientIp(req);
  if (allowed.some((entry) => matchesRange(clientIp, entry))) {
    return next();
  }

  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
};
