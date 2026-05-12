const express = require('express');
const router = express.Router();
const smsService = require('../../services/navigation/sms.service');

/**
 * Africa's Talking delivery report webhook.
 * AT sends POST to this endpoint with delivery status.
 */
router.post('/delivery-report', (req, res) => {
  try {
    const data = req.body;
    // data format: { data: { id, phoneNumber, status, messageId, ... } }
    smsService.handleDeliveryReport(data);
    res.status(200).send('OK');
  } catch (error) {
    console.error('AT delivery report error:', error);
    res.status(200).send('OK');
  }
});

/**
 * Inbound SMS webhook (if you want to receive replies).
 */
router.post('/inbound', (req, res) => {
  try {
    const { from, text, date } = req.body;
    // Process inbound message
    console.log(`SMS from ${from}: ${text}`);
    res.status(200).send('OK');
  } catch (error) {
    console.error('AT inbound webhook error:', error);
    res.status(200).send('OK');
  }
});

module.exports = router;