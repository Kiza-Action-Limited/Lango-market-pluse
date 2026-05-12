const Category = require('../models/Category.model');
const Product = require('../models/Product.model');

/**
 * Get all categories
 * GET /api/v1/categories
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort('name');
    
    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({ 
          category: category._id,
          isActive: true 
        });
        return {
          id: category._id,
          name: category.name,
          description: category.description,
          productCount,
          createdAt: category.createdAt
        };
      })
    );
    
    res.status(200).json({
      success: true,
      categories: categoriesWithCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new category
 * POST /api/v1/categories
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    
    const existingCategory = await Category.findOne({ name: name.toLowerCase() });
    if (existingCategory) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category already exists' 
      });
    }
    
    const category = new Category({
      name: name.toLowerCase(),
      description
    });
    
    await category.save();
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete category
 * DELETE /api/v1/categories/:categoryId
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.categoryId);
    
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }
    
    // Check if category has products
    const productCount = await Product.countDocuments({ category: category._id });
    if (productCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete category with ${productCount} products. Reassign or delete products first.` 
      });
    }
    
    await category.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};