const Product = require('../models/Product.model');
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const { validationResult } = require('express-validator');
const notificationService = require('../services/notification/notification.service');
const smsService = require('../services/notification/sms.service');
const planService = require('../services/subscription/plan.service');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary.config');
const { PLAN_IDS, PRODUCT_LIMITS } = require('../config/subscriptionPlans');
const { getEffectiveUserCategory, isFarmerUser, isSellerUser } = require('../utils/userCategory');

const NO_ACTIVE_SUBSCRIPTION_PRODUCT_LIMIT = PRODUCT_LIMITS.FREE;

const PLAN_PRODUCT_LIMITS = {
  none: NO_ACTIVE_SUBSCRIPTION_PRODUCT_LIMIT,
  free: NO_ACTIVE_SUBSCRIPTION_PRODUCT_LIMIT,
  v3: PRODUCT_LIMITS[PLAN_IDS.SMART],
  v4: PRODUCT_LIMITS[PLAN_IDS.GROWTH],
  [PLAN_IDS.SOLO]: PRODUCT_LIMITS[PLAN_IDS.SOLO],
  [PLAN_IDS.SMART]: PRODUCT_LIMITS[PLAN_IDS.SMART],
  [PLAN_IDS.GROWTH]: PRODUCT_LIMITS[PLAN_IDS.GROWTH],
  [PLAN_IDS.MIZIGO]: PRODUCT_LIMITS[PLAN_IDS.MIZIGO],
};

const PAID_REVIEW_STATUSES = [
  'FUNDS_HELD',
  'IN_TRANSIT',
  'DELIVERED',
  'RELEASED',
  'payment_escrowed',
  'processing',
  'dispatched',
  'delivered',
  'completed',
];

const isLogisticsUser = (user = {}) => getEffectiveUserCategory(user) === 'logistics';

const canManageProducts = (user = {}) => isSellerUser(user) || isLogisticsUser(user);

const sendProductSmsToUser = async (user, message, context = 'product SMS') => {
  const phone = user?.phone;
  if (!phone || !message) return null;

  try {
    return await smsService.sendToPhone(phone, message);
  } catch (error) {
    console.warn(`${context} failed:`, error.message);
    return null;
  }
};

const getProductText = (product = {}) => `${product.name || ''} ${product.category || ''}`.toLowerCase();

const getLowStockAdvice = (product = {}, stock = 0) => {
  const haystack = getProductText(product);
  const unit = product.unit || 'units';
  if (['maize', 'corn', 'unga', 'posho'].some((term) => haystack.includes(term))) {
    return `Maize demand can move fast. Add more stock now; only ${stock} ${unit} remain.`;
  }
  if (isEssentialCommodity(product)) {
    return `This is an essential product. Add more stock soon; only ${stock} ${unit} remain.`;
  }
  return `Add more product stock soon; only ${stock} ${unit} remain.`;
};

const notifySellerLowStock = async (product, seller, context = 'seller low stock alert') => {
  const sellerId = seller?._id || seller?.id || product?.seller;
  const stock = Number(product?.quantityAvailable || 0);
  const threshold = getEffectiveLowStockThreshold(product);

  if (!sellerId || threshold <= 0) return null;
  if (!product.metadata) product.metadata = new Map();

  if (stock > threshold) {
    if (product?.metadata?.get?.('lastLowStockAlertKey')) {
      product.metadata.delete('lastLowStockAlertKey');
      product.metadata.delete('lastLowStockAlertAt');
      await product.save();
    }
    return null;
  }

  const alertKey = `${stock}:${threshold}`;
  if (product?.metadata?.get?.('lastLowStockAlertKey') === alertKey) return null;

  const advice = getLowStockAdvice(product, stock);
  const title = `Low stock: ${product.name}`;
  const body = `${product.name} has ${stock} ${product.unit || 'units'} left. Threshold is ${threshold}. ${advice}`;

  try {
    const notification = await notificationService.create(sellerId, {
      type: 'in_app',
      channel: 'scarcity_alert',
      title,
      body,
      status: 'sent',
      data: {
        event: 'seller_low_stock_africastalking_alert',
        productId: String(product._id),
        productName: product.name,
        stock,
        threshold,
        href: '/seller/products?filter=low-stock',
      },
    });

    await sendProductSmsToUser(
      seller,
      `Lango Market Pulse: ${body}`,
      `${context} SMS`
    );

    product.metadata.set('lastLowStockAlertKey', alertKey);
    product.metadata.set('lastLowStockAlertAt', new Date().toISOString());
    await product.save();
    return notification;
  } catch (error) {
    console.warn(`${context} failed:`, error.message);
    return null;
  }
};

