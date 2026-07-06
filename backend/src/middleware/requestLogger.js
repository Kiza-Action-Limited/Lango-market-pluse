const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

const getRequestId = (req) => {
  const incomingId = req.headers['x-request-id'];
  if (typeof incomingId === 'string' && incomingId.trim()) {
    return incomingId.trim();
  }

  return randomUUID();
};

const pickResponseMessage = (body) => {
  if (!body || typeof body !== 'object') return undefined;

  if (typeof body.message === 'string') return body.message;
  if (typeof body.error === 'string') return body.error;
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    const firstError = body.errors[0];
    return firstError?.message || firstError?.msg || 'Validation failed';
  }

  return undefined;
};

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

const addErrorMetadata = (body, statusCode, requestId) => {
  if (
    statusCode < 400 ||
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Buffer.isBuffer(body)
  ) {
    return body;
  }

  if (statusCode >= 500) {
    return {
      success: false,
      message: defaultUserMessage(statusCode),
      statusCode,
      requestId,
      ...(body.code ? { code: body.code } : {}),
    };
  }

  return {
    ...body,
    message: pickResponseMessage(body) || defaultUserMessage(statusCode),
    statusCode: body.statusCode || statusCode,
    requestId: body.requestId || requestId,
  };
};

const requestLogger = (req, res, next) => {
  const startedAt = Date.now();
  req.id = req.id || getRequestId(req);
  res.setHeader('X-Request-Id', req.id);

  let responseBody;
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    responseBody = body;
    const normalizedBody = addErrorMetadata(body, res.statusCode, req.id);
    return originalJson(normalizedBody);
  };

  res.on('finish', () => {
    if (res.statusCode < 400) return;
    if (res.locals.errorLogged) return;

    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : 'warn';
    const durationMs = Date.now() - startedAt;
    const message = pickResponseMessage(responseBody) || res.statusMessage || 'Request failed';

    logger[level](`HTTP ${statusCode} ${req.method} ${req.originalUrl}`, {
      requestId: req.id,
      statusCode,
      method: req.method,
      path: req.originalUrl,
      message,
      durationMs,
      userId: req.user?.id || req.userId,
      ip: req.ip,
    });
  });

  next();
};

module.exports = requestLogger;
