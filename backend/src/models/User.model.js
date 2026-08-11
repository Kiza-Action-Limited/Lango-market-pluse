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
    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
      index: true,
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
    profileImageUrl: {
      type: String,
      default: null,
      trim: true,
    },
    locationHub: {
      type: String,
      trim: true,
      maxlength: [120, 'Location hub cannot exceed 120 characters'],
      default: '',
    },
    city: {
      type: String,
      trim: true,
      maxlength: [120, 'City cannot exceed 120 characters'],
      default: '',
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
    adminDocuments: [
      {
        documentType: {
          type: String,
          enum: ['national_id', 'business_permit', 'tax_certificate', 'kyc', 'contract', 'receipt', 'other'],
          default: 'other',
        },
        title: {
          type: String,
          trim: true,
          maxlength: 160,
        },
        notes: {
          type: String,
          trim: true,
          maxlength: 500,
        },
        documentNumber: {
          type: String,
          trim: true,
          maxlength: 120,
        },
        source: {
          type: String,
          trim: true,
          default: 'admin_saved',
        },
        originalName: String,
        mimeType: String,
        size: Number,
        url: String,
        publicId: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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
        enum: ['national_id', 'business_permit', 'driver_license', 'vehicle_logbook', 'insurance_certificate', 'kra_pin_certificate', 'tax_certificate', 'other'],
        default: null,
      },
      documentNumber: String,
      baseHub: {
        type: String,
        trim: true,
        maxlength: [120, 'Base hub cannot exceed 120 characters'],
        default: '',
      },
      locationHub: {
        type: String,
        trim: true,
        maxlength: [120, 'Location hub cannot exceed 120 characters'],
        default: '',
      },
      operatingAddress: {
        type: String,
        trim: true,
        maxlength: [240, 'Operating address cannot exceed 240 characters'],
        default: '',
      },
      serviceAreas: [
        {
          type: String,
          trim: true,
          maxlength: 80,
        },
      ],
      vehicleType: {
        type: String,
        trim: true,
        maxlength: [80, 'Vehicle type cannot exceed 80 characters'],
        default: '',
      },
      fleetSize: {
        type: Number,
        min: 1,
        default: 1,
      },
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
      reviewDueAt: Date,
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
            enum: ['national_id', 'business_permit', 'driver_license', 'vehicle_logbook', 'insurance_certificate', 'kra_pin_certificate', 'tax_certificate', 'other'],
          },
          documentNumber: String,
          originalName: String,
          mimeType: String,
          size: Number,
          url: String,
          publicId: String,
          source: {
            type: String,
            default: 'logistics_application',
          },
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    sellerLogisticsAddon: {
      active: {
        type: Boolean,
        default: false,
      },
      planId: {
        type: String,
        enum: ['mizigo'],
        default: 'mizigo',
      },
      sellerHub: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
      },
      selectedProvider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      selectedProviderSnapshot: {
        name: String,
        phone: String,
        email: String,
        hub: String,
        vehiclePlate: String,
        cargoCapacityKg: Number,
        verificationStatus: String,
      },
      activatedAt: Date,
      pausedAt: Date,
      updatedAt: Date,
    },
    buyerLogisticsPreference: {
      active: {
        type: Boolean,
        default: false,
      },
      selectedProvider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      selectedProviderSnapshot: {
        name: String,
        phone: String,
        email: String,
        hub: String,
        vehiclePlate: String,
        vehicleType: String,
        cargoCapacityKg: Number,
        verificationStatus: String,
      },
      deliveryHub: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
      },
      notes: {
        type: String,
        trim: true,
        maxlength: 300,
        default: '',
      },
      updatedAt: Date,
    },
    premiumVerification: {
      storefrontName: {
        type: String,
        trim: true,
        maxlength: 120,
      },
      governmentBusinessName: {
        type: String,
        trim: true,
        maxlength: 160,
      },
      businessEmail: {
        type: String,
        trim: true,
        lowercase: true,
      },
      businessUrls: [
        {
          type: String,
          trim: true,
        },
      ],
      planId: {
        type: String,
        trim: true,
        maxlength: 80,
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
      },
      submittedAt: Date,
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
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastLogin: Date,
  },
  {
    timestamps: true,
  }
);

const clearBuyerBusinessFields = (target) => {
  if (!target || !['buyer', 'consumer'].includes(String(target.role || '').trim().toLowerCase())) return;
  target.businessName = null;
  target.businessType = null;
  target.businessLogoUrl = null;
};

UserSchema.pre('validate', function clearBuyerBusinessProfile(next) {
  clearBuyerBusinessFields(this);
  next();
});

const clearBuyerBusinessUpdate = function clearBuyerBusinessProfileUpdate(next) {
  const update = this.getUpdate() || {};
  const directRole = update.role;
  const setRole = update.$set?.role;
  const nextRole = String(setRole || directRole || '').trim().toLowerCase();

  if (['buyer', 'consumer'].includes(nextRole)) {
    if (update.$set || update.$unset) {
      update.$set = {
        ...(update.$set || {}),
        businessName: null,
        businessType: null,
        businessLogoUrl: null,
      };
    } else {
      update.businessName = null;
      update.businessType = null;
      update.businessLogoUrl = null;
    }
    this.setUpdate(update);
  }

  next();
};

UserSchema.pre('findOneAndUpdate', clearBuyerBusinessUpdate);
UserSchema.pre('updateOne', clearBuyerBusinessUpdate);
UserSchema.pre('updateMany', clearBuyerBusinessUpdate);

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
UserSchema.index({ 'sellerLogisticsAddon.active': 1, 'sellerLogisticsAddon.selectedProvider': 1 });

module.exports = mongoose.model('User', UserSchema);