const getEffectivePlan = async (userId) => {
  try {
    const subscription = await planService.getUserSubscription(userId);
    if (planService.isSubscriptionActive(subscription)) {
      if (subscription.plan === 'free') return 'free';
      return planService.normalizePlanId(subscription.plan);
    }
    return null;
  } catch (error) {
    console.error('Error getting effective plan:', error);
    return null;
  }
};

const getProductLimitForPlan = (plan) => PLAN_PRODUCT_LIMITS[plan || 'none'] ?? 0;

const isFreeProductPlan = (plan) => !plan || plan === 'free';

const buildProductLimitMessage = (plan, productLimit) => {
  if (isFreeProductPlan(plan)) {
    return `You've reached your free ${productLimit} product limit. Upgrade your subscription to add more products.`;
  }

  const readableLimit = Number.isFinite(productLimit) ? productLimit.toLocaleString() : 'unlimited';
  const planLabel = String(plan || 'subscription').toUpperCase();
  return `You have reached your ${planLabel} product limit (${readableLimit}). Upgrade your subscription to add more products.`;
};

const PRODUCT_LIMIT_MAX = 100;
const MAX_PRODUCT_IMAGES = 10;

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
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
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

const WAREHOUSE_STATUSES = new Set(['seller_storage', 'warehouse_pending', 'warehouse_received', 'dispatch_ready', 'restricted']);

