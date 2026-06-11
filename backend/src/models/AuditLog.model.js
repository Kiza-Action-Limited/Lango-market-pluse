const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, trim: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, trim: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function () {
  throw new Error('Audit logs are write-once records and cannot be updated or deleted');
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
