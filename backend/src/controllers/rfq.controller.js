const { validationResult } = require('express-validator');
const RFQ = require('../models/RFQ.model');
const Product = require('../models/Product.model');
const notificationService = require('../services/notification/notification.service');

const sendValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;

  res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array(),
  });
  return true;
};

const userId = (user) => String(user?.id || user?._id || user?.userId || '');
const isSellerRole = (user) => ['seller', 'farmer'].includes(String(user?.role || '').toLowerCase());

const populateRfq = (query) => query
  .populate('product', 'name price unit images sku trackingSku quantityAvailable locationHub')
  .populate('buyer', 'fullName name businessName email phone role')
  .populate('seller', 'fullName name businessName email phone role');

const getDocId = (value) => value?._id || value?.id || value;

const getDisplayName = (user, fallback) => (
  user?.businessName || user?.fullName || user?.name || fallback
);

const createRfqNotification = async (userId, { title, body, rfq, event, href }) => {
  if (!userId) return null;

  try {
    return await notificationService.create(userId, {
      type: 'in_app',
      channel: 'system',
      title,
      body,
      status: 'pending',
      data: {
        rfqId: String(rfq?._id || ''),
        rfqNumber: rfq?.rfqNumber || '',
        productId: String(getDocId(rfq?.product) || ''),
        buyerId: String(getDocId(rfq?.buyer) || ''),
        sellerId: String(getDocId(rfq?.seller) || ''),
        status: rfq?.status,
        event,
        href,
      },
    });
  } catch (error) {
    console.warn('RFQ notification failed:', error.message);
    return null;
  }
};

const canReadRfq = (rfq, user) => {
  const currentUserId = userId(user);
  return String(rfq.buyer?._id || rfq.buyer) === currentUserId ||
    String(rfq.seller?._id || rfq.seller) === currentUserId ||
    String(user?.role || '').toLowerCase() === 'admin';
};

exports.createRFQ = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const product = await Product.findById(req.body.productId).select('seller unit price quantityAvailable name');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (String(product.seller) === userId(req.user)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot request a quote for your own product.',
      });
    }

    const quantity = Number(req.body.quantity);
    const targetPrice = req.body.targetPrice === undefined || req.body.targetPrice === ''
      ? null
      : Number(req.body.targetPrice);

    const rfq = await RFQ.create({
      buyer: req.user.id,
      seller: product.seller,
      product: product._id,
      quantity,
      unit: req.body.unit || product.unit,
      targetPrice,
      deliveryLocation: req.body.deliveryLocation || '',
      neededBy: req.body.neededBy || null,
      message: req.body.message || '',
      negotiationHistory: [{
        actor: req.user.id,
        action: 'created',
        message: req.body.message || '',
        quantity,
        targetPrice,
      }],
    });

    const populated = await populateRfq(RFQ.findById(rfq._id));

    return res.status(201).json({
      success: true,
      message: 'RFQ submitted to seller.',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyRFQs = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const status = req.query.status && req.query.status !== 'all' ? String(req.query.status) : null;
    const mode = req.query.mode || (isSellerRole(req.user) ? 'seller' : 'buyer');
    const query = {};

    if (mode === 'seller') query.seller = req.user.id;
    else query.buyer = req.user.id;
    if (status) query.status = status;

    const [rfqs, total] = await Promise.all([
      populateRfq(RFQ.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)),
      RFQ.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: rfqs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getRFQById = async (req, res, next) => {
  try {
    const rfq = await populateRfq(RFQ.findById(req.params.id));
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found',
      });
    }

    if (!canReadRfq(rfq, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this RFQ.',
      });
    }

    return res.status(200).json({
      success: true,
      data: rfq,
    });
  } catch (error) {
    next(error);
  }
};

exports.respondToRFQ = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const rfq = await RFQ.findById(req.params.id);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found',
      });
    }

    if (String(rfq.seller) !== userId(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned seller can respond to this RFQ.',
      });
    }

    if (!['open', 'quoted'].includes(rfq.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot quote an RFQ with status ${rfq.status}.`,
      });
    }

    const unitPrice = Number(req.body.unitPrice);
    const availableQuantity = req.body.availableQuantity === undefined || req.body.availableQuantity === ''
      ? rfq.quantity
      : Number(req.body.availableQuantity);

    rfq.quote = {
      unitPrice,
      totalPrice: unitPrice * Number(rfq.quantity),
      availableQuantity,
      validUntil: req.body.validUntil || null,
      deliveryWindowDays: req.body.deliveryWindowDays === undefined || req.body.deliveryWindowDays === ''
        ? null
        : Number(req.body.deliveryWindowDays),
      sellerMessage: req.body.sellerMessage || '',
      respondedAt: new Date(),
    };
    rfq.status = 'quoted';
    rfq.negotiationHistory.push({
      actor: req.user.id,
      action: 'quoted',
      message: req.body.sellerMessage || '',
      quantity: rfq.quantity,
      unitPrice,
      totalPrice: unitPrice * Number(rfq.quantity),
    });

    await rfq.save();
    const populated = await populateRfq(RFQ.findById(rfq._id));

    return res.status(200).json({
      success: true,
      message: 'RFQ quote sent to buyer.',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateRFQStatus = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const rfq = await RFQ.findById(req.params.id);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found',
      });
    }

    const nextStatus = req.body.status;
    const previousStatus = rfq.status;
    const currentUserId = userId(req.user);
    const isBuyer = String(rfq.buyer) === currentUserId;
    const isSeller = String(rfq.seller) === currentUserId;

    if (['accepted', 'cancelled'].includes(nextStatus) && !isBuyer) {
      return res.status(403).json({
        success: false,
        message: 'Only the buyer can accept or cancel this RFQ.',
      });
    }

    if (nextStatus === 'declined' && !isSeller) {
      return res.status(403).json({
        success: false,
        message: 'Only the seller can decline this RFQ.',
      });
    }

    rfq.status = nextStatus;
    rfq.negotiationHistory.push({
      actor: req.user.id,
      action: nextStatus,
      message: req.body.message || '',
      quantity: rfq.quantity,
      unitPrice: rfq.quote?.unitPrice,
      totalPrice: rfq.quote?.totalPrice,
    });

    await rfq.save();
    const populated = await populateRfq(RFQ.findById(rfq._id));

    if (nextStatus === 'accepted' && previousStatus !== 'accepted') {
      const sellerId = getDocId(populated?.seller);
      const buyerName = getDisplayName(populated?.buyer, 'Buyer');
      const productName = populated?.product?.name || 'your product';
      await createRfqNotification(sellerId, {
        title: 'RFQ quote accepted',
        body: `${buyerName} accepted your quote for ${productName}.`,
        rfq: populated,
        event: 'rfq_accepted',
        href: '/seller/rfqs',
      });
    }

    return res.status(200).json({
      success: true,
      message: `RFQ ${nextStatus}.`,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};
