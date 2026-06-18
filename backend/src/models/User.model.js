const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const isValidOptionalGeoCoordinates = (value) => (
  value == null ||
  (Array.isArray(value) && value.length === 0) ||
  (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((coordinate) => Number.isFinite(Number(coordinate)))
  )
);

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
    businessName: {
      type: String,
      trim: true,
      minlength: [2, 'Business name must be at least 2 characters'],
      maxlength: [120, 'Business name cannot exceed 120 characters'],
      required: [
        function requiredBusinessNameOnCreate() {
          return this.isNew && ['seller', 'farmer'].includes(this.role);
        },
        'Business name is required for seller accounts',
      ],
      index: true,
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
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'gold', 'rejected', 'restricted'],
      default: 'unverified',
      index: true,
    },
    trustScore: {
      type: Number,
      min: 0,
      max: 5,
      default: 5,
      index: true,
    },
    kycDetails: {
      idNumber: String,
      idImageUrl: String,
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    subscriptionTier: {
      type: String,
      enum: ['free', 'v3', 'v4', 'solo', 'smart', 'growth', 'mizigo', null],
      default: null,
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
    employer: {
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
    smsCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    staffRole: {
      type: String,
      enum: ['OWNER', 'CLERK'],
      default: 'OWNER',
    },
    sinkingFundBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    logisticsProfile: {
      verificationStatus: {
        type: String,
        enum: ['unverified', 'pending', 'verified', 'rejected'],
        default: 'unverified',
      },
      documentType: {
        type: String,
        enum: ['national_id', 'business_permit'],
        default: null,
      },
      documentNumber: String,
      vehiclePlate: String,
      cargoCapacityKg: {
        type: Number,
        min: 0,
      },
      driverMode: {
        type: String,
        enum: ['owner_operator', 'hired_driver'],
      },
      fleetOwner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      isOnline: {
        type: Boolean,
        default: false,
      },
      currentLocation: {
        lat: { type: Number },
        lng: { type: Number },
        accuracy: { type: Number },
        heading: { type: Number },
        speed: { type: Number },
        updatedAt: { type: Date },
      },
      location: {
        type: {
          type: String,
          enum: ['Point'],
        },
        coordinates: {
          type: [Number],
          default: undefined,
          validate: {
            validator: function (value) {
              return isValidOptionalGeoCoordinates(value);
            },
            message: 'Logistics location coordinates must contain [longitude, latitude]',
          },
        },
      },
      verifiedAt: Date,
      applicationSubmittedAt: Date,
      reviewedAt: Date,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reviewNotes: String,
      documents: [
        {
          documentType: {
            type: String,
            enum: ['national_id', 'business_permit'],
          },
          url: String,
          publicId: String,
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
        validate: {
          validator: function (value) {
            return isValidOptionalGeoCoordinates(value);
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
UserSchema.index(
  { location: '2dsphere' },
  { partialFilterExpression: { 'location.type': 'Point' } }
);
UserSchema.index({ role: 1, subscriptionTier: 1 });

module.exports = mongoose.model('User', UserSchema);
