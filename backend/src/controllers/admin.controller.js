const User = require('../models/User.model');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const Category = require('../models/Category.model');
const Transaction = require('../models/Transaction.model');
const Logistics = require('../models/Logistics.model');
const Escrow = require('../models/Escrow.model');
const Analytics = require('../models/Analytics.model');
const Subscription = require('../models/Subscription.model');
const SubscriptionFeature = require('../models/SubscriptionFeature.model');
const AgentReferral = require('../models/AgentReferral.model');
const SupportMessage = require('../models/SupportMessage.model');
const Payment = require('../models/Payment.model');
const Review = require('../models/Review.model');
const RFQ = require('../models/RFQ.model');
const billingService = require('../services/subscription/billing.service');
const escrowService = require('../services/order/escrow.service');
const auditService = require('../services/audit.service');
const trustPolicy = require('../services/trustPolicy.service');
const notificationService = require('../services/notification/notification.service');
const emailService = require('../services/notification/email.service');
const smsService = require('../services/notification/sms.service');
const { uploadToCloudinary } = require('../config/cloudinary.config');
const { PLAN_IDS, PLANS, PRODUCT_LIMITS, normalizePlanId } = require('../config/subscriptionPlans');
const planService = require('../services/subscription/plan.service');
const { dateStamp, displayName, docId, sendCsv } = require('../utils/csvExport');
const { getEffectiveUserCategory, isSellerUser } = require('../utils/userCategory');
const { validationResult } = require('express-validator');
const marketingController = require('./marketing.controller');

const getDocId = (value) => value?._id || value?.id || value;

const ADMIN_PRODUCT_LIMITS = {
  none: PRODUCT_LIMITS.FREE,
  free: PRODUCT_LIMITS.FREE,
  v3: PRODUCT_LIMITS[PLAN_IDS.SMART],
  v4: PRODUCT_LIMITS[PLAN_IDS.GROWTH],
  [PLAN_IDS.SOLO]: PRODUCT_LIMITS[PLAN_IDS.SOLO],
  [PLAN_IDS.SMART]: PRODUCT_LIMITS[PLAN_IDS.SMART],
  [PLAN_IDS.GROWTH]: PRODUCT_LIMITS[PLAN_IDS.GROWTH],
  [PLAN_IDS.MIZIGO]: PRODUCT_LIMITS[PLAN_IDS.MIZIGO],
};

const PRODUCT_CATEGORIES = new Set([
  'electronics',
  'fashion',
  'home-garden',
  'beauty-health',
  'sports-outdoor',
  'grocery',
  'vegetables',
  'grains-cereals',
  'food-staples',
  'sugar-baking',
  'cooking-oil',
  'dairy-eggs',
  'meat-fish',
  'beverages',
  'household',
  'farm-inputs',
  'other',
]);

const PRODUCT_UNITS = new Set(['kg', 'g', 'ton', 'piece', 'bunch', 'litre']);
const PRODUCT_WAREHOUSE_STATUSES = new Set(['seller_storage', 'warehouse_pending', 'warehouse_received', 'dispatch_ready', 'restricted']);

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeInt = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on', 'active', 'published'].includes(String(value).trim().toLowerCase());
};

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizePriceTiers = (value) => {
  const parsed = parseJsonField(value, []);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((tier) => ({
      minQuantity: parsePositiveInt(tier?.minQuantity, 0),
      unitPrice: Number(tier?.unitPrice),
      label: String(tier?.label || '').trim(),
    }))
    .filter((tier) => tier.minQuantity > 0 && Number.isFinite(tier.unitPrice) && tier.unitPrice >= 0)
    .sort((a, b) => a.minQuantity - b.minQuantity);
};

const normalizeWarehouseStatus = (value, fallback = 'seller_storage') => {
  const normalized = String(value || '').trim().toLowerCase();
  return PRODUCT_WAREHOUSE_STATUSES.has(normalized) ? normalized : fallback;
};

const normalizeWholesalePayload = (body = {}, existing = {}) => {
  const nested = parseJsonField(body.wholesale, {});
  const source = nested && typeof nested === 'object' ? nested : {};
  const existingWholesale = existing && typeof existing === 'object' ? existing : {};

  return {
    minimumOrderQuantity: parsePositiveInt(
      body.minimumOrderQuantity ?? body.moq ?? source.minimumOrderQuantity ?? source.moq,
      existingWholesale.minimumOrderQuantity || 1
    ),
    rfqEnabled: parseBoolean(
      body.rfqEnabled ?? source.rfqEnabled,
      existingWholesale.rfqEnabled !== undefined ? existingWholesale.rfqEnabled : true
    ),
    terms: String(body.wholesaleTerms ?? source.terms ?? existingWholesale.terms ?? '').trim(),
    priceTiers: normalizePriceTiers(body.priceTiers ?? source.priceTiers ?? existingWholesale.priceTiers ?? []),
  };
};

const LOW_STOCK_SENSITIVITY_RULES = [
  { threshold: 50, terms: ['maize', 'corn', 'unga', 'posho', 'grains-cereals', 'food-staples'] },
  { threshold: 45, terms: ['sugar', 'jaggery', 'sugar-baking'] },
  { threshold: 40, terms: ['rice', 'beans', 'wheat', 'flour', 'millet', 'sorghum'] },
  { threshold: 25, terms: ['cooking oil', 'oil', 'cooking-oil'] },
  { threshold: 20, terms: ['milk', 'dairy', 'eggs', 'dairy-eggs'] },
  { threshold: 18, terms: ['vegetables', 'tomato', 'onion', 'potato', 'cabbage', 'fresh'] },
  { threshold: 15, terms: ['beverage', 'water', 'juice', 'soda', 'beverages'] },
  { threshold: 12, terms: ['household', 'soap', 'detergent', 'tissue'] },
  { threshold: 10, terms: ['farm-inputs', 'seed', 'fertilizer', 'feed'] },
];

const getAutoLowStockThreshold = (product = {}) => {
  const haystack = `${product.name || ''} ${product.category || ''}`.toLowerCase();
  const matchedRule = LOW_STOCK_SENSITIVITY_RULES.find((rule) => (
    rule.terms.some((term) => haystack.includes(term))
  ));

  return matchedRule?.threshold || 10;
};

const normalizeProductImageUrls = (value, existingCount = 0) => {
  const parsed = parseJsonField(value, value);
  const rawUrls = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'string'
      ? parsed.split(/[|,\n\r]+/)
      : [];
  const availableSlots = Math.max(0, 10 - existingCount);
  const seen = new Set();

  return rawUrls
    .map((image) => (typeof image === 'string' ? image : image?.url))
    .map((url) => String(url || '').trim())
    .filter((url) => {
      if (!url || url.startsWith('blob:') || seen.has(url)) return false;
      try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false;
      } catch {
        return false;
      }
      seen.add(url);
      return true;
    })
    .slice(0, availableSlots)
    .map((url) => ({ url }));
};

const uploadAdminProductImages = async (files = [], sellerId) => {
  if (!Array.isArray(files) || files.length === 0) return [];

  const folder = `products/${sellerId}`;
  return Promise.all(files.map(async (file) => {
    const result = await uploadToCloudinary(file.buffer, folder, file.mimetype);
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }));
};

const getAdminEffectivePlan = async (sellerId) => {
  try {
    const subscription = await planService.getUserSubscription(sellerId);
    if (planService.isSubscriptionActive(subscription)) {
      if (subscription.plan === 'free') return 'free';
      return normalizePlanId(subscription.plan);
    }
    return null;
  } catch (error) {
    console.error('Error getting seller plan for admin product creation:', error);
    return null;
  }
};

const getAdminProductLimitForPlan = (plan) => ADMIN_PRODUCT_LIMITS[plan || 'none'] ?? 0;

const buildAdminProductLimitMessage = (plan, productLimit, sellerName = 'Seller') => {
  if (!plan || plan === 'free') {
    return `${sellerName} has reached the free ${productLimit} product limit. Upgrade their subscription to add more products.`;
  }

  const readableLimit = Number.isFinite(productLimit) ? productLimit.toLocaleString() : 'unlimited';
  return `${sellerName} has reached the ${String(plan).toUpperCase()} product limit (${readableLimit}).`;
};

const getOrderLabel = (order) => order?.orderNumber || `ORD-${String(order?._id || '').slice(-8).toUpperCase()}`;

const readableStatus = (status) => String(status || '')
  .replaceAll('_', ' ')
  .toLowerCase()
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatCurrencyLocal = (amount, currency = 'KES') => `${currency} ${Number(amount || 0).toLocaleString('en-KE', {
  maximumFractionDigits: 0,
})}`;

const createOrderNotification = async (userId, { title, body, order, event, data = {} }) => {
  if (!userId) return null;

  try {
    return await notificationService.create(userId, {
      type: 'in_app',
      channel: 'order_update',
      title,
      body,
      status: 'pending',
      data: {
        orderId: String(order?._id || ''),
        orderNumber: getOrderLabel(order),
        productId: String(getDocId(order?.product) || ''),
        status: order?.status,
        event,
        ...data,
      },
    });
  } catch (error) {
    console.warn('Admin order notification failed:', error.message);
    return null;
  }
};

const sendAdminSmsToUser = async (user, message, context = 'admin SMS') => {
  const phone = user?.phone;
  if (!phone || !message) return null;

  try {
    return await smsService.sendToPhone(phone, message);
  } catch (error) {
    console.warn(`${context} failed:`, error.message);
    return null;
  }
};

const notifyAdminOrderStatusUpdate = async (order, previousStatus, notes) => {
  const populatedOrder = await Order.findById(order._id)
    .populate('buyer', 'fullName phone')
    .populate('seller', 'fullName phone')
    .populate('product', 'name images');
  const targetOrder = populatedOrder || order;
  const statusLabel = readableStatus(targetOrder.status);
  const buyerId = getDocId(targetOrder.buyer);
  const sellerId = getDocId(targetOrder.seller);

  await Promise.all([
    createOrderNotification(buyerId, {
      event: 'admin_order_status_updated',
      title: `Order ${getOrderLabel(targetOrder)} is ${statusLabel}`,
      body: `Your order status changed to ${statusLabel}.`,
      order: targetOrder,
      data: {
        href: `/orders/${targetOrder._id}/track`,
        previousStatus,
        notes: notes || '',
      },
    }),
    sellerId && String(sellerId) !== String(buyerId) ? createOrderNotification(sellerId, {
      event: 'admin_order_status_updated',
      title: `Order ${getOrderLabel(targetOrder)} updated`,
      body: `Order status changed to ${statusLabel}.`,
      order: targetOrder,
      data: {
        href: '/seller/orders',
        previousStatus,
        notes: notes || '',
      },
    }) : null,
  ]);
};

const compactSkuCode = (value, fallback = 'GEN') => {
  const normalized = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return fallback;
  const withoutVowels = normalized.replace(/[AEIOU]/g, '');
  return (withoutVowels || normalized).slice(0, 3).padEnd(3, 'X');
};

