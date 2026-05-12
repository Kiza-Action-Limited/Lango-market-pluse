const express = require('express');
const { param } = require('express-validator');
const { protect: authMiddleware } = require('../../middleware/auth');
const wishlistController = require('../../controllers/wishlist.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', wishlistController.getWishlist);
router.get('/check/:productId', param('productId').isMongoId(), wishlistController.checkWishlist);
router.post('/:productId', param('productId').isMongoId(), wishlistController.addToWishlist);
router.delete('/:productId', param('productId').isMongoId(), wishlistController.removeFromWishlist);

module.exports = router;
