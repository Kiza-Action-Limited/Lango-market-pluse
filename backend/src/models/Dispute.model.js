const mongoose = require('mongoose');

const DisputeSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true, // This creates the unique index automatically
    },
    escrow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Escrow',
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      enum: ['product_not_received', 'quality_issue', 'quantity_mismatch', 'damaged_goods', 'late_delivery', 'other'],
      required: true,
    },
    description: String,
    evidence: [String],
    evidenceUrls: [String],
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved_buyer', 'resolved_seller', 'partial_refund', 'closed'],
      default: 'open',
    },
    resolution: {
      type: String,
      enum: ['refund_buyer', 'release_to_seller', 'partial_refund', 'cancelled'],
    },
    refundAmount: { 
      type: Number, 
      min: 0, 
      default: 0 
    },
    resolutionAmount: {
      type: Number,
      min: 0,
    },
    faultParty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    resolvedAt: Date,
    messages: [
      {
        sender: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'User',
          required: true,
        },
        message: { 
          type: String, 
          required: true,
          maxlength: 1000,
        },
        timestamp: { 
          type: Date, 
          default: Date.now 
        },
        isAdmin: { 
          type: Boolean, 
          default: false 
        },
      },
    ],
  },
  { 
    timestamps: true,
  }
);

// ============ INDEXES ============
// Single field indexes
// REMOVED: DisputeSchema.index({ order: 1 }, { unique: true }); // Duplicate - already defined in schema
DisputeSchema.index({ escrow: 1 });
DisputeSchema.index({ raisedBy: 1 });
DisputeSchema.index({ createdAt: -1 });

// Compound indexes for common query patterns
DisputeSchema.index({ status: 1, createdAt: -1 }); // For filtering by status and sorting by date
DisputeSchema.index({ raisedBy: 1, status: 1 }); // For finding user's disputes by status
DisputeSchema.index({ status: 1, reason: 1 }); // For analytics and reporting

// For text search if needed (optional)
DisputeSchema.index({ description: 'text', reason: 'text' });

module.exports = mongoose.model('Dispute', DisputeSchema);