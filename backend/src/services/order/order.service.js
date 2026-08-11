const Order = require('../../models/Order.model');
const mongoose = require('mongoose');
const Product = require('../../models/Product.model');
const User = require('../../models/User.model');
const Logistics = require('../../models/Logistics.model');
const Escrow = require('../../models/Escrow.model');
const productService = require('../inventory/product.service');
const escrowService = require('./escrow.service');
const trustPolicy = require('../trustPolicy.service');
const notificationService = require('../notification/notification.service');
const localGeocoder = require('../maps/localGeocoder.service');
const qrChainSvc = require('./qrChain.service');
const { smsQueue } = require('../../config/redis');
const { v4: uuidv4 } = require('uuid');

const MOQ_BUSINESS_TYPES = new Set(['wholesaler', 'manufacturer']);
const MOQ_EXEMPT_TYPES = new Set(['farmer', 'retailer']);

const normalizeBusinessType = (value) => String(value || '').trim().toLowerCase();

const requiresBulkMinimumOrder = (seller = {}) => {
  const businessType = normalizeBusinessType(seller.businessType || seller.role);
  if (MOQ_EXEMPT_TYPES.has(businessType)) return false;
  return MOQ_BUSINESS_TYPES.has(businessType);
};

const normalizeDeliveryAddress = (deliveryAddress) => {
  if (!deliveryAddress) return undefined;

  if (typeof deliveryAddress === 'string') {
    return {
      label: deliveryAddress.trim(),
      country: 'Kenya',
    };
  }

  if (typeof deliveryAddress === 'object') {
    return {
      label: deliveryAddress.label || deliveryAddress.address || deliveryAddress.street,
      county: deliveryAddress.county,
      town: deliveryAddress.town,
      street: deliveryAddress.street,
      country: deliveryAddress.country || 'Kenya',
      gpsLat: deliveryAddress.gpsLat,
      gpsLng: deliveryAddress.gpsLng,
    };
  }

  return undefined;
};

const httpError = (message, statusCode, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
};

const toObjectId = (value) => {
  if (!value) return value;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : value;
};

const getRangeStart = (range) => {
  const now = new Date();
  const start = new Date(now);
  const normalized = String(range || '').toLowerCase();

  if (normalized === 'today') {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  const legacyRanges = {
    '7d': { amount: 7, unit: 'd' },
    '30d': { amount: 1, unit: 'm' },
    '90d': { amount: 3, unit: 'm' },
    year: { amount: 1, unit: 'y' },
  };
  const parsedRange = legacyRanges[normalized] || (() => {
    const match = normalized.match(/^(\d+)([dwmy])$/);
    return match ? { amount: Number(match[1]), unit: match[2] } : null;
  })();

  if (!parsedRange) return null;

  if (parsedRange.unit === 'd') start.setDate(now.getDate() - parsedRange.amount);
  else if (parsedRange.unit === 'w') start.setDate(now.getDate() - (parsedRange.amount * 7));
  else if (parsedRange.unit === 'm') start.setMonth(now.getMonth() - parsedRange.amount);
  else if (parsedRange.unit === 'y') start.setFullYear(now.getFullYear() - parsedRange.amount);

  return start;
};

const buildDateFilter = ({ range, startDate, endDate } = {}) => {
  const createdAt = {};
  const rangeStart = getRangeStart(range);
  if (rangeStart) createdAt.$gte = rangeStart;
  if (startDate) {
    const parsedStart = new Date(startDate);
    if (!Number.isNaN(parsedStart.getTime())) {
      parsedStart.setHours(0, 0, 0, 0);
      createdAt.$gte = parsedStart;
    }
  }
  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!Number.isNaN(parsedEnd.getTime())) {
      parsedEnd.setHours(23, 59, 59, 999);
      createdAt.$lte = parsedEnd;
    }
  }
  return Object.keys(createdAt).length ? createdAt : null;
};

const normalizeLogisticsAddress = (address, fallback = {}) => {
  const source = address || fallback || {};
  if (typeof source === 'string') {
    return {
      label: source,
      town: fallback.town || source,
      county: fallback.county || 'Unknown',
      country: 'Kenya',
    };
  }

  return {
    label: source.label || source.address || source.street || fallback.label || fallback.address,
    county: source.county || source.state || fallback.county || fallback.state || 'Unknown',
    town: source.town || source.city || source.locationHub || fallback.town || fallback.city || fallback.locationHub || 'Unknown',
    street: source.street || fallback.street,
    country: source.country || fallback.country || 'Kenya',
    gpsLat: source.gpsLat ?? source.lat ?? fallback.gpsLat ?? fallback.lat,
    gpsLng: source.gpsLng ?? source.lng ?? fallback.gpsLng ?? fallback.lng,
  };
};

const idsMatch = (left, right) => left != null && right != null && left.toString() === right.toString();

const getDocId = (value) => value?._id || value?.id || value;

const getOrderLabel = (order) => order?.orderNumber || `ORD-${String(order?._id || '').slice(-8).toUpperCase()}`;

const readableStatus = (status) => String(status || '')
  .replaceAll('_', ' ')
  .toLowerCase()
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getCoordinatePair = (source = {}) => {
  const lat = toFiniteNumber(source.lat ?? source.gpsLat);
  const lng = toFiniteNumber(source.lng ?? source.gpsLng);
  return lat !== null && lng !== null ? { lat, lng } : null;
};

const getUserLocationCoordinates = (user = {}) => {
  const direct = getCoordinatePair(user.location);
  if (direct) return direct;
  const coordinates = user.location?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length === 2) {
    const lng = toFiniteNumber(coordinates[0]);
    const lat = toFiniteNumber(coordinates[1]);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  return getCoordinatePair(user.logisticsProfile?.currentLocation);
};

