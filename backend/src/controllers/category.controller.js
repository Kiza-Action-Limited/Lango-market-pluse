const mongoose = require('mongoose');
const Category = require('../models/Category.model');
const Product = require('../models/Product.model');
const { getEffectiveUserCategory, isSellerUser } = require('../utils/userCategory');

/**
 * GET ALL CATEGORIES
 * GET /api/v1/categories
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    const { type, search } = req.query;

    let query = { isActive: true };

    // Filter by category type
    if (type) {
      query.categoryType = type;
    }

    // Search by name
    if (search) {
      query.name = {
        $regex: search,
        $options: 'i'
      };
    }

    const categories = await Category.find(query).sort({ createdAt: -1 });

    const formattedCategories = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({
          category: category.slug || category.name,
          isPublished: true
        });

        return {
          id: category._id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          image: category.image,
          categoryType: category.categoryType,
          productCount,
          isActive: category.isActive,
          createdAt: category.createdAt,
          createdBy: category.createdBy
        };
      })
    );

    res.status(200).json({
      success: true,
      total: formattedCategories.length,
      categories: formattedCategories
    });

  } catch (error) {
    next(error);
  }
};

/**
 * CREATE CATEGORY
 * POST /api/v1/categories
 */
exports.createCategory = async (req, res, next) => {
  try {
    const {
      name,
      description,
      image,
      categoryType
    } = req.body;

    // Get user from request (set by auth middleware)
    const user = req.user;

    const effectiveCategory = getEffectiveUserCategory(user);
    const canCreateCategory = user.role === 'admin' || isSellerUser(user);
    
    if (!canCreateCategory) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to create categories'
      });
    }

    // Validate name
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    const normalizedName = name.toLowerCase().trim();

    // Check existing category
    const existingCategory = await Category.findOne({
      name: normalizedName
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      });
    }

    // Create slug
    const slug = normalizedName
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '');

    const category = await Category.create({
      name: normalizedName,
      slug,
      description,
      image,
      categoryType: categoryType || (user.role === 'admin' ? 'general' : effectiveCategory),
      createdBy: user._id,
      createdByRole: user.role
    });

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
 * UPDATE CATEGORY
 * PUT /api/v1/categories/:categoryId
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const user = req.user;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if user is authorized to update this category
    const isAuthorized = 
      user.role === 'admin' || 
      category.createdBy?.toString() === user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this category'
      });
    }

    const {
      name,
      description,
      image,
      categoryType,
      isActive
    } = req.body;

    if (name) {
      category.name = name.toLowerCase();

      category.slug = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '');
    }

    if (description !== undefined) {
      category.description = description;
    }

    if (image !== undefined) {
      category.image = image;
    }

    // Only admin can change category type
    if (categoryType !== undefined && user.role === 'admin') {
      category.categoryType = categoryType;
    }

    if (isActive !== undefined) {
      // Only admin can deactivate categories
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only admin can change category status'
        });
      }
      category.isActive = isActive;
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category
    });

  } catch (error) {
    next(error);
  }
};

/**
 * DELETE CATEGORY
 * DELETE /api/v1/categories/:categoryId
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const user = req.user;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if user is authorized to delete this category
    const isAuthorized = 
      user.role === 'admin' || 
      category.createdBy?.toString() === user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this category'
      });
    }

    // Check products
    const productCount = await Product.countDocuments({
      category: category.slug || category.name,
      isPublished: true
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} active products. Please reassign or delete the products first.`
      });
    }

    // Soft delete
    category.isActive = false;

    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * GET MY CATEGORIES
 * GET /api/v1/categories/my-categories
 */
exports.getMyCategories = async (req, res, next) => {
  try {
    const user = req.user;
    
    let query = { isActive: true };
    
    // If not admin, show only categories created by the user
    if (user.role !== 'admin') {
      query.createdBy = user._id;
    }
    
    const categories = await Category.find(query).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      total: categories.length,
      categories
    });
    
  } catch (error) {
    next(error);
  }
};
