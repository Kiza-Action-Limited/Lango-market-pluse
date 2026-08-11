const normalizeKenyanPhone = (phoneNumber) => {
  if (phoneNumber === undefined || phoneNumber === null || String(phoneNumber).trim() === '') {
    const error = new Error('Enter a valid Kenya phone number.');
    error.code = 'PHONE_REQUIRED';
    throw error;
  }

  let normalized = String(phoneNumber).trim().replace(/\D/g, '');

  if (normalized.startsWith('0')) {
    normalized = `254${normalized.slice(1)}`;
  } else if (/^[71]\d{8}$/.test(normalized)) {
    normalized = `254${normalized}`;
  }

  if (!/^254[71]\d{8}$/.test(normalized)) {
    const error = new Error('Enter a valid Kenya M-Pesa number, for example 0712345678 or 254712345678.');
    error.code = 'PHONE_INVALID';
    throw error;
  }

  return normalized;
};

module.exports = {
  normalizeKenyanPhone,
};