const geocodeLocal = (address) => {
  const geocoded = localGeocoder.geocodeAddress(address);
  if (!geocoded) return null;
  return { lat: geocoded.lat, lng: geocoded.lng };
};

const calculateDistanceKm = (start, end) => {
  if (!start || !end) return 0;
  const earthRadiusKm = 6371;
  const dLat = ((end.lat - start.lat) * Math.PI) / 180;
  const dLng = ((end.lng - start.lng) * Math.PI) / 180;
  const lat1 = (start.lat * Math.PI) / 180;
  const lat2 = (end.lat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const estimateOrderWeightKg = (product, quantity) => {
  const unit = String(product?.unit || '').toLowerCase();
  const explicitWeight = Number(product?.weightKg || product?.metadata?.get?.('weightKg') || product?.metadata?.weightKg || 0);
  if (explicitWeight > 0) return Math.max(1, explicitWeight * Number(quantity || 1));
  if (unit === 'g') return Math.max(1, Number(quantity || 1) / 1000);
  if (unit === 'ton') return Math.max(1, Number(quantity || 1) * 1000);
  if (unit === 'kg') return Math.max(1, Number(quantity || 1));
  return Math.max(1, Number(quantity || 1));
};

const calculateLogisticsCharge = ({ product, seller, deliveryAddress, quantity }) => {
  const sellerCoords = getUserLocationCoordinates(seller);
  const productPickupAddress = product?.pickupAddress || product?.metadata?.get?.('pickupAddress') || product?.metadata?.pickupAddress;
  const pickupAddress = normalizeLogisticsAddress(productPickupAddress, {
    label: product?.locationHub || seller?.locationHub || seller?.city || seller?.address || 'Seller pickup hub',
    town: product?.locationHub || seller?.locationHub || seller?.city || 'Seller hub',
    county: seller?.city || 'Unknown',
    gpsLat: sellerCoords?.lat,
    gpsLng: sellerCoords?.lng,
  });
  const shippingAddress = normalizeLogisticsAddress(deliveryAddress, {
    label: deliveryAddress?.label || deliveryAddress?.street || 'Buyer delivery address',
    town: deliveryAddress?.town || deliveryAddress?.city || 'Delivery town pending',
    county: deliveryAddress?.county || deliveryAddress?.state || 'Unknown',
  });

  const pickupCoords = getCoordinatePair(pickupAddress) || geocodeLocal(pickupAddress);
  const deliveryCoords = getCoordinatePair(shippingAddress) || geocodeLocal(shippingAddress);
  if (pickupCoords) {
    pickupAddress.gpsLat = pickupCoords.lat;
    pickupAddress.gpsLng = pickupCoords.lng;
  }
  if (deliveryCoords) {
    shippingAddress.gpsLat = deliveryCoords.lat;
    shippingAddress.gpsLng = deliveryCoords.lng;
  }

  const distanceKm = calculateDistanceKm(pickupCoords, deliveryCoords);
  const weightKg = estimateOrderWeightKg(product, quantity);
  const baseFee = 250;
  const ratePerKm = 45;
  const weightRate = 15;
  const minimumFee = 500;
  const calculatedFee = distanceKm > 0
    ? baseFee + (distanceKm * ratePerKm) + (weightKg * weightRate)
    : minimumFee;
  const logisticsFee = Math.max(minimumFee, Math.ceil(calculatedFee));

  return {
    logisticsFee,
    distanceKm: Math.round(distanceKm * 100) / 100,
    weightKg,
    pickupAddress,
    shippingAddress,
    estimated: !(pickupCoords && deliveryCoords),
    ratePerKm,
    weightRate,
    baseFee,
    minimumFee,
    calculationSource: pickupCoords && deliveryCoords ? 'gps_or_local_geocode' : 'minimum_fee_missing_gps',
  };
};

const getSelectedLogisticsProvider = async (seller) => {
  const addon = seller?.sellerLogisticsAddon || {};
  const providerId = addon.selectedProvider?._id || addon.selectedProvider;
  if (!addon.active || !providerId || !mongoose.Types.ObjectId.isValid(providerId)) return null;

  const provider = await User.findOne({
    _id: providerId,
    role: 'logistics',
    $or: [
      { verificationStatus: 'verified' },
      { 'logisticsProfile.verificationStatus': 'verified' },
    ],
  }).select('fullName name businessName phone logisticsProfile employer ownerAccount role');

  return provider || null;
};

const getVerifiedLogisticsProviderById = async (providerId) => {
  if (!providerId) return null;
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw httpError('Choose a valid logistics company.', 400);
  }

  const provider = await User.findOne({
    _id: providerId,
    role: 'logistics',
    $or: [
      { verificationStatus: 'verified' },
      { verificationStatus: 'gold' },
      { 'logisticsProfile.verificationStatus': 'verified' },
    ],
  }).select('fullName name businessName phone logisticsProfile employer ownerAccount role');

  if (!provider) {
    throw httpError('Selected logistics company is not available or verified.', 404);
  }

  return provider;
};

const buildLogisticsPreference = ({ provider, selectedBy, selectionSource, notes }) => ({
  selectedBy,
  requestedProvider: provider?._id,
  providerName: provider?.businessName || provider?.fullName || provider?.name || undefined,
  providerPhone: provider?.phone || undefined,
  providerHub: provider?.logisticsProfile?.baseHub || provider?.logisticsProfile?.locationHub || undefined,
  selectionSource,
  notes: String(notes || '').trim().slice(0, 300),
  requestedAt: new Date(),
});

const buildLogisticsAssignment = (provider) => {
  if (!provider?._id) return {};
  const driverMode = String(provider.logisticsProfile?.driverMode || '').toLowerCase();
  const fleetOwner = provider.employer || provider.ownerAccount || provider.logisticsProfile?.fleetOwner;
  const isFleetManaged = driverMode === 'hired_driver' || Boolean(fleetOwner);

  return {
    driver: provider._id,
    ...(isFleetManaged && fleetOwner ? { fleetOwner } : {}),
    driverName: provider.businessName || provider.fullName || provider.name || 'Logistics provider',
    driverPhone: provider.phone || '',
    carrier: isFleetManaged ? 'fleet_managed' : 'solo_owner_operator',
  };
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
  const origin = validPoints[0];
  const destination = validPoints[validPoints.length - 1];
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
};

const buildGoogleMapsEmbedUrl = (points = []) => {
  const validPoints = points.filter((point) => point?.lat !== undefined && point?.lng !== undefined);
  if (!validPoints.length) return null;
  const driverPoint = validPoints.find((point) => point.label === 'driver');
  const target = driverPoint || validPoints[validPoints.length - 1];
  return `https://maps.google.com/maps?q=${target.lat},${target.lng}&z=13&output=embed`;
};

const buildOrderNotificationData = (order, event, extra = {}) => ({
  orderId: String(order?._id || ''),
  orderNumber: getOrderLabel(order),
  productId: String(getDocId(order?.product) || ''),
  status: order?.status,
  event,
  href: extra.href || '/orders',
  ...extra,
});

const createOrderNotification = async (userId, { title, body, order, event, channel = 'order_update', data = {} }) => {
  if (!userId) return null;

  try {
    return await notificationService.create(userId, {
      type: 'in_app',
      channel,
      title,
      body,
      status: 'pending',
      data: buildOrderNotificationData(order, event, data),
    });
  } catch (error) {
    console.warn('Order notification failed:', error.message);
    return null;
  }
};

const notifyOrderParties = async (order, { buyer, seller } = {}) => {
  const tasks = [];
  const buyerId = getDocId(order?.buyer);
  const sellerId = getDocId(order?.seller);

  if (buyerId && buyer) {
    tasks.push(createOrderNotification(buyerId, { ...buyer, order }));
  }

  if (sellerId && seller && String(sellerId) !== String(buyerId)) {
    tasks.push(createOrderNotification(sellerId, { ...seller, order }));
  }

  await Promise.all(tasks);
};

const getPopulatedOrder = (orderId) => Order.findById(orderId)
  .populate('buyer', 'fullName name businessName phone email')
  .populate('seller', 'fullName name businessName phone email')
  .populate('logisticsPreference.requestedProvider', 'fullName name businessName phone logisticsProfile.baseHub logisticsProfile.locationHub logisticsProfile.vehiclePlate logisticsProfile.vehicleType')
  .populate('product', 'name images sku trackingSku');

const summarizeEscrow = (escrow) => {
  if (!escrow) return null;
  return {
    id: escrow._id,
    status: escrow.status,
    escrowStatus: escrow.status,
    amount: escrow.amount,
    escrowAmount: escrow.amount,
    currency: escrow.currency,
    paidAt: escrow.paidAt,
    heldAt: escrow.heldAt,
    deliveredAt: escrow.deliveredAt,
    autoReleaseAt: escrow.autoReleaseAt,
    expectedReleaseDate: escrow.autoReleaseAt,
    releasedAt: escrow.releasedAt,
    sellerPayout: escrow.sellerPayout,
    driverPayout: escrow.driverPayout,
    platformFee: escrow.platformFee,
    sinkingFundAmount: escrow.sinkingFundAmount,
    refundAmount: escrow.refundAmount,
    payouts: escrow.payouts || [],
  };
};

const summarizeLogistics = (logistics) => {
  if (!logistics) return null;
  const metadata = logistics.metadata instanceof Map
    ? Object.fromEntries(logistics.metadata)
    : logistics.metadata || {};
  const pickupCoords = getCoordinatePair(logistics.pickupAddress);
  const deliveryCoords = getCoordinatePair(logistics.shippingAddress);
  const driverCoords = getFirstCoordinatePair(
    logistics.gpsTracking?.current,
    logistics.driver?.logisticsProfile?.currentLocation
  );
  const history = (Array.isArray(logistics.gpsTracking?.history) ? logistics.gpsTracking.history : [])
    .slice(-50)
    .map((entry) => ({
      lat: toFiniteNumber(entry.location?.lat),
      lng: toFiniteNumber(entry.location?.lng),
      accuracy: entry.accuracy,
      speed: entry.speed,
      heading: entry.heading,
      timestamp: entry.timestamp,
      label: 'history',
    }))
    .filter((point) => point.lat !== null && point.lng !== null);
  const routePath = [
    pickupCoords ? { ...pickupCoords, label: 'pickup' } : null,
    ...history,
    driverCoords ? { ...driverCoords, label: 'driver' } : null,
    deliveryCoords ? { ...deliveryCoords, label: 'delivery' } : null,
  ].filter(Boolean);

  return {
    id: logistics._id,
    status: logistics.status,
    trackingNumber: logistics.trackingNumber,
    tripId: logistics.tripId,
    bookingReference: logistics.bookingReference,
    carrier: logistics.carrier,
    driverName: logistics.driverName,
    driverPhone: logistics.driverPhone,
    driver: logistics.driver,
    currentLocation: logistics.currentLocation,
    pickupQrConfirmed: logistics.pickupQrConfirmed,
    deliveryQrConfirmed: logistics.deliveryQrConfirmed,
    pickupAddress: logistics.pickupAddress,
    shippingAddress: logistics.shippingAddress,
    routeInfo: logistics.routeInfo,
    estimatedDelivery: logistics.estimatedDelivery,
    actualDelivery: logistics.actualDelivery,
    escrowReleaseDue: logistics.escrowReleaseDue,
    shippingCost: logistics.shippingCost,
    settlement: logistics.settlement,
    metadata,
    trackingHistory: logistics.trackingHistory || [],
    qrScans: logistics.qrScans || [],
    gpsTracking: logistics.gpsTracking,
    liveTracking: {
      pickup: pickupCoords,
      delivery: deliveryCoords,
      driver: driverCoords,
      history,
      routePath,
      lastUpdate: logistics.gpsTracking?.current?.lastUpdate || history[history.length - 1]?.timestamp || logistics.updatedAt,
      googleMapsUrl: buildGoogleMapsUrl(routePath.length ? routePath : [pickupCoords, deliveryCoords]),
      embedUrl: buildGoogleMapsEmbedUrl(routePath.length ? routePath : [pickupCoords, deliveryCoords]),
    },
  };
};

const summarizeParty = (party) => {
  if (!party) return null;
  const plain = party?.toObject ? party.toObject() : party;
  return {
    id: plain._id || plain.id,
    name: plain.businessName || plain.fullName || plain.name || 'Assigned partner',
    phone: plain.phone || '',
    email: plain.email || '',
  };
};

const statusEvent = ({ source, status, note, timestamp, location, gpsCoords }) => ({
  source,
  status,
  note,
  timestamp,
  location,
  gpsCoords,
});

const buildSellerTracking = (order) => {
  const timeline = Array.isArray(order.timeline) ? order.timeline : [];
  const createdEvent = statusEvent({
    source: 'seller',
    status: 'order_placed',
    note: 'Order placed and sent to the seller.',
    timestamp: order.createdAt,
  });

  return [createdEvent, ...timeline.map((item) => statusEvent({
    source: 'seller',
    status: item.status,
    note: item.note || `Seller/order status changed to ${readableStatus(item.status)}.`,
    timestamp: item.timestamp,
  }))].filter((item) => item.timestamp);
};

const buildLogisticsTracking = (logistics) => {
  if (!logistics) return [];

  const history = Array.isArray(logistics.trackingHistory) ? logistics.trackingHistory.map((item) => statusEvent({
    source: 'logistics',
    status: item.status,
    note: item.notes || 'Shipment status updated.',
    timestamp: item.timestamp,
    location: item.location,
    gpsCoords: item.gpsCoords,
  })) : [];

  const qrEvents = Array.isArray(logistics.qrScans) ? logistics.qrScans.map((scan) => statusEvent({
    source: 'logistics',
    status: `${scan.step}_qr_scanned`,
    note: `${scan.step === 'pickup' ? 'Seller pickup' : 'Buyer delivery'} QR scan confirmed.`,
    timestamp: scan.scannedAt,
    gpsCoords: scan.gpsCoords,
  })) : [];

  return [...history, ...qrEvents].filter((item) => item.timestamp);
};

const buildTrackingMilestones = ({ order, logistics, escrow }) => {
  const orderStatus = order.status;
  const logisticsStatus = logistics?.status;
  const sellerAccepted = !['pending', 'pending_payment', 'AWAITING_PAYMENT'].includes(orderStatus);
  const inTransit = ['dispatched', 'IN_TRANSIT'].includes(orderStatus) ||
    ['picked_up', 'in_transit', 'out_for_delivery'].includes(logisticsStatus);
  const delivered = ['delivered', 'DELIVERED', 'completed', 'RELEASED'].includes(orderStatus) ||
    logisticsStatus === 'delivered';

  return [
    {
      key: 'payment',
      label: 'Payment secured',
      complete: Boolean(order.paidAt || escrow?.paidAt || escrow?.heldAt || ['FUNDS_HELD', 'payment_escrowed', 'processing', 'dispatched', 'IN_TRANSIT', 'DELIVERED', 'RELEASED', 'completed'].includes(orderStatus)),
      source: 'escrow',
    },
    {
      key: 'seller',
      label: 'Seller processing',
      complete: sellerAccepted,
      source: 'seller',
    },
    {
      key: 'pickup',
      label: 'Logistics pickup',
      complete: Boolean(logistics?.pickupQrConfirmed || logistics?.qrScans?.some((scan) => scan.step === 'pickup') || inTransit || delivered),
      source: 'logistics',
    },
    {
      key: 'delivery',
      label: 'Delivered',
      complete: delivered,
      source: 'logistics',
    },
  ];
};

const attachOrderRelations = async (orders) => {
  const list = Array.isArray(orders) ? orders : [orders];
  const ids = list.map((order) => getDocId(order)).filter(Boolean);
  if (!ids.length) return Array.isArray(orders) ? [] : null;

  const [escrows, logisticsRecords] = await Promise.all([
    Escrow.find({ order: { $in: ids } }).lean(),
    Logistics.find({ order: { $in: ids } }).lean(),
  ]);
  const escrowMap = new Map(escrows.map((escrow) => [String(escrow.order), escrow]));
  const logisticsMap = new Map(logisticsRecords.map((record) => [String(record.order), record]));

  const decorated = list.map((order) => {
    const plain = order?.toObject ? order.toObject() : order;
    const id = String(getDocId(plain));
    return {
      ...plain,
      escrow: summarizeEscrow(escrowMap.get(id)),
      logistics: summarizeLogistics(logisticsMap.get(id)),
    };
  });

  return Array.isArray(orders) ? decorated : decorated[0];
};

class OrderService {
  async createOrder(orderData) {
    const { buyer, product, quantity, deliveryAddress, logisticsProviderId, logisticsPreference = {} } = orderData;

    // Get product details
    const productDoc = await Product.findById(product);
    if (!productDoc) throw httpError('Product not found', 404);

    const seller = await User.findById(productDoc.seller).select('role businessType phone locationHub city address location logisticsProfile.currentLocation sellerLogisticsAddon');
    const buyerDoc = await User.findById(buyer).select('buyerLogisticsPreference');
    const requiresBulkMinimum = requiresBulkMinimumOrder(seller);
    const orderQuantity = Number(quantity);

    if (requiresBulkMinimum && orderQuantity < 10) {
      throw httpError('Minimum order for wholesaler/manufacturer products is 10 pieces (MQQ1: 10-2,999, MQQ2: 3,000+)', 400);
    }

    // Check stock
    if (productDoc.quantityAvailable - productDoc.reservedQuantity < orderQuantity) {
      throw httpError('Insufficient stock', 409);
    }

    // Reserve stock
    await productService.reserveStock(product, orderQuantity);

    const normalizedDeliveryAddress = normalizeDeliveryAddress(deliveryAddress);
    const productSubtotal = orderQuantity * productDoc.price;
    const logisticsQuote = calculateLogisticsCharge({
      product: productDoc,
      seller,
      deliveryAddress: normalizedDeliveryAddress,
      quantity: orderQuantity,
    });
    const savedBuyerProviderId = buyerDoc?.buyerLogisticsPreference?.active
      ? buyerDoc.buyerLogisticsPreference.selectedProvider
      : null;
    const buyerRequestedProviderId = logisticsProviderId || savedBuyerProviderId;
    const buyerPreferenceNotes = logisticsProviderId
      ? logisticsPreference.notes
      : buyerDoc?.buyerLogisticsPreference?.notes || logisticsPreference.notes;
    const buyerSelectedProvider = buyerRequestedProviderId
      ? await getVerifiedLogisticsProviderById(buyerRequestedProviderId)
      : null;
    const sellerSelectedProvider = buyerSelectedProvider ? null : await getSelectedLogisticsProvider(seller);
    const selectedProvider = buyerSelectedProvider || sellerSelectedProvider;
    const selectionSource = buyerSelectedProvider ? 'buyer' : sellerSelectedProvider ? 'seller' : 'default';
    const logisticsAssignment = buildLogisticsAssignment(selectedProvider);
    const savedLogisticsPreference = buildLogisticsPreference({
      provider: selectedProvider,
      selectedBy: buyerSelectedProvider ? buyer : selectedProvider ? productDoc.seller : undefined,
      selectionSource,
      notes: buyerPreferenceNotes,
    });

    // Create order
    const order = await Order.create({
      buyer,
      seller: productDoc.seller,
      product,
      quantity: orderQuantity,
      unitPrice: productDoc.price,
      productSubtotal,
      logisticsFee: logisticsQuote.logisticsFee,
      logisticsDistanceKm: logisticsQuote.distanceKm,
      logisticsPricing: {
        estimated: logisticsQuote.estimated,
        origin: logisticsQuote.pickupAddress,
        destination: logisticsQuote.shippingAddress,
        weightKg: logisticsQuote.weightKg,
        ratePerKm: logisticsQuote.ratePerKm,
        weightRate: logisticsQuote.weightRate,
        baseFee: logisticsQuote.baseFee,
        minimumFee: logisticsQuote.minimumFee,
        calculationSource: logisticsQuote.calculationSource,
      },
      totalAmount: productSubtotal + logisticsQuote.logisticsFee,
      deliveryAddress: normalizedDeliveryAddress,
      deliveryAddressText: typeof deliveryAddress === 'string' ? deliveryAddress.trim() : normalizedDeliveryAddress?.label,
      logisticsPreference: savedLogisticsPreference,
      qrChain: uuidv4(),
      status: 'pending_payment',
      inventoryReservedAt: new Date(),
    });

    try {
      const logistics = await Logistics.create({
        order: order._id,
        orderNumber: getOrderLabel(order),
        seller: productDoc.seller,
        buyer,
        carrier: logisticsAssignment.carrier || 'solo_owner_operator',
        ...logisticsAssignment,
        pickupAddress: logisticsQuote.pickupAddress,
        shippingAddress: logisticsQuote.shippingAddress,
        weight: logisticsQuote.weightKg,
        weightUnit: 'kg',
        cargoType: productDoc.name || 'Order cargo',
        status: 'pending',
        shippingCost: logisticsQuote.logisticsFee,
        routeInfo: {
          totalDistanceKm: logisticsQuote.distanceKm,
          estimatedDurationMin: logisticsQuote.distanceKm ? Math.ceil((logisticsQuote.distanceKm / 45) * 60) : 0,
          waypoints: [
            {
              location: {
                lat: logisticsQuote.pickupAddress.gpsLat,
                lng: logisticsQuote.pickupAddress.gpsLng,
              },
              address: logisticsQuote.pickupAddress.label,
              type: 'pickup',
              sequence: 1,
            },
            {
              location: {
                lat: logisticsQuote.shippingAddress.gpsLat,
                lng: logisticsQuote.shippingAddress.gpsLng,
              },
              address: logisticsQuote.shippingAddress.label,
              type: 'dropoff',
              sequence: 2,
            },
          ].filter((point) => point.location.lat != null && point.location.lng != null),
        },
        metadata: {
          autoCreated: true,
          source: 'order_created_with_buyer_location',
          paymentIncludedInEscrow: true,
          distanceKm: logisticsQuote.distanceKm,
          calculationSource: logisticsQuote.calculationSource,
          estimated: logisticsQuote.estimated,
          selectedProviderId: selectedProvider?._id,
          selectedProviderName: selectedProvider?.businessName || selectedProvider?.fullName || selectedProvider?.name,
          selectedProviderPhone: selectedProvider?.phone,
          selectedBy: selectionSource,
          buyerRequestedProvider: Boolean(buyerSelectedProvider),
        },
      });
      await qrChainSvc.generateTripTokens(logistics);
    } catch (logisticsError) {
      console.warn('Order logistics creation failed:', logisticsError.message);
    }

    // Notify seller via SMS
    if (seller?.phone) {
      await smsQueue.add('send', {
        to: seller.phone,
        message: `New order #${order._id} for ${orderQuantity} ${productDoc.name}. Awaiting payment. Total KES ${Math.ceil(order.totalAmount).toLocaleString()} includes logistics${selectedProvider ? ` via ${savedLogisticsPreference.providerName}` : ''}.`,
      });
    }

    await notifyOrderParties(order, {
      buyer: {
        event: 'order_created',
        title: `Order ${getOrderLabel(order)} created`,
        body: `Your order for ${orderQuantity} ${productDoc.name} is awaiting payment. Total includes logistics delivery fee${selectedProvider ? ` via ${savedLogisticsPreference.providerName}` : ''}.`,
        data: {
          href: `/orders/${order._id}/track`,
          productName: productDoc.name,
          productSubtotal,
          logisticsFee: logisticsQuote.logisticsFee,
          totalAmount: order.totalAmount,
          logisticsProviderName: savedLogisticsPreference.providerName,
          logisticsSelectionSource: selectionSource,
        },
      },
      seller: {
        event: 'new_order',
        title: `New order ${getOrderLabel(order)}`,
        body: `New order for ${orderQuantity} ${productDoc.name}. Buyer payment will hold product and logistics money in escrow${selectedProvider ? `; buyer requests you use ${savedLogisticsPreference.providerName} for transport to their location` : ''}.`,
        data: {
          href: '/seller/orders',
          productName: productDoc.name,
          productSubtotal,
          logisticsFee: logisticsQuote.logisticsFee,
          totalAmount: order.totalAmount,
          logisticsProviderName: savedLogisticsPreference.providerName,
          logisticsSelectionSource: selectionSource,
        },
      },
    });

    return order;
  }

  async getOrders(filters) {
    const { userId, userRole, page = 1, limit = 10, status, role, range, startDate, endDate } = filters;
    const query = {};

    if (role === 'buyer') query.buyer = toObjectId(userId);
    else if (role === 'seller') query.seller = toObjectId(userId);
    else {
      // For admin or if role not specified, show both
      const objectUserId = toObjectId(userId);
      query.$or = [{ buyer: objectUserId }, { seller: objectUserId }];
    }

    if (status) query.status = status;
    const dateFilter = buildDateFilter({ range, startDate, endDate });
    if (dateFilter) query.createdAt = dateFilter;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(limit) || 10));
    const skip = (pageNumber - 1) * pageSize;
    const orders = await Order.find(query)
      .populate('buyer', 'fullName phone')
      .populate('seller', 'fullName phone')
      .populate('logisticsPreference.requestedProvider', 'fullName name businessName phone logisticsProfile.baseHub logisticsProfile.locationHub logisticsProfile.vehiclePlate logisticsProfile.vehicleType')
      .populate('product', 'name images')
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 });

    const [total, summaryRows] = await Promise.all([
      Order.countDocuments(query),
      Order.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$totalAmount', 0] } },
            pendingOrders: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['pending_payment', 'payment_escrowed', 'processing', 'dispatched']] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);
    const summary = summaryRows[0] || { totalRevenue: 0, pendingOrders: 0 };

    return {
      data: await attachOrderRelations(orders),
      summary: {
        totalOrders: total,
        totalRevenue: summary.totalRevenue || 0,
        pendingOrders: summary.pendingOrders || 0,
        range: range || null,
        startDate: dateFilter?.$gte || null,
        endDate: dateFilter?.$lte || null,
      },
      pagination: { page: pageNumber, limit: pageSize, total, pages: Math.ceil(total / pageSize) },
    };
  }

  async getBuyerSellers(buyerId) {
    const orders = await Order.find({ buyer: buyerId })
      .populate('seller', 'fullName name businessName email phone businessType businessLogoUrl city locationHub')
      .populate('product', 'name images price category rating')
      .sort({ createdAt: -1 })
      .lean();

    const sellerMap = new Map();
    orders.forEach((order) => {
      const seller = order.seller;
      const sellerId = String(seller?._id || seller || '');
      if (!sellerId) return;
      const current = sellerMap.get(sellerId) || {
        id: sellerId,
        seller,
        orderCount: 0,
        totalSpent: 0,
        lastOrderAt: null,
        activeOrders: 0,
        deliveredOrders: 0,
        products: [],
      };

      current.orderCount += 1;
      current.totalSpent += Number(order.totalAmount || order.total || 0);
      current.lastOrderAt = current.lastOrderAt && new Date(current.lastOrderAt) > new Date(order.createdAt)
        ? current.lastOrderAt
        : order.createdAt;
      if (['processing', 'payment_escrowed', 'FUNDS_HELD', 'dispatched', 'IN_TRANSIT'].includes(order.status)) current.activeOrders += 1;
      if (['delivered', 'DELIVERED', 'completed', 'RELEASED'].includes(order.status)) current.deliveredOrders += 1;
      if (order.product && !current.products.some((product) => String(product._id || product.id) === String(order.product._id || order.product))) {
        current.products.push(order.product);
      }

      sellerMap.set(sellerId, current);
    });

    return Array.from(sellerMap.values()).sort((left, right) => new Date(right.lastOrderAt || 0) - new Date(left.lastOrderAt || 0));
  }

  async getBuyerReviewQueue(buyerId) {
    const reviewableStatuses = ['delivered', 'DELIVERED', 'completed', 'RELEASED'];
    const orders = await Order.find({ buyer: buyerId, status: { $in: reviewableStatuses } })
      .populate('seller', 'fullName name businessName businessLogoUrl')
      .populate('product', 'name images price category rating reviews')
      .sort({ updatedAt: -1 })
      .lean();

    return orders.map((order) => {
      const reviews = Array.isArray(order.product?.reviews) ? order.product.reviews : [];
      const existingReview = reviews.find((review) => String(review.user?._id || review.user) === String(buyerId));
      return {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          deliveredAt: order.deliveredAt,
          updatedAt: order.updatedAt,
        },
        product: order.product,
        seller: order.seller,
        canReview: Boolean(order.product),
        reviewed: Boolean(existingReview),
        review: existingReview || null,
      };
    }).filter((item) => item.product);
  }

  async getOrderById(orderId, userId, userRole) {
    const order = await Order.findById(orderId)
      .populate('buyer', 'fullName phone')
      .populate('seller', 'fullName phone')
      .populate('logisticsPreference.requestedProvider', 'fullName name businessName phone logisticsProfile.baseHub logisticsProfile.locationHub logisticsProfile.vehiclePlate logisticsProfile.vehicleType')
      .populate('product');
    if (!order) throw httpError('Order not found', 404);

    // Check authorization
    if (userRole !== 'admin' && order.buyer._id.toString() !== userId && order.seller._id.toString() !== userId) {
      throw httpError('Unauthorized', 403);
    }
    return order;
  }

  async getOrderView(orderId, userId, userRole) {
    const order = await this.getOrderById(orderId, userId, userRole);
    return attachOrderRelations(order);
  }

  async getOrderTracking(orderId, userId, userRole) {
    const order = await this.getOrderById(orderId, userId, userRole);
    const [logistics, escrow] = await Promise.all([
      Logistics.findOne({ order: orderId })
        .populate('driver', 'fullName name phone role verificationStatus logisticsProfile.verificationStatus logisticsProfile.currentLocation')
        .lean()
        .catch(() => null),
      Escrow.findOne({ order: orderId }).lean().catch(() => null),
    ]);
    const sellerTracking = buildSellerTracking(order);
    const logisticsTracking = buildLogisticsTracking(logistics);
    const logisticsSummary = summarizeLogistics(logistics);
    const trust = trustPolicy.buildTrustChecks({ order, logistics, escrow });

    const timeline = [
      ...sellerTracking,
      ...logisticsTracking,
    ].filter((item) => item.timestamp)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      order,
      buyer: summarizeParty(order.buyer),
      seller: summarizeParty(order.seller),
      logistics: logisticsSummary,
      liveTracking: logisticsSummary?.liveTracking || null,
      escrow: summarizeEscrow(escrow),
      sellerTracking,
      logisticsTracking,
      milestones: buildTrackingMilestones({ order, logistics, escrow }),
      timeline,
      trust,
      currentStatus: logistics?.status || order.status,
      proofOfDelivery: {
        deliveredAt: logistics?.actualDelivery || order.deliveredAt,
        deliveryQrConfirmed: Boolean(logistics?.deliveryQrConfirmed || logistics?.qrScans?.some((scan) => scan.step === 'delivery')),
        gpsCoords: logistics?.qrScans?.find((scan) => scan.step === 'delivery')?.gpsCoords || logistics?.gpsTracking?.current || null,
      },
    };
  }

  async cancelOrder(orderId, userId, userRole, reason) {
    const order = await this.getOrderById(orderId, userId, userRole);
    if (!['pending_payment', 'AWAITING_PAYMENT', 'payment_escrowed', 'FUNDS_HELD'].includes(order.status)) {
      throw httpError('Order cannot be cancelled at this stage', 409, { currentStatus: order.status });
    }

    if (order.inventoryCommittedAt && !order.inventoryRestockedAt) {
      await productService.restoreCommittedStock(order.product, order.quantity);
      order.inventoryRestockedAt = new Date();
    } else if (!order.inventoryCommittedAt) {
      await productService.releaseReservedStock(order.product, order.quantity);
    }

    // If payment was escrowed, refund
    if (['payment_escrowed', 'FUNDS_HELD'].includes(order.status)) {
      await escrowService.cancelEscrow(orderId, reason, userId);
    }

    order.status = 'cancelled';
    await order.save();

    // Notify both parties
    if (order.buyer?.phone) {
      await smsQueue.add('send', {
        to: order.buyer.phone,
        message: `Order #${orderId} has been cancelled. Reason: ${reason || 'Not provided'}`,
      });
    }

    await notifyOrderParties(order, {
      buyer: {
        event: 'order_cancelled',
        title: `Order ${getOrderLabel(order)} cancelled`,
        body: `Your order has been cancelled${reason ? `: ${reason}` : '.'}`,
        data: {
          href: `/orders/${order._id}/track`,
          reason: reason || '',
        },
      },
      seller: {
        event: 'order_cancelled',
        title: `Order ${getOrderLabel(order)} cancelled`,
        body: `Order was cancelled${reason ? `: ${reason}` : '.'}`,
        data: {
          href: '/seller/orders',
          reason: reason || '',
        },
      },
    });

    return order;
  }

  async confirmDelivery(orderId, buyerId) {
    const order = await Order.findById(orderId);
    if (!order) throw httpError('Order not found', 404);
    if (order.buyer.toString() !== buyerId) throw httpError('Unauthorized', 403);

    if (['completed', 'RELEASED'].includes(order.status)) {
      return order;
    }

    if (['cancelled', 'disputed', 'DISPUTED'].includes(order.status)) {
      throw httpError(`Cannot confirm delivery for a ${order.status} order`, 409, {
        currentStatus: order.status,
        expectedStatus: 'delivered',
      });
    }

    if (!['delivered', 'DELIVERED'].includes(order.status)) {
      throw httpError('Order must be marked delivered before buyer confirmation', 409, {
        currentStatus: order.status,
        expectedStatus: 'delivered',
      });
    }

    const release = await escrowService.releasePayment(orderId, {
      releasedBy: buyerId,
      forceRelease: false,
      releaseMethod: 'manual_confirm',
    });

    const finalOrder = await getPopulatedOrder(orderId);
    await notifyOrderParties(finalOrder || order, {
      buyer: {
        event: 'delivery_confirmed',
        title: `Delivery confirmed for ${getOrderLabel(finalOrder || order)}`,
        body: 'Your delivery confirmation was received.',
        data: {
          href: `/orders/${orderId}/track`,
        },
      },
      seller: {
        event: 'delivery_confirmed',
        title: `Buyer confirmed ${getOrderLabel(finalOrder || order)}`,
        body: 'The buyer confirmed delivery. Escrow release has started.',
        data: {
          href: '/seller/orders',
        },
      },
    });

    return finalOrder || order;
  }

  async raiseDispute(orderId, userId, data, userRole) {
    const order = await Order.findById(orderId);
    if (!order) throw httpError('Order not found', 404);
    const isParty = idsMatch(order.buyer, userId) || idsMatch(order.seller, userId);
    const isAdmin = userRole === 'admin';
    if (!isParty && !isAdmin) {
      throw httpError('Not authorized to create dispute for this order', 403);
    }

    const dispute = await escrowService.raiseDispute(orderId, userId, data, userRole);
    const disputedOrder = await getPopulatedOrder(orderId);

    await notifyOrderParties(disputedOrder || order, {
      buyer: {
        event: 'order_dispute_opened',
        channel: 'dispute',
        title: `Dispute opened for ${getOrderLabel(disputedOrder || order)}`,
        body: 'A dispute has been opened for this order.',
        data: {
          href: `/orders/${orderId}/track`,
          disputeId: String(dispute?._id || ''),
        },
      },
      seller: {
        event: 'order_dispute_opened',
        channel: 'dispute',
        title: `Dispute opened for ${getOrderLabel(disputedOrder || order)}`,
        body: 'A dispute has been opened for this order. Review the order details.',
        data: {
          href: '/seller/orders',
          disputeId: String(dispute?._id || ''),
        },
      },
    });

    return dispute;
  }

  async updateOrderStatus(orderId, userId, userRole, nextStatus) {
    const order = await Order.findById(orderId);
    if (!order) throw httpError('Order not found', 404);

    const isOwnerSeller = order.seller.toString() === userId;
    const isAdmin = userRole === 'admin';
    if (!isOwnerSeller && !isAdmin) {
      throw httpError('Unauthorized', 403);
    }

    const allowedTransitions = {
      pending_payment: ['processing', 'cancelled'],
      AWAITING_PAYMENT: ['EXPIRED', 'cancelled'],
      payment_escrowed: ['processing', 'cancelled'],
      FUNDS_HELD: ['IN_TRANSIT', 'DISPUTED', 'cancelled'],
      processing: ['dispatched', 'cancelled'],
      dispatched: ['delivered'],
      IN_TRANSIT: ['DELIVERED', 'DISPUTED'],
      DELIVERED: ['RELEASED', 'DISPUTED'],
      DISPUTED: [],
      RELEASED: [],
      REFUNDED: [],
      PARTIAL_REFUND: [],
      EXPIRED: [],
      delivered: [],
      completed: [],
      cancelled: [],
      disputed: [],
    };

    const currentStatus = order.status;
    const allowedNext = allowedTransitions[currentStatus] || [];
    if (!allowedNext.includes(nextStatus)) {
      throw httpError(`Invalid status transition from ${currentStatus} to ${nextStatus}`, 409, {
        currentStatus,
        nextStatus,
        allowedNext,
      });
    }

    order.status = nextStatus;
    if (['delivered', 'DELIVERED'].includes(nextStatus) && !order.deliveredAt) {
      order.deliveredAt = new Date();
      const releaseDate = new Date(order.deliveredAt);
      releaseDate.setHours(releaseDate.getHours() + 72);
      order.escrowReleaseDate = releaseDate;
    }
    if (['RELEASED', 'completed'].includes(nextStatus) && !order.releasedAt) {
      order.releasedAt = new Date();
    }
    await order.save();

    const updatedOrder = await getPopulatedOrder(orderId);
    const statusLabel = readableStatus(nextStatus);

    await notifyOrderParties(updatedOrder || order, {
      buyer: {
        event: 'order_status_updated',
        title: `Order ${getOrderLabel(updatedOrder || order)} is ${statusLabel}`,
        body: `Your order status changed to ${statusLabel}.`,
        data: {
          href: `/orders/${orderId}/track`,
          previousStatus: currentStatus,
        },
      },
      seller: {
        event: 'order_status_updated',
        title: `Order ${getOrderLabel(updatedOrder || order)} updated`,
        body: `Order status changed to ${statusLabel}.`,
        data: {
          href: '/seller/orders',
          previousStatus: currentStatus,
        },
      },
    });

    return updatedOrder || order;
  }
}

module.exports = new OrderService();
