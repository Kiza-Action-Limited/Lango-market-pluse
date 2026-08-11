const express = require('express');
const mpesaWebhookRoutes = require('../webhooks/mpesa.webhook');

const router = express.Router();

router.use('/mpesa', mpesaWebhookRoutes);

module.exports = router;
