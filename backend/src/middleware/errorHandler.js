module.exports = (err, req, res, next) => {
  const isMongooseInputError = err.name === 'ValidationError' || err.name === 'CastError';
  const statusCode = err.statusCode || (isMongooseInputError ? 400 : 500);
  const message = err.message || 'Internal server error';

  if (statusCode >= 500) {
    console.error('Unhandled error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.currentStatus ? { currentStatus: err.currentStatus } : {}),
    ...(err.expectedStatus ? { expectedStatus: err.expectedStatus } : {}),
    ...(err.nextStatus ? { nextStatus: err.nextStatus } : {}),
    ...(err.allowedNext ? { allowedNext: err.allowedNext } : {}),
    ...(err.errors ? { errors: err.errors } : {}),
  });
};
