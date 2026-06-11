const express = require('express');
const router = express.Router();
const mpesaService = require('../../services/payment/mpesa.service');
const darajaIpWhitelist = require('../../middleware/darajaIpWhitelist');
const { extractStkMetadata } = require('../../config/mpesa');

router.use(darajaIpWhitelist);

/**
 * M-Pesa STK Push callback endpoint.
 * Safaricom will POST here after user completes payment.
 */
const stkCallbackHandler = async (req, res) => {
  try {
    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

    if (stkCallback.ResultCode === 0) {
      const metadata = extractStkMetadata(stkCallback);
      await mpesaService.handleSuccessCallback({
        checkoutRequestId: stkCallback.CheckoutRequestID,
        amount: metadata.amount,
        transactionId: metadata.mpesaReceiptNumber,
        transactionDate: metadata.transactionDate,
      });
    } else {
      await mpesaService.handleFailureCallback({
        checkoutRequestId: stkCallback.CheckoutRequestID,
        errorMessage: stkCallback.ResultDesc,
      });
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('M-Pesa webhook error:', error);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Error logged' });
  }
};

router.post('/callback', stkCallbackHandler);
router.post('/stk-callback', stkCallbackHandler);

router.post('/b2c-result', async (req, res) => {
  try {
    await mpesaService.handleB2CResult(req.body);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('M-Pesa B2C result error:', error);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Error logged' });
  }
});

router.post('/b2c-timeout', async (req, res) => {
  try {
    await mpesaService.handleB2CTimeout(req.body);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('M-Pesa B2C timeout error:', error);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Error logged' });
  }
});

/**
 * Validation endpoint (optional, for C2B).
 */
router.post('/validation', (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

/**
 * Confirmation endpoint (for C2B).
 */
router.post('/confirmation', (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
});

module.exports = router;
