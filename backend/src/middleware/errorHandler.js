module.exports = (err, req, res, next) => {
  const isMongooseInputError = err.name === 'ValidationError' || err.name === 'CastError';
  const isDuplicateKeyError = err.code === 11000;
  const statusCode = err.statusCode || (isMongooseInputError ? 400 : (isDuplicateKeyError ? 409 : 500));
  const duplicateField = isDuplicateKeyError ? Object.keys(err.keyPattern || err.keyValue || {})[0] : null;
  const message = isDuplicateKeyError
    ? `${duplicateField || 'Resource'} already exists.`
    : (err.message || 'Internal server error');

  if (statusCode >= 500) {
    console.error('Unhandled error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(isDuplicateKeyError && err.keyValue ? { keyValue: err.keyValue } : {}),
    ...(err.currentStatus ? { currentStatus: err.currentStatus } : {}),
    ...(err.expectedStatus ? { expectedStatus: err.expectedStatus } : {}),
    ...(err.nextStatus ? { nextStatus: err.nextStatus } : {}),
    ...(err.allowedNext ? { allowedNext: err.allowedNext } : {}),
    ...(err.requiredPayment ? { requiredPayment: err.requiredPayment } : {}),
    ...(err.requiredAmount ? { requiredAmount: err.requiredAmount } : {}),
    ...(err.currency ? { currency: err.currency } : {}),
    ...(err.fromPlan ? { fromPlan: err.fromPlan } : {}),
    ...(err.toPlan ? { toPlan: err.toPlan } : {}),
    ...(err.code ? { code: err.code } : {}),
    ...(err.googleStatus ? { googleStatus: err.googleStatus } : {}),
    ...(err.errors ? { errors: err.errors } : {}),
  });
};
