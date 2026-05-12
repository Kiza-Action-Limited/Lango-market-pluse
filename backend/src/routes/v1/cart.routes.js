const express = require('express');
const cartController = require('../../controllers/cart.controller');
const { protect: authMiddleware } = require('../../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', cartController.getCart);
router.post('/add', cartController.addToCart);
router.put('/update', cartController.updateQuantity);
router.delete('/remove/:itemId', cartController.removeFromCart);
router.delete('/clear', cartController.clearCart);
router.post('/apply-coupon', cartController.applyCoupon);
router.delete('/remove-coupon', cartController.removeCoupon);
router.post('/merge', cartController.mergeCart);

module.exports = router;

