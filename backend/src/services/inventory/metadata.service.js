const Product = require('../../models/Product.model');

class MetadataService {
  /**
   * Update product metadata (schema-agnostic)
   */
  async updateMetadata(productId, sellerId, metadata) {
    const product = await Product.findOne({ _id: productId, seller: sellerId });
    if (!product) throw new Error('Product not found or unauthorized');

    // Merge new metadata with existing
    for (const [key, value] of Object.entries(metadata)) {
      product.metadata.set(key, value);
    }
    await product.save();
    return product;
  }

  /**
   * Get specific metadata field
   */
  async getMetadataField(productId, key) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');
    return product.metadata.get(key);
  }

  /**
   * Delete metadata field
   */
  async deleteMetadataField(productId, sellerId, key) {
    const product = await Product.findOne({ _id: productId, seller: sellerId });
    if (!product) throw new Error('Product not found or unauthorized');
    product.metadata.delete(key);
    await product.save();
    return product;
  }

  /**
   * Bulk update metadata (e.g., from CSV import)
   */
  async bulkUpdateMetadata(productIds, metadataMap) {
    const updates = productIds.map(async (id) => {
      const product = await Product.findById(id);
      if (product) {
        for (const [key, value] of Object.entries(metadataMap)) {
          product.metadata.set(key, value);
        }
        await product.save();
      }
    });
    await Promise.all(updates);
    return { success: true };
  }
}

module.exports = new MetadataService();