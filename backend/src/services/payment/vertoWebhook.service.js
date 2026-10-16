const crypto = require('crypto');
const CallbackEvent = require('../../models/CallbackEvent.model');
const Payment = require('../../models/Payment.model');
const Payout = require('../../models/Payout.model');
const vertoPaymentService = require('./vertoPayment.service');
const { getVertoConfig } = require('../../config/verto');
const { sha256 } = require('../../utils/hash');
const logger = require('../../utils/logger');
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

const decodeBase64 = (value) => {
  const text = String(value || '');
  if (!text || !/^[A-Za-z0-9+/]+={0,2}$/.test(text) || text.length % 4 !== 0) return null;
  const decoded = Buffer.from(text, 'base64');
  return decoded.toString('base64') === text ? decoded : null;
};

const isAcceptableUtcDay = (value, now = Date.now()) => {
  const acceptedDays = [-1, 0, 1].map((offset) => (
    String(new Date(now + offset * 24 * 60 * 60 * 1000).getUTCDate())
  ));
  return acceptedDays.some((day) => timingSafeEqual(day, value));
};

const verifyCertificateAuth = ({ headers, privateKey, companyId }) => {
  if (!privateKey || !companyId) return false;

  for (const [name, rawValue] of Object.entries(headers || {})) {
    if (!name.toLowerCase().startsWith('auth-')) continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const value of values) {
      const ciphertext = decodeBase64(value);
      if (!ciphertext) continue;

      let plaintext;
      try {
        plaintext = crypto.privateDecrypt({
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha512',
        }, ciphertext).toString('utf8');
      } catch (error) {
        continue;
      }

      const separator = plaintext.indexOf('||');
      if (separator < 0) continue;

      const encodedCompanyId = plaintext.slice(0, separator);
      const decodedCompanyId = decodeBase64(encodedCompanyId);
      if (!decodedCompanyId) continue;

      const receivedCompanyId = decodedCompanyId.toString('utf8');
      const utcDay = plaintext.slice(separator + 2);
      if (timingSafeEqual(receivedCompanyId, companyId) && isAcceptableUtcDay(utcDay)) {
        return true;
      }
    }
  }

  return false;
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

    if (verifyCertificateAuth({
      headers: req.headers,
      privateKey: config.webhookPrivateKey,
      companyId: config.companyId,
    })) {
      return true;
    }

    logger.warn('Verto webhook authentication failed', {
      requestId: req.id,
      authHeaderNames: Object.keys(req.headers || {}).filter((name) => name.toLowerCase().startsWith('auth-')),
      hmacSignaturePresent: Boolean(signature),
      webhookCompanyIdConfigured: Boolean(config.companyId),
      webhookPrivateKeyConfigured: Boolean(config.webhookPrivateKey),
      webhookSecretConfigured: Boolean(config.webhookSecret),
    });

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
