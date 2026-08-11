const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../../models/User.model');
const Subscription = require('../../models/Subscription.model');
const memoryStore = require('./authMemoryStore');
const { emailService } = require('../../config/email');
const { getEffectiveUserCategory, isSellerUser } = require('../../utils/userCategory');

const applyDotPath = (target, path, value) => {
  const segments = String(path).split('.');
  let current = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }
    current[segment] = current[segment] && typeof current[segment] === 'object' ? current[segment] : {};
    current = current[segment];
  });
};

const expandDotUpdates = (updates = {}) => Object.entries(updates).reduce((acc, [key, value]) => {
  if (key.includes('.')) applyDotPath(acc, key, value);
  else acc[key] = value;
  return acc;
}, {});

// Safe imports with fallbacks
let smsQueue = null;
let redisClient = null;
try {
  const redis = require('../../config/redis');
  smsQueue = redis.smsQueue;
  redisClient = redis.redisClient;
} catch (err) {
  console.warn('⚠️ Redis/SMS queue not available – SMS features disabled');
}

const getDefaultRedirectForUser = (user = {}) => {
  const role = String(user.role || '').toLowerCase();
  const category = getEffectiveUserCategory(user);

  if (role === 'admin' || category === 'admin') return '/admin/dashboard';
  if (role === 'logistics' || category === 'logistics') return '/logistics/dashboard';
  if (isSellerUser(user)) return '/seller';
  return '/';
};

const isBuyerAccount = (user = {}) => {
  const role = String(user.role || '').trim().toLowerCase();
  return role === 'buyer' || role === 'consumer' || getEffectiveUserCategory(user) === 'consumer';
};

const isProduction = process.env.NODE_ENV === 'production';
const PASSWORD_RESET_TOKEN_TTL_SECONDS = 60 * 60;

const hashResetToken = (token) => crypto
  .createHash('sha256')
  .update(String(token || ''))
  .digest('hex');

const passwordResetKey = (tokenHash) => `reset:token:${tokenHash}`;

class AuthService {
  useFallback() {
    return process.env.AUTH_FALLBACK_MODE === 'true' || mongoose.connection.readyState !== 1;
  }

  resolveUserId(user) {
    return String(user._id || user.id);
  }

