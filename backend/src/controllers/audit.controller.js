const AuditLog = require('../models/AuditLog.model');
const auditService = require('../services/audit.service');
const { validationResult } = require('express-validator');

/**
 * Get audit logs (admin only)
 * GET /api/v1/audit/logs
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      page = 1,
      limit = 50,
      entityType,
      action,
      actor,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = req.query;

    const query = {};

    if (entityType) query.entityType = entityType;
    if (action) query.action = action;
    if (actor) query.actor = actor;

    // Date range filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actor', 'name email role phone')
        .populate('entityId')
        .sort({ [sortBy]: parseInt(sortOrder) })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit log by ID
 * GET /api/v1/audit/logs/:id
 */
exports.getAuditLogById = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { id } = req.params;

    const log = await AuditLog.findById(id)
      .populate('actor', 'name email role phone')
      .populate('entityId');

    if (!log) {
      return res.status(404).json({ success: false, message: 'Audit log not found' });
    }

    res.status(200).json({
      success: true,
      data: log,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get entity audit history
 * GET /api/v1/audit/entity/:entityType/:entityId
 */
exports.getEntityHistory = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find({ entityType, entityId })
        .populate('actor', 'name email role phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments({ entityType, entityId }),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user activity
 * GET /api/v1/audit/user/:userId
 */
exports.getUserActivity = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { userId } = req.params;
    const { page = 1, limit = 20, action, startDate, endDate } = req.query;

    const query = { actor: userId };

    if (action) query.action = action;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit statistics
 * GET /api/v1/audit/stats
 */
exports.getAuditStats = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { startDate, endDate } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const stats = await AuditLog.aggregate([
      { $match: matchStage },
      {
        $facet: {
          byAction: [
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byEntityType: [
            { $group: { _id: '$entityType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byActor: [
            { $group: { _id: '$actor', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {},
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export audit logs to CSV (admin only)
 * GET /api/v1/audit/export
 */
exports.exportAuditLogs = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { entityType, action, startDate, endDate } = req.query;

    const query = {};
    if (entityType) query.entityType = entityType;
    if (action) query.action = action;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate('actor', 'name email')
      .sort({ createdAt: -1 });

    // Convert to CSV
    const csv = convertToCSV(logs);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent activities for dashboard
 * GET /api/v1/audit/recent
 */
exports.getRecentActivities = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { limit = 10 } = req.query;

    const logs = await AuditLog.find()
      .populate('actor', 'name email role phone avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search audit logs
 * POST /api/v1/audit/search
 */
exports.searchAuditLogs = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { query, page = 1, limit = 20 } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    const skip = (page - 1) * limit;

    // Search in multiple fields
    const searchQuery = {
      $or: [
        { action: new RegExp(query, 'i') },
        { entityType: new RegExp(query, 'i') },
        { 'metadata.notes': new RegExp(query, 'i') },
      ],
    };

    const [logs, total] = await Promise.all([
      AuditLog.find(searchQuery)
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(searchQuery),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to convert audit logs to CSV
 */
function convertToCSV(logs) {
  const headers = ['Timestamp', 'Entity Type', 'Entity ID', 'Action', 'Actor', 'IP Address', 'User Agent'];

  const rows = logs.map(log => [
    new Date(log.createdAt).toISOString(),
    log.entityType,
    log.entityId,
    log.action,
    log.actor?.name || 'Unknown',
    log.ipAddress || 'N/A',
    log.userAgent?.substring(0, 50) || 'N/A',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}