const normalizeWarehouseStatus = (value, fallback = 'seller_storage') => {
  const normalized = String(value || '').trim().toLowerCase();
  return WAREHOUSE_STATUSES.has(normalized) ? normalized : fallback;
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

const normalizeProductCategory = (category) => String(category || '').trim().toLowerCase();

const normalizeProductImageUrls = (value, existingCount = 0) => {
  const parsed = parseJsonField(value, value);
  const rawUrls = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'string'
      ? parsed.split(/[|,\n\r]+/)
      : [];
  const availableSlots = Math.max(0, MAX_PRODUCT_IMAGES - existingCount);
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

const uploadProductImages = async (files = [], userId) => {
  if (!Array.isArray(files) || files.length === 0) return [];

  const folder = `products/${userId}`;
  const uploads = files.map(async (file) => {
    const result = await uploadToCloudinary(file.buffer, folder, file.mimetype);
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  });

  return Promise.all(uploads);
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

const getEffectiveLowStockThreshold = (product = {}) => {
  const configured = Number(product.minThreshold);
  if (Number.isFinite(configured) && configured === 0) return 0;
  const autoThreshold = getAutoLowStockThreshold(product);
  if (!Number.isFinite(configured) || configured < 0) return autoThreshold;
  return Math.max(configured, autoThreshold);
};

const SCARCITY_SENSITIVITY = {
  normal: { thresholdMultiplier: 1, riskRatio: 1.2, criticalRatio: 0.5 },
  sensitive: { thresholdMultiplier: 1.25, riskRatio: 1.5, criticalRatio: 0.65 },
  high: { thresholdMultiplier: 1.5, riskRatio: 1.8, criticalRatio: 0.8 },
};

const normalizeScarcitySensitivity = (value) => {
  const key = String(value || 'sensitive').trim().toLowerCase();
  return SCARCITY_SENSITIVITY[key] ? key : 'sensitive';
};

const getScarcityThreshold = (product = {}, sensitivity = 'sensitive') => {
  const baseThreshold = getEffectiveLowStockThreshold(product);
  if (baseThreshold <= 0) return 0;
  const config = SCARCITY_SENSITIVITY[sensitivity] || SCARCITY_SENSITIVITY.sensitive;
  return Math.ceil(baseThreshold * config.thresholdMultiplier);
};

const isEssentialCommodity = (product = {}) => {
  const haystack = `${product.name || ''} ${product.category || ''}`.toLowerCase();
  return [
    'maize',
    'corn',
    'unga',
    'posho',
    'sugar',
    'rice',
    'beans',
    'wheat',
    'flour',
    'millet',
    'sorghum',
    'cooking oil',
    'oil',
    'milk',
    'eggs',
    'vegetables',
    'food-staples',
    'grains-cereals',
    'sugar-baking',
    'cooking-oil',
    'dairy-eggs',
  ].some((term) => haystack.includes(term));
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
  const quantity = Math.max(1, Math.round(Number(product.quantityAvailable || 0)));
  const unit = String(product.unit || 'UNIT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'UNIT';
  const suffix = String(product._id || '').slice(-4).toUpperCase();

  return `${location}-${category}-${productCode}-${quantity}${unit}${suffix ? `-${suffix}` : ''}`;
};

const MOQ_BUSINESS_TYPES = new Set(['wholesaler', 'manufacturer']);
const MOQ_EXEMPT_TYPES = new Set(['farmer', 'retailer']);

const normalizeBusinessType = (value) => String(value || '').trim().toLowerCase();

const isMqqRestrictedBusinessType = (seller = {}) => {
  const businessType = normalizeBusinessType(seller.businessType || seller.role);
  if (MOQ_EXEMPT_TYPES.has(businessType)) return false;
  return MOQ_BUSINESS_TYPES.has(businessType);
};

const getEffectiveMinimumOrderQuantity = (product = {}) => {
  const sellerType = product.seller?.businessType || product.seller?.role;
  if (!sellerType) return product.wholesale?.minimumOrderQuantity || 1;
  return isMqqRestrictedBusinessType(product.seller)
    ? Math.max(10, Number(product.wholesale?.minimumOrderQuantity || 10))
    : 1;
};

const appendInventoryGraph = (product) => {
  if (!product) return product;
  const quantityAvailable = Number(product.quantityAvailable || 0);
  const reservedQuantity = Number(product.reservedQuantity || 0);
  const history = Array.isArray(product.inventoryHistory) ? product.inventoryHistory : [];
  const sku = buildTrackingSku(product);

  return {
    ...product,
    sku,
    trackingSku: sku,
    minimumOrderQuantity: getEffectiveMinimumOrderQuantity(product),
    rfqEnabled: product.wholesale?.rfqEnabled !== false,
    priceTiers: product.wholesale?.priceTiers || [],
    wholesaleTerms: product.wholesale?.terms || '',
    warehouseStatus: normalizeWarehouseStatus(product.warehouseStatus),
    minThreshold: getEffectiveLowStockThreshold(product),
    availableQuantity: Math.max(0, quantityAvailable - reservedQuantity),
    inventoryGraph: history.length
      ? history.map((entry) => ({
          onHand: Number(entry.onHand || 0),
          reserved: Number(entry.reserved || 0),
          available: Number(entry.available || 0),
          unit: entry.unit || product.unit,
          event: entry.event,
          recordedAt: entry.recordedAt,
        }))
      : [{
          onHand: quantityAvailable,
          reserved: reservedQuantity,
          available: Math.max(0, quantityAvailable - reservedQuantity),
          unit: product.unit,
          event: 'created',
          recordedAt: product.createdAt || new Date(),
        }],
  };
};

/**
 * Create a new product (farmer/seller only)
 * POST /api/v1/products
 */
exports.createProduct = async (req, res, next) => {
  try {
    const effectiveCategory = getEffectiveUserCategory(req.user);

    if (!canManageProducts(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only sellers, farmers, or logistics providers can add products.',
        ...(process.env.NODE_ENV !== 'production' ? {
          debug: {
            role: req.user?.role,
            businessType: req.user?.businessType,
            effectiveCategory,
          },
        } : {}),
      });
    }

    if (!isLogisticsUser(req.user) && !String(req.user.businessName || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'Business name is required before adding products. Update your seller business profile first.',
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const [plan, currentProductCount] = await Promise.all([
      getEffectivePlan(req.user.id),
      Product.countDocuments({ seller: req.user.id }),
    ]);
    const productLimit = getProductLimitForPlan(plan);

    if (currentProductCount >= productLimit) {
      return res.status(403).json({
        success: false,
        message: buildProductLimitMessage(plan, productLimit),
        data: {
          currentPlan: plan || null,
          productLimit,
          currentProductCount,
          remainingSlots: Number.isFinite(productLimit) ? Math.max(0, productLimit - currentProductCount) : null,
          upgradeRequired: isFreeProductPlan(plan) || (Number.isFinite(productLimit) && currentProductCount >= productLimit),
        },
      });
    }

    let uploadedImages = [];
    try {
      uploadedImages = await uploadProductImages(req.files, req.user.id);
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload images. Please try again.',
        error: error.message
      });
    }

    // Parse customAttributes if sent as JSON string
    let customAttributes = {};
    if (req.body.customAttributes) {
      try {
        customAttributes = typeof req.body.customAttributes === 'string' 
          ? JSON.parse(req.body.customAttributes) 
          : req.body.customAttributes;
      } catch (e) {
        customAttributes = req.body.customAttributes;
      }
    }

    let category = String(req.body.category || '').trim().toLowerCase();
    if (isFarmerUser(req.user) && !category) {
      category = 'grocery';
    }

    const remoteImages = normalizeProductImageUrls(req.body.imageUrls, uploadedImages.length);

    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      quantityAvailable: parseInt(req.body.quantityAvailable, 10),
      minThreshold: parseNonNegativeInt(req.body.minThreshold, getAutoLowStockThreshold({
        name: req.body.name,
        category,
      })),
      category,
      unit: req.body.unit,
      locationHub: req.body.locationHub || '',
      warehouseStatus: normalizeWarehouseStatus(req.body.warehouseStatus),
      wholesale: normalizeWholesalePayload(req.body),
      images: [...uploadedImages, ...remoteImages],
      customAttributes: customAttributes,
      isPublished: req.body.isPublished === 'true' || req.body.isPublished === true,
      seller: req.user.id,
    };

    const product = new Product(productData);
    await product.save();
    sendProductSmsToUser(
      req.user,
      `Lango Market Pulse: ${product.name} is now in your catalog. Stock: ${product.quantityAvailable} ${product.unit}, price: KES ${Number(product.price || 0).toLocaleString('en-KE')}.`,
      'product create SMS'
    );
    await notifySellerLowStock(product, req.user, 'product create low stock alert');

    // send in-app notifications to buyers about new product (non-blocking)
    (async () => {
      try {
        const buyers = await User.find({ role: 'buyer', isActive: true }).select('_id');
        const buyerIds = buyers.map((b) => b._id);
        const sellerName = req.user?.fullName || req.user?.name || req.user?.businessName || 'Seller';
        if (buyerIds.length > 0) {
          await notificationService.sendBulkNotifications(buyerIds, {
            type: 'in_app',
            channel: 'new_product',
            title: 'New product available',
            body: `${sellerName} added ${product.name} to the marketplace.`,
            data: { productId: String(product._id), sellerId: String(req.user.id) },
          });
        }
      } catch (e) {
        console.error('Error sending new product notifications:', e);
      }
    })();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
      planUsage: {
        currentPlan: plan,
        productLimit,
        currentProductCount: currentProductCount + 1,
        remainingSlots: Number.isFinite(productLimit) ? Math.max(0, productLimit - (currentProductCount + 1)) : null,
        upgradeRequired: Number.isFinite(productLimit) ? currentProductCount + 1 >= productLimit : false,
      },
    });
  } catch (error) {
    console.error('Error in createProduct:', error);
    next(error);
  }
};

