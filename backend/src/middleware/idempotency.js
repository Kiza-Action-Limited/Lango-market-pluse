const IdempotencyKey = require('../models/IdempotencyKey.model');
const { sha256 } = require('../utils/hash');

const idempotency = (scope, options = {}) => async (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) {
    if (options.required) {
      return res.status(428).json({
        success: false,
        message: 'Idempotency-Key header is required for this operation.',
      });
    }
    return next();
  }

  const normalizedKey = String(key).trim();
  const requestHash = sha256({
    method: req.method,
    path: req.originalUrl,
    body: req.body || {},
    userId: req.user?.id || req.userId || null,
  });

  try {
    let record = await IdempotencyKey.findOne({
      key: normalizedKey,
      scope,
      user: req.user?._id || req.user?.id || null,
    });

    if (record) {
      if (record.requestHash !== requestHash) {
        return res.status(409).json({
          success: false,
          message: 'Idempotency-Key was already used with different request details.',
        });
      }

      if (record.status === 'completed') {
        return res.status(record.responseStatus || 200).json(record.responseBody);
      }

      return res.status(409).json({
        success: false,
        message: 'A request with this Idempotency-Key is already being processed.',
      });
    }

    record = await IdempotencyKey.create({
      key: normalizedKey,
      scope,
      user: req.user?._id || req.user?.id || null,
      requestHash,
      lockedUntil: new Date(Date.now() + 5 * 60 * 1000),
    });

    req.idempotency = record;
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const finalBody = body && typeof body === 'object' ? body : { data: body };
      IdempotencyKey.findByIdAndUpdate(record._id, {
        status: res.statusCode >= 500 ? 'failed' : 'completed',
        responseStatus: res.statusCode,
        responseBody: finalBody,
      }).catch(() => {});
      return originalJson(body);
    };

    return next();
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A request with this Idempotency-Key is already being processed.',
      });
    }
    return next(error);
  }
};

module.exports = idempotency;
