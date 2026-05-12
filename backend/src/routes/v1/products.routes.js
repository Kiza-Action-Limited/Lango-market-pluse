// routes/v1/products.routes.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const productController = require('../../controllers/product.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const { upload, handleUploadError } = require('../../middleware/upload');

// ---------- Public routes ----------
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('category').optional().isString(),
    query('search').optional().isString(),
    query('minPrice').optional().isFloat({ min: 0 }),
    query('maxPrice').optional().isFloat({ min: 0 }),
    query('sortBy').optional().isIn(['newest', 'price_asc', 'price_desc', 'popular', 'rating']),
  ],
  productController.getProducts
);

router.get(
  '/:id/reviews',
  param('id').isMongoId(),
  productController.getProductReviews
);

// ---------- Protected routes (authentication required) ----------
router.use(authMiddleware);

// Low stock must come before /:id to avoid treating "low-stock" as an ID
router.get('/low-stock', productController.getLowStockProducts);
router.get('/my-products', productController.getMyProducts);
router.get('/:id', param('id').isMongoId(), productController.getProductById);
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
    body('category').isIn(['cereals', 'vegetables', 'fruits', 'livestock', 'dairy', 'other']),
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
