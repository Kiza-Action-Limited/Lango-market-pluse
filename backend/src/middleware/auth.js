const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const memoryStore = require('../services/auth/authMemoryStore');

const extractToken = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization || req.headers['x-access-token'];
  if (authHeader && typeof authHeader === 'string') {
    const headerValue = authHeader.trim();
    const bearerMatch = headerValue.match(/^(?:bearer\s+)?(.+)$/i);
    if (bearerMatch) {
      const extracted = bearerMatch[1].trim();
      if (['', 'undefined', 'null'].includes(extracted.toLowerCase())) {
        return null;
      }
      return extracted;
    }
  }
  if (req.query?.token) {
    const token = `${req.query.token}`.trim();
    if (!['', 'undefined', 'null'].includes(token.toLowerCase())) return token;
  }
  if (req.body?.token) {
    const token = `${req.body.token}`.trim();
    if (!['', 'undefined', 'null'].includes(token.toLowerCase())) return token;
  }
  return null;
};

/**
 * Middleware to verify JWT token and attach user to request object
 * Expects token in Authorization header: "Bearer <token>"
 */
const protect = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized, no token provided' 
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ 
      success: false, 
      message: 'Server JWT secret is not configured. Contact administrator.' 
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Determine if we're in fallback mode
    const fallbackMode = process.env.AUTH_FALLBACK_MODE === 'true' || 
                        mongoose.connection.readyState !== 1;
    
    let user;
    if (fallbackMode) {
      // Use memory store for fallback
      user = memoryStore.getUserById(decoded.id) || {
        _id: decoded.id,
        id: decoded.id,
        userId: decoded.id,
        role: decoded.role || 'buyer',
        isActive: true,
      };
    } else {
      // Fetch from database, exclude password
      user = await User.findById(decoded.id).select('-password').lean();
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or token invalid',
      });
    }
    
    // Check if account is active
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Account deactivated. Contact support.',
      });
    }
    
    // Ensure consistent user object structure
    req.user = {
      ...user,
      id: user.id || user._id?.toString() || decoded.id,
      _id: user._id || decoded.id,
      userId: user.userId || user.id || user._id?.toString() || decoded.id,
      role: user.role || decoded.role || 'buyer'
    };
    
    // Attach userId directly for convenience
    req.userId = req.user.id;
    
    next();
  } catch (error) {
    const isDev = process.env.NODE_ENV !== 'production';
    if (error.name === 'JsonWebTokenError') {
      if (isDev) {
        console.error('JWT verification failed:', error.message, 'token=', token);
      }
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      if (isDev) {
        console.error('JWT token expired:', error.message, 'token=', token);
      }
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, token expired. Please login again' 
      });
    }
    
    if (isDev) {
      console.error('JWT verification error:', error.message, 'token=', token);
    }
    
    // Generic error
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized, token failed' 
    });
  }
};

/**
 * Admin authorization middleware
 * Must be used after protect middleware
 */
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Not authorized as admin. Admin access required.' 
    });
  }
};

/**
 * Optional: Role-based authorization factory
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authenticated' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required role: ${roles.join(' or ')}` 
      });
    }
    
    next();
  };
};

module.exports = {
  protect,
  admin,
  authorize,
};