  async register(userData) {
    const {
      password,
      email,
      fullName,
      role,
      businessType,
      businessLogoUrl,
      businessName,
      isPhoneVerified = false,
      isEmailVerified = false,
    } = userData;
    const phone = this.normalizePhone(userData.phone);
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;

    const orConditions = [{ phone }];
    if (normalizedEmail) {
      orConditions.push({ email: normalizedEmail });
    }

    const existingUser = this.useFallback()
      ? memoryStore.findByPhoneOrEmail({ phone, email: normalizedEmail })
      : await User.findOne({ $or: orConditions });
    if (existingUser) {
      const error = new Error('User with this phone or email already exists');
      error.statusCode = 409;
      throw error;
    }

    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : undefined;
    const normalizedBusinessType = typeof businessType === 'string' ? businessType.trim().toLowerCase() : null;
    const normalizedBusinessLogoUrl = typeof businessLogoUrl === 'string' ? businessLogoUrl.trim() : '';
    const normalizedBusinessName = typeof businessName === 'string' ? businessName.trim().replace(/\s+/g, ' ') : '';

    if (normalizedBusinessLogoUrl.startsWith('data:')) {
      const error = new Error('Please re-upload your business logo before registering.');
      error.statusCode = 400;
      error.code = 'INLINE_BUSINESS_LOGO_NOT_ALLOWED';
      throw error;
    }

    const roleMap = {
      seller: 'seller',
      farmer: 'farmer',
      brand: 'seller',
      wholesaler: 'seller',
      manufacturer: 'seller',
      retailer: 'seller',
      small_business: 'seller',
      vendor: 'seller',
      analytics: 'seller',
      analystic: 'seller',
      logistic: 'logistics',
      buyer: 'buyer',
      logistics: 'logistics',
      admin: 'admin',
    };

    const userPayload = {
      phone,
      password,
      fullName,
      role: roleMap[normalizedRole] || 'buyer',
      isPhoneVerified: Boolean(isPhoneVerified),
      isEmailVerified: Boolean(isEmailVerified),
    };

    if (userPayload.role === 'seller' && normalizedBusinessName.length < 2) {
      const error = new Error('Business name is required for seller accounts');
      error.statusCode = 400;
      throw error;
    }

    if (normalizedEmail) {
      userPayload.email = normalizedEmail;
    }
    const sellerSubtypeFromRole = ['brand', 'wholesaler', 'manufacturer', 'retailer', 'small_business'].includes(normalizedRole)
      ? normalizedRole
      : null;

    if (!isBuyerAccount(userPayload) && (normalizedBusinessType || sellerSubtypeFromRole)) {
      userPayload.businessType = normalizedBusinessType || sellerSubtypeFromRole;
    }
    if (!isBuyerAccount(userPayload) && normalizedBusinessName) {
      userPayload.businessName = normalizedBusinessName;
    }
    if (!isBuyerAccount(userPayload) && normalizedBusinessLogoUrl) {
      userPayload.businessLogoUrl = normalizedBusinessLogoUrl;
    }

    const user = this.useFallback()
      ? await memoryStore.createUser(userPayload)
      : await User.create(userPayload);
    const tokens = this.generateTokens(user);

    // Optional SMS (non-blocking)
    if (smsQueue) {
      smsQueue.add('send', { to: phone, message: 'Welcome to MarketPulse!' }).catch(console.error);
    }

    const sanitizedUser = this.sanitizeUser(user);
    return { user: sanitizedUser, redirectTo: getDefaultRedirectForUser(sanitizedUser), ...tokens };
  }

  async login(credentials) {
    const { phone, email, password } = credentials;
    const normalizedPhone = phone ? this.normalizePhone(phone) : null;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : null;

    if (this.useFallback()) {
      const fallbackUser = await memoryStore.validateLogin({
        phone: normalizedPhone,
        email: normalizedEmail,
        password,
      });
      if (!fallbackUser) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401;
        throw error;
      }
      if (!fallbackUser.isActive) {
        const error = new Error('Account deactivated');
        error.statusCode = 403;
        throw error;
      }
      const tokens = this.generateTokens(fallbackUser);
      const sanitizedUser = this.sanitizeUser(fallbackUser);
      return { user: sanitizedUser, redirectTo: getDefaultRedirectForUser(sanitizedUser), ...tokens };
    }

