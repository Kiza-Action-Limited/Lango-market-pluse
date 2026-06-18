const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const users = new Map();

const toPublicUser = (user) => {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

const createId = () => new mongoose.Types.ObjectId().toString();

const findByPhoneOrEmail = ({ phone, email }) => {
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  for (const user of users.values()) {
    if (phone && user.phone === phone) return user;
    if (normalizedEmail && user.email === normalizedEmail) return user;
  }
  return null;
};

const createUser = async ({ phone, email, password, fullName, role, businessType, businessName, businessLogoUrl }) => {
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const user = {
    _id: createId(),
    phone,
    email: normalizedEmail,
    fullName: fullName || '',
    role,
    businessType: businessType || null,
    businessName: businessName || null,
    businessLogoUrl: businessLogoUrl || null,
    isActive: true,
    kycVerified: false,
    subscriptionTier: 'free',
    walletBalance: 0,
    escrowBalance: 0,
    createdAt: now,
    updatedAt: now,
    lastLogin: null,
    passwordHash,
  };
  users.set(user._id, user);
  return toPublicUser(user);
};

const validateLogin = async ({ phone, email, password }) => {
  const user = findByPhoneOrEmail({ phone, email });
  if (!user) return null;
  const matched = await bcrypt.compare(password, user.passwordHash);
  if (!matched) return null;
  user.lastLogin = new Date();
  user.updatedAt = new Date();
  return toPublicUser(user);
};

const getUserById = (id) => {
  const user = users.get(String(id));
  return user ? toPublicUser(user) : null;
};

const updateUserById = (id, updates) => {
  const key = String(id);
  const user = users.get(key);
  if (!user) return null;
  Object.assign(user, updates, { updatedAt: new Date() });
  users.set(key, user);
  return toPublicUser(user);
};

module.exports = {
  findByPhoneOrEmail,
  createUser,
  validateLogin,
  getUserById,
  updateUserById,
};