/**
 * Get all products (with filters & pagination)
 * GET /api/v1/products
 */
exports.getProducts = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const {
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      search,
      seller,
      sortBy = 'newest',
      businessType,
    } = req.query;

    const filter = { isPublished: true };

    if (category) filter.category = normalizeProductCategory(category);
    if (seller) filter.seller = seller;

    if (businessType) {
      const normalizedBusinessType = String(businessType).trim().toLowerCase();
      const sellerQuery = {
        $or: [
          { businessType: normalizedBusinessType },
          { role: normalizedBusinessType },
        ],
      };

      if (seller) {
        sellerQuery._id = seller;
      }

      const matchingSellers = await User.find(sellerQuery).select('_id');
      filter.seller = { $in: matchingSellers.map((user) => user._id) };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined && minPrice !== '') filter.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined && maxPrice !== '') filter.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      filter.$text = { $search: search };
    }

    let sort = {};
    switch (sortBy) {
      case 'newest':
        sort = { createdAt: -1 };
        break;
      case 'price_asc':
        sort = { price: 1 };
        break;
      case 'price_desc':
        sort = { price: -1 };
        break;
      case 'popular':
        sort = { soldCount: -1, createdAt: -1 };
        break;
      case 'rating':
        sort = { rating: -1, createdAt: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    const pageNum = parsePositiveInt(page, 1);
    const limitNum = Math.min(parsePositiveInt(limit, 20), PRODUCT_LIMIT_MAX);
    const skip = (pageNum - 1) * limitNum;

    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('seller', 'fullName name email businessName businessType role businessLogoUrl')
        .lean(),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalProducts / limitNum));

    const productsWithInventoryGraph = products.map(appendInventoryGraph);

    res.status(200).json({
      success: true,
      products: productsWithInventoryGraph,
      data: productsWithInventoryGraph,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalProducts,
        pages: totalPages,
      },
      totalPages,
      currentPage: pageNum,
      totalProducts,
    });
  } catch (error) {
    console.error('Error in getProducts:', error);
    next(error);
  }
};