    let user = null;
    if (normalizedPhone) {
      user = await User.findOne({ phone: normalizedPhone }).select('+password');
    }
    if (!user && normalizedEmail) {
      user = await User.findOne({ email: normalizedEmail }).select('+password');
    }
    if (!user) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }
    if (!user.isActive) {
      const error = new Error('Account deactivated');
      error.statusCode = 403;
      throw error;
    }

    const loginAt = new Date();
    user.lastLogin = loginAt;
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: loginAt } });

    const tokens = this.generateTokens(user);
    const sanitizedUser = this.sanitizeUser(user);
    return { user: sanitizedUser, redirectTo: getDefaultRedirectForUser(sanitizedUser), ...tokens };
  }

  async verifyKYC(userId, kycData) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const isVerified = await this.simulateKYCCheck(kycData);
    user.kycVerified = isVerified;
    user.kycDetails = {
      idNumber: kycData.idNumber,
      idImageUrl: kycData.idImageUrl,
      verifiedAt: isVerified ? new Date() : null,
    };
    await user.save();
    return { kycVerified: user.kycVerified };
  }

  async requestPasswordReset(phone) {
    const normalizedPhone = this.normalizePhone(phone);
    const user = this.useFallback()
      ? memoryStore.findByPhoneOrEmail({ phone: normalizedPhone })
      : await User.findOne({ phone: normalizedPhone });
    if (!user) return { message: 'If account exists, reset code sent' };

    const resetCode = crypto.randomInt(100000, 999999).toString();
    await this.storeResetCode(normalizedPhone, resetCode);

    if (smsQueue) {
      smsQueue.add('send', { to: normalizedPhone, message: `MarketPulse reset code: ${resetCode}` }).catch(console.error);
    } else {
      console.log(`[SMS disabled] Reset code for ${normalizedPhone}: ${resetCode}`);
    }
    return { message: 'Reset code sent' };
  }

  async resetPassword(phone, code, newPassword) {
    const normalizedPhone = this.normalizePhone(phone);
    const isValid = await this.verifyResetCode(normalizedPhone, code);
    if (!isValid) {
      const error = new Error('Invalid or expired code');
      error.statusCode = 400;
      throw error;
    }

    const user = this.useFallback()
      ? memoryStore.findByPhoneOrEmail({ phone: normalizedPhone })
      : await User.findOne({ phone: normalizedPhone });
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (this.useFallback()) {
      const error = new Error('Password reset in fallback mode is not supported');
      error.statusCode = 501;
      throw error;
    }

    user.password = newPassword;
    await user.save();
    
    // Clear the used reset code
    if (redisClient) {
      await redisClient.del(`reset:${normalizedPhone}`);
    } else {
      if (global._resetCodes) {
        global._resetCodes.delete(`reset:${normalizedPhone}`);
      }
    }
    
    return { success: true };
  }

  async checkEmailAccount(email) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      const error = new Error('Valid email address is required');
      error.statusCode = 400;
      throw error;
    }

    const user = await this.findUserByEmail(normalizedEmail);
    return {
      exists: Boolean(user),
      email: normalizedEmail,
      user: user ? {
        id: String(user._id || user.id),
        role: user.role || 'buyer',
        isEmailVerified: Boolean(user.isEmailVerified),
      } : null,
    };
  }

  async requestEmailPasswordReset(email) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      const error = new Error('Valid email address is required');
      error.statusCode = 400;
      throw error;
    }

    const user = await this.findUserByEmail(normalizedEmail);
    if (!user) {
      return {
        success: true,
        sent: false,
        message: 'If an account exists, a password reset link has been sent.',
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    await this.storePasswordResetToken(tokenHash, {
      userId: String(user._id || user.id),
      email: normalizedEmail,
      createdAt: Date.now(),
    });

    let delivered = false;
    let deliveryError = null;
    try {
      await emailService.sendPasswordResetEmail(normalizedEmail, token, 60);
      delivered = true;
    } catch (error) {
      deliveryError = error;
      if (isProduction) {
        await this.clearPasswordResetToken(tokenHash);
        throw error;
      }
      console.warn(`[Email disabled] Reset link token for ${normalizedEmail}: ${token}`);
    }

    return {
      success: true,
      sent: delivered,
      delivered,
      message: delivered
        ? 'Password reset link sent to your email.'
        : 'Password reset link generated. Email delivery failed in development mode.',
      ...(deliveryError && !isProduction ? { deliveryError: deliveryError.message, devResetToken: token } : {}),
    };
  }

  async resetPasswordByToken(token, newPassword) {
    const rawToken = String(token || '').trim();
    if (!rawToken) {
      const error = new Error('Reset token is required');
      error.statusCode = 400;
      throw error;
    }

    const tokenHash = hashResetToken(rawToken);
    const entry = await this.getPasswordResetToken(tokenHash);
    if (!entry?.userId && !entry?.email) {
      const error = new Error('Invalid or expired reset token');
      error.statusCode = 400;
      error.code = 'RESET_TOKEN_INVALID';
      throw error;
    }

    const user = this.useFallback()
      ? memoryStore.getUserById(entry.userId)
      : entry.userId
        ? await User.findById(entry.userId).select('+password')
        : await User.findOne({ email: entry.email }).select('+password');

    if (!user) {
      await this.clearPasswordResetToken(tokenHash);
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    await this.setUserPassword(user, newPassword);

    await this.clearPasswordResetToken(tokenHash);
    return { success: true };
  }

  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      const user = this.useFallback()
        ? memoryStore.getUserById(decoded.id)
        : await User.findById(decoded.id);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      const newAccessToken = jwt.sign(
        {
          id: this.resolveUserId(user),
          role: user.role,
          businessType: user.businessType,
          businessName: user.businessName,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return { accessToken: newAccessToken };
    } catch (err) {
      const error = new Error('Invalid refresh token');
      error.statusCode = 401;
      throw error;
    }
  }

  generateTokens(user) {
    if (!process.env.JWT_SECRET) {
      const error = new Error('JWT_SECRET is missing');
      error.statusCode = 500;
      throw error;
    }
    const userId = this.resolveUserId(user);
    const role = user.role || 'buyer';
    const buyerAccount = isBuyerAccount(user);
    const tokenPayload = {
      id: userId,
      role,
      businessType: buyerAccount ? null : user.businessType,
      businessName: buyerAccount ? null : user.businessName,
    };
    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
    const refreshToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '30d' });
    return { accessToken, refreshToken };
  }

  sanitizeUser(user) {
    const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    delete obj.password;
    delete obj.passwordHash;
    delete obj.__v;
    if (isBuyerAccount(obj)) {
      obj.businessName = null;
      obj.businessType = null;
      obj.businessLogoUrl = null;
    }
    return obj;
  }

  async getCurrentUser(userId) {
    const user = this.useFallback()
      ? memoryStore.getUserById(userId)
      : await User.findById(userId).select('-password -__v');
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const obj = this.sanitizeUser(user);
    const effectiveCategory = getEffectiveUserCategory(obj);
    const canUseSubscriptionPlans = isSellerUser(obj) || effectiveCategory === 'logistics';
    if (!canUseSubscriptionPlans) {
      obj.subscriptionTier = null;
      obj.subscriptionExpiry = null;
    }

    if (!this.useFallback()) {
      const subscription = canUseSubscriptionPlans ? await Subscription.findOne({ user: userId }).lean() : null;
      obj.subscription = subscription ? {
        id: subscription._id,
        planId: subscription.plan,
        planName: subscription.planName,
        status: subscription.status,
        active: subscription.status === 'active' && (
          subscription.plan === 'mizigo' ||
          !subscription.endDate ||
          subscription.endDate > new Date()
        ),
        price: subscription.price,
        expiresAt: subscription.endDate,
      } : {
        active: false,
        planId: null,
        status: 'inactive',
        expiresAt: null,
      };
    }
    return obj;
  }

  async updateCurrentUser(userId, profileData = {}) {
    const allowedUpdates = {};
    const unsetUpdates = {};
    const useFallbackStore = this.useFallback();
    const currentUser = useFallbackStore
      ? memoryStore.getUserById(userId)
      : await User.findById(userId).select('role businessType location logisticsProfile').lean();

    if (!currentUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const effectiveCategory = getEffectiveUserCategory(currentUser);
    const isLogisticsProfile = effectiveCategory === 'logistics';
    const buyerProfile = effectiveCategory === 'consumer';

    if (profileData.fullName !== undefined || profileData.name !== undefined) {
      allowedUpdates.fullName = String(profileData.fullName ?? profileData.name ?? '').trim();
    }
    if (profileData.phone !== undefined) {
      allowedUpdates.phone = this.normalizePhone(profileData.phone);
    }
    if (buyerProfile) {
      unsetUpdates.businessName = '';
      unsetUpdates.businessType = '';
      unsetUpdates.businessLogoUrl = '';
    } else {
      if (profileData.businessName !== undefined) {
        allowedUpdates.businessName = String(profileData.businessName || '').trim() || null;
      }
      if (profileData.businessType !== undefined) {
        allowedUpdates.businessType = profileData.businessType || null;
      }
      if (profileData.businessLogoUrl !== undefined) {
        allowedUpdates.businessLogoUrl = profileData.businessLogoUrl || null;
      }
    }
    if (profileData.profileImageUrl !== undefined) {
      allowedUpdates.profileImageUrl = profileData.profileImageUrl || null;
    }
    if (profileData.locationHub !== undefined) {
      allowedUpdates.locationHub = String(profileData.locationHub || '').trim();
    }
    if (profileData.city !== undefined) {
      allowedUpdates.city = String(profileData.city || '').trim();
    }
    if (profileData.address !== undefined) {
      allowedUpdates.address = String(profileData.address || '').trim();
    }

    const logisticsProfileInput = profileData.logisticsProfile;
    if (
      logisticsProfileInput &&
      typeof logisticsProfileInput === 'object' &&
      !Array.isArray(logisticsProfileInput)
    ) {
      if (!isLogisticsProfile) {
        const error = new Error('Only logistics accounts can update logistics profile details');
        error.statusCode = 403;
        throw error;
      }

      if (logisticsProfileInput.baseHub !== undefined || logisticsProfileInput.locationHub !== undefined) {
        const baseHub = String(
          logisticsProfileInput.baseHub ?? logisticsProfileInput.locationHub ?? ''
        ).trim();
        allowedUpdates['logisticsProfile.baseHub'] = baseHub;
        allowedUpdates['logisticsProfile.locationHub'] = baseHub;
        allowedUpdates.locationHub = baseHub;
      }

      if (logisticsProfileInput.driverMode !== undefined) {
        const driverMode = String(logisticsProfileInput.driverMode || '').trim();
        if (driverMode) allowedUpdates['logisticsProfile.driverMode'] = driverMode;
        else unsetUpdates['logisticsProfile.driverMode'] = '';
      }

      if (logisticsProfileInput.vehiclePlate !== undefined) {
        const vehiclePlate = String(logisticsProfileInput.vehiclePlate || '').trim().toUpperCase();
        if (vehiclePlate) allowedUpdates['logisticsProfile.vehiclePlate'] = vehiclePlate;
        else unsetUpdates['logisticsProfile.vehiclePlate'] = '';
      }

      if (logisticsProfileInput.cargoCapacityKg !== undefined) {
        const rawCapacity = String(logisticsProfileInput.cargoCapacityKg ?? '').trim();
        if (rawCapacity) allowedUpdates['logisticsProfile.cargoCapacityKg'] = Number(rawCapacity);
        else unsetUpdates['logisticsProfile.cargoCapacityKg'] = '';
      }
    }

    if (Object.keys(allowedUpdates).length === 0 && Object.keys(unsetUpdates).length === 0) {
      return this.getCurrentUser(userId);
    }

    if (useFallbackStore) {
      const fallbackUpdates = expandDotUpdates(allowedUpdates);
      Object.keys(unsetUpdates).forEach((key) => applyDotPath(fallbackUpdates, key, null));
      delete fallbackUpdates.location;
      const user = memoryStore.updateUserById(userId, fallbackUpdates);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }
      return this.getCurrentUser(userId);
    }

    const hasValidGeoLocation =
      currentUser?.location?.type === 'Point' &&
      Array.isArray(currentUser.location.coordinates) &&
      currentUser.location.coordinates.length === 2 &&
      currentUser.location.coordinates.every((coordinate) => Number.isFinite(Number(coordinate)));

    if (!hasValidGeoLocation && currentUser?.location) {
      unsetUpdates.location = '';
    } else if (hasValidGeoLocation && profileData.address !== undefined) {
      allowedUpdates['location.address'] = allowedUpdates.address;
    }

    const updateOperation = {};
    if (Object.keys(allowedUpdates).length > 0) updateOperation.$set = allowedUpdates;
    if (Object.keys(unsetUpdates).length > 0) updateOperation.$unset = unsetUpdates;

    const user = await User.findByIdAndUpdate(
      userId,
      updateOperation,
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return this.getCurrentUser(userId);
  }

  async findUserByPhone(phone) {
    const normalizedPhone = this.normalizePhone(phone);
    return this.useFallback()
      ? memoryStore.findByPhoneOrEmail({ phone: normalizedPhone })
      : await User.findOne({ phone: normalizedPhone });
  }

  async findUserByEmail(email) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) return null;
    return this.useFallback()
      ? memoryStore.findByPhoneOrEmail({ email: normalizedEmail })
      : await User.findOne({ email: normalizedEmail });
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      const error = new Error('Current password is incorrect');
      error.statusCode = 401;
      throw error;
    }

    user.password = newPassword;
    await user.save();
    
    return { success: true };
  }

  normalizePhone(phone) {
    if (typeof phone !== 'string') return phone;
    const trimmed = phone.trim();
    if (/^07\d{8}$/.test(trimmed)) {
      return `254${trimmed.slice(1)}`;
    }
    if (/^\+254\d{9}$/.test(trimmed)) {
      return trimmed.slice(1);
    }
    return trimmed;
  }

  async setUserPassword(user, newPassword) {
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (this.useFallback()) {
      const updated = await memoryStore.updatePasswordById(user._id || user.id, newPassword);
      if (!updated) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }
      return updated;
    }

    user.password = newPassword;
    await user.save();
    return this.sanitizeUser(user);
  }

  normalizeEmail(email) {
    if (typeof email !== 'string') return null;
    const normalized = email.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
  }

  async simulateKYCCheck(kycData) {
    return true;
  }

  async storeResetCode(phone, code) {
    if (redisClient) {
      await redisClient.setEx(`reset:${phone}`, 600, code);
    } else {
      // Fallback: in-memory store (not for production)
      if (!global._resetCodes) global._resetCodes = new Map();
      global._resetCodes.set(`reset:${phone}`, { code, expires: Date.now() + 600000 });
    }
  }

  async verifyResetCode(phone, code) {
    if (redisClient) {
      const stored = await redisClient.get(`reset:${phone}`);
      return stored === code;
    } else {
      const entry = global._resetCodes?.get(`reset:${phone}`);
      if (entry && entry.code === code && entry.expires > Date.now()) {
        global._resetCodes.delete(`reset:${phone}`);
        return true;
      }
      return false;
    }
  }

  async storePasswordResetToken(tokenHash, payload) {
    if (redisClient) {
      await redisClient.setEx(passwordResetKey(tokenHash), PASSWORD_RESET_TOKEN_TTL_SECONDS, JSON.stringify(payload));
      return;
    }

    if (!global._passwordResetTokens) global._passwordResetTokens = new Map();
    global._passwordResetTokens.set(passwordResetKey(tokenHash), {
      payload,
      expires: Date.now() + PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000,
    });
  }

  async getPasswordResetToken(tokenHash) {
    if (redisClient) {
      const raw = await redisClient.get(passwordResetKey(tokenHash));
      return raw ? JSON.parse(raw) : null;
    }

    const entry = global._passwordResetTokens?.get(passwordResetKey(tokenHash));
    if (!entry) return null;
    if (entry.expires <= Date.now()) {
      global._passwordResetTokens.delete(passwordResetKey(tokenHash));
      return null;
    }
    return entry.payload;
  }

  async clearPasswordResetToken(tokenHash) {
    if (redisClient) {
      await redisClient.del(passwordResetKey(tokenHash));
      return;
    }

    if (global._passwordResetTokens) {
      global._passwordResetTokens.delete(passwordResetKey(tokenHash));
    }
  }
}

module.exports = new AuthService();
