const frameAncestors = process.env.FRAME_ANCESTORS || "'none'";

module.exports = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
  res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
  next();
};
