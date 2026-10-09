const crypto = require('crypto');
const CallbackEvent = require('../../models/CallbackEvent.model');
const Payment = require('../../models/Payment.model');
const Payout = require('../../models/Payout.model');
const vertoPaymentService = require('./vertoPayment.service');
const { getVertoConfig } = require('../../config/verto');
const { sha256 } = require('../../utils/hash');
const { createVertoError } = require('./vertoAuth.service');

const getHeader = (headers, names) => {
  for (const name of names) {
    const value = headers[name] || headers[name.toLowerCase()];
    if (value) return String(value);
  }
  return '';
};

const timingSafeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const verifyHmac = ({ rawBody, signature, secret }) => {
  const normalized = String(signature || '').replace(/^sha256=/i, '');
  const expected = crypto.createHmac('sha256', secret).update(rawBody || '').digest('hex');
  return timingSafeEqual(expected, normalized);
};

const verifyCertificateSignature = ({ rawBody, signature, publicCertificate }) => {
  if (!signature || !publicCertificate) return false;
  const payload = Buffer.from(String(signature).replace(/^sha(256|512)=/i, ''), 'base64');

  return ['RSA-SHA256', 'RSA-SHA512'].some((algorithm) => {
    try {
      return crypto.verify(algorithm, Buffer.from(rawBody || '', 'utf8'), publicCertificate, payload);
    } catch (error) {
      return false;
    }
  });
};

const extractEventId = (payload = {}) => (
  payload.id ||
  payload.eventId ||
  payload.event_id ||
  payload.webhookId ||
  payload.data?.id ||
  payload.data?.eventId
);

const extractEventType = (payload = {}) => (
  payload.type ||
  payload.event ||
  payload.topic ||
  payload.eventType ||
  payload.event_type ||
  'unknown'
);

const extractProviderReference = (payload = {}) => (
  payload.paymentId ||
  payload.paymentReference ||
  payload.reference ||
  payload.transactionId ||
  payload.payoutId ||
  payload.data?.paymentId ||
  payload.data?.paymentReference ||
  payload.data?.reference ||
  payload.data?.transactionId ||
  payload.data?.payoutId
);

class VertoWebhookService {
  verify(req) {
    const config = getVertoConfig();
    if (!config.enabled) {
      throw createVertoError('Verto webhook received while Verto is disabled.', 'VERTO_DISABLED', 503);
    }

    const signature = getHeader(req.headers, [
      'x-verto-signature',
      'x-webhook-signature',
      'x-signature',
      'verto-signature',
    ]);
    const rawBody = req.rawBody || JSON.stringify(req.body || {});

    if (config.webhookSecret && verifyHmac({ rawBody, signature, secret: config.webhookSecret })) {
      return true;
    }

    if (config.publicCertificate && verifyCertificateSignature({ rawBody, signature, publicCertificate: config.publicCertificate })) {
      return true;
    }

    throw createVertoError('Invalid Verto webhook signature.', 'VERTO_WEBHOOK_SIGNATURE_INVALID', 401);
  }

  async handle(req) {
    this.verify(req);

    const payload = req.body || {};
    const eventType = extractEventType(payload);
    const eventId = extractEventId(payload);
    const payloadHash = sha256(req.rawBody || payload);

    const callbackEvent = await CallbackEvent.findOneAndUpdate(
      {
        provider: 'verto',
        eventType,
        payloadHash,
      },
      {
        $setOnInsert: {
          provider: 'verto',
          eventType,
          eventId,
          payloadHash,
          processingStatus: 'received',
          rawPayload: payload,
          sourceIp: req.ip,
          requestId: req.id,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (callbackEvent.processingStatus === 'processed') {
      return { duplicate: true, event: callbackEvent };
    }

    callbackEvent.processingStatus = 'processing';
    await callbackEvent.save();

    try {
      const reference = extractProviderReference(payload);
      const lowerEvent = String(eventType || '').toLowerCase();
      let result = null;

      if (reference && lowerEvent.includes('payout')) {
        result = await this.applyPayoutWebhook(reference, payload);
      } else if (reference) {
        const payment = await Payment.findOne({
          paymentMethod: 'verto',
          $or: [
            { providerPaymentReference: reference },
            { transactionId: reference },
          ],
        });
        if (payment) {
          result = await vertoPaymentService.applyProviderStatus({
            payment,
            providerResponse: payload,
            source: 'webhook',
          });
        }
      }

      callbackEvent.processingStatus = result ? 'processed' : 'ignored';
      callbackEvent.processedAt = new Date();
      await callbackEvent.save();
      return { event: callbackEvent, result };
    } catch (error) {
      callbackEvent.processingStatus = 'failed';
      callbackEvent.failureReason = error.message;
      await callbackEvent.save();
      throw error;
    }
  }

  async applyPayoutWebhook(reference, payload) {
    const payout = await Payout.findOne({
      channel: 'verto',
      $or: [
        { providerPayoutReference: reference },
        { conversationId: reference },
      ],
    });
    if (!payout) return null;

    const status = String(payload.status || payload.payoutStatus || payload.data?.status || '').toLowerCase();
    const previousStatus = payout.status;
    payout.providerStatus = status || payout.providerStatus;
    if (['completed', 'complete', 'success', 'successful', 'paid'].includes(status)) {
      payout.status = 'completed';
      payout.completedAt = payout.completedAt || new Date();
    } else if (['failed', 'rejected', 'declined'].includes(status)) {
      payout.status = 'failed';
      payout.failureReason = payload.reason || payload.message || status;
    } else if (['timeout', 'timed_out'].includes(status)) {
      payout.status = 'timeout';
      payout.failureReason = payload.reason || payload.message || status;
    } else {
      payout.status = payout.status === 'pending' ? 'submitted' : payout.status;
    }

    payout.metadata = {
      ...(payout.metadata?.toObject?.() || payout.metadata || {}),
      lastWebhookPayload: payload,
      lastWebhookAt: new Date().toISOString(),
    };
    await payout.save();

    if (payout.status === 'completed' && previousStatus !== 'completed') {
      await vertoPaymentService.creditWalletForCompletedPayout(payout);
    } else if (payout.status === 'completed') {
      await vertoPaymentService.creditWalletForCompletedPayout(payout);
    }

    if (payout.order) {
      await Payment.updateMany(
        { order: payout.order, paymentMethod: 'verto' },
        { payoutStatus: payout.status === 'completed' ? 'completed' : payout.status === 'failed' ? 'failed' : 'processing' }
      );
    }

    return payout;
  }
}

module.exports = new VertoWebhookService();
