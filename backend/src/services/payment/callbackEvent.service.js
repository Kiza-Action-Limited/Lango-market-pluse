const CallbackEvent = require('../../models/CallbackEvent.model');
const { sha256 } = require('../../utils/hash');

const getClientIp = (req) => {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req?.ip || req?.socket?.remoteAddress || '');
  return ip.split(',')[0].trim().replace(/^::ffff:/, '');
};

const extractIdentifiers = (eventType, payload = {}) => {
  if (eventType === 'stk') {
    const stk = payload?.Body?.stkCallback || payload?.stkCallback || {};
    return {
      eventId: stk.CheckoutRequestID,
      checkoutRequestId: stk.CheckoutRequestID,
      merchantRequestId: stk.MerchantRequestID,
      resultCode: stk.ResultCode != null ? String(stk.ResultCode) : undefined,
      resultDesc: stk.ResultDesc,
    };
  }

  const result = payload?.Result || payload || {};
  return {
    eventId: result.ConversationID || result.OriginatorConversationID,
    conversationId: result.ConversationID,
    originatorConversationId: result.OriginatorConversationID,
    resultCode: result.ResultCode != null ? String(result.ResultCode) : undefined,
    resultDesc: result.ResultDesc,
  };
};

const recordMpesaCallback = async ({ eventType, payload, req }) => {
  const payloadHash = sha256(payload || {});
  const identifiers = extractIdentifiers(eventType, payload);

  try {
    const event = await CallbackEvent.create({
      provider: 'mpesa',
      eventType,
      payloadHash,
      ...identifiers,
      sourceIp: getClientIp(req),
      requestId: req?.id,
      rawPayload: payload,
    });
    return { event, duplicate: false };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const event = await CallbackEvent.findOne({ provider: 'mpesa', eventType, payloadHash });
    return { event, duplicate: true };
  }
};

const markProcessing = (event) => {
  if (!event || event.processingStatus === 'processed') return event;
  event.processingStatus = 'processing';
  return event.save();
};

const markProcessed = (event) => {
  if (!event) return event;
  event.processingStatus = 'processed';
  event.processedAt = new Date();
  event.failureReason = undefined;
  return event.save();
};

const markFailed = (event, error) => {
  if (!event) return event;
  event.processingStatus = 'failed';
  event.failureReason = error?.message || String(error || 'Callback processing failed');
  return event.save();
};

module.exports = {
  recordMpesaCallback,
  markProcessing,
  markProcessed,
  markFailed,
};
