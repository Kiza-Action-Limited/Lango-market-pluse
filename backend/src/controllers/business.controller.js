const Product = require('../models/Product.model');
const User = require('../models/User.model');
const { getEffectiveUserCategory } = require('../utils/userCategory');

const PUBLIC_USER_FIELDS = 'fullName name email phone role businessName businessType businessLogoUrl profileImageUrl city address locationHub createdAt verificationStatus trustScore';
const PUBLIC_PRODUCT_FIELDS = 'name price images category rating reviews seller quantityAvailable unit createdAt';

const toInt = (value, fallback, max = 100) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const toRegex = (value) => {
  const safe = String(value || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe ? new RegExp(safe, 'i') : null;
};

const normalizeBusiness = (user, products = []) => {
  const raw = user?.toObject ? user.toObject() : user;
  const productList = products.filter((product) => {
    const sellerId = String(product?.seller?._id || product?.seller || '');
    return sellerId && sellerId === String(raw?._id || raw?.id || '');
  });
  const reviews = productList.reduce((sum, product) => sum + (product.reviews?.length || 0), 0);
  const ratingTotal = productList.reduce((sum, product) => sum + Number(product.rating || 0), 0);
  const categorySet = new Set(productList.map((product) => product.category).filter(Boolean));

  return {
    id: String(raw._id || raw.id),
    _id: raw._id,
    userId: String(raw._id || raw.id),
    name: raw.businessName || raw.fullName || raw.name || raw.email || 'Business',
    businessName: raw.businessName || '',
    businessType: raw.businessType || getEffectiveUserCategory(raw),
    role: raw.role,
    email: raw.email || '',
    phone: raw.phone || '',
    logo: raw.businessLogoUrl || raw.profileImageUrl || '',
    image: raw.businessLogoUrl || raw.profileImageUrl || '',
    city: raw.city || raw.locationHub || raw.address || '',
    locationHub: raw.locationHub || raw.city || '',
    verified: ['verified', 'gold'].includes(raw.verificationStatus) || raw.kycVerified === true,
    verificationStatus: raw.verificationStatus || 'unverified',
    trustScore: raw.trustScore || 0,
    productCount: productList.length,
    categories: Array.from(categorySet),
    rating: productList.length ? Number((ratingTotal / productList.length).toFixed(1)) : 0,
    reviews,
    createdAt: raw.createdAt,
  };
};

const getBusinessQuery = ({ search, businessType }) => {
  const query = {
    isActive: { $ne: false },
    $or: [
      { role: { $in: ['seller', 'farmer', 'logistics'] } },
      { businessType: { $in: ['brand', 'wholesaler', 'manufacturer', 'retailer', 'farmer', 'small_business', 'logistics'] } },
    ],
  };

  if (businessType && businessType !== 'all') {
    const normalizedType = String(businessType).trim().toLowerCase();
    query.$and = [{
      $or: [
        { businessType: normalizedType },
        { role: normalizedType },
      ],
    }];
  }

  const searchRegex = toRegex(search);
  if (searchRegex) {
    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          { businessName: searchRegex },
          { fullName: searchRegex },
          { name: searchRegex },
          { email: searchRegex },
          { businessType: searchRegex },
          { city: searchRegex },
          { locationHub: searchRegex },
        ],
      },
    ];
  }

  return query;
};

const getProductQuery = ({ search, category }) => {
  const query = { isPublished: true };
  const searchRegex = toRegex(search);
  if (searchRegex) {
    query.$or = [
      { name: searchRegex },
      { description: searchRegex },
      { category: searchRegex },
    ];
  }
  if (category && category !== 'all') query.category = String(category).trim().toLowerCase();
  return query;
};

exports.getBusinesses = async (req, res, next) => {
  try {
    const limit = toInt(req.query.limit, 50, 200);
    const users = await User.find(getBusinessQuery(req.query))
      .select(PUBLIC_USER_FIELDS)
      .sort({ verificationStatus: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const userIds = users.map((user) => user._id);
    const products = userIds.length
      ? await Product.find({ isPublished: true, seller: { $in: userIds } })
        .select(PUBLIC_PRODUCT_FIELDS)
        .populate('seller', PUBLIC_USER_FIELDS)
        .limit(limit * 6)
        .lean()
      : [];

    const businesses = users.map((user) => normalizeBusiness(user, products));

    res.status(200).json({
      success: true,
      businesses,
      suppliers: businesses,
      data: businesses,
      products,
    });
  } catch (error) {
    next(error);
  }
};

exports.searchBusinesses = async (req, res, next) => {
  try {
    const limit = toInt(req.query.limit, 50, 100);
    const products = await Product.find(getProductQuery(req.query))
      .select(PUBLIC_PRODUCT_FIELDS)
      .populate('seller', PUBLIC_USER_FIELDS)
      .sort({ rating: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    const businessType = String(req.query.businessType || '').trim().toLowerCase();
    const filteredProducts = businessType && businessType !== 'all'
      ? products.filter((product) => {
        const seller = product.seller || {};
        return seller.businessType === businessType || seller.role === businessType;
      })
      : products;

    const sellerMap = new Map();
    filteredProducts.forEach((product) => {
      const seller = product.seller;
      if (seller?._id) sellerMap.set(String(seller._id), seller);
    });
    const businesses = Array.from(sellerMap.values()).map((seller) => normalizeBusiness(seller, filteredProducts));

    res.status(200).json({
      success: true,
      products: filteredProducts,
      businesses,
      suppliers: businesses,
      data: {
        products: filteredProducts,
        businesses,
        suppliers: businesses,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getHeaderConfig = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      topLinks: ['All categories', 'Verified businesses', 'Order protections'],
      searchPlaceholder: 'Search suppliers, products, capabilities...',
      trustBadges: ['Verified sellers', 'Escrow protected', 'Mizigo logistics'],
    },
  });
};

exports.predictSuppliers = async (req, res) => {
  const query = String(req.body?.query || '').trim().toLowerCase();
  const suppliers = Array.isArray(req.body?.suppliers) ? req.body.suppliers : [];
  const predictions = suppliers.map((supplier, index) => {
    const haystack = [
      supplier.name,
      supplier.businessType,
      ...(supplier.capabilities || []),
    ].join(' ').toLowerCase();
    const matchBoost = query && haystack.includes(query) ? 35 : 0;
    const ratingBoost = Math.min(20, Number(supplier.rating || 0) * 4);
    const confidence = Math.min(98, Math.round(45 + matchBoost + ratingBoost - index));
    return {
      supplierId: supplier.id,
      confidence: Math.max(30, confidence),
      tags: [
        matchBoost ? 'Direct match' : 'Relevant supplier',
        Number(supplier.reviews || 0) > 0 ? 'Reviewed' : 'New supplier',
      ],
    };
  });

  res.status(200).json({ success: true, predictions, data: predictions });
};

exports.searchByImage = async (req, res, next) => {
  try {
    const limit = toInt(req.query.limit, 24, 50);
    const products = await Product.find({ isPublished: true })
      .select(PUBLIC_PRODUCT_FIELDS)
      .populate('seller', PUBLIC_USER_FIELDS)
      .sort({ rating: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      message: 'Image received. Returning visually browsable marketplace matches.',
      products,
      data: { products },
    });
  } catch (error) {
    next(error);
  }
};