/**
 * Get featured products
 * GET /api/v1/products/featured
 */
exports.getFeaturedProducts = async (req, res, next) => {
  try {
    const limit = Math.min(parsePositiveInt(req.query.limit, 8), 24);
    const products = await Product.find({ isPublished: true })
      .sort({ rating: -1, soldCount: -1, createdAt: -1 })
      .limit(limit)
      .populate('seller', 'fullName name email businessName businessType role businessLogoUrl')
      .lean();

    const productsWithInventoryGraph = products.map(appendInventoryGraph);

    res.status(200).json({
      success: true,
      products: productsWithInventoryGraph,
      data: productsWithInventoryGraph,
    });
  } catch (error) {
    console.error('Error in getFeaturedProducts:', error);
    next(error);
  }
};

/**
 * Get live regional scarcity board from published inventory
 * GET /api/v1/products/scarcity-board
 */
exports.getScarcityBoard = async (req, res, next) => {
  try {
    const category = normalizeProductCategory(req.query.category || '');
    const hub = String(req.query.hub || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 1000, 1), 2000);
    const sensitivity = normalizeScarcitySensitivity(req.query.sensitivity);
    const sensitivityConfig = SCARCITY_SENSITIVITY[sensitivity];

    const query = { isPublished: true };
    if (category && category !== 'all') query.category = category;
    if (hub && hub !== 'all') query.locationHub = hub;

    const products = await Product.find(query)
      .select('name category quantityAvailable minThreshold reservedQuantity unit price locationHub images seller updatedAt createdAt')
      .populate('seller', 'fullName name businessName businessType role location campus')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const hubs = new Map();
    const categorySummary = new Map();
    let totalStock = 0;
    let alertCount = 0;
    let criticalCount = 0;
    let essentialAtRiskCount = 0;

    products.forEach((product) => {
      const hubName = product.locationHub || product.seller?.location || product.seller?.campus || 'Unassigned Hub';
      const categoryName = product.category || 'other';
      const stock = Number(product.quantityAvailable || 0);
      const reserved = Number(product.reservedQuantity || 0);
      const threshold = getScarcityThreshold(product, sensitivity);
      const available = Math.max(0, stock - reserved);
      const alert = threshold > 0 && stock <= threshold;
      const critical = alert && stock <= Math.max(1, Math.ceil(threshold * sensitivityConfig.criticalRatio));
      const essential = isEssentialCommodity(product);
      const riskRatio = threshold > 0 ? stock / threshold : 999;
      const sellerId = String(product.seller?._id || product.seller || 'unknown');

      totalStock += stock;
      if (alert) alertCount += 1;
      if (critical) criticalCount += 1;
      if (essential && riskRatio <= sensitivityConfig.riskRatio) essentialAtRiskCount += 1;

      if (!hubs.has(hubName)) {
        hubs.set(hubName, {
          hub: hubName,
          totalStock: 0,
          totalSkus: 0,
          alertCount: 0,
          criticalCount: 0,
          essentialCount: 0,
          essentialsAtRisk: [],
          categories: {},
          sellerIds: new Set(),
          updatedAt: product.updatedAt || product.createdAt,
        });
      }

      const hubRow = hubs.get(hubName);
      hubRow.totalStock += stock;
      hubRow.totalSkus += 1;
      hubRow.alertCount += alert ? 1 : 0;
      hubRow.criticalCount += critical ? 1 : 0;
      hubRow.essentialCount += essential ? 1 : 0;
      hubRow.sellerIds.add(sellerId);
      hubRow.updatedAt = new Date(product.updatedAt || product.createdAt) > new Date(hubRow.updatedAt || 0)
        ? product.updatedAt || product.createdAt
        : hubRow.updatedAt;

      if (!hubRow.categories[categoryName]) {
        hubRow.categories[categoryName] = { category: categoryName, stock: 0, skus: 0, alerts: 0 };
      }
      hubRow.categories[categoryName].stock += stock;
      hubRow.categories[categoryName].skus += 1;
      hubRow.categories[categoryName].alerts += alert ? 1 : 0;

      if (essential && riskRatio <= sensitivityConfig.riskRatio) {
        hubRow.essentialsAtRisk.push({
          id: product._id,
          name: product.name,
          category: categoryName,
          stock,
          available,
          reserved,
          threshold,
          ratio: riskRatio,
          unit: product.unit,
          severity: critical ? 'critical' : 'low',
          sensitivity,
          seller: product.seller?.businessName || product.seller?.fullName || product.seller?.name || 'Seller',
          updatedAt: product.updatedAt || product.createdAt,
        });
      }

      if (!categorySummary.has(categoryName)) {
        categorySummary.set(categoryName, { category: categoryName, stock: 0, skus: 0, alerts: 0 });
      }
      const categoryRow = categorySummary.get(categoryName);
      categoryRow.stock += stock;
      categoryRow.skus += 1;
      categoryRow.alerts += alert ? 1 : 0;
    });

    const hubRows = Array.from(hubs.values())
      .map((row) => {
        const categories = Object.values(row.categories).sort((a, b) => b.alerts - a.alerts || b.stock - a.stock);
        const essentialsAtRisk = row.essentialsAtRisk.sort((a, b) => a.ratio - b.ratio).slice(0, 8);
        const guardianState = row.criticalCount > 0 || essentialsAtRisk.length > 0
          ? 'scarcity-risk'
          : row.alertCount > 0 ? 'watch' : 'stable';

        return {
          hub: row.hub,
          totalStock: row.totalStock,
          totalSkus: row.totalSkus,
          alertCount: row.alertCount,
          criticalCount: row.criticalCount,
          essentialCount: row.essentialCount,
          essentialsAtRisk,
          categories,
          guardianState,
          sellerCount: row.sellerIds.size,
          updatedAt: row.updatedAt,
        };
      })
      .sort((a, b) => b.criticalCount - a.criticalCount || b.alertCount - a.alertCount || b.totalStock - a.totalStock);

    res.status(200).json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        summary: {
          hubs: hubRows.length,
          products: products.length,
          totalStock,
          alertCount,
          criticalCount,
          essentialAtRiskCount,
          sensitivity,
          thresholdMultiplier: sensitivityConfig.thresholdMultiplier,
          earlyWarningRatio: sensitivityConfig.riskRatio,
        },
        hubs: hubRows,
        categories: Array.from(categorySummary.values()).sort((a, b) => b.alerts - a.alerts || b.stock - a.stock),
      },
    });
  } catch (error) {
    console.error('Error in getScarcityBoard:', error);
    next(error);
  }
};

