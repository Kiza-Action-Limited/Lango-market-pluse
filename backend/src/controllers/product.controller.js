const Product = require('../models/Product.model');
const Order = require('../models/Order.model');
const { validationResult } = require('express-validator');
const planService = require('../services/subscription/plan.service');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary.config');
const { PLAN_IDS } = require('../config/subscriptionPlans');
const { getEffectiveUserCategory, isFarmerUser, isSellerUser } = require('../utils/userCategory');

const PLAN_PRODUCT_LIMITS = {
  free: 30,
  v3: Number.MAX_SAFE_INTEGER,
  v4: Number.MAX_SAFE_INTEGER,
  [PLAN_IDS.SOLO]: 30,
  [PLAN_IDS.SMART]: Number.MAX_SAFE_INTEGER,
  [PLAN_IDS.GROWTH]: Number.MAX_SAFE_INTEGER,
  [PLAN_IDS.MIZIGO]: Number.MAX_SAFE_INTEGER,
};

const PAID_REVIEW_STATUSES = ['payment_escrowed', 'processing', 'dispatched', 'delivered', 'completed'];

const isLogisticsUser = (user = {}) => getEffectiveUserCategory(user) === 'logistics';

const canManageProducts = (user = {}) => isSellerUser(user) || isLogisticsUser(user);

const getEffectivePlan = async (userId) => {
  try {
    const subscription = await planService.getUserSubscription(userId);
    if (planService.isSubscriptionActive(subscription)) {
      return planService.normalizePlanId(subscription.plan);
    }
    return PLAN_IDS.SOLO;
  } catch (error) {
    console.error('Error getting effective plan:', error);
    return PLAN_IDS.SOLO;
  }
};

const getProductLimitForPlan = (plan) => PLAN_PRODUCT_LIMITS[plan] ?? PLAN_PRODUCT_LIMITS.free;

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

    const plan = await getEffectivePlan(req.user.id);
    const productLimit = getProductLimitForPlan(plan);
    const currentProductCount = await Product.countDocuments({ seller: req.user.id });

    if (currentProductCount >= productLimit) {
      const readableLimit = Number.isFinite(productLimit) ? productLimit : 'unlimited';
      return res.status(403).json({
        success: false,
        message: `You have reached your ${plan.toUpperCase()} plan product limit (${readableLimit}). Upgrade your plan to add more products.`,
        data: {
          currentPlan: plan,
          productLimit,
          currentProductCount,
        },
      });
    }

    // Upload images to Cloudinary
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, `products/${req.user.id}`, file.mimetype);
          uploadedImages.push({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } catch (error) {
          console.error('Error uploading to Cloudinary:', error);
          return res.status(500).json({
            success: false,
            message: 'Failed to upload images. Please try again.',
            error: error.message
          });
        }
      }
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
    if (isFarmerUser(req.user)) {
      category = 'grocery';
    }

    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      quantityAvailable: parseInt(req.body.quantityAvailable, 10),
      category,
      unit: req.body.unit,
      locationHub: req.body.locationHub || '',
      images: uploadedImages,
      customAttributes: customAttributes,
      isPublished: req.body.isPublished === 'true' || req.body.isPublished === true,
      seller: req.user.id,
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
      planUsage: {
        currentPlan: plan,
        productLimit,
        currentProductCount: currentProductCount + 1,
        remainingSlots: Number.isFinite(productLimit) ? Math.max(0, productLimit - (currentProductCount + 1)) : null,
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
    const {
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      search,
      seller,
      sortBy = 'newest',
    } = req.query;

    const filter = { isPublished: true };

    if (category) filter.category = category;
    if (seller) filter.seller = seller;
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
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
        sort = { scarcityScore: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('seller', 'fullName name email businessName businessType businessLogoUrl');

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / parseInt(limit));

    res.status(200).json({
      success: true,
      products,
      totalPages,
      currentPage: parseInt(page),
      totalProducts,
    });
  } catch (error) {
    console.error('Error in getProducts:', error);
    next(error);
  }
};

/**
 * Get single product by ID
 * GET /api/v1/products/:id
 */
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('seller', 'fullName name email businessName businessType businessLogoUrl');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({
      success: true,
      data: product,
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
      const newImages = [];
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, `products/${req.user.id}`, file.mimetype);
          newImages.push({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } catch (error) {
          console.error('Error uploading to Cloudinary:', error);
          return res.status(500).json({
            success: false,
            message: 'Failed to upload images',
          });
        }
      }
      
      // Keep existing images
      product.images = [...product.images, ...newImages];
    }

    // Update other fields
    const allowedUpdates = ['name', 'description', 'price', 'quantityAvailable', 'unit', 'category', 'isPublished', 'locationHub'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'price') product[field] = parseFloat(req.body[field]);
        else if (field === 'quantityAvailable') product[field] = parseInt(req.body[field], 10);
        else if (field === 'isPublished') product[field] = req.body[field] === 'true' || req.body[field] === true;
        else product[field] = req.body[field];
      }
    });

    if (isFarmerUser(req.user)) {
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
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product,
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
    const threshold = parseInt(req.query.threshold) || 10;
    const products = await Product.find({
      seller: req.user.id,
      quantityAvailable: { $lt: threshold },
    }).select('name quantityAvailable unit price images');

    res.status(200).json({
      success: true,
      data: products,
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

    const plan = await getEffectivePlan(req.user.id);
    const productLimit = getProductLimitForPlan(plan);
    const totalProducts = await Product.countDocuments({ seller: req.user.id });

    const safeLimit = Math.min(requestedLimit, productLimit);
    const normalizedLimit = Number.isFinite(safeLimit) ? safeLimit : requestedLimit;
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
          currentPlan: plan,
          productLimit,
          totalProducts,
          visibleProducts: maxVisibleProducts,
          remainingSlots: Number.isFinite(productLimit) ? Math.max(0, productLimit - totalProducts) : null,
        },
      });
    }

    const remainingVisible = maxVisibleProducts - skip;
    const fetchLimit = Math.min(normalizedLimit, remainingVisible);

    const products = await Product.find({ seller: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(fetchLimit);

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
        currentPlan: plan,
        productLimit,
        totalProducts,
        visibleProducts: maxVisibleProducts,
        remainingSlots: Number.isFinite(productLimit) ? Math.max(0, productLimit - totalProducts) : null,
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
      .populate('reviews.user', 'name');

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
      ],
    }).select('_id status paymentStatus');

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
    await product.populate('reviews.user', 'name');

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
