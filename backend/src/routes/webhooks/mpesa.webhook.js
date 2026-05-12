const express = require('express');
const router = express.Router();
const mpesaService = require('../../services/payment/mpesa.service');

/**
 * M-Pesa STK Push callback endpoint.
 * Safaricom will POST here after user completes payment.
 */
router.post('/callback', async (req, res) => {
  try {
    const { Body } = req.body;
    const resultCode = Body.stkCallback.ResultCode;

    if (resultCode === 0) {
      // Success
      const { CheckoutRequestID, Amount, MpesaReceiptNumber, TransactionDate } = Body.stkCallback;
      await mpesaService.handleSuccessCallback({
        checkoutRequestId: CheckoutRequestID,
        amount: Amount,
        transactionId: MpesaReceiptNumber,
        transactionDate: TransactionDate,
      });
    } else {
      // Failure
      const { CheckoutRequestID, ResultDesc } = Body.stkCallback;
      await mpesaService.handleFailureCallback({
        checkoutRequestId: CheckoutRequestID,
        errorMessage: ResultDesc,
      });
    }

    // Always respond with success to M-Pesa
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('M-Pesa webhook error:', error);
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