const express = require('express');
const router = express.Router();
const { protect, admin } = require('../../middleware/auth');
const {
  getAllCategories,
  createCategory,
  deleteCategory
} = require('../../controllers/category.controller');

// Public routes
router.get('/', getAllCategories);

// Admin only routes
router.post('/', protect, admin, createCategory);
router.delete('/:categoryId', protect, admin, deleteCategory);

module.exports = router;