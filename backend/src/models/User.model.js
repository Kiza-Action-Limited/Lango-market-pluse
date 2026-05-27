const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^\+?254[0-9]{9}$/, 'Please enter a valid Kenyan phone number (e.g., 2547XXXXXXXX)'],
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    fullName: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['seller', 'farmer', 'buyer', 'logistics', 'admin'],
      default: 'buyer',
      index: true,
    },
    businessType: {
      type: String,
      enum: [
        'brand',
        'wholesaler',
        'manufacturer',
        'retailer',
        'farmer',
        'small_business',
        'analytics',
        'analystic',
        'logistics',
      ],
      default: null,
      index: true,
    },
    businessLogoUrl: {
      type: String,
      default: null,
      trim: true,
    },
    kycVerified: {
      type: Boolean,
      default: false,
    },
    kycDetails: {
      idNumber: String,
      idImageUrl: String,
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    subscriptionTier: {
      type: String,
      enum: ['free', 'v3', 'v4', 'solo', 'smart', 'growth', 'mizigo'],
      default: 'solo',
      index: true,
    },
    subscriptionExpiry: {
      type: Date,
      default: null,
    },
    accountRole: {
      type: String,
      enum: ['OWNER', 'CLERK', 'DRIVER', 'FLEET_OWNER'],
      default: 'OWNER',
      index: true,
    },
    ownerAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    escrowBalance: {
      type: Number,
      default: 0, // Amount held in escrow
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        validate: {
          validator: function (value) {
            if (value == null) return true;
            return Array.isArray(value) && value.length === 2;
          },
          message: 'Location coordinates must contain [longitude, latitude]',
        },
      },
      address: String,
    },
    pushTokens: [String], // FCM / Expo tokens
    wishlist: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Indexes
UserSchema.index({ location: '2dsphere' });
UserSchema.index({ role: 1, subscriptionTier: 1 });

module.exports = mongoose.model('User', UserSchema);