/**
 * Get single product by ID
 * GET /api/v1/products/:id
 */
exports.getProductById = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const product = await Product.findById(req.params.id)
      .populate('seller', 'fullName name email businessName businessType role businessLogoUrl')
      .lean();
    const isOwner = req.user && String(product?.seller?._id || product?.seller) === String(req.user.id || req.user._id);
    const isAdmin = req.user?.role === 'admin';

    if (!product || (!product.isPublished && !isOwner && !isAdmin)) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({
      success: true,
      data: appendInventoryGraph(product),
    });
  } catch (error) {
    console.error('Error in getProductById:', error);
    next(error);
  }
};

/**
 * Update product (seller only)
 * PUT /api/v1/products/:id
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (product.seller.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update this product' });
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      let newImages = [];
      try {
        newImages = await uploadProductImages(req.files, req.user.id);
      } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload images',
        });
      }

      // Keep existing images
      product.images = [...product.images, ...newImages];
    }

    // Update other fields
    const allowedUpdates = ['name', 'description', 'price', 'quantityAvailable', 'minThreshold', 'unit', 'category', 'isPublished', 'locationHub', 'warehouseStatus'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'price') product[field] = parseFloat(req.body[field]);
        else if (field === 'quantityAvailable' || field === 'minThreshold') product[field] = parseNonNegativeInt(req.body[field], field === 'minThreshold' ? 10 : 0);
        else if (field === 'isPublished') product[field] = req.body[field] === 'true' || req.body[field] === true;
        else if (field === 'warehouseStatus') product[field] = normalizeWarehouseStatus(req.body[field], product.warehouseStatus);
        else product[field] = req.body[field];
      }
    });

    product.wholesale = normalizeWholesalePayload(req.body, product.wholesale);

    if (isFarmerUser(req.user) && !product.category) {
      product.category = 'grocery';
    }

    // Handle customAttributes
    if (req.body.customAttributes) {
      try {
        product.customAttributes = typeof req.body.customAttributes === 'string'
          ? JSON.parse(req.body.customAttributes)
          : req.body.customAttributes;
      } catch (e) {
        product.customAttributes = req.body.customAttributes;
      }
    }

    await product.save();
    await notifySellerLowStock(product, req.user, 'product update low stock alert');
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: appendInventoryGraph(product),
    });
  } catch (error) {
    console.error('Error in updateProduct:', error);
    next(error);
  }
};

/**
 * Delete product (seller only)
 * DELETE /api/v1/products/:id
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (product.seller.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this product' });
    }

    // Delete images from Cloudinary
    for (const image of product.images) {
      if (image.publicId) {
        try {
          await deleteFromCloudinary(image.publicId);
        } catch (error) {
          console.error('Error deleting image from Cloudinary:', error);
        }
      }
    }

    await product.deleteOne();
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    next(error);
  }
};

/**
 * Delete product image
 * DELETE /api/v1/products/:id/images/:imageIndex
 */
