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
const SupportMessage = require('../models/SupportMessage.model');
const billingService = require('../services/subscription/billing.service');
const escrowService = require('../services/order/escrow.service');
const notificationService = require('../services/notification/notification.service');
const emailService = require('../services/notification/email.service');
const smsService = require('../services/notification/sms.service');
const { uploadToCloudinary } = require('../config/cloudinary.config');
const { PLANS } = require('../config/subscriptionPlans');
const { validationResult } = require('express-validator');

const getDocId = (value) => value?._id || value?.id || value;

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

const escapePdfText = (value = '') => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const buildSimplePdfBuffer = (title, rows = []) => {
  const lines = [];
  let y = 800;
  const addText = (size, text, x = 48) => {
    lines.push(`BT /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`);
    y -= size + 7;
  };

  addText(18, title);
  addText(10, `Generated: ${new Date().toLocaleString()}`);
  y -= 8;
  rows.forEach((row) => {
    if (y < 80) return;
    addText(row.size || 10, row.text || '');
  });

  const content = lines.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${object}\n`;
  });
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf);
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
    externalProvider: escrow.externalProvider,
    externalStatus: escrow.externalStatus,
    externalTransactionId: escrow.externalTransactionId,
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
    const andConditions = [];

    if (role && role !== 'all') {
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

    const query = andConditions.length ? { $and: andConditions } : {};
    
    const [users, total, summaryRows, documentUsers] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort('-createdAt')
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      User.countDocuments(query),
      User.aggregate([
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
      User.find({})
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
    const updates = {};
    
    if (role) updates.role = role;
    if (businessType) updates.businessType = businessType;
    if (isBlocked !== undefined) updates.isBlocked = isBlocked;
    if (isActive !== undefined) updates.isActive = isActive;
    else if (isBlocked !== undefined) updates.isActive = !isBlocked;
    if (isPhoneVerified !== undefined) updates.isPhoneVerified = isPhoneVerified;
    if (isEmailVerified !== undefined) updates.isEmailVerified = isEmailVerified;
    if (kycVerified !== undefined) updates.kycVerified = kycVerified;
    if (verificationStatus) updates.verificationStatus = verificationStatus;
    if (userType) updates.userType = userType;
    if (businessName) updates.businessName = businessName;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;

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
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
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
 * Get all saved user documents from database-backed user document sources
 * GET /api/v1/admin/users/:userId/documents
 */
exports.getUserDocuments = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select('-password').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
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

    const users = await User.find({})
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
      .select('order tripId bookingReference trackingNumber status carrier estimatedDelivery shippingCost driverName driverPhone liveTracking gpsTracking')
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
 * Update product status/details as admin
 * PUT /api/v1/admin/products/:productId
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const product = await Product.findById(req.params.productId);
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

    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isPublished = !product.isPublished;
    await product.save();

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
        select: 'orderNumber buyer seller totalAmount status paymentStatus paidAt deliveredAt releasedAt escrowReleaseDate',
        populate: [
          { path: 'buyer', select: 'fullName name email phone userType' },
          { path: 'seller', select: 'fullName name businessName email phone' },
        ],
      })
      .populate('seller', 'fullName name businessName email phone')
      .populate('buyer', 'fullName name email phone userType')
      .populate('driver', 'fullName name phone logisticsProfile.currentLocation')
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
        select: 'orderNumber buyer seller totalAmount status paymentStatus paidAt deliveredAt releasedAt escrowReleaseDate',
        populate: [
          { path: 'buyer', select: 'fullName name email phone userType' },
          { path: 'seller', select: 'fullName name businessName email phone' },
        ],
      })
      .populate('seller', 'fullName name businessName email phone')
      .populate('buyer', 'fullName name email phone userType')
      .populate('driver', 'fullName name phone logisticsProfile.currentLocation')
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
    const logistics = await Logistics.findById(req.params.logisticsId).select('order orderNumber status').lean();
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found' });
    }
    if (!logistics.order) {
      return res.status(409).json({ success: false, message: 'This logistics record is not linked to an order escrow.' });
    }

    const result = await escrowService.releasePayment(logistics.order, {
      releasedBy: req.user._id || req.user.id,
      forceRelease: req.body.forceRelease !== false,
      releaseMethod: 'admin_override',
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
      .populate('driver', 'fullName name phone logisticsProfile.currentLocation')
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

/**
 * Export compact admin report as PDF
 * GET /api/v1/admin/reports/summary.pdf
 */
exports.exportSummaryPdf = async (req, res, next) => {
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
      { size: 13, text: 'Platform Snapshot' },
      { text: `Users: ${totalUsers} total | ${activeUsers} active` },
      { text: `Products: ${totalProducts} total | ${activeProducts} active | ${inactiveProducts} inactive` },
      { text: `Orders: ${totalOrders} total | ${pendingOrders} pending/processing` },
      { text: `Logistics: ${logisticsProviders} providers | ${verifiedLogistics} verified` },
      { size: 13, text: 'Recent Transactions' },
      ...transactions.map((transaction) => ({
        text: `${transaction.reference || transaction.transactionId || String(transaction._id).slice(-8)} | ${transaction.type || transaction.paymentMethod || 'payment'} | KES ${Number(transaction.amount || 0).toLocaleString()} | ${transaction.user?.email || transaction.user?.phone || 'user'}`,
      })),
    ];

    const pdfBuffer = buildSimplePdfBuffer('Lango MarketPulse Admin Report', rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="admin_report_${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.send(pdfBuffer);
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
