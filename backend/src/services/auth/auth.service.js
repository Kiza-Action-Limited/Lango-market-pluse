const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../../models/User.model');
const Subscription = require('../../models/Subscription.model');
const memoryStore = require('./authMemoryStore');
const { getEffectiveUserCategory, isSellerUser } = require('../../utils/userCategory');

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

class AuthService {
  useFallback() {
    return process.env.AUTH_FALLBACK_MODE === 'true' || mongoose.connection.readyState !== 1;
  }

  resolveUserId(user) {
    return String(user._id || user.id);
  }

  async register(userData) {
    const { password, email, fullName, role, businessType, businessLogoUrl, businessName } = userData;
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
    const roleMap = {
      seller: 'seller',
      farmer: 'farmer',
      wholesaler: 'seller',
      manufacturer: 'seller',
      retailer: 'seller',
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
    };

    if (userPayload.role === 'seller' && !normalizedBusinessLogoUrl) {
      const error = new Error('Business logo is required for seller accounts');
      error.statusCode = 400;
      throw error;
    }

    if (userPayload.role === 'seller' && normalizedBusinessName.length < 2) {
      const error = new Error('Business name is required for seller accounts');
      error.statusCode = 400;
      throw error;
    }

    if (normalizedEmail) {
      userPayload.email = normalizedEmail;
    }
    if (normalizedBusinessType) {
      userPayload.businessType = normalizedBusinessType;
    }
    if (normalizedBusinessName) {
      userPayload.businessName = normalizedBusinessName;
    }
    if (normalizedBusinessLogoUrl) {
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

    return { user: this.sanitizeUser(user), ...tokens };
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
      return { user: this.sanitizeUser(fallbackUser), ...tokens };
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
    return { user: this.sanitizeUser(user), ...tokens };
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
    const tokenPayload = {
      id: userId,
      role,
      businessType: user.businessType,
      businessName: user.businessName,
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

    if (profileData.fullName !== undefined || profileData.name !== undefined) {
      allowedUpdates.fullName = String(profileData.fullName ?? profileData.name ?? '').trim();
    }
    if (profileData.phone !== undefined) {
      allowedUpdates.phone = this.normalizePhone(profileData.phone);
    }
    if (profileData.businessName !== undefined) {
      allowedUpdates.businessName = String(profileData.businessName || '').trim() || null;
    }
    if (profileData.businessType !== undefined) {
      allowedUpdates.businessType = profileData.businessType || null;
    }
    if (profileData.businessLogoUrl !== undefined) {
      allowedUpdates.businessLogoUrl = profileData.businessLogoUrl || null;
    }
    if (profileData.address !== undefined) {
      allowedUpdates.address = String(profileData.address || '').trim();
    }

    if (Object.keys(allowedUpdates).length === 0 && Object.keys(unsetUpdates).length === 0) {
      return this.getCurrentUser(userId);
    }

    if (this.useFallback()) {
      const fallbackUpdates = { ...allowedUpdates };
      delete fallbackUpdates.location;
      const user = memoryStore.updateUserById(userId, fallbackUpdates);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }
      return this.getCurrentUser(userId);
    }

    const currentUser = await User.findById(userId).select('location').lean();
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
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : null;
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
}

module.exports = new AuthService();