exports.deleteProductImage = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (product.seller.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not authorized to modify this product' });
    }

    const imageIndex = parseInt(req.params.imageIndex);
    if (imageIndex >= product.images.length) {
      return res.status(400).json({ success: false, message: 'Invalid image index' });
    }

    const imageToDelete = product.images[imageIndex];
    if (imageToDelete && imageToDelete.publicId) {
      try {
        await deleteFromCloudinary(imageToDelete.publicId);
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
      }
    }

    product.images.splice(imageIndex, 1);
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: product,
    });
  } catch (error) {
    console.error('Error in deleteProductImage:', error);
    next(error);
  }
};

/**
 * Add/update product metadata (dynamic attributes)
 * PUT /api/v1/products/:id/metadata
 */
exports.updateMetadata = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (product.seller.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not authorized to modify this product' });
    }

    const newMetadata = req.body;
    for (const [key, value] of Object.entries(newMetadata)) {
      product.metadata.set(key, value);
    }

    await product.save();
    res.status(200).json({
      success: true,
      message: 'Metadata updated successfully',
      data: product,
    });
  } catch (error) {
    console.error('Error in updateMetadata:', error);
    next(error);
  }
};

/**
 * Get low-stock products for authenticated seller
 * GET /api/v1/products/low-stock
 */
exports.getLowStockProducts = async (req, res, next) => {
  try {
    const threshold = parseNonNegativeInt(req.query.threshold, 0);
    const products = await Product.find({
      seller: req.user.id,
      quantityAvailable: { $gt: 0 },
    }).select('name category quantityAvailable minThreshold unit price images sku inventoryHistory reservedQuantity').lean();

    const lowStockProducts = products.filter((product) => {
      const effectiveThreshold = threshold > 0 ? threshold : getEffectiveLowStockThreshold(product);
      return effectiveThreshold > 0 && Number(product.quantityAvailable || 0) <= effectiveThreshold;
    });

    res.status(200).json({
      success: true,
      data: lowStockProducts.map(appendInventoryGraph),
    });
  } catch (error) {
    console.error('Error in getLowStockProducts:', error);
    next(error);
  }
};

/**
 * Get seller dashboard products based on subscription plan
 * GET /api/v1/products/my-products
 */
