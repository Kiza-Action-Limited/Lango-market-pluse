const DEFAULT_CURRENCY = 'KES';

const toMinorUnits = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('Amount must be a finite number');
  }
  return Math.round((numeric + Number.EPSILON) * 100);
};

const fromMinorUnits = (value) => {
  const numeric = Number(value || 0);
  return Math.round(numeric) / 100;
};

const normalizeMoney = (value) => fromMinorUnits(toMinorUnits(value));

const assertPositiveAmount = (value, label = 'Amount') => {
  const minor = toMinorUnits(value);
  if (minor <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
  return minor;
};

module.exports = {
  DEFAULT_CURRENCY,
  toMinorUnits,
  fromMinorUnits,
  normalizeMoney,
  assertPositiveAmount,
};
