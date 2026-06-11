// backend/src/routes/v1/audit.routes.js
const express = require('express');
const router = express.Router();
const auditController = require('../../controllers/audit.controller');
const { protect } = require('../../middleware/auth');
const { body, param, query } = require('express-validator');

// Apply authentication to all routes
router.use(protect);

// GET /api/v1/audit/logs - Get all audit logs (admin only)
router.get('/logs', auditController.getAuditLogs);

// GET /api/v1/audit/logs/:id - Get specific audit log (admin only)
router.get('/logs/:id', 
  param('id').isMongoId(),
  auditController.getAuditLogById
);

// GET /api/v1/audit/entity/:entityType/:entityId - Get entity history (admin only)
router.get('/entity/:entityType/:entityId', 
  param('entityType').isString(),
  param('entityId').isMongoId(),
  auditController.getEntityHistory
);

// GET /api/v1/audit/user/:userId - Get user activity
router.get('/user/:userId', 
  param('userId').isMongoId(),
  auditController.getUserActivity
);

// GET /api/v1/audit/stats - Get audit statistics (admin only)
router.get('/stats', auditController.getAuditStats);

// GET /api/v1/audit/recent - Get recent activities (admin only)
router.get('/recent', auditController.getRecentActivities);

// GET /api/v1/audit/export - Export audit logs (admin only)
router.get('/export', auditController.exportAuditLogs);

// POST /api/v1/audit/search - Search audit logs (admin only)
router.post('/search', 
  body('query').notEmpty(),
  auditController.searchAuditLogs
);

module.exports = router;