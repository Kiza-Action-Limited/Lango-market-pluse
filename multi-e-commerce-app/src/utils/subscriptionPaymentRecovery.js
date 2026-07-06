const STORAGE_PREFIX = 'lango:subscription-payment:';

const getUserId = (user) => user?.id || user?._id || 'anonymous';

export const getSubscriptionPaymentKey = (user, planId) => {
  if (!planId) return null;
  return `${STORAGE_PREFIX}${getUserId(user)}:${planId}`;
};

export const savePendingSubscriptionPayment = (user, planId, payload = {}) => {
  const key = getSubscriptionPaymentKey(user, planId);
  if (!key || typeof window === 'undefined') return null;

  const record = {
    ...payload,
    planId,
    userId: getUserId(user),
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(record));
    return record;
  } catch {
    return null;
  }
};

export const loadPendingSubscriptionPayment = (user, planId) => {
  const key = getSubscriptionPaymentKey(user, planId);
  if (!key || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearPendingSubscriptionPayment = (user, planId) => {
  const key = getSubscriptionPaymentKey(user, planId);
  if (!key || typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures; payment state can still be recovered by starting a new STK request.
  }
};

export const listPendingSubscriptionPayments = (user) => {
  if (typeof window === 'undefined') return [];
  const userId = getUserId(user);
  const prefix = `${STORAGE_PREFIX}${userId}:`;
  const records = [];

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.checkoutRequestId) records.push(parsed);
    }
  } catch {
    return records;
  }

  return records.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
};
