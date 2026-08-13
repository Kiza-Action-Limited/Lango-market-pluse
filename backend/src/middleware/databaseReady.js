const mongoose = require('mongoose');

const DEFAULT_ALLOWED_PREFIXES = [
  '/health',
  '/api/test',
  '/api/v1/mobile/config',
  '/api/mobile/config',
  '/api/v1/auth',
  '/api/auth',
  '/v1/auth',
  '/api/v1/callbacks',
  '/webhooks',
  '/api/mpesa',
  '/uploads',
];

const isAllowedPath = (path, prefixes) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

module.exports = ({ allowedPrefixes = DEFAULT_ALLOWED_PREFIXES } = {}) => (req, res, next) => {
  if (isAllowedPath(req.path, allowedPrefixes)) return next();
  if (mongoose.connection.readyState === 1) return next();

  const error = new Error('Database temporarily unavailable. Please check MongoDB connectivity and try again.');
  error.statusCode = 503;
  error.serviceCode = 'DB_UNAVAILABLE';
  error.dbState = mongoose.connection.readyState;
  return next(error);
};
