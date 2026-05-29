const express = require('express');
const router = express.Router();

const {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getMyCategories
} = require('../../controllers/category.controller');

const {
  protect
} = require('../../middleware/auth');

// PUBLIC
router.get('/', getAllCategories);

// PROTECTED ROUTES (Authentication required)
router.use(protect); // All routes below this require authentication

// Get categories created by the logged-in user
router.get('/my-categories', getMyCategories);

// Create category (Farmers, Wholesalers, Retailers, Manufacturers, and Admin)
router.post('/', createCategory);

// Update category (Only creator or admin)
router.put('/:categoryId', updateCategory);

// Delete category (Only creator or admin)
router.delete('/:categoryId', deleteCategory);

module.exports = router;