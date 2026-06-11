const Category = require('../../models/Category.model');
const logger = require('../../utils/logger');

class CategoryService {
  /**
   * Create category
   */
  async createCategory(data) {
    const category = new Category(data);
    await category.save();
    return category;
  }

  /**
   * Get all categories
   */
  async getAllCategories(options = {}) {
    const { page = 1, limit = 50, parentId = null, active = true } = options;

    const query = {};
    if (parentId) query.parent = parentId;
    if (active) query.isActive = true;

    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      Category.find(query)
        .sort({ order: 1, name: 1 })
        .skip(skip)
        .limit(limit)
        .populate('parent', 'name'),
      Category.countDocuments(query),
    ]);

    return {
      categories,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get category by ID
   */
  async getCategoryById(categoryId) {
    return Category.findById(categoryId)
      .populate('parent', 'name')
      .populate('children', 'name');
  }

  /**
   * Get category with subcategories
   */
  async getCategoryWithChildren(categoryId) {
    const category = await Category.findById(categoryId).populate('children');
    return category;
  }

  /**
   * Update category
   */
  async updateCategory(categoryId, data) {
    return Category.findByIdAndUpdate(categoryId, data, { new: true });
  }

  /**
   * Delete category
   */
  async deleteCategory(categoryId) {
    const category = await Category.findById(categoryId);
    if (!category) throw new Error('Category not found');

    // Check if has children
    const childCount = await Category.countDocuments({ parent: categoryId });
    if (childCount > 0) {
      throw new Error('Cannot delete category with subcategories');
    }

    await Category.findByIdAndDelete(categoryId);
    return { success: true };
  }

  /**
   * Get category hierarchy
   */
  async getCategoryHierarchy() {
    const categories = await Category.find({ parent: null })
      .populate({
        path: 'children',
        populate: { path: 'children' },
      })
      .sort({ order: 1 });

    return categories;
  }
}

module.exports = new CategoryService();
