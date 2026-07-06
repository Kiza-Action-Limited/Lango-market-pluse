const logger = require('../utils/logger');

const ERROR_DETAILS = [
  'currentStatus',
  'expectedStatus',
  'nextStatus',
  'allowedNext',
  'requiredPayment',
  'requiredAmount',
  'currency',
  'fromPlan',
  'toPlan',
  'googleStatus',
  'errors',
];

const defaultUserMessage = (statusCode) => {
  if (statusCode >= 500) {
    return 'Something went wrong. Please try again later.';
  }

  if (statusCode === 404) return 'The requested resource was not found.';
  if (statusCode === 403) return 'You do not have permission to perform this action.';
  if (statusCode === 401) return 'Please sign in to continue.';
  if (statusCode === 400) return 'Please check your request and try again.';

  return 'Request failed. Please try again.';
};

const normalizeStatusCode = (err) => {
  const explicitStatus = err.statusCode || err.status || err.response?.status;

  if (Number.isInteger(explicitStatus) && explicitStatus >= 400 && explicitStatus <= 599) {
    return explicitStatus;
  }

  if (err.name === 'ValidationError' || err.name === 'CastError' || err.isJoi) {
    return 400;
  }

  if (err.code === 11000) {
    return 409;
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return 401;
  }

  if (err.name === 'MulterError') {
    return err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
  }

  if (err.type === 'entity.parse.failed') {
    return 400;
  }

  if (err.message?.toLowerCase().includes('cors blocked')) {
    return 403;
  }

  if (err.isAxiosError) {
    return err.response ? 502 : 503;
  }

  return 500;
};

const getLogMessage = (err, statusCode) => {
  if (err.code === 11000) {
    const duplicateField = Object.keys(err.keyPattern || err.keyValue || {})[0];
    return `${duplicateField || 'Resource'} already exists.`;
  }

  return err.message || 'Internal server error';
};

const getUserMessage = (err, statusCode) => {
  if (statusCode >= 500) {
    return defaultUserMessage(statusCode);
  }

  return getLogMessage(err, statusCode) || defaultUserMessage(statusCode);
};

const buildErrorPayload = (err, statusCode, message, requestId) => {
  const payload = {
    success: false,
    statusCode,
    message,
    requestId,
  };

  if (err.code) payload.code = err.code;
  if (err.code === 11000 && err.keyValue) payload.keyValue = err.keyValue;

  ERROR_DETAILS.forEach((key) => {
    if (err[key] !== undefined) {
      payload[key] = err[key];
    }
  });

  return payload;
};

module.exports = (err, req, res, next) => {
  if (res.headersSent) {
    logger.error('Error after response headers were sent', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      message: err.message,
      stack: err.stack,
    });
    return next(err);
  }

  const statusCode = normalizeStatusCode(err);
  const logMessage = getLogMessage(err, statusCode);
  const userMessage = getUserMessage(err, statusCode);
  const level = statusCode >= 500 ? 'error' : 'warn';
  res.locals.errorLogged = true;

  logger[level](`HTTP ${statusCode} ${req.method} ${req.originalUrl}`, {
    requestId: req.id,
    statusCode,
    method: req.method,
    path: req.originalUrl,
    message: logMessage,
    errorName: err.name,
    code: err.code,
    userId: req.user?.id || req.userId,
    ip: req.ip,
    stack: statusCode >= 500 ? err.stack : undefined,
  });

  return res.status(statusCode).json(buildErrorPayload(err, statusCode, userMessage, req.id));
};
