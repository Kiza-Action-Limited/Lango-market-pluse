const buckets = new Map();

const simpleRateLimit = (options = {}) => {
  const windowMs = Number(options.windowMs || process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const max = Number(options.max || process.env.RATE_LIMIT_MAX || 600);

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${options.scope || 'global'}:${ip}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please wait and try again.',
      });
    }

    return next();
  };
};

module.exports = simpleRateLimit;