exports.getMyProducts = async (req, res, next) => {
  try {
    if (!canManageProducts(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only sellers, farmers, or logistics providers can access this dashboard.',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const requestedLimit = Math.max(1, parseInt(req.query.limit, 10) || 20);

    const [plan, totalProducts] = await Promise.all([
      getEffectivePlan(req.user.id),
      Product.countDocuments({ seller: req.user.id }),
    ]);
    const productLimit = getProductLimitForPlan(plan);
    const remainingSlots = Number.isFinite(productLimit) ? Math.max(0, productLimit - totalProducts) : null;
    const upgradeRequired = isFreeProductPlan(plan) && remainingSlots === 0;

    const safeLimit = Math.min(requestedLimit, productLimit);
    const normalizedLimit = Math.max(1, Number.isFinite(safeLimit) ? safeLimit : requestedLimit);
    const skip = (page - 1) * normalizedLimit;
    const maxVisibleProducts = Math.min(totalProducts, productLimit);

    if (skip >= maxVisibleProducts) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page,
          limit: normalizedLimit,
          total: maxVisibleProducts,
          pages: Math.ceil(maxVisibleProducts / normalizedLimit) || 1,
        },
        planUsage: {
          currentPlan: plan || null,
          productLimit,
          totalProducts,
          visibleProducts: maxVisibleProducts,
          remainingSlots,
          upgradeRequired,
        },
      });
    }

    const remainingVisible = maxVisibleProducts - skip;
    const fetchLimit = Math.min(normalizedLimit, remainingVisible);

    const products = await Product.find({ seller: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(fetchLimit)
      .lean();

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page,
        limit: normalizedLimit,
        total: maxVisibleProducts,
        pages: Math.ceil(maxVisibleProducts / normalizedLimit) || 1,
      },
      planUsage: {
        currentPlan: plan || null,
        productLimit,
        totalProducts,
        visibleProducts: maxVisibleProducts,
        remainingSlots,
        upgradeRequired,
      },
    });
  } catch (error) {
    console.error('Error in getMyProducts:', error);
    next(error);
  }
};

/**
 * Get product reviews
 * GET /api/v1/products/:id/reviews
 */
exports.getProductReviews = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .select('reviews')
      .populate('reviews.user', 'name fullName profileImageUrl');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const reviews = [...(product.reviews || [])].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json({
      success: true,
      reviews,
    });
  } catch (error) {
    console.error('Error in getProductReviews:', error);
    next(error);
  }
};

/**
 * Check whether authenticated user can review a product
 * GET /api/v1/products/:id/reviews/eligibility
 */
exports.getReviewEligibility = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).select('seller');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (String(product.seller) === String(req.user.id)) {
      return res.status(200).json({
        success: true,
        canReview: false,
        message: 'You cannot review your own product.',
      });
    }

    const paidOrder = await Order.findOne({
      buyer: req.user.id,
      product: req.params.id,
      $or: [
        { status: { $in: PAID_REVIEW_STATUSES } },
        { paymentStatus: 'completed' },
        { paidAt: { $exists: true, $ne: null } },
      ],
    }).select('_id status paymentStatus paidAt');

    res.status(200).json({
      success: true,
      canReview: Boolean(paidOrder),
      message: paidOrder
        ? 'You can review this product.'
        : 'Complete payment for this product before writing a review.',
      orderId: paidOrder?._id,
    });
  } catch (error) {
    console.error('Error in getReviewEligibility:', error);
    next(error);
  }
};

/**
 * Add product review
 * POST /api/v1/products/:id/reviews
 */
exports.addProductReview = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (String(product.seller) === String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'You cannot review your own product.' });
    }

    const paidOrder = await Order.exists({
      buyer: req.user.id,
      product: req.params.id,
      $or: [
        { status: { $in: PAID_REVIEW_STATUSES } },
        { paymentStatus: 'completed' },
        { paidAt: { $exists: true, $ne: null } },
      ],
    });

    if (!paidOrder) {
      return res.status(403).json({
        success: false,
        message: 'Complete payment for this product before writing a review.',
      });
    }

    const existingReviewIndex = product.reviews.findIndex(
      (review) => String(review.user) === String(req.user.id)
    );

    if (existingReviewIndex >= 0) {
      product.reviews[existingReviewIndex].rating = Number(rating);
      product.reviews[existingReviewIndex].comment = String(comment).trim();
      product.reviews[existingReviewIndex].updatedAt = new Date();
    } else {
      product.reviews.unshift({
        user: req.user.id,
        rating: Number(rating),
        comment: String(comment).trim(),
      });
    }

    const totalRating = product.reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    product.rating = product.reviews.length ? Number((totalRating / product.reviews.length).toFixed(1)) : 0;

    await product.save();
    await product.populate('reviews.user', 'name fullName profileImageUrl');

    const savedReview = product.reviews.find(
      (review) => String(review.user?._id || review.user) === String(req.user.id)
    );

    res.status(201).json({
      success: true,
      message: existingReviewIndex >= 0 ? 'Review updated successfully' : 'Review added successfully',
      review: savedReview,
    });
  } catch (error) {
    console.error('Error in addProductReview:', error);
    next(error);
  }
};