const buildTrackingSku = (product) => {
  if (product.sku) return product.sku;

  const location = compactSkuCode(product.locationHub, 'ORG');
  const category = compactSkuCode(product.category, 'CAT');
  const productCode = compactSkuCode(product.name, 'PRD');
  const quantity = Math.max(1, Math.round(Number(product.quantityAvailable || product.stock || 0)));
  const unit = String(product.unit || 'UNIT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'UNIT';
  const suffix = String(product._id || '').slice(-4).toUpperCase();

  return `${location}-${category}-${productCode}-${quantity}${unit}${suffix ? `-${suffix}` : ''}`;
};

const appendInventoryFields = (product) => {
  if (!product) return product;
  const raw = product.toObject ? product.toObject() : product;
  const quantityAvailable = Number(raw.quantityAvailable ?? raw.stock ?? 0);
  const reservedQuantity = Number(raw.reservedQuantity || 0);
  const history = Array.isArray(raw.inventoryHistory) ? raw.inventoryHistory : [];
  const sku = buildTrackingSku(raw);

  return {
    ...raw,
    sku,
    trackingSku: sku,
    stock: quantityAvailable,
    availableQuantity: Math.max(0, quantityAvailable - reservedQuantity),
    inventoryGraph: history.length
      ? history.map((entry) => ({
          onHand: Number(entry.onHand || 0),
          reserved: Number(entry.reserved || 0),
          available: Number(entry.available || 0),
          unit: entry.unit || raw.unit,
          event: entry.event,
          recordedAt: entry.recordedAt,
        }))
      : [{
          onHand: quantityAvailable,
          reserved: reservedQuantity,
          available: Math.max(0, quantityAvailable - reservedQuantity),
          unit: raw.unit,
          event: 'created',
          recordedAt: raw.createdAt || new Date(),
        }],
  };
};

const getAdminTargetQuery = ({ targetRole, targetUserType }) => {
  const query = { role: { $ne: 'admin' } };
  if (targetRole && targetRole !== 'all') {
    if (targetRole === 'seller') {
      query.$or = [
        { role: { $in: ['seller', 'farmer'] } },
        { businessType: { $in: ['brand', 'wholesaler', 'manufacturer', 'retailer', 'farmer', 'small_business'] } },
      ];
    } else if (targetRole === 'consumer') {
      query.$or = [{ role: 'buyer' }, { businessType: 'consumer' }];
    } else {
      query.$or = [{ role: targetRole }, { businessType: targetRole }];
    }
  }
  if (targetUserType && targetUserType !== 'all') {
    query.userType = targetUserType;
  }
  return query;
};

const escapeEmailHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

const isMongoId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

const buildUserDocumentList = (user = {}) => {
  const documents = [];
  const addDocument = (doc, source, defaults = {}) => {
    const url = doc?.url || doc?.idImageUrl || defaults.url || '';
    const hasFile = Boolean(url || doc?.publicId);
    const hasMetadata = Boolean(
      doc?.documentType ||
      doc?.documentNumber ||
      doc?.title ||
      doc?.originalName ||
      doc?.mimeType ||
      defaults.documentType ||
      defaults.title
    );
    if (!hasFile && !hasMetadata) return;

    documents.push({
      _id: doc._id,
      source,
      documentType: doc.documentType || defaults.documentType || 'other',
      documentNumber: doc.documentNumber || defaults.documentNumber || '',
      title: doc.title || defaults.title || doc.originalName || 'Saved document',
      notes: doc.notes || defaults.notes || '',
      originalName: doc.originalName || defaults.originalName || '',
      mimeType: doc.mimeType || defaults.mimeType || '',
      size: doc.size || null,
      url,
      publicId: doc.publicId || '',
      hasFile,
      uploadedBy: doc.uploadedBy || doc.verifiedBy || defaults.uploadedBy || null,
      uploadedAt: doc.uploadedAt || doc.verifiedAt || defaults.uploadedAt || null,
    });
  };

  (Array.isArray(user.adminDocuments) ? user.adminDocuments : []).forEach((doc) => {
    addDocument(doc, 'admin_saved', { title: 'Admin saved document' });
  });

  (Array.isArray(user.logisticsProfile?.documents) ? user.logisticsProfile.documents : []).forEach((doc) => {
    addDocument(doc, 'logistics_application', { title: 'Logistics application document' });
  });

  if (user.logisticsProfile?.documentType || user.logisticsProfile?.documentNumber) {
    addDocument({
      documentType: user.logisticsProfile.documentType,
      documentNumber: user.logisticsProfile.documentNumber,
      uploadedAt: user.logisticsProfile.applicationSubmittedAt || user.logisticsProfile.reviewedAt,
      uploadedBy: user.logisticsProfile.reviewedBy,
    }, 'logistics_profile', {
      title: 'Logistics verification record',
      notes: user.logisticsProfile.reviewNotes || '',
    });
  }

  if (user.kycDetails?.idImageUrl) {
    addDocument(user.kycDetails, 'kyc', {
      documentType: 'kyc',
      title: 'KYC identity image',
      originalName: 'KYC identity image',
      uploadedAt: user.kycDetails.verifiedAt,
      uploadedBy: user.kycDetails.verifiedBy,
    });
  }

  if (user.kycDetails?.idNumber && !user.kycDetails?.idImageUrl) {
    addDocument({
      documentType: 'kyc',
      documentNumber: user.kycDetails.idNumber,
      uploadedAt: user.kycDetails.verifiedAt,
      uploadedBy: user.kycDetails.verifiedBy,
    }, 'kyc', {
      title: 'KYC identity record',
      notes: `KYC status: ${user.verificationStatus || (user.kycVerified ? 'verified' : 'unverified')}`,
    });
  }

  return documents.sort((left, right) => new Date(right.uploadedAt || 0) - new Date(left.uploadedAt || 0));
};

exports.getHomepageAds = marketingController.getAdminHomepageAds;

exports.updateHomepageAds = marketingController.updateAdminHomepageAds;

exports.uploadHomepageAdImage = async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }

    const placement = String(req.body.placement || 'homepage').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'homepage';
    const result = await uploadToCloudinary(req.file.buffer, `admin/marketing/${placement}`, req.file.mimetype);

    res.status(201).json({
      success: true,
      message: 'Ad image uploaded successfully',
      data: {
        imageUrl: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error) {
    next(error);
  }
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getCoordinatePair = (source = {}) => {
  const lat = toFiniteNumber(source.lat ?? source.gpsLat);
  const lng = toFiniteNumber(source.lng ?? source.gpsLng);
  return lat !== null && lng !== null ? { lat, lng } : null;
};

const getFirstCoordinatePair = (...sources) => {
  for (const source of sources) {
    const coords = getCoordinatePair(source);
    if (coords) return coords;
  }
  return null;
};

const buildGoogleMapsUrl = (points = []) => {
  const validPoints = points.filter((point) => point?.lat !== undefined && point?.lng !== undefined);
  if (!validPoints.length) return null;
  if (validPoints.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${validPoints[0].lat},${validPoints[0].lng}`;
  }
  const [origin, ...rest] = validPoints;
  const destination = rest[rest.length - 1];
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
};

const buildGoogleMapsEmbedUrl = (points = []) => {
  const validPoints = points.filter((point) => point?.lat !== undefined && point?.lng !== undefined);
  if (!validPoints.length) return null;
  const target = validPoints.find((point) => point.label === 'driver') || validPoints[validPoints.length - 1];
  return `https://maps.google.com/maps?q=${target.lat},${target.lng}&z=13&output=embed`;
};

const serializeEscrowSnapshot = (escrow) => {
  if (!escrow) return null;
  return {
    _id: escrow._id,
    order: escrow.order,
    logistics: escrow.logistics,
    status: escrow.status,
    amount: Number(escrow.amount || 0),
    currency: escrow.currency || 'KES',
    platformFee: Number(escrow.platformFee || 0),
    sellerPayout: Number(escrow.sellerPayout || 0),
    driverPayout: Number(escrow.driverPayout || 0),
    sinkingFundAmount: Number(escrow.sinkingFundAmount || 0),
    refundAmount: Number(escrow.refundAmount || 0),
    paidAt: escrow.paidAt,
    heldAt: escrow.heldAt,
    deliveredAt: escrow.deliveredAt,
    autoReleaseAt: escrow.autoReleaseAt,
    releasedAt: escrow.releasedAt,
    payouts: Array.isArray(escrow.payouts) ? escrow.payouts : [],
  };
};

const buildAdminLogisticsSnapshot = (trip, escrow = null) => {
  const raw = trip?.toObject ? trip.toObject({ virtuals: true }) : trip;
  if (!raw) return null;

  const pickupCoords = getCoordinatePair(raw.pickupAddress);
  const deliveryCoords = getCoordinatePair(raw.shippingAddress);
  const driverProfileLocation = raw.driver?.logisticsProfile?.currentLocation;
  const driverCoords = getFirstCoordinatePair(raw.gpsTracking?.current, driverProfileLocation);
  const trackingPath = (Array.isArray(raw.gpsTracking?.history) ? raw.gpsTracking.history : [])
    .slice(-50)
    .map((entry) => ({
      lat: toFiniteNumber(entry.location?.lat),
      lng: toFiniteNumber(entry.location?.lng),
      accuracy: entry.accuracy,
      speed: entry.speed,
      heading: entry.heading,
      timestamp: entry.timestamp,
    }))
    .filter((point) => point.lat !== null && point.lng !== null);
  const routePath = [
    pickupCoords ? { ...pickupCoords, label: 'pickup' } : null,
    ...trackingPath.map((point) => ({ ...point, label: 'history' })),
    driverCoords ? { ...driverCoords, label: 'driver' } : null,
    deliveryCoords ? { ...deliveryCoords, label: 'delivery' } : null,
  ].filter(Boolean);
  const qrScans = Array.isArray(raw.qrScans) ? raw.qrScans : [];
  const pickupScan = qrScans.find((scan) => scan.step === 'pickup' && scan.verified !== false);
  const deliveryScan = qrScans.find((scan) => scan.step === 'delivery' && scan.verified !== false);
  const trust = trustPolicy.buildTrustChecks({ order: raw.order, logistics: raw, escrow });

  return {
    ...raw,
    orderNumber: raw.orderNumber || raw.order?.orderNumber,
    customer: raw.order?.buyer || raw.buyer || null,
    escrow: serializeEscrowSnapshot(escrow),
    liveTracking: {
      pickup: pickupCoords,
      delivery: deliveryCoords,
      driver: driverCoords,
      history: trackingPath,
      routePath,
      lastUpdate: raw.gpsTracking?.current?.lastUpdate || trackingPath[trackingPath.length - 1]?.timestamp || raw.updatedAt,
      googleMapsUrl: buildGoogleMapsUrl(routePath.length ? routePath : [pickupCoords, deliveryCoords]),
      embedUrl: buildGoogleMapsEmbedUrl(routePath.length ? routePath : [pickupCoords, deliveryCoords]),
    },
    qr: {
      pickupConfirmed: Boolean(pickupScan || raw.pickupQrConfirmed),
      deliveryConfirmed: Boolean(deliveryScan || raw.deliveryQrConfirmed),
      pickupAt: pickupScan?.scannedAt || raw.pickupQrScannedAt || null,
      deliveryAt: deliveryScan?.scannedAt || raw.deliveryQrScannedAt || null,
      nextStep: !pickupScan ? 'pickup' : !deliveryScan ? 'delivery' : 'complete',
      scans: qrScans,
    },
    trust,
  };
};

const normalizeFeatureKey = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const serializeSubscriptionFeature = (feature) => {
  const raw = feature?.toObject ? feature.toObject() : feature;
  if (!raw) return null;
  return {
    _id: raw._id,
    id: raw._id,
    key: raw.key,
    label: raw.label,
    description: raw.description || '',
    category: raw.category || 'seller_tools',
    planIds: Array.isArray(raw.planIds) ? raw.planIds : [],
    isActive: raw.isActive !== false,
    sortOrder: Number(raw.sortOrder || 0),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy,
    updatedBy: raw.updatedBy,
  };
};

/**
 * Get comprehensive system statistics
 * GET /api/v1/admin/stats
 */
exports.getStats = async (req, res, next) => {
  try {
    const orderStatusGroups = {
      pending: ['pending', 'pending_payment', 'AWAITING_PAYMENT'],
      processing: ['processing', 'payment_escrowed', 'FUNDS_HELD'],
      shipped: ['shipped', 'dispatched', 'IN_TRANSIT'],
      delivered: ['delivered', 'completed', 'DELIVERED', 'RELEASED'],
      cancelled: ['cancelled', 'REFUNDED', 'EXPIRED'],
      disputed: ['disputed', 'DISPUTED'],
    };
    const activeLogisticsStatuses = ['driver_assigned', 'en_route_to_pickup', 'picked_up', 'in_transit', 'out_for_delivery'];
    const revenueExcludedStatuses = ['cancelled', 'REFUNDED', 'EXPIRED', 'refunded'];

    const [
      totalUsers,
      farmers,
      wholesalers,
      retailers,
      consumers,
      logisticsUsers,
      blockedUsers,
      phoneVerifiedUsers,
      phoneUnverifiedUsers,
      kycVerifiedUsers,
      kycPendingUsers,
      totalProducts,
      activeProducts,
      inactiveProducts,
      outOfStock,
      lowStockProducts,
      totalCategories,
      activeCategories,
      inactiveCategories,
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      disputedOrders,
      revenueResult,
      paymentStats,
      transactionStats,
      totalLogistics,
      activeDeliveries,
      completedDeliveries,
      logisticsNeedingQr,
      logisticsWithGps,
      escrowStats,
      subscriptionStats,
      activeSubscriptionFeatures,
      supportStats,
      urgentSupportCount,
      documentStats,
      recentOrders,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ $or: [{ role: 'farmer' }, { businessType: 'farmer' }] }),
      User.countDocuments({ businessType: 'wholesaler' }),
      User.countDocuments({ businessType: 'retailer' }),
      User.countDocuments({ $or: [{ role: 'buyer' }, { role: 'consumer' }, { businessType: 'consumer' }] }),
      User.countDocuments({ $or: [{ role: 'logistics' }, { businessType: 'logistics' }] }),
      User.countDocuments({ isBlocked: true }),
      User.countDocuments({ isPhoneVerified: true }),
      User.countDocuments({ isPhoneVerified: { $ne: true } }),
      User.countDocuments({ $or: [{ kycVerified: true }, { verificationStatus: { $in: ['verified', 'gold'] } }] }),
      User.countDocuments({ $or: [{ verificationStatus: { $in: ['pending', 'unverified'] } }, { kycVerified: { $ne: true } }] }),
      Product.countDocuments(),
      Product.countDocuments({ isPublished: true }),
      Product.countDocuments({ isPublished: false }),
      Product.countDocuments({ quantityAvailable: { $lte: 0 } }),
      Product.countDocuments({
        quantityAvailable: { $gt: 0 },
        $expr: { $lte: ['$quantityAvailable', { $ifNull: ['$minThreshold', 10] }] },
      }),
      Category.countDocuments(),
      Category.countDocuments({ isActive: true }),
      Category.countDocuments({ isActive: false }),
      Order.countDocuments(),
      Order.countDocuments({ status: { $in: orderStatusGroups.pending } }),
      Order.countDocuments({ status: { $in: orderStatusGroups.processing } }),
      Order.countDocuments({ status: { $in: orderStatusGroups.shipped } }),
      Order.countDocuments({ status: { $in: orderStatusGroups.delivered } }),
      Order.countDocuments({ status: { $in: orderStatusGroups.cancelled } }),
      Order.countDocuments({ status: { $in: orderStatusGroups.disputed } }),
      Order.aggregate([
        { $match: { status: { $nin: revenueExcludedStatuses } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$totalAmount' },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]),
      Logistics.countDocuments(),
      Logistics.countDocuments({ status: { $in: activeLogisticsStatuses } }),
      Logistics.countDocuments({ status: { $in: ['delivered', 'auto_released'] } }),
      Logistics.countDocuments({
        status: { $in: ['pending', 'driver_assigned', 'en_route_to_pickup', 'picked_up', 'in_transit', 'out_for_delivery'] },
        $or: [
          { qrScans: { $not: { $elemMatch: { step: 'pickup', verified: { $ne: false } } } } },
          { qrScans: { $not: { $elemMatch: { step: 'delivery', verified: { $ne: false } } } } },
        ],
      }),
      Logistics.countDocuments({ 'gpsTracking.current.lat': { $ne: null }, 'gpsTracking.current.lng': { $ne: null } }),
      Escrow.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
            platformFees: { $sum: '$platformFee' },
            sellerPayouts: { $sum: '$sellerPayout' },
            driverPayouts: { $sum: '$driverPayout' },
          },
        },
      ]),
      Subscription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$price' } } }]),
      SubscriptionFeature.countDocuments({ isActive: true }),
      SupportMessage.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      SupportMessage.countDocuments({ priority: { $in: ['high', 'urgent'] }, status: { $nin: ['resolved', 'closed'] } }),
      User.aggregate([
        {
          $project: {
            adminDocumentCount: { $size: { $ifNull: ['$adminDocuments', []] } },
            logisticsDocumentCount: { $size: { $ifNull: ['$logisticsProfile.documents', []] } },
            hasLogisticsRecord: {
              $cond: [
                {
                  $or: [
                    { $ne: [{ $ifNull: ['$logisticsProfile.documentType', ''] }, ''] },
                    { $ne: [{ $ifNull: ['$logisticsProfile.documentNumber', ''] }, ''] },
                  ],
                },
                1,
                0,
              ],
            },
            hasKycRecord: {
              $cond: [
                {
                  $or: [
                    { $ne: [{ $ifNull: ['$kycDetails.idImageUrl', ''] }, ''] },
                    { $ne: [{ $ifNull: ['$kycDetails.idNumber', ''] }, ''] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
        {
          $project: {
            count: {
              $add: [
                '$adminDocumentCount',
                '$logisticsDocumentCount',
                '$hasLogisticsRecord',
                '$hasKycRecord',
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            documents: { $sum: '$count' },
            usersWithDocuments: { $sum: { $cond: [{ $gt: ['$count', 0] }, 1, 0] } },
          },
        },
      ]),
      Order.find()
        .sort('-createdAt')
        .limit(5)
        .populate('buyer', 'fullName name email phone userType role businessType')
        .lean(),
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;
    const escrowTotals = escrowStats.reduce((acc, row) => {
      const key = row._id || 'unknown';
      acc.byStatus[key] = row;
      acc.totalCount += row.count || 0;
      acc.totalAmount += row.amount || 0;
      acc.platformFees += row.platformFees || 0;
      acc.sellerPayouts += row.sellerPayouts || 0;
      acc.driverPayouts += row.driverPayouts || 0;
      return acc;
    }, { byStatus: {}, totalCount: 0, totalAmount: 0, platformFees: 0, sellerPayouts: 0, driverPayouts: 0 });
    const subscriptionTotals = subscriptionStats.reduce((acc, row) => {
      const key = row._id || 'unknown';
      acc.byStatus[key] = row.count || 0;
      acc.revenue += row.revenue || 0;
      acc.total += row.count || 0;
      if (['active', 'trial'].includes(key)) acc.active += row.count || 0;
      return acc;
    }, { byStatus: {}, total: 0, active: 0, revenue: 0 });
    const supportTotals = supportStats.reduce((acc, row) => {
      acc[row._id || 'unknown'] = row.count || 0;
      return acc;
    }, {});
    const pendingTransactions = transactionStats.find((row) => row._id === 'pending') || { count: 0, amount: 0 };
    const heldEscrow = escrowTotals.byStatus.HELD || { count: 0, amount: 0 };
    const releaseEscrow = escrowTotals.byStatus.DELIVERED || { count: 0, amount: 0 };
    const marketplaceRevenue = totalRevenue;
    const subscriptionRevenue = subscriptionTotals.revenue || 0;
    const platformFeeRevenue = escrowTotals.platformFees || 0;
    const totalPlatformRevenue = marketplaceRevenue + subscriptionRevenue + platformFeeRevenue;
    const fulfillmentRate = totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0;
    const activeProductRate = totalProducts ? Math.round((activeProducts / totalProducts) * 100) : 0;
    const kycVerificationRate = totalUsers ? Math.round((kycVerifiedUsers / totalUsers) * 100) : 0;
    const gpsCoverageRate = totalLogistics ? Math.round((logisticsWithGps / totalLogistics) * 100) : 0;

    const recentActivity = recentOrders.map((order) => ({
      ...order,
      customer: order.buyer,
      total: order.totalAmount,
    }));
    const trustCandidateStatuses = [
      ...activeLogisticsStatuses,
      'delivered',
    ];
    const trustCandidates = await Logistics.find({ status: { $in: trustCandidateStatuses } })
      .sort({ updatedAt: -1 })
      .limit(120)
      .populate('order', 'orderNumber status totalAmount buyer seller logisticsFee')
      .populate('seller', 'fullName name businessName phone')
      .populate('buyer', 'fullName name phone')
      .populate('driver', 'fullName name phone role verificationStatus logisticsProfile.verificationStatus logisticsProfile.currentLocation')
      .lean({ virtuals: true });
    const trustEscrows = await Escrow.find({
      $or: [
        { logistics: { $in: trustCandidates.map((trip) => trip._id) } },
        { order: { $in: trustCandidates.map((trip) => getDocId(trip.order)).filter(Boolean) } },
      ],
    }).lean();
    const trustEscrowByLogistics = new Map(trustEscrows.filter((escrow) => escrow.logistics).map((escrow) => [String(escrow.logistics), escrow]));
    const trustEscrowByOrder = new Map(trustEscrows.filter((escrow) => escrow.order).map((escrow) => [String(escrow.order), escrow]));
    const trustRisks = trustCandidates
      .map((trip) => {
        const escrow = trustEscrowByLogistics.get(String(trip._id)) || trustEscrowByOrder.get(String(getDocId(trip.order) || ''));
        const trust = trustPolicy.buildTrustChecks({ order: trip.order, logistics: trip, escrow });
        const failedChecks = trust.checks.filter((check) => !check.passed);
        if (!failedChecks.length) return null;
        return {
          logisticsId: trip._id,
          orderId: getDocId(trip.order),
          orderNumber: trip.orderNumber || trip.order?.orderNumber,
          status: trip.status,
          seller: trip.seller?.businessName || trip.seller?.fullName || trip.seller?.name || 'Seller',
          buyer: trip.buyer?.fullName || trip.buyer?.name || 'Buyer',
          driver: trip.driver?.fullName || trip.driver?.name || trip.driverName || 'Driver pending',
          lastGpsUpdate: trust.lastGpsUpdate,
          blockingRiskCount: trust.blockingRiskCount,
          riskCount: trust.riskCount,
          failedChecks: failedChecks.map((check) => ({
            key: check.key,
            label: check.label,
            blocking: check.blocking,
          })),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.blockingRiskCount - a.blockingRiskCount) || (b.riskCount - a.riskCount))
      .slice(0, 12);
    const trustRiskTotals = trustRisks.reduce((acc, item) => {
      item.failedChecks.forEach((check) => {
        acc.byCheck[check.key] = (acc.byCheck[check.key] || 0) + 1;
      });
      if (item.blockingRiskCount > 0) acc.blocking += 1;
      return acc;
    }, { total: trustRisks.length, blocking: 0, byCheck: {} });

    const workQueues = [
      {
        key: 'verification',
        label: 'KYC and phone verification',
        value: kycPendingUsers + phoneUnverifiedUsers,
        detail: `${kycPendingUsers} KYC pending, ${phoneUnverifiedUsers} phone unverified`,
        route: '/admin/users',
        tone: 'amber',
      },
      {
        key: 'support',
        label: 'Admin messages',
        value: (supportTotals.pending_admin || 0) + (supportTotals.open || 0),
        detail: `${urgentSupportCount} high priority conversations`,
        route: '/admin/contact-queue',
        tone: urgentSupportCount ? 'red' : 'blue',
      },
      {
        key: 'products',
        label: 'Product review',
        value: inactiveProducts + outOfStock + lowStockProducts,
        detail: `${inactiveProducts} inactive, ${outOfStock} out of stock, ${lowStockProducts} low stock`,
        route: '/admin/products',
        tone: 'orange',
      },
      {
        key: 'logistics',
        label: 'Logistics action',
        value: activeDeliveries + logisticsNeedingQr,
        detail: `${activeDeliveries} active trips, ${logisticsNeedingQr} QR checks`,
        route: '/admin/logistics',
        tone: 'cyan',
      },
      {
        key: 'escrow',
        label: 'Escrow release queue',
        value: releaseEscrow.count || 0,
        detail: `${formatCurrencyLocal(releaseEscrow.amount || 0)} ready for review`,
        route: '/admin/finance-audit',
        tone: 'green',
      },
      {
        key: 'trust',
        label: 'Trust and proof risks',
        value: trustRiskTotals.total,
        detail: `${trustRiskTotals.blocking} blocking payout release, ${trustRiskTotals.byCheck.live_gps_after_pickup || 0} missing live GPS`,
        route: '/admin/logistics',
        tone: trustRiskTotals.blocking ? 'red' : trustRiskTotals.total ? 'amber' : 'green',
      },
    ];
    const platformUpdates = [
      {
        key: 'marketplace_revenue',
        label: 'Marketplace revenue',
        value: marketplaceRevenue,
        displayValue: formatCurrencyLocal(marketplaceRevenue),
        detail: `${totalOrders} orders, ${formatCurrencyLocal(totalOrders > 0 ? marketplaceRevenue / totalOrders : 0)} average order value`,
        tone: 'green',
      },
      {
        key: 'platform_income',
        label: 'Platform income',
        value: totalPlatformRevenue,
        displayValue: formatCurrencyLocal(totalPlatformRevenue),
        detail: `${formatCurrencyLocal(subscriptionRevenue)} subscriptions, ${formatCurrencyLocal(platformFeeRevenue)} platform fees`,
        tone: 'blue',
      },
      {
        key: 'escrow_control',
        label: 'Escrow control',
        value: escrowTotals.totalAmount || 0,
        displayValue: formatCurrencyLocal(escrowTotals.totalAmount || 0),
        detail: `${formatCurrencyLocal(heldEscrow.amount || 0)} held, ${formatCurrencyLocal(releaseEscrow.amount || 0)} ready to release`,
        tone: 'amber',
      },
      {
        key: 'platform_health',
        label: 'Platform health',
        value: fulfillmentRate,
        displayValue: `${fulfillmentRate}%`,
        detail: `${activeProductRate}% active products, ${kycVerificationRate}% KYC verified`,
        tone: 'orange',
      },
    ];

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          farmers,
          wholesalers,
          retailers,
          consumers,
          logistics: logisticsUsers,
          blocked: blockedUsers,
          phoneVerified: phoneVerifiedUsers,
          phoneUnverified: phoneUnverifiedUsers,
          kycVerified: kycVerifiedUsers,
          kycPending: kycPendingUsers,
        },
        products: { total: totalProducts, active: activeProducts, inactive: inactiveProducts, outOfStock, lowStock: lowStockProducts },
        categories: { total: totalCategories, active: activeCategories, inactive: inactiveCategories },
        orders: { total: totalOrders, pending: pendingOrders, processing: processingOrders, shipped: shippedOrders, delivered: deliveredOrders, cancelled: cancelledOrders, disputed: disputedOrders },
        revenue: { total: totalRevenue, averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0 },
        payments: paymentStats,
        logistics: {
          total: totalLogistics,
          activeDeliveries,
          completedDeliveries,
          needsQr: logisticsNeedingQr,
          gpsTracked: logisticsWithGps,
        },
        finance: {
          escrow: escrowTotals,
          pendingTransactions,
          heldEscrow,
          releaseEscrow,
          transactionStats,
        },
        platform: {
          name: 'Lango Market',
          marketplaceRevenue,
          subscriptionRevenue,
          platformFeeRevenue,
          totalPlatformRevenue,
          heldEscrowAmount: heldEscrow.amount || 0,
          releaseQueueAmount: releaseEscrow.amount || 0,
          pendingTransactionAmount: pendingTransactions.amount || 0,
          averageOrderValue: totalOrders > 0 ? marketplaceRevenue / totalOrders : 0,
          currency: 'KES',
          lastUpdated: new Date(),
        },
        subscriptions: {
          ...subscriptionTotals,
          activeFeatures: activeSubscriptionFeatures,
        },
        support: {
          byStatus: supportTotals,
          urgent: urgentSupportCount,
          open: (supportTotals.pending_admin || 0) + (supportTotals.open || 0),
        },
        documents: documentStats[0] || { documents: 0, usersWithDocuments: 0 },
        adminOverview: {
          workQueues,
          platformSummary: {
            name: 'Lango Market',
            headline: 'Lango Market Revenue Overview',
            totalPlatformRevenue,
            marketplaceRevenue,
            subscriptionRevenue,
            platformFeeRevenue,
            heldEscrowAmount: heldEscrow.amount || 0,
            releaseQueueAmount: releaseEscrow.amount || 0,
            activeUsers: totalUsers - blockedUsers,
            totalUsers,
            totalOrders,
            totalProducts,
            totalLogistics,
            currency: 'KES',
            lastUpdated: new Date(),
          },
          platformUpdates,
          health: {
            fulfillmentRate,
            activeProductRate,
            kycVerificationRate,
            gpsCoverageRate,
          },
          trust: {
            risks: trustRisks,
            totals: trustRiskTotals,
            rules: [
              'Verified logistics driver assigned',
              'Pickup QR confirmed with GPS',
              'Live GPS recorded after pickup',
              'Delivery QR confirmed with GPS',
              'Escrow release blocked until proof is complete unless admin override is justified',
            ],
          },
          modules: {
            users: { route: '/admin/users', attention: kycPendingUsers + blockedUsers },
            products: { route: '/admin/products', attention: inactiveProducts + outOfStock + lowStockProducts },
            categories: { route: '/admin/categories', attention: inactiveCategories },
            subscriptions: { route: '/admin/subscriptions', attention: activeSubscriptionFeatures },
            logistics: { route: '/admin/logistics', attention: activeDeliveries + logisticsNeedingQr },
            finance: { route: '/admin/finance-audit', attention: pendingTransactions.count + (releaseEscrow.count || 0) },
            messages: { route: '/admin/contact-queue', attention: urgentSupportCount + (supportTotals.pending_admin || 0) },
            documents: { route: '/admin/users', attention: documentStats[0]?.documents || 0 },
          },
        },
        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get users with advanced filtering
 * GET /api/v1/admin/users
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(limit) || 20));
    const andConditions = [{ role: { $ne: 'admin' } }];

    if (role && role !== 'all' && role !== 'admin') {
      if (['brand', 'wholesaler', 'manufacturer', 'retailer', 'farmer', 'small_business', 'logistics'].includes(role)) {
        andConditions.push({ $or: [{ role }, { businessType: role }] });
      } else if (role === 'consumer') {
        andConditions.push({ $or: [{ role: 'buyer' }, { role: 'consumer' }, { businessType: 'consumer' }] });
      } else {
        andConditions.push({ role });
      }
    }
    if (status === 'active') andConditions.push({ isBlocked: { $ne: true } });
    if (status === 'blocked') andConditions.push({ isBlocked: true });
    if (status === 'phone_verified') andConditions.push({ isPhoneVerified: true });
    if (status === 'phone_unverified') andConditions.push({ isPhoneVerified: { $ne: true } });
    if (status === 'email_verified') andConditions.push({ isEmailVerified: true });
    if (status === 'email_unverified') andConditions.push({ isEmailVerified: { $ne: true } });
    if (status === 'kyc_verified') andConditions.push({ $or: [{ kycVerified: true }, { verificationStatus: { $in: ['verified', 'gold'] } }] });
    if (['unverified', 'pending', 'verified', 'gold', 'rejected', 'restricted'].includes(status)) {
      andConditions.push({ verificationStatus: status });
    }
    
    if (search) {
      andConditions.push({ $or: [
        { name: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } },
        { locationHub: { $regex: search, $options: 'i' } },
      ] });
    }

    const query = { $and: andConditions };
    
    const [users, total, summaryRows, documentUsers] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort('-createdAt')
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      User.countDocuments(query),
      User.aggregate([
        { $match: { role: { $ne: 'admin' } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $ne: ['$isBlocked', true] }, 1, 0] } },
            blocked: { $sum: { $cond: ['$isBlocked', 1, 0] } },
            buyers: { $sum: { $cond: [{ $eq: ['$role', 'buyer'] }, 1, 0] } },
            sellers: { $sum: { $cond: [{ $in: ['$role', ['seller', 'farmer']] }, 1, 0] } },
            logistics: { $sum: { $cond: [{ $eq: ['$role', 'logistics'] }, 1, 0] } },
            admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
            phoneVerified: { $sum: { $cond: ['$isPhoneVerified', 1, 0] } },
            emailVerified: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
            kycVerified: { $sum: { $cond: [{ $or: ['$kycVerified', { $in: ['$verificationStatus', ['verified', 'gold']] }] }, 1, 0] } },
            kycPending: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'pending'] }, 1, 0] } },
            documents: { $sum: { $size: { $ifNull: ['$adminDocuments', []] } } },
          },
        },
      ]),
      User.find({ role: { $ne: 'admin' } })
        .select('adminDocuments logisticsProfile kycDetails kycVerified verificationStatus')
        .lean(),
    ]);

    const documentCountsForSummary = documentUsers.map((user) => buildUserDocumentList(user).length);
    const documentListForSummary = documentCountsForSummary.reduce((sum, count) => sum + count, 0);
    const summary = {
      ...(summaryRows[0] || {
        total: 0,
        active: 0,
        blocked: 0,
        buyers: 0,
        sellers: 0,
        logistics: 0,
        admins: 0,
        phoneVerified: 0,
        emailVerified: 0,
        kycVerified: 0,
        kycPending: 0,
      }),
      documents: documentListForSummary,
      usersWithDocuments: documentCountsForSummary.filter((count) => count > 0).length,
    };

    const usersWithDocumentCount = users.map((user) => ({
      ...user,
      documentCount: buildUserDocumentList(user).length,
    }));
    
    res.status(200).json({
      success: true,
      users: usersWithDocumentCount,
      summary,
      pagination: { page: pageNumber, limit: pageSize, total, pages: Math.ceil(total / pageSize) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user details with analytics
 * GET /api/v1/admin/users/:userId
 */
exports.getUserDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select('-password').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin account details are only available from Admin Profile' });
    }
    const userId = user._id;
    
    const orderMatch = { $or: [{ buyer: userId }, { seller: userId }] };
    const [orderStats, recentOrders, sellerProducts, buyerOrderCount, sellerOrderCount] = await Promise.all([
      Order.aggregate([
      { $match: orderMatch },
      { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: {
          $sum: {
            $cond: [
              { $eq: ['$buyer', userId] },
              { $ifNull: ['$totalAmount', { $ifNull: ['$total', 0] }] },
              0,
            ],
          },
        },
        totalSales: {
          $sum: {
            $cond: [
              { $eq: ['$seller', userId] },
              { $ifNull: ['$totalAmount', { $ifNull: ['$total', 0] }] },
              0,
            ],
          },
        },
        avgOrderValue: { $avg: { $ifNull: ['$totalAmount', { $ifNull: ['$total', 0] }] } }
      }}
    ]),
      Order.find(orderMatch)
      .sort('-createdAt')
      .limit(10)
        .populate('buyer', 'fullName name email phone role businessType')
        .populate('seller', 'fullName name businessName email phone role businessType')
        .populate('product', 'name price category images')
        .lean(),
      Product.find({ seller: userId })
        .select('name category price quantityAvailable isPublished soldCount rating reviews createdAt')
        .sort('-createdAt')
        .limit(10)
        .lean(),
      Order.countDocuments({ buyer: userId }),
      Order.countDocuments({ seller: userId }),
    ]);

    const productStats = await Product.aggregate([
      { $match: { seller: userId } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          publishedProducts: { $sum: { $cond: ['$isPublished', 1, 0] } },
          lowStockProducts: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$quantityAvailable', 0] },
                    { $gt: [{ $ifNull: ['$minThreshold', 10] }, 0] },
                    { $lte: ['$quantityAvailable', { $ifNull: ['$minThreshold', 10] }] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          totalSold: { $sum: { $ifNull: ['$soldCount', 0] } },
          avgRating: { $avg: { $ifNull: ['$rating', 0] } },
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      user,
      documents: buildUserDocumentList(user),
      analytics: {
        totalOrders: 0,
        buyerOrders: buyerOrderCount,
        sellerOrders: sellerOrderCount,
        totalSpent: 0,
        totalSales: 0,
        avgOrderValue: 0,
        ...(orderStats[0] || {}),
      },
      productStats: productStats[0] || {
        totalProducts: 0,
        publishedProducts: 0,
        lowStockProducts: 0,
        totalSold: 0,
        avgRating: 0,
      },
      products: sellerProducts,
      recentOrders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user (block, verify, change role)
 * PUT /api/v1/admin/users/:userId
 */
exports.updateUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      role,
      businessType,
      isBlocked,
      isActive,
      isPhoneVerified,
      isEmailVerified,
      kycVerified,
      verificationStatus,
      userType,
      businessName,
      phone,
      address,
    } = req.body;

    const existingUser = await User.findById(req.params.userId).select('role businessType');
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (existingUser.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts are managed from Admin Profile only' });
    }

    const updates = {};
    
    const normalizedRequestedRole = role ? String(role).trim().toLowerCase() : null;
    if (normalizedRequestedRole) {
      const normalizedRole = normalizedRequestedRole;
      if (['brand', 'wholesaler', 'manufacturer', 'retailer', 'small_business'].includes(normalizedRole)) {
        updates.role = 'seller';
        updates.businessType = normalizedRole;
      } else if (normalizedRole === 'farmer') {
        updates.role = 'farmer';
        updates.businessType = 'farmer';
      } else {
        updates.role = normalizedRole;
        if (['buyer', 'admin'].includes(normalizedRole)) updates.businessType = null;
        if (normalizedRole === 'logistics') updates.businessType = 'logistics';
      }
    }
    if (
      businessType &&
      (!normalizedRequestedRole || ['seller', 'brand', 'wholesaler', 'manufacturer', 'retailer', 'small_business'].includes(normalizedRequestedRole))
    ) {
      updates.businessType = businessType;
    }
    if (isBlocked !== undefined) updates.isBlocked = isBlocked;
    if (isActive !== undefined) updates.isActive = isActive;
    else if (isBlocked !== undefined) updates.isActive = !isBlocked;
    if (isPhoneVerified !== undefined) updates.isPhoneVerified = isPhoneVerified;
    if (isEmailVerified !== undefined) updates.isEmailVerified = isEmailVerified;
    if (kycVerified !== undefined) updates.kycVerified = kycVerified;
    if (verificationStatus) updates.verificationStatus = verificationStatus;
    if (userType) updates.userType = userType;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;

    const finalRole = String(updates.role || existingUser.role || '').toLowerCase();
    if (['buyer', 'consumer'].includes(finalRole)) {
      updates.businessName = null;
      updates.businessType = null;
      updates.businessLogoUrl = null;
    } else if (businessName) {
      updates.businessName = businessName;
    }

    if (verificationStatus === 'verified' || verificationStatus === 'gold') {
      updates.kycVerified = true;
      updates['kycDetails.verifiedAt'] = new Date();
      updates['kycDetails.verifiedBy'] = req.user._id || req.user.id;
    }

    if (verificationStatus === 'rejected' || verificationStatus === 'restricted' || verificationStatus === 'unverified') {
      updates.kycVerified = false;
    }

    if (kycVerified === true && !verificationStatus) {
      updates.verificationStatus = 'verified';
      updates['kycDetails.verifiedAt'] = new Date();
      updates['kycDetails.verifiedBy'] = req.user._id || req.user.id;
    }

    if (kycVerified === false && !verificationStatus) {
      updates.verificationStatus = 'unverified';
    }
    
    updates.updatedAt = new Date();
    
    const user = await User.findByIdAndUpdate(req.params.userId, updates, { new: true }).select('-password');
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a non-admin user account
 * DELETE /api/v1/admin/users/:userId
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const requestingAdminId = req.user?._id || req.user?.id;
    if (String(user._id) === String(requestingAdminId)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own admin account' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts are managed from Admin Profile only' });
    }

    const [productResult] = await Promise.all([
      Product.updateMany(
        { seller: user._id },
        { $set: { isPublished: false, warehouseStatus: 'restricted' } }
      ),
      Subscription.deleteMany({ user: user._id }),
      AgentReferral.deleteMany({ seller: user._id }),
    ]);

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      unpublishedProducts: productResult.modifiedCount || 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all saved user documents from database-backed user document sources
 * GET /api/v1/admin/users/:userId/documents
 */
exports.getUserDocuments = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select('-password').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin account details are only available from Admin Profile' });
    }

    res.status(200).json({
      success: true,
      data: buildUserDocumentList(user),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all saved user documents for the admin dashboard vault
 * GET /api/v1/admin/documents
 */
exports.getAllUserDocuments = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = '',
      source = 'all',
      documentType = 'all',
    } = req.query;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const searchTerm = String(search || '').trim().toLowerCase();

    const users = await User.find({ role: { $ne: 'admin' } })
      .select('fullName name email phone businessName role businessType adminDocuments logisticsProfile kycDetails kycVerified verificationStatus createdAt updatedAt')
      .sort('-updatedAt')
      .lean();

    const allDocuments = users.flatMap((user) => {
      const userDocuments = buildUserDocumentList(user);
      return userDocuments.map((document) => ({
        ...document,
        user: {
          _id: user._id,
          id: user._id,
          fullName: user.fullName || user.name || '',
          name: user.name || user.fullName || '',
          businessName: user.businessName || '',
          email: user.email || '',
          phone: user.phone || '',
          role: user.role,
          businessType: user.businessType,
          verificationStatus: user.verificationStatus,
          kycVerified: user.kycVerified,
        },
      }));
    });

    const sourceBreakdown = allDocuments.reduce((acc, document) => {
      const key = document.source || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const documentTypeBreakdown = allDocuments.reduce((acc, document) => {
      const key = document.documentType || 'other';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const filteredDocuments = allDocuments.filter((document) => {
      if (source !== 'all' && document.source !== source) return false;
      if (documentType !== 'all' && document.documentType !== documentType) return false;
      if (searchTerm) {
        const searchable = [
          document.title,
          document.originalName,
          document.documentNumber,
          document.documentType,
          document.source,
          document.user?.fullName,
          document.user?.name,
          document.user?.businessName,
          document.user?.email,
          document.user?.phone,
          document.user?.role,
          document.user?.businessType,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(searchTerm)) return false;
      }
      return true;
    }).sort((left, right) => new Date(right.uploadedAt || 0) - new Date(left.uploadedAt || 0));

    const start = (safePage - 1) * safeLimit;
    const pagedDocuments = filteredDocuments.slice(start, start + safeLimit);

    res.status(200).json({
      success: true,
      data: pagedDocuments,
      summary: {
        totalDocuments: allDocuments.length,
        usersWithDocuments: new Set(allDocuments.map((document) => String(document.user?._id || ''))).size,
        fileBackedDocuments: allDocuments.filter((document) => document.hasFile).length,
        metadataRecords: allDocuments.filter((document) => !document.hasFile).length,
        filteredDocuments: filteredDocuments.length,
        filteredUsersWithDocuments: new Set(filteredDocuments.map((document) => String(document.user?._id || ''))).size,
        filteredFileBackedDocuments: filteredDocuments.filter((document) => document.hasFile).length,
        filteredMetadataRecords: filteredDocuments.filter((document) => !document.hasFile).length,
        sourceBreakdown,
        documentTypeBreakdown,
      },
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: filteredDocuments.length,
        pages: Math.ceil(filteredDocuments.length / safeLimit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload and save a document against a user from admin dashboard
 * POST /api/v1/admin/users/:userId/documents
 */
exports.uploadUserDocument = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin account details are only available from Admin Profile' });
    }

    const {
      documentType = 'other',
      title = '',
      notes = '',
      documentNumber = '',
    } = req.body;
    const hasFile = Boolean(req.file?.buffer);
    const hasDatabaseRecord = Boolean(
      String(title || '').trim() ||
      String(notes || '').trim() ||
      String(documentNumber || '').trim()
    );

    if (!hasFile && !hasDatabaseRecord) {
      return res.status(400).json({
        success: false,
        message: 'Upload a document file or enter document details to save in the database.',
      });
    }

    const result = hasFile
      ? await uploadToCloudinary(
          req.file.buffer,
          `admin/users/${user._id}/documents`,
          req.file.mimetype
        )
      : null;

    const savedDocument = {
      documentType,
      title: title || req.file?.originalname || `${readableStatus(documentType)} record`,
      notes,
      documentNumber,
      source: 'admin_saved',
      originalName: req.file?.originalname || '',
      mimeType: req.file?.mimetype || '',
      size: req.file?.size || null,
      url: result?.secure_url || '',
      publicId: result?.public_id || '',
      uploadedBy: req.user._id || req.user.id,
      uploadedAt: new Date(),
    };

    user.adminDocuments = Array.isArray(user.adminDocuments) ? user.adminDocuments : [];
    user.adminDocuments.push(savedDocument);

    if ((documentType === 'kyc' || documentType === 'national_id') && user.verificationStatus === 'unverified') {
      user.verificationStatus = 'pending';
    }

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');

    res.status(201).json({
      success: true,
      message: 'User document saved successfully',
      document: updatedUser.adminDocuments[updatedUser.adminDocuments.length - 1],
      documents: buildUserDocumentList(updatedUser.toObject ? updatedUser.toObject() : updatedUser),
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get seller subscriptions for super-admin management
 * GET /api/v1/admin/subscriptions
 */
exports.getSubscriptions = async (req, res, next) => {
  try {
    const { status, plan, search, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));

    const sellerQuery = {
      role: { $ne: 'admin' },
      $or: [
        { role: { $in: ['seller', 'farmer', 'logistics'] } },
        { businessType: { $in: ['brand', 'wholesaler', 'manufacturer', 'retailer', 'farmer', 'small_business', 'logistics'] } },
      ],
    };

    if (search) {
      const searchFilter = [
        { fullName: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } },
      ];
      sellerQuery.$and = [{ $or: sellerQuery.$or }, { $or: searchFilter }];
      delete sellerQuery.$or;
    }

    const sellers = await User.find(sellerQuery)
      .select('fullName name email phone role businessType businessName subscriptionTier subscriptionExpiry createdAt')
      .sort('-createdAt')
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const sellerIds = sellers.map((seller) => seller._id);
    const subscriptions = await Subscription.find({ user: { $in: sellerIds } }).lean();
    const subscriptionByUser = new Map(subscriptions.map((subscription) => [String(subscription.user), subscription]));

    const rows = sellers
      .map((seller) => {
        const subscription = subscriptionByUser.get(String(seller._id)) || null;
        return {
          seller,
          subscription,
          active: Boolean(subscription?.status === 'active' && (subscription.plan === 'mizigo' || !subscription.endDate || new Date(subscription.endDate) > new Date())),
        };
      })
      .filter((row) => {
        if (status && status !== 'all') {
          const rowStatus = row.subscription?.status || 'inactive';
          return rowStatus === status;
        }
        if (plan && plan !== 'all') return row.subscription?.plan === plan;
        return true;
      });

    const [totalSellers, subscriptionStats, featureRecords] = await Promise.all([
      User.countDocuments(sellerQuery),
      Subscription.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$price' },
          },
        },
      ]),
      SubscriptionFeature.find({}).sort({ sortOrder: 1, label: 1 }).lean(),
    ]);

    res.status(200).json({
      success: true,
      data: rows,
      plans: Object.values(PLANS).map((planData) => ({
        id: planData.id,
        name: planData.displayName || planData.name,
        price: planData.price,
        billingModel: planData.billingModel,
      })),
      features: featureRecords.map(serializeSubscriptionFeature).filter(Boolean),
      stats: subscriptionStats,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: totalSellers,
        pages: Math.ceil(totalSellers / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get agent referrals captured during seller subscription activation
 * GET /api/v1/admin/agent-referrals
 */
exports.getAgentReferrals = async (req, res, next) => {
  try {
    const { search = '', agentNationalId = '', plan = 'all', page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));
    const query = {};

    if (agentNationalId) {
      query.agentNationalId = String(agentNationalId).replace(/\D/g, '');
    }

    if (plan && plan !== 'all') {
      query.planId = plan;
    }

    if (search) {
      const normalizedSearch = String(search).trim();
      query.$or = [
        { agentNationalId: { $regex: normalizedSearch, $options: 'i' } },
        { 'sellerSnapshot.name': { $regex: normalizedSearch, $options: 'i' } },
        { 'sellerSnapshot.businessName': { $regex: normalizedSearch, $options: 'i' } },
        { 'sellerSnapshot.email': { $regex: normalizedSearch, $options: 'i' } },
        { 'sellerSnapshot.phone': { $regex: normalizedSearch, $options: 'i' } },
        { paymentReference: { $regex: normalizedSearch, $options: 'i' } },
      ];
    }

    const [rows, total, uniqueAgentIds, byAgent, byPlan] = await Promise.all([
      AgentReferral.find(query)
        .populate('seller', 'fullName name businessName email phone role businessType')
        .populate('subscription', 'plan planName status price startDate endDate')
        .sort({ referredAt: -1, createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      AgentReferral.countDocuments(query),
      AgentReferral.distinct('agentNationalId', query),
      AgentReferral.aggregate([
        { $match: query },
        { $group: { _id: '$agentNationalId', referrals: { $sum: 1 }, latestReferralAt: { $max: '$referredAt' } } },
        { $sort: { referrals: -1, latestReferralAt: -1 } },
        { $limit: 20 },
      ]),
      AgentReferral.aggregate([
        { $match: query },
        { $group: { _id: '$planId', referrals: { $sum: 1 } } },
        { $sort: { referrals: -1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: rows,
      summary: {
        totalReferrals: total,
        uniqueAgents: uniqueAgentIds.length,
        topAgents: byAgent.map((agent) => ({
          agentNationalId: agent._id,
          referrals: agent.referrals,
          latestReferralAt: agent.latestReferralAt,
        })),
        byPlan: byPlan.map((item) => ({ planId: item._id, referrals: item.referrals })),
      },
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update a seller subscription as super admin
 * PUT /api/v1/admin/subscriptions/:userId
 */
exports.setSubscription = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const subscription = await billingService.setSubscriptionByAdmin(req.user.id, req.params.userId, {
      planId: req.body.planId,
      amount: req.body.amount,
      status: req.body.status || 'active',
      endDate: req.body.endDate,
      autoRenew: req.body.autoRenew,
      note: req.body.note,
    });

    res.status(200).json({
      success: true,
      message: 'Seller subscription updated successfully',
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a seller subscription as super admin
 * DELETE /api/v1/admin/subscriptions/:userId
 */
exports.cancelSellerSubscription = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const result = await billingService.cancelSubscription(
      req.params.userId,
      req.body?.reason || `Cancelled by admin ${req.user.id}`
    );

    res.status(200).json({
      success: true,
      message: 'Seller subscription cancelled successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.getSubscriptionFeatures = async (req, res, next) => {
  try {
    const { status = 'all', plan = 'all', search = '' } = req.query;
    const query = {};

    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (plan && plan !== 'all') query.planIds = plan;
    if (search) {
      query.$or = [
        { key: { $regex: search, $options: 'i' } },
        { label: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    const features = await SubscriptionFeature.find(query).sort({ sortOrder: 1, label: 1 }).lean();
    res.status(200).json({
      success: true,
      data: features.map(serializeSubscriptionFeature).filter(Boolean),
      summary: {
        total: features.length,
        active: features.filter((feature) => feature.isActive !== false).length,
        inactive: features.filter((feature) => feature.isActive === false).length,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createSubscriptionFeature = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const key = normalizeFeatureKey(req.body.key || req.body.label);
    if (!key) {
      return res.status(400).json({ success: false, message: 'Feature key or label is required' });
    }

    const feature = await SubscriptionFeature.create({
      key,
      label: String(req.body.label || '').trim(),
      description: String(req.body.description || '').trim(),
      category: String(req.body.category || 'seller_tools').trim() || 'seller_tools',
      planIds: Array.isArray(req.body.planIds) ? req.body.planIds : [],
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      sortOrder: Number(req.body.sortOrder || 0),
      createdBy: req.user._id || req.user.id,
      updatedBy: req.user._id || req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Subscription feature created successfully',
      data: serializeSubscriptionFeature(feature),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A feature with this key already exists' });
    }
    next(error);
  }
};

exports.updateSubscriptionFeature = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const updates = {
      updatedBy: req.user._id || req.user.id,
    };

    if (req.body.key !== undefined) updates.key = normalizeFeatureKey(req.body.key);
    if (req.body.label !== undefined) updates.label = String(req.body.label || '').trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description || '').trim();
    if (req.body.category !== undefined) updates.category = String(req.body.category || 'seller_tools').trim() || 'seller_tools';
    if (req.body.planIds !== undefined) updates.planIds = Array.isArray(req.body.planIds) ? req.body.planIds : [];
    if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
    if (req.body.sortOrder !== undefined) updates.sortOrder = Number(req.body.sortOrder || 0);

    const feature = await SubscriptionFeature.findByIdAndUpdate(
      req.params.featureId,
      updates,
      { new: true, runValidators: true }
    );

    if (!feature) {
      return res.status(404).json({ success: false, message: 'Subscription feature not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription feature updated successfully',
      data: serializeSubscriptionFeature(feature),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A feature with this key already exists' });
    }
    next(error);
  }
};

exports.deleteSubscriptionFeature = async (req, res, next) => {
  try {
    const feature = await SubscriptionFeature.findByIdAndDelete(req.params.featureId);
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Subscription feature not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription feature deleted successfully',
      data: serializeSubscriptionFeature(feature),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get logistics applications queue
 * GET /api/v1/admin/logistics/applications
 */
exports.getLogisticsApplications = async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
    const filter = { role: 'logistics' };

    if (status && status !== 'all') {
      filter['logisticsProfile.verificationStatus'] = status;
    }

    const applications = await User.find(filter)
      .select('fullName name businessName email phone locationHub city address verificationStatus kycVerified isActive logisticsProfile createdAt updatedAt')
      .populate('logisticsProfile.reviewedBy', 'fullName name email')
      .sort({ 'logisticsProfile.applicationSubmittedAt': -1, createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const [total, statusCounts] = await Promise.all([
      User.countDocuments(filter),
      User.aggregate([
        { $match: { role: 'logistics' } },
        {
          $group: {
            _id: { $ifNull: ['$logisticsProfile.verificationStatus', 'unverified'] },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);
    const summary = statusCounts.reduce((acc, item) => {
      acc[item._id || 'unverified'] = item.count;
      acc.total += item.count;
      return acc;
    }, { total: 0, pending: 0, verified: 0, rejected: 0, unverified: 0 });

    res.status(200).json({
      success: true,
      data: applications,
      summary,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Review logistics application (approve/reject)
 * PUT /api/v1/admin/logistics/applications/:userId/review
 */
exports.reviewLogisticsApplication = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { action, notes = '' } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject".',
      });
    }

    const candidate = await User.findById(userId);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Logistics applicant not found' });
    }

    const nextStatus = action === 'approve' ? 'verified' : 'rejected';
    const existingProfile = candidate.logisticsProfile?.toObject?.() || candidate.logisticsProfile || {};
    candidate.role = 'logistics';
    candidate.businessType = 'logistics';
    candidate.verificationStatus = action === 'approve' ? 'verified' : 'rejected';
    if (action === 'approve') {
      candidate.kycVerified = true;
    }
    candidate.isActive = true;
    candidate.isBlocked = false;
    if (action === 'approve') {
      candidate.subscriptionTier = 'mizigo';
    }
    candidate.logisticsProfile = {
      ...existingProfile,
      verificationStatus: nextStatus,
      isOnline: action === 'approve' ? Boolean(existingProfile.isOnline) : false,
      reviewedAt: new Date(),
      reviewedBy: req.user._id,
      reviewNotes: String(notes || '').trim(),
      verifiedAt: action === 'approve' ? new Date() : null,
    };

    await candidate.save();

    await notificationService.create(candidate._id, {
      type: 'in_app',
      channel: 'logistics',
      title: action === 'approve' ? 'Logistics application approved' : 'Logistics application rejected',
      body: action === 'approve'
        ? 'Your logistics account is approved. You can now receive assignments and use the logistics dashboard.'
        : 'Your logistics application was rejected. Review the admin notes and submit updated documents.',
      status: 'pending',
      data: {
        href: '/logistics/apply',
        verificationStatus: nextStatus,
        notes: candidate.logisticsProfile.reviewNotes,
      },
    }).catch(() => null);

    res.status(200).json({
      success: true,
      message: `Application ${action}d successfully.`,
      data: {
        userId: candidate._id,
        businessName: candidate.businessName,
        fullName: candidate.fullName || candidate.name,
        verificationStatus: candidate.logisticsProfile.verificationStatus,
        reviewedAt: candidate.logisticsProfile.reviewedAt,
        notes: candidate.logisticsProfile.reviewNotes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get comprehensive orders with filters
 * GET /api/v1/admin/orders
 */
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, paymentStatus, userType, startDate, endDate, search = '', page = 1, limit = 20 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
    const query = {};
    
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: String(search).trim(), $options: 'i' } },
        ...(isMongoId(search) ? [{ _id: search }] : []),
      ];
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    let orders = await Order.find(query)
      .populate('buyer', 'fullName name email phone userType role businessType')
      .populate('seller', 'fullName name businessName email phone role businessType')
      .populate('logisticsPreference.requestedProvider', 'fullName name businessName phone logisticsProfile.baseHub logisticsProfile.locationHub logisticsProfile.vehiclePlate logisticsProfile.vehicleType')
      .populate('product', 'name images price category')
      .sort('-createdAt')
      .lean();
    
    // Filter by user type if specified
    if (userType && userType !== 'all') {
      orders = orders.filter((order) => (
        order.buyer?.userType === userType ||
        order.buyer?.role === userType ||
        order.buyer?.businessType === userType
      ));
    }
    if (paymentStatus && paymentStatus !== 'all') {
      orders = orders.filter((order) => {
        const computedPaymentStatus = order.paymentStatus || (order.paidAt ? 'paid' : 'pending');
        return computedPaymentStatus === paymentStatus;
      });
    }

    const total = orders.length;
    const pagedOrders = orders.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

    const logisticsRecords = await Logistics.find({ order: { $in: pagedOrders.map((order) => order._id) } })
      .select('order tripId bookingReference trackingNumber status carrier estimatedDelivery shippingCost driverName driverPhone liveTracking gpsTracking metadata')
      .lean();
    const logisticsByOrder = new Map(logisticsRecords.map((record) => [String(record.order), record]));

    const summary = orders.reduce((acc, order) => {
      const statusKey = String(order.status || 'unknown');
      const paymentStatusKey = String(order.paymentStatus || (order.paidAt ? 'paid' : 'pending'));
      const totalAmount = Number(order.totalAmount || order.total || 0);
      acc.totalOrders += 1;
      acc.totalRevenue += ['DELIVERED', 'RELEASED', 'delivered', 'completed'].includes(statusKey) ? totalAmount : 0;
      acc.totalOrderValue += totalAmount;
      acc.byStatus[statusKey] = (acc.byStatus[statusKey] || 0) + 1;
      acc.byPaymentStatus[paymentStatusKey] = (acc.byPaymentStatus[paymentStatusKey] || 0) + 1;
      if (['pending_payment', 'AWAITING_PAYMENT'].includes(statusKey)) acc.awaitingPayment += 1;
      if (['FUNDS_HELD', 'payment_escrowed', 'processing'].includes(statusKey)) acc.processing += 1;
      if (['IN_TRANSIT', 'dispatched'].includes(statusKey)) acc.inTransit += 1;
      if (['DELIVERED', 'RELEASED', 'delivered', 'completed'].includes(statusKey)) acc.delivered += 1;
      if (['DISPUTED', 'disputed'].includes(statusKey)) acc.disputed += 1;
      if (['REFUNDED', 'cancelled', 'EXPIRED'].includes(statusKey)) acc.cancelled += 1;
      return acc;
    }, {
      totalOrders: 0,
      totalRevenue: 0,
      totalOrderValue: 0,
      awaitingPayment: 0,
      processing: 0,
      inTransit: 0,
      delivered: 0,
      disputed: 0,
      cancelled: 0,
      byStatus: {},
      byPaymentStatus: {},
    });
    summary.averageOrderValue = summary.totalOrders ? summary.totalOrderValue / summary.totalOrders : 0;
    
    // Enhanced order data with analytics
    const enhancedOrders = pagedOrders.map((order) => {
      const logistics = logisticsByOrder.get(String(order._id)) || null;
      const totalAmount = Number(order.totalAmount || order.total || 0);
      const quantity = Number(order.quantity || 0);
      const unitPrice = Number(order.unitPrice || order.product?.price || 0);

      return {
        ...order,
        customer: order.buyer,
        buyerName: order.buyer?.businessName || order.buyer?.fullName || order.buyer?.name || 'Buyer',
        sellerName: order.seller?.businessName || order.seller?.fullName || order.seller?.name || 'Seller',
        productName: order.product?.name || 'Product',
        productCategory: order.product?.category || 'other',
        items: [{
          id: order.product?._id || order.product || order._id,
          product: order.product,
          name: order.product?.name || 'Product',
          image: order.product?.images?.[0]?.url || order.product?.images?.[0] || '',
          quantity,
          price: unitPrice,
        }],
        total: totalAmount,
        paymentStatus: order.paymentStatus || (order.paidAt ? 'paid' : 'pending'),
        escrowStatus: order.status,
        logistics,
        trackingNumber: logistics?.trackingNumber || order.trackingNumber || '',
        carrier: logistics?.carrier || order.carrier || '',
        timeline: getOrderTimeline(order),
        estimatedDelivery: logistics?.estimatedDelivery || calculateEstimatedDelivery(order.createdAt),
        shippingAddress: logistics?.shippingAddress || order.deliveryAddress || null,
        paymentBreakdown: {
          subtotal: totalAmount,
          tax: 0,
          shipping: Number(logistics?.shippingCost || 0),
          total: totalAmount + Number(logistics?.shippingCost || 0),
        },
      };
    });
    
    res.status(200).json({
      success: true,
      orders: enhancedOrders,
      summary,
      pagination: { page: pageNumber, limit: pageSize, total, pages: Math.ceil(total / pageSize) || 1 }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status with tracking
 * PUT /api/v1/admin/orders/:orderId/status
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, trackingNumber, carrier, notes } = req.body;
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const previousStatus = order.status;
    order.status = status;
    order.updatedAt = new Date();
    
    // Add status history
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      notes: notes || '',
      updatedBy: req.user._id
    });
    
    // Update tracking metadata when the order enters dispatch or transit.
    if (['dispatched', 'IN_TRANSIT'].includes(status) && trackingNumber) {
      order.trackingNumber = trackingNumber;
      order.carrier = carrier;
    }
    
    // Update payment marker if delivered/released.
    if (['DELIVERED', 'RELEASED', 'delivered', 'completed'].includes(status)) {
      order.paymentStatus = 'completed';
      order.deliveredAt = new Date();
    }
    
    await order.save();
    await notifyAdminOrderStatusUpdate(order, previousStatus, notes);
    
    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all products with advanced filtering
 * GET /api/v1/admin/products
 */
exports.getAllProducts = async (req, res, next) => {
  try {
    const { category, status, minPrice, maxPrice, farmer, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (category && category !== 'all') query.category = category;
    if (status === 'active') query.isPublished = true;
    if (status === 'inactive') query.isPublished = false;
    if (minPrice) query.price = { $gte: parseFloat(minPrice) };
    if (maxPrice) query.price = { ...query.price, $lte: parseFloat(maxPrice) };
    if (farmer) query.seller = farmer;
    
    const products = await Product.find(query)
      .populate('seller', 'name businessName email rating')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Product.countDocuments(query);
    
    // Enhanced product analytics
    const enhancedProducts = await Promise.all(products.map(async (product) => {
      const salesData = await Order.aggregate([
        { $match: { product: product._id, status: 'delivered' } },
        { $group: {
          _id: null,
          totalSold: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalAmount' }
        }}
      ]);
      
      const productWithInventory = appendInventoryFields(product);

      return {
        ...productWithInventory,
        isActive: product.isPublished,
        active: product.isPublished,
        analytics: {
          totalSold: salesData[0]?.totalSold || 0,
          totalRevenue: salesData[0]?.totalRevenue || 0,
          rating: product.rating || 0
        }
      };
    }));
    
    res.status(200).json({
      success: true,
      products: enhancedProducts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create product on behalf of a seller as admin
 * POST /api/v1/admin/products
 */
exports.createProductForSeller = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const sellerId = req.body.sellerId || req.body.seller || req.body.createdForSellerId;
    const seller = await User.findById(sellerId).select('role businessType businessName fullName name email phone');
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found',
      });
    }

    const effectiveCategory = getEffectiveUserCategory(seller);
    if (!isSellerUser(seller)) {
      return res.status(400).json({
        success: false,
        message: 'Selected account is not a seller, farmer, wholesaler, manufacturer, retailer, brand, or small business.',
        data: {
          sellerId: String(seller._id),
          role: seller.role,
          businessType: seller.businessType,
          effectiveCategory,
        },
      });
    }

    if (!String(seller.businessName || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'Selected seller needs a business name before products can be created for them.',
      });
    }

    const [plan, currentProductCount] = await Promise.all([
      getAdminEffectivePlan(seller._id),
      Product.countDocuments({ seller: seller._id }),
    ]);
    const productLimit = getAdminProductLimitForPlan(plan);

    if (currentProductCount >= productLimit) {
      return res.status(403).json({
        success: false,
        message: buildAdminProductLimitMessage(plan, productLimit, seller.businessName || seller.fullName || 'Seller'),
        data: {
          currentPlan: plan || null,
          productLimit,
          currentProductCount,
          remainingSlots: Number.isFinite(productLimit) ? Math.max(0, productLimit - currentProductCount) : null,
          upgradeRequired: true,
        },
      });
    }

    const name = String(req.body.name || '').trim();
    const category = String(req.body.category || (effectiveCategory === 'farmer' ? 'grocery' : 'other')).trim().toLowerCase();
    const unit = String(req.body.unit || '').trim().toLowerCase();
    const price = Number(req.body.price);
    const quantityAvailable = parseNonNegativeInt(req.body.quantityAvailable, NaN);

    if (!name) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ success: false, message: 'Price must be a positive number' });
    }
    if (!Number.isFinite(quantityAvailable) || quantityAvailable < 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a non-negative integer' });
    }
    if (!PRODUCT_CATEGORIES.has(category)) {
      return res.status(400).json({ success: false, message: 'Choose a valid category' });
    }
    if (!PRODUCT_UNITS.has(unit)) {
      return res.status(400).json({ success: false, message: 'Valid unit required' });
    }

    let uploadedImages = [];
    try {
      uploadedImages = await uploadAdminProductImages(req.files, seller._id);
    } catch (error) {
      console.error('Admin product image upload failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload images. Please try again.',
        error: error.message,
      });
    }

    const remoteImages = normalizeProductImageUrls(req.body.imageUrls, uploadedImages.length);
    const customAttributes = parseJsonField(req.body.customAttributes, {});

    const product = new Product({
      seller: seller._id,
      name,
      description: String(req.body.description || '').trim(),
      price,
      quantityAvailable,
      minThreshold: parseNonNegativeInt(req.body.minThreshold, getAutoLowStockThreshold({ name, category })),
      category,
      unit,
      locationHub: String(req.body.locationHub || '').trim(),
      warehouseStatus: normalizeWarehouseStatus(req.body.warehouseStatus),
      wholesale: normalizeWholesalePayload(req.body),
      images: [...uploadedImages, ...remoteImages],
      customAttributes: customAttributes && typeof customAttributes === 'object' && !Array.isArray(customAttributes)
        ? customAttributes
        : {},
      isPublished: parseBoolean(req.body.isPublished, true),
    });

    if (req.body.sku) {
      product.sku = String(req.body.sku).trim().toUpperCase();
    }

    await product.save();

    await createOrderNotification(seller._id, {
      event: 'admin_product_created',
      title: 'Product added by admin',
      body: `${product.name} was added to your seller catalog by an administrator.`,
      order: {},
      data: {
        productId: String(product._id),
        href: '/seller/products',
      },
    });
    sendAdminSmsToUser(
      seller,
      `Lango Market Pulse: Admin added ${product.name} to your catalog. Stock: ${product.quantityAvailable} ${product.unit}.`,
      'admin product create SMS'
    );

    const responseProduct = appendInventoryFields(product);
    responseProduct.isActive = product.isPublished;
    responseProduct.active = product.isPublished;

    res.status(201).json({
      success: true,
      message: 'Product created for seller successfully',
      product: responseProduct,
      data: responseProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product status/details as admin
 * PUT /api/v1/admin/products/:productId
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const product = await Product.findById(req.params.productId).populate('seller', 'fullName name businessName email phone');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const allowedUpdates = [
      'name',
      'description',
      'price',
      'quantityAvailable',
      'minThreshold',
      'unit',
      'category',
      'locationHub',
      'isPublished',
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'price') product[field] = parseFloat(req.body[field]);
        else if (field === 'quantityAvailable') product[field] = parseInt(req.body[field], 10);
        else if (field === 'minThreshold') product[field] = parseInt(req.body[field], 10);
        else if (field === 'isPublished') product[field] = req.body[field] === true || req.body[field] === 'true';
        else product[field] = req.body[field];
      }
    });

    if (req.body.isActive !== undefined) {
      product.isPublished = req.body.isActive === true || req.body.isActive === 'true';
    }

    await product.save();
    sendAdminSmsToUser(
      product.seller,
      `Lango Market Pulse: Admin updated ${product.name}. Stock: ${product.quantityAvailable} ${product.unit}, price: ${formatCurrencyLocal(product.price)}.`,
      'admin product update SMS'
    );

    const responseProduct = appendInventoryFields(product);
    responseProduct.isActive = product.isPublished;
    responseProduct.active = product.isPublished;

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: responseProduct,
      data: responseProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product as admin
 * DELETE /api/v1/admin/products/:productId
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const product = await Product.findById(req.params.productId).populate('seller', 'fullName name businessName email phone');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const deletedProduct = {
      id: product._id,
      name: product.name,
      seller: product.seller,
    };

    await product.deleteOne();

    const sellerId = getDocId(deletedProduct.seller);
    if (sellerId) {
      await createOrderNotification(sellerId, {
        event: 'admin_product_deleted',
        title: 'Product removed by admin',
        body: `${deletedProduct.name} was removed from the marketplace by an administrator.`,
        order: {},
        data: {
          productId: String(deletedProduct.id),
          href: '/seller/products',
        },
      });
      sendAdminSmsToUser(
        deletedProduct.seller,
        `Lango Market Pulse: Admin removed ${deletedProduct.name} from your seller catalog.`,
        'admin product delete SMS'
      );
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: deletedProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle product published status as admin
 * PUT /api/v1/admin/products/:productId/toggle
 */
exports.toggleProductStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const product = await Product.findById(req.params.productId).populate('seller', 'fullName name businessName email phone');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isPublished = !product.isPublished;
    await product.save();
    sendAdminSmsToUser(
      product.seller,
      `Lango Market Pulse: ${product.name} was ${product.isPublished ? 'activated' : 'deactivated'} by admin.`,
      'admin product status SMS'
    );

    const responseProduct = appendInventoryFields(product);
    responseProduct.isActive = product.isPublished;
    responseProduct.active = product.isPublished;

    res.status(200).json({
      success: true,
      message: product.isPublished ? 'Product activated' : 'Product deactivated',
      product: responseProduct,
      data: responseProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get logistics and delivery tracking
 * GET /api/v1/admin/logistics
 */
exports.getLogistics = async (req, res, next) => {
  try {
    const { status, carrier, page = 1, limit = 20 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
    const query = {};
    
    if (status && status !== 'all') query.status = status;
    if (carrier && carrier !== 'all') query.carrier = carrier;
    
    const logistics = await Logistics.find(query)
      .populate({
        path: 'order',
        select: 'orderNumber buyer seller totalAmount status paymentStatus paidAt deliveredAt releasedAt escrowReleaseDate logisticsPreference',
        populate: [
          { path: 'buyer', select: 'fullName name email phone userType' },
          { path: 'seller', select: 'fullName name businessName email phone' },
          { path: 'logisticsPreference.requestedProvider', select: 'fullName name businessName phone logisticsProfile.baseHub logisticsProfile.locationHub logisticsProfile.vehiclePlate logisticsProfile.vehicleType' },
        ],
      })
      .populate('seller', 'fullName name businessName email phone')
      .populate('buyer', 'fullName name email phone userType')
      .populate('driver', 'fullName name phone role verificationStatus logisticsProfile.verificationStatus logisticsProfile.currentLocation')
      .populate('fleetOwner', 'fullName name businessName phone')
      .sort('-createdAt')
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean({ virtuals: true });
    
    const total = await Logistics.countDocuments(query);
    const orderIds = logistics.map((trip) => getDocId(trip.order)).filter(Boolean);
    const logisticsIds = logistics.map((trip) => trip._id).filter(Boolean);
    const escrows = await Escrow.find({
      $or: [
        { order: { $in: orderIds } },
        { logistics: { $in: logisticsIds } },
      ],
    }).lean();
    const escrowByOrder = new Map(escrows.filter((escrow) => escrow.order).map((escrow) => [String(escrow.order), escrow]));
    const escrowByLogistics = new Map(escrows.filter((escrow) => escrow.logistics).map((escrow) => [String(escrow.logistics), escrow]));
    const logisticsSnapshots = logistics.map((trip) => buildAdminLogisticsSnapshot(
      trip,
      escrowByOrder.get(String(getDocId(trip.order) || '')) || escrowByLogistics.get(String(trip._id))
    ));
    
    res.status(200).json({
      success: true,
      logistics: logisticsSnapshots,
      pagination: { page: pageNumber, limit: pageSize, total, pages: Math.ceil(total / pageSize) }
    });
  } catch (error) {
    next(error);
  }
};

exports.getLogisticsLiveTracking = async (req, res, next) => {
  try {
    const logistics = await Logistics.findById(req.params.logisticsId)
      .populate({
        path: 'order',
        select: 'orderNumber buyer seller totalAmount status paymentStatus paidAt deliveredAt releasedAt escrowReleaseDate logisticsPreference',
        populate: [
          { path: 'buyer', select: 'fullName name email phone userType' },
          { path: 'seller', select: 'fullName name businessName email phone' },
          { path: 'logisticsPreference.requestedProvider', select: 'fullName name businessName phone logisticsProfile.baseHub logisticsProfile.locationHub logisticsProfile.vehiclePlate logisticsProfile.vehicleType' },
        ],
      })
      .populate('seller', 'fullName name businessName email phone')
      .populate('buyer', 'fullName name email phone userType')
      .populate('driver', 'fullName name phone role verificationStatus logisticsProfile.verificationStatus logisticsProfile.currentLocation')
      .populate('fleetOwner', 'fullName name businessName phone')
      .lean({ virtuals: true });

    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found' });
    }

    const escrowQuery = [{ logistics: logistics._id }];
    const orderId = getDocId(logistics.order);
    if (orderId) escrowQuery.push({ order: orderId });
    const escrow = await Escrow.findOne({ $or: escrowQuery }).lean();

    res.status(200).json({
      success: true,
      data: buildAdminLogisticsSnapshot(logistics, escrow),
    });
  } catch (error) {
    next(error);
  }
};

exports.releaseLogisticsEscrow = async (req, res, next) => {
  try {
    const forceRelease = req.body.forceRelease === true;
    const overrideReason = String(req.body.overrideReason || req.body.reason || '').trim();
    if (forceRelease && overrideReason.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Override reason is required before force releasing escrow.',
      });
    }

    const logistics = await Logistics.findById(req.params.logisticsId).select('order orderNumber status').lean();
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found' });
    }
    if (!logistics.order) {
      return res.status(409).json({ success: false, message: 'This logistics record is not linked to an order escrow.' });
    }

    const result = await escrowService.releasePayment(logistics.order, {
      releasedBy: req.user._id || req.user.id,
      forceRelease,
      releaseMethod: 'admin_override',
      overrideReason,
    });

    await auditService.record({
      entityType: 'Logistics',
      entityId: req.params.logisticsId,
      action: forceRelease ? 'ADMIN_FORCE_RELEASED_ESCROW' : 'ADMIN_RELEASED_ESCROW',
      actor: req.user._id || req.user.id,
      newValue: {
        order: logistics.order,
        forceRelease,
        overrideReason,
      },
      req,
    });

    const refreshed = await Logistics.findById(req.params.logisticsId)
      .populate({
        path: 'order',
        select: 'orderNumber buyer seller totalAmount status paymentStatus paidAt deliveredAt releasedAt escrowReleaseDate',
        populate: [
          { path: 'buyer', select: 'fullName name email phone userType' },
          { path: 'seller', select: 'fullName name businessName email phone' },
        ],
      })
      .populate('seller', 'fullName name businessName email phone')
      .populate('buyer', 'fullName name email phone userType')
      .populate('driver', 'fullName name phone role verificationStatus logisticsProfile.verificationStatus logisticsProfile.currentLocation')
      .populate('fleetOwner', 'fullName name businessName phone')
      .lean({ virtuals: true });
    const escrow = await Escrow.findOne({ order: logistics.order }).lean();

    res.status(200).json({
      success: true,
      message: result.alreadyReleased ? 'Escrow was already released.' : 'Escrow released by admin.',
      data: {
        release: result,
        logistics: buildAdminLogisticsSnapshot(refreshed, escrow),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update logistics tracking
 * PUT /api/v1/admin/logistics/:logisticsId/tracking
 */
exports.updateLogisticsTracking = async (req, res, next) => {
  try {
    const { status, location, notes, estimatedDelivery, gpsCoords } = req.body;
    const logistics = await Logistics.findById(req.params.logisticsId);
    
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found' });
    }

    if (status === 'in_transit' && !trustPolicy.hasVerifiedQrScan(logistics, 'pickup')) {
      return res.status(409).json({
        success: false,
        message: 'Pickup QR must be confirmed before marking this shipment in transit.',
        code: 'PICKUP_QR_REQUIRED',
      });
    }

    if (status === 'delivered' && !trustPolicy.hasVerifiedQrScan(logistics, 'delivery')) {
      return res.status(409).json({
        success: false,
        message: 'Delivery QR must be confirmed before marking this shipment delivered.',
        code: 'DELIVERY_QR_REQUIRED',
      });
    }
    
    logistics.status = status;
    logistics.currentLocation = location;
    if (estimatedDelivery) logistics.estimatedDelivery = new Date(estimatedDelivery);
    
    // Add tracking history
    if (!logistics.trackingHistory) logistics.trackingHistory = [];
    logistics.trackingHistory.push({
      status,
      location,
      notes,
      gpsCoords,
      updatedBy: req.user._id || req.user.id,
      timestamp: new Date()
    });
    if (gpsCoords?.lat !== undefined && gpsCoords?.lng !== undefined) {
      logistics.gpsTracking = logistics.gpsTracking || {};
      logistics.gpsTracking.history = logistics.gpsTracking.history || [];
      logistics.gpsTracking.history.push({
        location: { lat: Number(gpsCoords.lat), lng: Number(gpsCoords.lng) },
        recordedBy: req.user._id || req.user.id,
        timestamp: new Date(),
      });
      logistics.gpsTracking.current = {
        lat: Number(gpsCoords.lat),
        lng: Number(gpsCoords.lng),
        accuracy: gpsCoords.accuracy,
        lastUpdate: new Date(),
      };
    }
    
    await logistics.save();
    
    // Update associated order status
    if (status === 'delivered') {
      await Order.findByIdAndUpdate(logistics.order, { status: 'delivered' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Logistics tracking updated',
      logistics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get analytics dashboard data
 * GET /api/v1/admin/analytics
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    const now = new Date();
    const defaultStart = new Date(now);

    if (period === 'week') defaultStart.setDate(defaultStart.getDate() - 7);
    else if (period === 'year') defaultStart.setFullYear(defaultStart.getFullYear() - 1);
    else defaultStart.setDate(defaultStart.getDate() - 30);

    const rangeStart = startDate ? new Date(startDate) : defaultStart;
    const rangeEnd = endDate ? new Date(endDate) : now;
    const dateFilter = { createdAt: { $gte: rangeStart, $lte: rangeEnd } };
    const revenueStatuses = ['DELIVERED', 'RELEASED', 'delivered', 'completed'];
    const activeLogisticsStatuses = ['driver_assigned', 'en_route_to_pickup', 'picked_up', 'in_transit', 'out_for_delivery'];

    const orderRevenueExpression = { $ifNull: ['$totalAmount', '$total'] };
    const productsSoldExpression = { $ifNull: ['$quantity', { $sum: { $ifNull: ['$items.quantity', []] } }] };

    const [
      orderSummary,
      allTimeSummary,
      userRoleStats,
      userVerificationStats,
      salesByUserType,
      topProducts,
      trends,
      sellerPerformance,
      productStatusStats,
      productCategoryStats,
      logisticsStats,
      paymentStats,
      escrowStats,
      subscriptionStats,
      supportStats,
      recentOrders,
      recentUsers,
      recentLogistics,
      recentPayments,
    ] = await Promise.all([
      Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            revenueOrders: { $sum: { $cond: [{ $in: ['$status', revenueStatuses] }, 1, 0] } },
            totalRevenue: { $sum: { $cond: [{ $in: ['$status', revenueStatuses] }, orderRevenueExpression, 0] } },
            pendingOrders: { $sum: { $cond: [{ $in: ['$status', ['pending_payment', 'AWAITING_PAYMENT']] }, 1, 0] } },
            activeOrders: { $sum: { $cond: [{ $in: ['$status', ['FUNDS_HELD', 'payment_escrowed', 'processing', 'dispatched', 'IN_TRANSIT']] }, 1, 0] } },
            deliveredOrders: { $sum: { $cond: [{ $in: ['$status', revenueStatuses] }, 1, 0] } },
            disputedOrders: { $sum: { $cond: [{ $in: ['$status', ['DISPUTED', 'disputed']] }, 1, 0] } },
            cancelledOrders: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'REFUNDED', 'EXPIRED']] }, 1, 0] } },
            productsSold: { $sum: productsSoldExpression },
          },
        },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: { $cond: [{ $in: ['$status', revenueStatuses] }, orderRevenueExpression, 0] } },
            buyers: { $addToSet: '$buyer' },
            sellers: { $addToSet: '$seller' },
          },
        },
      ]),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $ne: ['$isBlocked', true] }, 1, 0] } },
            blocked: { $sum: { $cond: ['$isBlocked', 1, 0] } },
            phoneVerified: { $sum: { $cond: ['$isPhoneVerified', 1, 0] } },
            emailVerified: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
            kycVerified: { $sum: { $cond: ['$kycVerified', 1, 0] } },
            kycPending: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'pending'] }, 1, 0] } },
            documents: { $sum: { $size: { $ifNull: ['$adminDocuments', []] } } },
          },
        },
      ]),
      Order.aggregate([
        { $match: { ...dateFilter, status: { $in: revenueStatuses } } },
        { $lookup: { from: 'users', localField: 'buyer', foreignField: '_id', as: 'customerData' } },
        { $unwind: { path: '$customerData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$customerData.role', '$customerData.userType'] },
            totalSales: { $sum: orderRevenueExpression },
            orderCount: { $sum: 1 },
            averageOrderValue: { $avg: orderRevenueExpression },
          },
        },
        { $sort: { totalSales: -1 } },
      ]),
      Order.aggregate([
        { $match: { ...dateFilter, status: { $in: revenueStatuses } } },
        {
          $group: {
            _id: '$product',
            totalSold: { $sum: productsSoldExpression },
            revenue: { $sum: orderRevenueExpression },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      ]),
      Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            totalRevenue: { $sum: { $cond: [{ $in: ['$status', revenueStatuses] }, orderRevenueExpression, 0] } },
            orderCount: { $sum: 1 },
            deliveredCount: { $sum: { $cond: [{ $in: ['$status', revenueStatuses] }, 1, 0] } },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]),
      Order.aggregate([
        { $match: { ...dateFilter, status: { $in: revenueStatuses } } },
        {
          $group: {
            _id: '$seller',
            totalSold: { $sum: productsSoldExpression },
            revenue: { $sum: orderRevenueExpression },
            orders: { $addToSet: '$_id' },
          },
        },
        { $project: { sellerId: '$_id', farmerId: '$_id', totalSold: 1, revenue: 1, orderCount: { $size: '$orders' } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: 'sellerId', foreignField: '_id', as: 'farmer' } },
        { $unwind: { path: '$farmer', preserveNullAndEmptyArrays: true } },
      ]),
      Product.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            published: { $sum: { $cond: ['$isPublished', 1, 0] } },
            active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            inactive: { $sum: { $cond: [{ $ne: ['$status', 'active'] }, 1, 0] } },
            outOfStock: { $sum: { $cond: [{ $lte: ['$quantityAvailable', 0] }, 1, 0] } },
            lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$quantityAvailable', 0] }, { $lte: ['$quantityAvailable', { $ifNull: ['$minThreshold', 10] }] }] }, 1, 0] } },
          },
        },
      ]),
      Product.aggregate([
        { $group: { _id: '$category', products: { $sum: 1 }, stock: { $sum: '$quantityAvailable' }, value: { $sum: { $multiply: ['$quantityAvailable', '$price'] } } } },
        { $sort: { products: -1 } },
        { $limit: 8 },
      ]),
      Logistics.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $in: ['$status', activeLogisticsStatuses] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'auto_released']] }, 1, 0] } },
            disputed: { $sum: { $cond: [{ $eq: ['$status', 'disputed'] }, 1, 0] } },
            gpsEnabled: { $sum: { $cond: [{ $or: ['$gpsTracking.enabled', '$liveGps.enabled'] }, 1, 0] } },
            shippingRevenue: { $sum: '$shippingCost' },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$type', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { amount: -1 } },
      ]),
      Escrow.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', amount: { $sum: '$amount' }, sellerPayout: { $sum: '$sellerPayout' }, driverPayout: { $sum: '$driverPayout' }, count: { $sum: 1 } } },
      ]),
      Subscription.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$price' } } },
      ]),
      SupportMessage.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).catch(() => []),
      Order.find(dateFilter)
        .populate('buyer', 'fullName name businessName role')
        .populate('seller', 'fullName name businessName role')
        .populate('product', 'name')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      User.find(dateFilter).select('fullName name businessName role phone email createdAt verificationStatus').sort({ createdAt: -1 }).limit(8).lean(),
      Logistics.find(dateFilter).select('tripId orderNumber status shippingCost createdAt updatedAt').sort({ updatedAt: -1 }).limit(8).lean(),
      Transaction.find(dateFilter).populate('user', 'fullName name businessName role').sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    const summary = orderSummary[0] || {};
    const allTime = allTimeSummary[0] || {};
    const users = userVerificationStats[0] || {};
    const products = productStatusStats[0] || {};
    const logistics = logisticsStats[0] || {};
    const totalUsers = Number(users.total || 0);
    const totalOrders = Number(summary.totalOrders || 0);
    const totalRevenue = Number(summary.totalRevenue || 0);
    const platformFeeRevenue = Math.round(totalRevenue * 0.05);
    const subscriptionRevenue = subscriptionStats.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
    const escrowHeld = escrowStats.reduce((sum, item) => (
      ['HELD', 'FUNDS_HELD', 'IN_TRANSIT', 'DELIVERED'].includes(String(item._id || '').toUpperCase())
        ? sum + Number(item.amount || 0)
        : sum
    ), 0);

    const roleBreakdown = userRoleStats.map((item) => ({
      role: item._id || 'unknown',
      count: item.count || 0,
      share: totalUsers ? Math.round((Number(item.count || 0) / totalUsers) * 100) : 0,
    }));

    const trendRows = trends.map((row) => ({
      ...row,
      date: `${row._id.year}-${String(row._id.month).padStart(2, '0')}-${String(row._id.day).padStart(2, '0')}`,
    }));

    const recentActivity = [
      ...recentOrders.map((order) => ({
        type: 'order',
        title: `Order ${getOrderLabel(order)}`,
        detail: `${order.product?.name || 'Product'} - ${readableStatus(order.status)}`,
        amount: order.totalAmount || order.total || 0,
        createdAt: order.createdAt,
      })),
      ...recentUsers.map((user) => ({
        type: 'user',
        title: user.businessName || user.fullName || user.name || 'New user',
        detail: `${readableStatus(user.role)} account - ${readableStatus(user.verificationStatus)}`,
        createdAt: user.createdAt,
      })),
      ...recentLogistics.map((trip) => ({
        type: 'logistics',
        title: trip.tripId || trip.orderNumber || 'Logistics trip',
        detail: readableStatus(trip.status),
        amount: trip.shippingCost || 0,
        createdAt: trip.updatedAt || trip.createdAt,
      })),
      ...recentPayments.map((payment) => ({
        type: 'payment',
        title: readableStatus(payment.type),
        detail: payment.user?.businessName || payment.user?.fullName || payment.user?.name || payment.status,
        amount: payment.amount || 0,
        createdAt: payment.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12);

    res.status(200).json({
      success: true,
      data: {
        salesByUserType,
        topProducts,
        trends: trendRows,
        farmerPerformance: sellerPerformance,
        sellerPerformance,
        roleBreakdown,
        productCategoryStats,
        paymentStats,
        escrowStats,
        subscriptionStats,
        supportStats,
        recentActivity,
        platformUsageTrend: trendRows.map((row) => row.orderCount || 0),
        platformVisitsTrend: trendRows.map((row) => row.deliveredCount || 0),
        financials: {
          marketplaceRevenue: totalRevenue,
          subscriptionRevenue,
          platformFeeRevenue,
          escrowHeld,
          shippingRevenue: logistics.shippingRevenue || 0,
          grossPlatformValue: totalRevenue + subscriptionRevenue + Number(logistics.shippingRevenue || 0),
        },
        operations: {
          logistics,
          products,
          support: supportStats,
          fulfillmentRate: totalOrders ? Math.round((Number(summary.deliveredOrders || 0) / totalOrders) * 100) : 0,
          gpsCoverageRate: logistics.total ? Math.round((Number(logistics.gpsEnabled || 0) / Number(logistics.total || 1)) * 100) : 0,
        },
        users: {
          ...users,
          roles: roleBreakdown,
          phoneVerificationRate: totalUsers ? Math.round((Number(users.phoneVerified || 0) / totalUsers) * 100) : 0,
          emailVerificationRate: totalUsers ? Math.round((Number(users.emailVerified || 0) / totalUsers) * 100) : 0,
          kycVerificationRate: totalUsers ? Math.round((Number(users.kycVerified || 0) / totalUsers) * 100) : 0,
        },
        allTime: {
          totalOrders: allTime.totalOrders || 0,
          totalRevenue: allTime.totalRevenue || 0,
          buyers: Array.isArray(allTime.buyers) ? allTime.buyers.length : 0,
          sellers: Array.isArray(allTime.sellers) ? allTime.sellers.length : 0,
        },
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue: Number(summary.revenueOrders || 0) > 0 ? totalRevenue / Number(summary.revenueOrders || 1) : 0,
          pendingOrders: summary.pendingOrders || 0,
          activeOrders: summary.activeOrders || 0,
          deliveredOrders: summary.deliveredOrders || 0,
          disputedOrders: summary.disputedOrders || 0,
          cancelledOrders: summary.cancelledOrders || 0,
          productsSold: summary.productsSold || 0,
          totalUsers,
          activeUsers: users.active || 0,
          blockedUsers: users.blocked || 0,
          totalProducts: products.total || 0,
          activeProducts: products.active || 0,
          totalLogistics: logistics.total || 0,
          activeLogistics: logistics.active || 0,
        },
        range: { period, startDate: rangeStart, endDate: rangeEnd },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment transactions
 * GET /api/v1/admin/payments
 */
exports.getPayments = async (req, res, next) => {
  try {
    const { status, method, startDate, endDate, page = 1, limit = 20 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
    const query = {};
    
    if (status && status !== 'all') query.status = status;
    if (method && method !== 'all') {
      query.$or = [
        { type: method },
        { 'metadata.paymentMethod': method },
        { 'metadata.method': method },
        { 'metadata.channel': method },
      ];
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const payments = await Transaction.find(query)
      .populate('user', 'fullName name email phone')
      .populate('orderId', 'orderNumber totalAmount status')
      .sort('-createdAt')
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean();
    
    const total = await Transaction.countDocuments(query);
    
    // Payment summary
    const summary = await Transaction.aggregate([
      { $match: query },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }}
    ]);
    
    const normalizedPayments = payments.map((payment) => ({
      ...payment,
      order: payment.orderId || null,
      paymentMethod:
        payment.paymentMethod ||
        payment.metadata?.paymentMethod ||
        payment.metadata?.method ||
        payment.metadata?.channel ||
        payment.type,
      totalAmount: payment.amount,
    }));

    res.status(200).json({
      success: true,
      payments: normalizedPayments,
      summary,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Broadcast notification to users
 * POST /api/v1/admin/broadcast
 */
exports.broadcastNotification = async (req, res, next) => {
  try {
    const {
      type = 'in_app',
      title = 'Platform announcement',
      message,
      targetRole = 'all',
      targetUserType = 'all',
      targetMode = 'all',
      recipientId,
      recipientEmail,
      recipientPhone,
    } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const recipientEmailValue = String(recipientEmail || '').trim().toLowerCase();
    const recipientPhoneValue = String(recipientPhone || '').trim();
    let targetUsers = [];

    if (targetMode === 'individual') {
      const recipientQuery = [];
      if (isMongoId(recipientId)) recipientQuery.push({ _id: recipientId });
      if (recipientEmailValue) recipientQuery.push({ email: recipientEmailValue });
      if (recipientPhoneValue) recipientQuery.push({ phone: recipientPhoneValue });

      const matchedUser = recipientQuery.length
        ? await User.findOne({ $or: recipientQuery })
          .select('_id email phone fullName name businessName notificationPreferences role businessType')
          .lean()
        : null;

      if (matchedUser) {
        targetUsers = [matchedUser];
      } else if (recipientEmailValue || recipientPhoneValue) {
        targetUsers = [{
          _id: null,
          email: recipientEmailValue || null,
          phone: recipientPhoneValue || null,
          fullName: 'Direct recipient',
          role: 'external',
        }];
      } else {
        return res.status(400).json({
          success: false,
          message: 'Enter a user ID, email address, or phone number for an individual message',
        });
      }
    } else {
      targetUsers = await User.find(getAdminTargetQuery({ targetRole, targetUserType }))
        .select('_id email phone fullName name businessName notificationPreferences role businessType')
        .limit(5000)
        .lean();
    }

    const userIds = targetUsers.map((user) => user._id).filter(Boolean);
    const requestedChannels = type === 'all' ? ['in_app', 'email', 'sms'] : [type];
    const results = {
      recipients: targetUsers.length,
      inApp: { attempted: 0, success: 0, failed: 0 },
      email: { attempted: 0, success: 0, failed: 0 },
      sms: { attempted: 0, success: 0, failed: 0 },
    };

    if (requestedChannels.includes('in_app') || requestedChannels.includes('push')) {
      results.inApp.attempted = userIds.length;
      if (userIds.length > 0) {
        try {
          await notificationService.sendBulkNotifications(userIds, {
            type: 'in_app',
            channel: 'system',
            title: title || 'Platform announcement',
            body: message,
            status: 'sent',
            data: {
              source: 'admin_broadcast',
              targetMode,
              targetRole,
              targetUserType,
            },
          });
          results.inApp.success = userIds.length;
        } catch (error) {
          results.inApp.failed = userIds.length;
          results.inApp.error = error.message;
        }
      }
    }

    if (requestedChannels.includes('email')) {
      const emailUsers = targetUsers.filter((user) => user.email);
      results.email.attempted = emailUsers.length;
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2 style="color:#F97316">${escapeEmailHtml(title || 'Lango MarketPulse Update')}</h2>
          <p>${escapeEmailHtml(message).replace(/\n/g, '<br />')}</p>
          <p style="font-size:12px;color:#6B7280">Sent by Lango MarketPulse admin.</p>
        </div>
      `;
      const emailResults = await Promise.all(
        emailUsers.map((user) =>
          emailService.sendEmail(user.email, title || 'Lango MarketPulse Update', emailHtml, message)
            .catch((error) => ({ success: false, error: error.message }))
        )
      );
      results.email.success = emailResults.filter((result) => result?.success).length;
      results.email.failed = emailResults.length - results.email.success;
    }

    if (requestedChannels.includes('sms')) {
      const smsUsers = targetUsers.filter((user) => user.phone);
      results.sms.attempted = smsUsers.length;
      const smsResults = await Promise.all(
        smsUsers.map((user) =>
          smsService.sendToPhone(user.phone, `${title ? `${title}: ` : ''}${message}`)
            .catch((error) => ({ success: false, error: error.message }))
        )
      );
      results.sms.success = smsResults.filter((result) => result?.success).length;
      results.sms.failed = smsResults.length - results.sms.success;
    }

    res.status(200).json({
      success: true,
      message: targetMode === 'individual'
        ? 'Admin message processed for 1 recipient'
        : `Broadcast processed for ${targetUsers.length} users`,
      recipients: targetUsers.length,
      results,
    });
  } catch (error) {
    next(error);
  }
};

const ADMIN_EXPORT_TYPES = [
  'users',
  'products',
  'orders',
  'payments',
  'transactions',
  'logistics',
  'subscriptions',
  'documents',
  'categories',
  'support',
  'rfqs',
  'reviews',
  'agent-referrals',
];

const adminCsvHeaders = {
  users: ['id', 'name', 'email', 'phone', 'role', 'businessType', 'businessName', 'verificationStatus', 'isActive', 'isBlocked', 'createdAt'],
  products: ['id', 'name', 'seller', 'sellerEmail', 'category', 'price', 'unit', 'quantityAvailable', 'reservedQuantity', 'status', 'sku', 'createdAt'],
  orders: ['id', 'orderNumber', 'buyer', 'seller', 'product', 'quantity', 'unitPrice', 'totalAmount', 'status', 'paidAt', 'deliveredAt', 'createdAt'],
  payments: ['id', 'transactionId', 'user', 'order', 'amount', 'currency', 'paymentMethod', 'status', 'mpesaReceiptNumber', 'paidAt', 'createdAt'],
  transactions: ['id', 'user', 'type', 'amount', 'currency', 'balanceBefore', 'balanceAfter', 'reference', 'status', 'createdAt'],
  logistics: ['id', 'orderNumber', 'buyer', 'seller', 'driver', 'status', 'carrier', 'trackingNumber', 'shippingCost', 'estimatedDelivery', 'actualDelivery', 'createdAt'],
  subscriptions: [
    'id', 'seller', 'sellerEmail', 'sellerPhone', 'businessName', 'businessType',
    'planId', 'planName', 'status', 'amount', 'billingCycle', 'paymentMethod',
    'startDate', 'endDate', 'lastPaymentDate', 'nextBillingDate', 'autoRenew',
    'smsCreditsAllocated', 'smsCreditsUsed', 'smsCreditsRemaining',
    'createdAt', 'updatedAt',
  ],
  documents: ['id', 'user', 'email', 'role', 'businessType', 'source', 'documentType', 'title', 'documentNumber', 'hasFile', 'url', 'uploadedAt'],
  categories: ['id', 'name', 'description', 'isActive', 'createdAt'],
  support: ['id', 'user', 'email', 'subject', 'category', 'priority', 'status', 'createdAt', 'updatedAt'],
  rfqs: ['id', 'rfqNumber', 'buyer', 'seller', 'product', 'quantity', 'unit', 'targetPrice', 'status', 'quoteTotal', 'neededBy', 'createdAt'],
  reviews: ['id', 'product', 'seller', 'reviewer', 'order', 'rating', 'title', 'verified', 'helpful', 'unhelpful', 'createdAt'],
  'agent-referrals': ['id', 'agentNationalId', 'seller', 'sellerEmail', 'sellerPhone', 'businessName', 'planId', 'source', 'paymentReference', 'status', 'referredAt', 'createdAt'],
};

const getAdminExportRows = async (type, filters = {}) => {
  const limit = 10000;

  switch (type) {
    case 'users': {
      const users = await User.find({ role: { $ne: 'admin' } })
        .select('fullName name email phone role businessType businessName verificationStatus isActive isBlocked createdAt')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return users.map((user) => ({
        id: docId(user),
        name: displayName(user),
        email: user.email,
        phone: user.phone,
        role: user.role,
        businessType: user.businessType,
        businessName: user.businessName,
        verificationStatus: user.verificationStatus,
        isActive: user.isActive !== false,
        isBlocked: Boolean(user.isBlocked),
        createdAt: user.createdAt,
      }));
    }

    case 'products': {
      const products = await Product.find({})
        .populate('seller', 'fullName name businessName email')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return products.map((product) => ({
        id: docId(product),
        name: product.name,
        seller: displayName(product.seller),
        sellerEmail: product.seller?.email,
        category: product.category,
        price: product.price,
        unit: product.unit,
        quantityAvailable: product.quantityAvailable,
        reservedQuantity: product.reservedQuantity,
        status: product.status || (product.isPublished === false ? 'inactive' : 'active'),
        sku: product.sku,
        createdAt: product.createdAt,
      }));
    }

    case 'orders': {
      const orders = await Order.find({})
        .populate('buyer', 'fullName name businessName email phone')
        .populate('seller', 'fullName name businessName email phone')
        .populate('product', 'name')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return orders.map((order) => ({
        id: docId(order),
        orderNumber: order.orderNumber,
        buyer: displayName(order.buyer),
        seller: displayName(order.seller),
        product: order.product?.name || docId(order.product),
        quantity: order.quantity,
        unitPrice: order.unitPrice,
        totalAmount: order.totalAmount,
        status: order.status,
        paidAt: order.paidAt,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
      }));
    }

    case 'payments': {
      const payments = await Payment.find({})
        .populate('user', 'fullName name businessName email phone')
        .populate('order', 'orderNumber')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return payments.map((payment) => ({
        id: docId(payment),
        transactionId: payment.transactionId,
        user: displayName(payment.user),
        order: payment.order?.orderNumber || docId(payment.order),
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        mpesaReceiptNumber: payment.mpesaReceiptNumber,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      }));
    }

    case 'transactions': {
      const transactions = await Transaction.find({})
        .populate('user', 'fullName name businessName email phone')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return transactions.map((transaction) => ({
        id: docId(transaction),
        user: displayName(transaction.user),
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        reference: transaction.reference,
        status: transaction.status,
        createdAt: transaction.createdAt,
      }));
    }

    case 'logistics': {
      const records = await Logistics.find({})
        .populate('buyer seller driver', 'fullName name businessName email phone')
        .populate('order', 'orderNumber')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return records.map((record) => ({
        id: docId(record),
        orderNumber: record.order?.orderNumber || record.orderNumber,
        buyer: displayName(record.buyer),
        seller: displayName(record.seller),
        driver: displayName(record.driver),
        status: record.status,
        carrier: record.carrier,
        trackingNumber: record.trackingNumber,
        shippingCost: record.shippingCost,
        estimatedDelivery: record.estimatedDelivery,
        actualDelivery: record.actualDelivery,
        createdAt: record.createdAt,
      }));
    }

    case 'subscriptions': {
      const subscriptionQuery = {};
      const plan = String(filters.plan || '').trim().toLowerCase();
      const status = String(filters.status || '').trim().toLowerCase();
      const search = String(filters.search || '').trim().toLowerCase();

      if (plan && plan !== 'all') subscriptionQuery.plan = plan;
      if (status && status !== 'all') subscriptionQuery.status = status;

      const subscriptions = await Subscription.find(subscriptionQuery)
        .populate('user', 'fullName name businessName email phone role businessType')
        .sort('-createdAt')
        .limit(limit)
        .lean();

      return subscriptions.filter((subscription) => {
        if (!search) return true;
        const seller = subscription.user || {};
        return [
          displayName(seller),
          seller.email,
          seller.phone,
          seller.businessName,
          seller.businessType,
          subscription.plan,
          subscription.planName,
          subscription.status,
        ].some((value) => String(value || '').toLowerCase().includes(search));
      }).map((subscription) => {
        const seller = subscription.user;
        const smsAllocated = Number(subscription.features?.smsCreditsAllocated || 0);
        const smsUsed = Number(subscription.features?.smsCreditsUsed || 0);
        return {
          id: docId(subscription),
          seller: displayName(seller),
          sellerEmail: seller?.email,
          sellerPhone: seller?.phone,
          businessName: seller?.businessName,
          businessType: seller?.businessType || seller?.role,
          planId: subscription.planId || subscription.plan,
          planName: subscription.planName,
          status: subscription.status,
          amount: subscription.amount ?? subscription.price,
          billingCycle: subscription.billingCycle,
          paymentMethod: subscription.paymentMethod,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          lastPaymentDate: subscription.lastPaymentDate,
          nextBillingDate: subscription.nextBillingDate,
          autoRenew: subscription.autoRenew,
          smsCreditsAllocated: smsAllocated,
          smsCreditsUsed: smsUsed,
          smsCreditsRemaining: Math.max(0, smsAllocated - smsUsed),
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        };
      });
    }

    case 'documents': {
      const users = await User.find({ role: { $ne: 'admin' } })
        .select('fullName name email phone role businessType businessName adminDocuments logisticsProfile kycDetails verificationStatus kycVerified')
        .sort('-updatedAt')
        .limit(limit)
        .lean();
      return users.flatMap((user) => buildUserDocumentList(user).map((document) => ({
        id: docId(document),
        user: displayName(user),
        email: user.email,
        role: user.role,
        businessType: user.businessType,
        source: document.source,
        documentType: document.documentType,
        title: document.title,
        documentNumber: document.documentNumber,
        hasFile: document.hasFile,
        url: document.url,
        uploadedAt: document.uploadedAt,
      })));
    }

    case 'categories': {
      const categories = await Category.find({}).sort('name').limit(limit).lean();
      return categories.map((category) => ({
        id: docId(category),
        name: category.name,
        description: category.description,
        isActive: category.isActive !== false,
        createdAt: category.createdAt,
      }));
    }

    case 'support': {
      const messages = await SupportMessage.find({})
        .populate('requester', 'fullName name businessName email phone')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return messages.map((message) => ({
        id: docId(message),
        user: displayName(message.requester) || message.requesterSnapshot?.name,
        email: message.requesterSnapshot?.email || message.requester?.email,
        subject: message.subject || message.title,
        category: message.category,
        priority: message.priority,
        status: message.status,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      }));
    }

    case 'rfqs': {
      const rfqs = await RFQ.find({})
        .populate('buyer seller', 'fullName name businessName email phone')
        .populate('product', 'name')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return rfqs.map((rfq) => ({
        id: docId(rfq),
        rfqNumber: rfq.rfqNumber,
        buyer: displayName(rfq.buyer),
        seller: displayName(rfq.seller),
        product: rfq.product?.name || docId(rfq.product),
        quantity: rfq.quantity,
        unit: rfq.unit,
        targetPrice: rfq.targetPrice,
        status: rfq.status,
        quoteTotal: rfq.quote?.totalPrice,
        neededBy: rfq.neededBy,
        createdAt: rfq.createdAt,
      }));
    }

    case 'reviews': {
      const reviews = await Review.find({})
        .populate('product', 'name')
        .populate('seller reviewer', 'fullName name businessName email phone')
        .populate('order', 'orderNumber')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return reviews.map((review) => ({
        id: docId(review),
        product: review.product?.name || docId(review.product),
        seller: displayName(review.seller),
        reviewer: displayName(review.reviewer),
        order: review.order?.orderNumber || docId(review.order),
        rating: review.rating,
        title: review.title,
        verified: review.verified,
        helpful: review.helpful,
        unhelpful: review.unhelpful,
        createdAt: review.createdAt,
      }));
    }

    case 'agent-referrals': {
      const referrals = await AgentReferral.find({})
        .populate('seller', 'fullName name businessName email phone')
        .sort('-referredAt')
        .limit(limit)
        .lean();
      return referrals.map((referral) => {
        const seller = referral.seller || referral.sellerSnapshot || {};
        return {
          id: docId(referral),
          agentNationalId: referral.agentNationalId,
          seller: displayName(seller) || referral.sellerSnapshot?.name,
          sellerEmail: seller.email || referral.sellerSnapshot?.email,
          sellerPhone: seller.phone || referral.sellerSnapshot?.phone,
          businessName: seller.businessName || referral.sellerSnapshot?.businessName,
          planId: referral.planId,
          source: referral.source,
          paymentReference: referral.paymentReference,
          status: referral.status,
          referredAt: referral.referredAt,
          createdAt: referral.createdAt,
        };
      });
    }

    default:
      return null;
  }
};

/**
 * Export admin records as CSV
 * GET /api/v1/admin/export/:type
 */
exports.exportRecordsCsv = async (req, res, next) => {
  try {
    const type = String(req.params.type || '').trim().toLowerCase();
    if (!ADMIN_EXPORT_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported export type. Use one of: ${ADMIN_EXPORT_TYPES.join(', ')}`,
      });
    }

    const rows = await getAdminExportRows(type, req.query || {});
    const exportSuffix = type === 'subscriptions' && req.query?.plan && req.query.plan !== 'all'
      ? `_${String(req.query.plan).replace(/[^a-z0-9_-]/gi, '').toLowerCase()}`
      : '';
    sendCsv(res, `admin_${type}${exportSuffix}_${dateStamp()}.csv`, adminCsvHeaders[type], rows || []);
  } catch (error) {
    next(error);
  }
};

/**
 * Export compact admin report as CSV
 * GET /api/v1/admin/reports/summary.csv
 */
exports.exportSummaryCsv = async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalProducts,
      activeProducts,
      inactiveProducts,
      totalOrders,
      pendingOrders,
      logisticsProviders,
      verifiedLogistics,
      transactions,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: { $ne: 'admin' }, isActive: true, isBlocked: { $ne: true } }),
      Product.countDocuments(),
      Product.countDocuments({ isPublished: true }),
      Product.countDocuments({ isPublished: false }),
      Order.countDocuments(),
      Order.countDocuments({ status: { $in: ['pending', 'pending_payment', 'processing'] } }),
      User.countDocuments({ $or: [{ role: 'logistics' }, { businessType: 'logistics' }] }),
      User.countDocuments({ $or: [{ 'logisticsProfile.verificationStatus': 'verified' }, { verificationStatus: 'verified' }] }),
      Transaction.find().sort('-createdAt').limit(8).populate('user', 'fullName name email phone').lean(),
    ]);

    const rows = [
      { section: 'Platform Snapshot', metric: 'Total users', value: totalUsers },
      { section: 'Platform Snapshot', metric: 'Active users', value: activeUsers },
      { section: 'Platform Snapshot', metric: 'Total products', value: totalProducts },
      { section: 'Platform Snapshot', metric: 'Active products', value: activeProducts },
      { section: 'Platform Snapshot', metric: 'Inactive products', value: inactiveProducts },
      { section: 'Platform Snapshot', metric: 'Total orders', value: totalOrders },
      { section: 'Platform Snapshot', metric: 'Pending or processing orders', value: pendingOrders },
      { section: 'Platform Snapshot', metric: 'Logistics providers', value: logisticsProviders },
      { section: 'Platform Snapshot', metric: 'Verified logistics', value: verifiedLogistics },
      ...transactions.map((transaction) => ({
        section: 'Recent Transactions',
        metric: transaction.reference || transaction.transactionId || String(transaction._id).slice(-8),
        value: `${transaction.type || transaction.paymentMethod || 'payment'} | KES ${Number(transaction.amount || 0).toLocaleString()} | ${transaction.user?.email || transaction.user?.phone || 'user'}`,
      })),
    ];

    sendCsv(res, `admin_report_${dateStamp()}.csv`, ['section', 'metric', 'value'], rows);
  } catch (error) {
    next(error);
  }
};

// Helper functions
function getOrderTimeline(order) {
  const timeline = [];
  if (order.createdAt) timeline.push({ status: 'Order Placed', date: order.createdAt });
  if (order.confirmedAt) timeline.push({ status: 'Confirmed', date: order.confirmedAt });
  if (order.processingAt) timeline.push({ status: 'Processing', date: order.processingAt });
  if (order.shippedAt) timeline.push({ status: 'Shipped', date: order.shippedAt });
  if (order.deliveredAt) timeline.push({ status: 'Delivered', date: order.deliveredAt });
  return timeline;
}

function calculateEstimatedDelivery(createdAt) {
  const estimated = new Date(createdAt);
  estimated.setDate(estimated.getDate() + 5); // 5 days delivery estimate
  return estimated;
}
