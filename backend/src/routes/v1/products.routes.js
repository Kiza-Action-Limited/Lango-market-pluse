// routes/v1/products.routes.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const productController = require('../../controllers/product.controller');
const { protect: authMiddleware, optionalProtect } = require('../../middleware/auth');
const { upload, handleUploadError } = require('../../middleware/upload');
const { isFarmerUser } = require('../../utils/userCategory');

router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });
  next();
});

// ---------- Public routes ----------
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('category').optional().isString(),
    query('search').optional().isString(),
    query('seller').optional().isMongoId(),
    query('businessType').optional().isString(),
    query('minPrice').optional().isFloat({ min: 0 }),
    query('maxPrice').optional().isFloat({ min: 0 }),
    query('sortBy').optional().isIn(['newest', 'price_asc', 'price_desc', 'popular', 'rating']),
  ],
  productController.getProducts
);

router.get('/featured', productController.getFeaturedProducts);

router.get(
  '/:id/reviews',
  param('id').isMongoId(),
  productController.getProductReviews
);

router.get(
  '/:id',
  optionalProtect,
  param('id').isMongoId(),
  productController.getProductById
);

// ---------- Protected routes (authentication required) ----------
router.use(authMiddleware);

// Low stock must come before /:id to avoid treating "low-stock" as an ID
router.get('/low-stock', productController.getLowStockProducts);
router.get('/my-products', productController.getMyProducts);
router.get('/:id/reviews/eligibility', param('id').isMongoId(), productController.getReviewEligibility);
router.post(
  '/:id/reviews',
  [
    param('id').isMongoId(),
    body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').isString().trim().isLength({ min: 2, max: 1000 }).withMessage('Comment must be between 2 and 1000 characters'),
  ],
  productController.addProductReview
);

// Product CRUD with image upload
router.post(
  '/',
  upload.array('images', 10),
  handleUploadError,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('quantityAvailable').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    body('category')
      .custom((value, { req }) => {
        if (isFarmerUser(req.user)) return true;
        return ['electronics', 'fashion', 'home-garden', 'beauty-health', 'sports-outdoor', 'grocery', 'vegetables'].includes(value);
      })
      .withMessage('Choose a valid category. Farmer products are categorized as Grocery automatically.'),
    body('unit').isIn(['kg', 'g', 'ton', 'piece', 'bunch', 'litre']).withMessage('Valid unit required'),
    body('description').optional().isString(),
  ],
  productController.createProduct
);

router.put(
  '/:id',
  upload.array('images', 10),
  handleUploadError,
  param('id').isMongoId(),
  productController.updateProduct
);

router.delete(
  '/:id',
  param('id').isMongoId(),
  productController.deleteProduct
);

router.delete(
  '/:id/images/:imageIndex',
  param('id').isMongoId(),
  param('imageIndex').isInt({ min: 0 }),
  productController.deleteProductImage
);

router.put(
  '/:id/metadata',
  param('id').isMongoId(),
  productController.updateMetadata
);

module.exports = router;
