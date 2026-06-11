const AuditLog = require('../models/AuditLog.model');

class AuditService {
  async record({ entityType, entityId, action, actor, oldValue, newValue, metadata = {}, req }) {
    return AuditLog.create({
      entityType,
      entityId,
      action,
      actor,
      oldValue,
      newValue,
      metadata,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  }
}

module.exports = new AuditService();
