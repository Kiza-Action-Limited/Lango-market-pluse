const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Product = require('../models/Product.model');
const Order = require('../models/Order.model');
const Logistics = require('../models/Logistics.model');
const Escrow = require('../models/Escrow.model');
const Transaction = require('../models/Transaction.model');
const Payment = require('../models/Payment.model');
const Subscription = require('../models/Subscription.model');
const Review = require('../models/Review.model');
const RFQ = require('../models/RFQ.model');
const SellerJournal = require('../models/SellerJournal.model');
const walletService = require('../services/payment/wallet.service');
const { uploadToCloudinary } = require('../config/cloudinary.config');
const { dateStamp, displayName, docId, sendCsv } = require('../utils/csvExport');
const { SELLER_BUSINESS_TYPES, getEffectiveUserCategory } = require('../utils/userCategory');

const parseBusinessUrls = (value) => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
  } catch (error) {
    // Fall through to newline/comma parsing.
  }
  return String(value).split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
};

const SELLER_EXPORT_TYPES = [
  'products',
  'orders',
  'rfqs',
  'reviews',
  'logistics',
  'transactions',
  'payments',
  'subscriptions',
  'documents',
];

const sellerCsvHeaders = {
  products: ['id', 'name', 'category', 'price', 'unit', 'quantityAvailable', 'reservedQuantity', 'status', 'sku', 'createdAt'],
  orders: [
    'id', 'orderNumber', 'createdAt', 'updatedAt',
    'buyer', 'buyerPhone', 'buyerEmail',
    'product', 'productSku', 'productCategory', 'unit',
    'quantity', 'unitPrice', 'productSubtotal', 'logisticsFee', 'totalAmount',
    'status', 'paymentStatus', 'paymentIntentId', 'paymentReference', 'paymentMethod', 'mpesaReceiptNumber', 'paidAt',
    'escrowStatus', 'escrowAmount', 'escrowCurrency', 'escrowHeldAt', 'escrowReleasedAt',
    'sellerPayout', 'platformFee', 'driverPayout', 'sinkingFundAmount', 'refundAmount',
    'logisticsStatus', 'trackingNumber', 'carrier', 'driver', 'driverPhone', 'shippingCost',
    'distanceKm', 'weightKg', 'weightUnit', 'pickupAddress', 'deliveryAddress', 'deliveryTown',
    'deliveryCounty', 'deliveryGps', 'estimatedDelivery', 'actualDelivery', 'escrowReleaseDue',
    'deliveredAt', 'releasedAt', 'inventoryReservedAt', 'inventoryCommittedAt', 'inventoryRestockedAt',
    'qrChain', 'latestTimelineStatus', 'latestTimelineAt', 'timeline',
  ],
  rfqs: ['id', 'rfqNumber', 'buyer', 'product', 'quantity', 'unit', 'targetPrice', 'status', 'quoteTotal', 'neededBy', 'createdAt'],
  reviews: ['id', 'product', 'reviewer', 'order', 'rating', 'title', 'verified', 'helpful', 'unhelpful', 'createdAt'],
  logistics: ['id', 'orderNumber', 'buyer', 'driver', 'status', 'carrier', 'trackingNumber', 'shippingCost', 'estimatedDelivery', 'actualDelivery', 'createdAt'],
  transactions: ['id', 'type', 'amount', 'currency', 'balanceBefore', 'balanceAfter', 'reference', 'status', 'createdAt'],
  payments: ['id', 'transactionId', 'order', 'amount', 'currency', 'paymentMethod', 'status', 'mpesaReceiptNumber', 'paidAt', 'createdAt'],
  subscriptions: ['id', 'planId', 'status', 'amount', 'startDate', 'endDate', 'autoRenew', 'createdAt'],
  documents: ['id', 'source', 'documentType', 'title', 'documentNumber', 'hasFile', 'url', 'uploadedAt'],
};

const isExportingSeller = (user = {}) => {
  const category = getEffectiveUserCategory(user);
  return user.role === 'seller' || user.role === 'farmer' || SELLER_BUSINESS_TYPES.has(category);
};

const formatAddress = (address, fallback = '') => {
  if (!address) return fallback || '';
  if (typeof address === 'string') return address;
  return address.label ||
    [address.street, address.town, address.county, address.country].filter(Boolean).join(', ') ||
    fallback ||
    '';
};

const formatGps = (address = {}) => {
  const lat = address?.gpsLat ?? address?.lat;
  const lng = address?.gpsLng ?? address?.lng;
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? `${lat},${lng}` : '';
};

const latestTimelineEntry = (timeline = []) => (
  Array.isArray(timeline) && timeline.length ? timeline[timeline.length - 1] : null
);

const compactTimeline = (timeline = []) => {
  if (!Array.isArray(timeline)) return '';
  return timeline.map((item) => {
    const timestamp = item.timestamp ? new Date(item.timestamp).toISOString() : '';
    return [item.status, timestamp && `@ ${timestamp}`, item.note].filter(Boolean).join(' ');
  }).join(' | ');
};

const mapLatestByOrderId = (records = []) => {
  const map = new Map();
  records.forEach((record) => {
    const orderId = docId(record.order);
    if (orderId && !map.has(orderId)) map.set(orderId, record);
  });
  return map;
};

const parseJournalNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const parseJournalBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const JOURNAL_ENTRY_TYPES = new Set(['offline_sale', 'offline_purchase', 'expense', 'return', 'stock_adjustment']);
const JOURNAL_WALLET_PAYMENT_METHODS = new Set(['cash', 'mpesa', 'bank', 'card', 'mixed']);

const journalTypeLabel = (entryType) => ({
  offline_sale: 'Offline Sale',
  offline_purchase: 'Offline Purchase',
  expense: 'Expense',
  return: 'Return',
  stock_adjustment: 'Inventory Adjustment',
}[entryType] || 'Journal Entry');

const generateJournalReference = (entryType) => {
  const prefix = {
    offline_sale: 'SJ',
    offline_purchase: 'PJ',
    expense: 'EJ',
    return: 'RJ',
    stock_adjustment: 'AJ',
  }[entryType] || 'JJ';
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${datePart}-${random}`;
};

const getJournalDateRange = (range = 'today') => {
  const now = new Date();
  const start = new Date(now);
  if (range === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
};

const serializeJournalEntry = (entry = {}) => ({
  id: docId(entry),
  _id: entry._id,
  entryType: entry.entryType,
  adjustmentMode: entry.adjustmentMode,
  quantity: entry.quantity,
  unit: entry.unit,
  unitCost: entry.unitCost,
  unitPrice: entry.unitPrice,
  discount: entry.discount,
  tax: entry.tax,
  charges: entry.charges,
  amount: entry.amount,
  totalAmount: entry.totalAmount,
  totalCost: entry.totalCost,
  stockBefore: entry.stockBefore,
  stockAfter: entry.stockAfter,
  stockDelta: entry.stockDelta,
  supplierName: entry.supplierName,
  partyName: entry.partyName || entry.supplierName,
  partyPhone: entry.partyPhone,
  partyType: entry.partyType,
  paymentMethod: entry.paymentMethod,
  category: entry.category,
  inventoryAction: entry.inventoryAction,
  affectsMainAccount: Boolean(entry.affectsMainAccount),
  accountImpact: entry.accountImpact,
  accountAmount: entry.accountAmount,
  returnSettlement: entry.returnSettlement,
  walletTransaction: entry.walletTransaction,
  status: entry.status,
  reference: entry.reference,
  notes: entry.notes,
  purchasedAt: entry.purchasedAt,
  createdAt: entry.createdAt,
  product: entry.product,
  typeLabel: journalTypeLabel(entry.entryType),
});

const toMongoId = (value) => (
  mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : value
);

const summarizeJournalRows = (rows = []) => {
  const byType = Object.fromEntries(rows.map((row) => [row._id, row]));
  const sales = byType.offline_sale || {};
  const purchases = byType.offline_purchase || {};
  const expenses = byType.expense || {};
  const returns = byType.return || {};
  const adjustments = byType.stock_adjustment || {};
  const salesAmount = Number(sales.amount || 0);
  const purchaseAmount = Number(purchases.amount || purchases.cost || 0);
  const expenseAmount = Number(expenses.amount || 0);
  return {
    sales: salesAmount,
    salesCount: Number(sales.count || 0),
    purchases: purchaseAmount,
    purchaseCount: Number(purchases.count || 0),
    expenses: expenseAmount,
    expenseCount: Number(expenses.count || 0),
    returns: Number(returns.amount || 0),
    returnCount: Number(returns.count || 0),
    adjustments: Number(adjustments.count || 0),
    inventoryMovement: rows.reduce((sum, row) => sum + Number(row.stockDelta || 0), 0),
    totalQuantity: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    profit: salesAmount - purchaseAmount - expenseAmount,
    byType: rows,
  };
};

const summarizeAccountRows = (rows = []) => {
  const summary = rows.reduce((acc, row) => {
    const amount = Number(row.amount || 0);
    if (row._id === 'credit') {
      acc.credits += amount;
      acc.creditCount += Number(row.count || 0);
    } else if (row._id === 'debit') {
      acc.debits += amount;
      acc.debitCount += Number(row.count || 0);
    }
    return acc;
  }, { credits: 0, debits: 0, creditCount: 0, debitCount: 0 });

  return {
    credits: money(summary.credits),
    debits: money(summary.debits),
    net: money(summary.credits - summary.debits),
    creditCount: summary.creditCount,
    debitCount: summary.debitCount,
  };
};

const journalSummaryPipeline = (match) => ([
  { $match: match },
  {
    $group: {
      _id: '$entryType',
      amount: { $sum: '$totalAmount' },
      cost: { $sum: '$totalCost' },
      quantity: { $sum: '$quantity' },
      stockDelta: { $sum: '$stockDelta' },
      count: { $sum: 1 },
    },
  },
]);

const journalAccountPipeline = (match) => ([
  {
    $match: {
      ...match,
      affectsMainAccount: true,
      accountImpact: { $in: ['credit', 'debit'] },
    },
  },
  {
    $group: {
      _id: '$accountImpact',
      amount: { $sum: '$accountAmount' },
      count: { $sum: 1 },
    },
  },
]);

const getReturnSettlement = (entryType, inventoryAction, value) => {
  if (entryType !== 'return') return 'no_cash';
  if (['customer_refund', 'supplier_refund', 'no_cash'].includes(value)) return value;
  return inventoryAction === 'decrease' ? 'supplier_refund' : 'customer_refund';
};

const getJournalAccountEffect = ({ entryType, paymentMethod, totalAmount, returnSettlement, requestedAffectsMainAccount }) => {
  const accountAmount = money(totalAmount);
  const normalizedPayment = String(paymentMethod || '').trim().toLowerCase();
  const canPostPayment = JOURNAL_WALLET_PAYMENT_METHODS.has(normalizedPayment);
  const affectsMainAccount = requestedAffectsMainAccount && accountAmount > 0 && canPostPayment;

  if (!affectsMainAccount || entryType === 'stock_adjustment') {
    return { affectsMainAccount: false, accountImpact: 'none', accountAmount: 0 };
  }

  if (entryType === 'offline_sale') {
    return { affectsMainAccount: true, accountImpact: 'credit', accountAmount };
  }

  if (entryType === 'offline_purchase' || entryType === 'expense') {
    return { affectsMainAccount: true, accountImpact: 'debit', accountAmount };
  }

  if (entryType === 'return') {
    if (returnSettlement === 'customer_refund') {
      return { affectsMainAccount: true, accountImpact: 'debit', accountAmount };
    }
    if (returnSettlement === 'supplier_refund') {
      return { affectsMainAccount: true, accountImpact: 'credit', accountAmount };
    }
  }

  return { affectsMainAccount: false, accountImpact: 'none', accountAmount: 0 };
};

const getSellerExportRows = async (type, sellerId) => {
  const limit = 10000;

  switch (type) {
    case 'products': {
      const products = await Product.find({ seller: sellerId }).sort('-createdAt').limit(limit).lean();
      return products.map((product) => ({
        id: docId(product),
        name: product.name,
        category: product.category,
        price: product.price,
        unit: product.unit,
        quantityAvailable: product.quantityAvailable,
        reservedQuantity: product.reservedQuantity,
        status: product.status || (product.isPublished === false ? 'inactive' : 'active'),
        sku: product.sku,
        createdAt: product.createdAt,
      }));
    }

    case 'orders': {
      const orders = await Order.find({ seller: sellerId })
        .populate('buyer', 'fullName name businessName email phone')
        .populate('product', 'name sku category unit')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      const orderIds = orders.map((order) => order._id);
      const [logisticsRecords, escrowRecords, payments] = await Promise.all([
        Logistics.find({ order: { $in: orderIds } })
          .populate('driver', 'fullName name businessName email phone')
          .sort('-createdAt')
          .lean(),
        Escrow.find({ order: { $in: orderIds } }).sort('-createdAt').lean(),
        Payment.find({ order: { $in: orderIds } }).sort('-createdAt').lean(),
      ]);
      const logisticsByOrder = mapLatestByOrderId(logisticsRecords);
      const escrowByOrder = mapLatestByOrderId(escrowRecords);
      const paymentByOrder = mapLatestByOrderId(payments);

      return orders.map((order) => {
        const orderId = docId(order);
        const logistics = logisticsByOrder.get(orderId);
        const escrow = escrowByOrder.get(orderId);
        const payment = paymentByOrder.get(orderId);
        const deliveryAddress = order.deliveryAddress || logistics?.shippingAddress || order.logisticsPricing?.destination;
        const pickupAddress = logistics?.pickupAddress || order.logisticsPricing?.origin;
        const latestTimeline = latestTimelineEntry(order.timeline);

        return {
          id: orderId,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          buyer: displayName(order.buyer),
          buyerPhone: order.buyer?.phone || payment?.phoneNumber || '',
          buyerEmail: order.buyer?.email || '',
          product: order.product?.name || docId(order.product),
          productSku: order.product?.sku || '',
          productCategory: order.product?.category || '',
          unit: order.product?.unit || '',
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          productSubtotal: order.productSubtotal,
          logisticsFee: order.logisticsFee,
          totalAmount: order.totalAmount,
          status: order.status,
          paymentStatus: payment?.status || (order.paidAt ? 'completed' : 'pending'),
          paymentIntentId: order.paymentIntentId,
          paymentReference: payment?.transactionId || escrow?.externalReference || escrow?.externalTransactionId || '',
          paymentMethod: payment?.paymentMethod || '',
          mpesaReceiptNumber: payment?.mpesaReceiptNumber || escrow?.mpesaReceiptNumber || '',
          paidAt: order.paidAt || payment?.paidAt || escrow?.paidAt,
          escrowStatus: escrow?.status || '',
          escrowAmount: escrow?.amount,
          escrowCurrency: escrow?.currency,
          escrowHeldAt: escrow?.heldAt,
          escrowReleasedAt: escrow?.releasedAt,
          sellerPayout: escrow?.sellerPayout ?? logistics?.settlement?.sellerPayout,
          platformFee: escrow?.platformFee ?? logistics?.settlement?.platformFee,
          driverPayout: escrow?.driverPayout ?? logistics?.settlement?.driverPayout,
          sinkingFundAmount: escrow?.sinkingFundAmount ?? logistics?.settlement?.sinkingFund,
          refundAmount: escrow?.refundAmount || payment?.refundAmount,
          logisticsStatus: logistics?.status || '',
          trackingNumber: logistics?.trackingNumber || '',
          carrier: logistics?.carrier || '',
          driver: displayName(logistics?.driver) || logistics?.driverName || '',
          driverPhone: logistics?.driverPhone || logistics?.driver?.phone || '',
          shippingCost: logistics?.shippingCost,
          distanceKm: logistics?.routeInfo?.totalDistanceKm || order.logisticsDistanceKm || order.logisticsPricing?.distanceKm,
          weightKg: logistics?.weight || order.logisticsPricing?.weightKg,
          weightUnit: logistics?.weightUnit || 'kg',
          pickupAddress: formatAddress(pickupAddress),
          deliveryAddress: formatAddress(deliveryAddress, order.deliveryAddressText),
          deliveryTown: deliveryAddress?.town || '',
          deliveryCounty: deliveryAddress?.county || '',
          deliveryGps: formatGps(deliveryAddress),
          estimatedDelivery: logistics?.estimatedDelivery,
          actualDelivery: logistics?.actualDelivery,
          escrowReleaseDue: logistics?.escrowReleaseDue || order.escrowReleaseDate,
          deliveredAt: order.deliveredAt || logistics?.actualDelivery || escrow?.deliveredAt,
          releasedAt: order.releasedAt || escrow?.releasedAt,
          inventoryReservedAt: order.inventoryReservedAt,
          inventoryCommittedAt: order.inventoryCommittedAt,
          inventoryRestockedAt: order.inventoryRestockedAt,
          qrChain: order.qrChain,
          latestTimelineStatus: latestTimeline?.status || '',
          latestTimelineAt: latestTimeline?.timestamp || '',
          timeline: compactTimeline(order.timeline),
        };
      });
    }

    case 'rfqs': {
      const rfqs = await RFQ.find({ seller: sellerId })
        .populate('buyer', 'fullName name businessName email phone')
        .populate('product', 'name')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return rfqs.map((rfq) => ({
        id: docId(rfq),
        rfqNumber: rfq.rfqNumber,
        buyer: displayName(rfq.buyer),
        product: rfq.product?.name || docId(rfq.product),
        quantity: rfq.quantity,
        unit: rfq.unit,
        targetPrice: rfq.targetPrice,
        status: rfq.status,
        quoteTotal: rfq.quote?.totalPrice,
        neededBy: rfq.neededBy,
        createdAt: rfq.createdAt,
      }));
    }

    case 'reviews': {
      const reviews = await Review.find({ seller: sellerId })
        .populate('product', 'name')
        .populate('reviewer', 'fullName name businessName email phone')
        .populate('order', 'orderNumber')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return reviews.map((review) => ({
        id: docId(review),
        product: review.product?.name || docId(review.product),
        reviewer: displayName(review.reviewer),
        order: review.order?.orderNumber || docId(review.order),
        rating: review.rating,
        title: review.title,
        verified: review.verified,
        helpful: review.helpful,
        unhelpful: review.unhelpful,
        createdAt: review.createdAt,
      }));
    }

    case 'logistics': {
      const records = await Logistics.find({ seller: sellerId })
        .populate('buyer driver', 'fullName name businessName email phone')
        .populate('order', 'orderNumber')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return records.map((record) => ({
        id: docId(record),
        orderNumber: record.order?.orderNumber || record.orderNumber,
        buyer: displayName(record.buyer),
        driver: displayName(record.driver),
        status: record.status,
        carrier: record.carrier,
        trackingNumber: record.trackingNumber,
        shippingCost: record.shippingCost,
        estimatedDelivery: record.estimatedDelivery,
        actualDelivery: record.actualDelivery,
        createdAt: record.createdAt,
      }));
    }

    case 'transactions': {
      const transactions = await Transaction.find({ user: sellerId }).sort('-createdAt').limit(limit).lean();
      return transactions.map((transaction) => ({
        id: docId(transaction),
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        reference: transaction.reference,
        status: transaction.status,
        createdAt: transaction.createdAt,
      }));
    }

    case 'payments': {
      const orders = await Order.find({ seller: sellerId }).select('_id').lean();
      const orderIds = orders.map((order) => order._id);
      const payments = await Payment.find({ order: { $in: orderIds } })
        .populate('order', 'orderNumber')
        .sort('-createdAt')
        .limit(limit)
        .lean();
      return payments.map((payment) => ({
        id: docId(payment),
        transactionId: payment.transactionId,
        order: payment.order?.orderNumber || docId(payment.order),
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        mpesaReceiptNumber: payment.mpesaReceiptNumber,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      }));
    }

    case 'subscriptions': {
      const subscriptions = await Subscription.find({ user: sellerId }).sort('-createdAt').limit(limit).lean();
      return subscriptions.map((subscription) => ({
        id: docId(subscription),
        planId: subscription.planId || subscription.plan,
        status: subscription.status,
        amount: subscription.amount ?? subscription.price,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
        createdAt: subscription.createdAt,
      }));
    }

    case 'documents': {
      const user = await User.findById(sellerId)
        .select('adminDocuments premiumVerification kycDetails verificationStatus')
        .lean();
      const adminDocuments = Array.isArray(user?.adminDocuments) ? user.adminDocuments : [];
      const documents = adminDocuments.map((document) => ({
        id: docId(document),
        source: document.source || 'seller_document',
        documentType: document.documentType || 'other',
        title: document.title || document.originalName || 'Seller document',
        documentNumber: document.documentNumber,
        hasFile: Boolean(document.url || document.publicId),
        url: document.url,
        uploadedAt: document.uploadedAt,
      }));
      if (user?.kycDetails?.idNumber || user?.kycDetails?.idImageUrl) {
        documents.push({
          id: '',
          source: 'kyc',
          documentType: 'kyc',
          title: 'KYC identity record',
          documentNumber: user.kycDetails.idNumber,
          hasFile: Boolean(user.kycDetails.idImageUrl),
          url: user.kycDetails.idImageUrl,
          uploadedAt: user.kycDetails.verifiedAt,
        });
      }
      return documents;
    }

    default:
      return null;
  }
};

exports.getJournalEntries = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const sellerId = req.user?.id || req.user?._id;
    if (!isExportingSeller(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only seller accounts can access the seller journal.',
      });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const query = { seller: sellerId };
    if (req.query.productId) query.product = req.query.productId;
    if (req.query.entryType && req.query.entryType !== 'all') query.entryType = req.query.entryType;
    const mongoMatch = { seller: toMongoId(sellerId) };
    if (req.query.productId) mongoMatch.product = toMongoId(req.query.productId);
    if (req.query.entryType && req.query.entryType !== 'all') mongoMatch.entryType = req.query.entryType;
    const todayRange = getJournalDateRange('today');
    const monthRange = getJournalDateRange('month');

    const [entries, total, totals, todayTotals, monthTotals, accountTotals, todayAccountTotals, monthAccountTotals, walletBalance] = await Promise.all([
      SellerJournal.find(query)
        .populate('product', 'name sku unit quantityAvailable price category')
        .sort({ purchasedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SellerJournal.countDocuments(query),
      SellerJournal.aggregate(journalSummaryPipeline(mongoMatch)).catch(() => []),
      SellerJournal.aggregate(journalSummaryPipeline({
        ...mongoMatch,
        purchasedAt: { $gte: todayRange.start, $lte: todayRange.end },
      })).catch(() => []),
      SellerJournal.aggregate(journalSummaryPipeline({
        ...mongoMatch,
        purchasedAt: { $gte: monthRange.start, $lte: monthRange.end },
      })).catch(() => []),
      SellerJournal.aggregate(journalAccountPipeline(mongoMatch)).catch(() => []),
      SellerJournal.aggregate(journalAccountPipeline({
        ...mongoMatch,
        purchasedAt: { $gte: todayRange.start, $lte: todayRange.end },
      })).catch(() => []),
      SellerJournal.aggregate(journalAccountPipeline({
        ...mongoMatch,
        purchasedAt: { $gte: monthRange.start, $lte: monthRange.end },
      })).catch(() => []),
      walletService.getBalance(sellerId).catch(() => null),
    ]);
    const allSummary = summarizeJournalRows(totals);
    const todaySummary = summarizeJournalRows(todayTotals);
    const monthSummary = summarizeJournalRows(monthTotals);
    const accountSummary = summarizeAccountRows(accountTotals);
    const todayAccountSummary = summarizeAccountRows(todayAccountTotals);
    const monthAccountSummary = summarizeAccountRows(monthAccountTotals);

    res.status(200).json({
      success: true,
      data: entries.map(serializeJournalEntry),
      summary: {
        ...allSummary,
        entries: total,
        totalCost: allSummary.purchases + allSummary.expenses,
        account: {
          ...accountSummary,
          today: todayAccountSummary,
          month: monthAccountSummary,
          wallet: walletBalance,
          withdrawableBalance: Number(walletBalance?.availableBalance || 0),
          lockedBalance: Number(walletBalance?.lockedBalance || 0),
        },
        today: todaySummary,
        month: monthSummary,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createJournalEntry = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const sellerId = req.user?.id || req.user?._id;
    if (!isExportingSeller(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only seller accounts can use the seller journal.',
      });
    }

    const entryType = JOURNAL_ENTRY_TYPES.has(req.body.entryType) ? req.body.entryType : 'offline_purchase';
    const requiresProduct = entryType !== 'expense';
    const product = req.body.productId
      ? await Product.findOne({ _id: req.body.productId, seller: sellerId })
      : null;
    if (requiresProduct && !product) {
      return res.status(404).json({
        success: false,
        message: 'Choose a valid product for this journal entry.',
      });
    }

    const quantity = parseJournalNumber(req.body.quantity);
    if (requiresProduct && quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than zero for inventory journal entries.',
      });
    }

    const unitCost = Math.max(0, parseJournalNumber(req.body.unitCost));
    const unitPrice = Math.max(0, parseJournalNumber(req.body.unitPrice, parseJournalNumber(req.body.sellingPrice)));
    const discount = Math.max(0, parseJournalNumber(req.body.discount));
    const tax = Math.max(0, parseJournalNumber(req.body.tax));
    const charges = Math.max(0, parseJournalNumber(req.body.charges));
    const explicitAmount = Math.max(0, parseJournalNumber(req.body.amount));
    const paymentMethod = String(req.body.paymentMethod || '').trim().toLowerCase();
    const baseLineAmount = entryType === 'offline_sale'
      ? Math.max(0, (quantity * unitPrice) - discount + tax + charges)
      : entryType === 'return'
        ? Math.max(0, (quantity * (unitPrice || unitCost)) - discount + tax + charges)
        : Math.max(0, quantity * unitCost);
    const totalAmount = money(explicitAmount || baseLineAmount);
    const totalCost = entryType === 'offline_purchase'
      ? totalAmount
      : entryType === 'expense'
        ? totalAmount
        : money(Math.max(0, quantity * unitCost));

    let adjustmentMode = req.body.adjustmentMode || 'none';
    let inventoryAction = 'none';
    let stockBefore = product ? Math.max(0, Number(product.quantityAvailable || 0)) : 0;
    let stockAfter = stockBefore;

    if (product) {
      if (entryType === 'offline_purchase') {
        adjustmentMode = 'add';
        inventoryAction = 'increase';
        stockAfter = stockBefore + quantity;
      } else if (entryType === 'offline_sale') {
        adjustmentMode = 'subtract';
        inventoryAction = 'decrease';
        if (quantity > stockBefore) {
          return res.status(409).json({
            success: false,
            message: `Not enough stock. ${product.name} has ${stockBefore} ${product.unit || ''} available.`,
          });
        }
        stockAfter = stockBefore - quantity;
      } else if (entryType === 'return') {
        const requestedAction = req.body.inventoryAction || 'increase';
        inventoryAction = ['increase', 'decrease', 'none'].includes(requestedAction) ? requestedAction : 'increase';
        adjustmentMode = inventoryAction === 'increase' ? 'add' : inventoryAction === 'decrease' ? 'subtract' : 'none';
        stockAfter = inventoryAction === 'increase'
          ? stockBefore + quantity
          : inventoryAction === 'decrease'
            ? Math.max(0, stockBefore - quantity)
            : stockBefore;
      } else if (entryType === 'stock_adjustment') {
        adjustmentMode = ['add', 'subtract', 'set'].includes(req.body.adjustmentMode) ? req.body.adjustmentMode : 'set';
        inventoryAction = adjustmentMode === 'set' ? 'set' : adjustmentMode === 'add' ? 'increase' : 'decrease';
        stockAfter = adjustmentMode === 'set'
          ? Math.max(0, quantity)
          : adjustmentMode === 'add'
            ? stockBefore + quantity
            : Math.max(0, stockBefore - quantity);
      }

      product.quantityAvailable = stockAfter;
      product.inventoryHistory.push({
        onHand: stockAfter,
        reserved: Number(product.reservedQuantity || 0),
        available: Math.max(0, stockAfter - Number(product.reservedQuantity || 0)),
        unit: product.unit,
        event: entryType === 'offline_sale' ? 'sale_committed' : entryType === 'return' ? 'sale_restocked' : 'inventory_adjusted',
        recordedAt: new Date(),
      });
    }

    const stockDelta = stockAfter - stockBefore;
    const partyName = String(req.body.partyName || req.body.customerName || req.body.supplierName || req.body.vendor || '').trim();
    const transactionDate = req.body.purchasedAt || req.body.transactionAt || req.body.expenseDate;
    const returnSettlement = getReturnSettlement(entryType, inventoryAction, req.body.returnSettlement);
    const requestedAffectsMainAccount = parseJournalBoolean(
      req.body.affectsMainAccount,
      entryType !== 'stock_adjustment' && paymentMethod !== 'credit'
    );
    if (entryType === 'return' && returnSettlement === 'customer_refund') {
      if (!requestedAffectsMainAccount) {
        return res.status(400).json({
          success: false,
          message: 'Customer refunds must post to the seller main account. Choose "No cash movement" for inventory-only returns.',
        });
      }
      if (!JOURNAL_WALLET_PAYMENT_METHODS.has(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: 'Customer refunds must use a paid method such as cash, M-Pesa, bank, card, or mixed.',
        });
      }
    }
    const accountEffect = getJournalAccountEffect({
      entryType,
      paymentMethod,
      totalAmount,
      returnSettlement,
      requestedAffectsMainAccount,
    });

    if (accountEffect.accountImpact === 'debit') {
      const balance = await walletService.getBalance(sellerId);
      if (Number(balance.availableBalance || 0) < accountEffect.accountAmount) {
        return res.status(409).json({
          success: false,
          message: 'Seller main account does not have enough withdrawable balance for this refund, purchase, or expense.',
          data: {
            availableBalance: Number(balance.availableBalance || 0),
            requiredAmount: accountEffect.accountAmount,
          },
        });
      }
    }

    if (product) {
      await product.save();
    }

    const entry = await SellerJournal.create({
      seller: sellerId,
      product: product?._id,
      entryType,
      adjustmentMode,
      quantity: requiresProduct ? quantity : 0,
      unit: product?.unit || req.body.unit,
      unitCost,
      unitPrice,
      discount,
      tax,
      charges,
      amount: totalAmount,
      totalAmount,
      totalCost,
      stockBefore,
      stockAfter,
      stockDelta,
      supplierName: String(req.body.supplierName || partyName || '').trim(),
      partyName,
      partyPhone: String(req.body.partyPhone || req.body.customerPhone || req.body.supplierPhone || '').trim(),
      partyType: String(req.body.partyType || req.body.customerType || req.body.supplierType || '').trim(),
      paymentMethod,
      category: String(req.body.category || req.body.expenseCategory || '').trim(),
      inventoryAction,
      affectsMainAccount: accountEffect.affectsMainAccount,
      accountImpact: accountEffect.accountImpact,
      accountAmount: accountEffect.accountAmount,
      returnSettlement,
      status: ['draft', 'completed', 'cancelled', 'refunded'].includes(req.body.status) ? req.body.status : 'completed',
      reference: String(req.body.reference || req.body.invoiceNumber || req.body.receiptNumber || generateJournalReference(entryType)).trim(),
      notes: String(req.body.notes || '').trim(),
      purchasedAt: transactionDate ? new Date(transactionDate) : new Date(),
    });

    if (accountEffect.affectsMainAccount) {
      const reference = `JOURNAL_${entry.reference || entry._id}`;
      const description = `${journalTypeLabel(entryType)} posted from seller journal`;
      const walletResult = accountEffect.accountImpact === 'credit'
        ? await walletService.creditWallet(sellerId, accountEffect.accountAmount, reference, description, {
          type: 'deposit',
          metadata: {
            journalEntry: entry._id,
            entryType,
            returnSettlement,
            partyName,
            paymentMethod,
          },
        })
        : await walletService.debitWallet(sellerId, accountEffect.accountAmount, reference, description, {
          type: 'payment',
          metadata: {
            journalEntry: entry._id,
            entryType,
            returnSettlement,
            partyName,
            paymentMethod,
          },
        });

      entry.walletTransaction = walletResult.transaction?._id;
      await entry.save();
    }

    await entry.populate('product', 'name sku unit quantityAvailable price category');
    await entry.populate('walletTransaction', 'type amount balanceBefore balanceAfter status createdAt');

    res.status(201).json({
      success: true,
      message: accountEffect.affectsMainAccount
        ? 'Seller journal entry saved, inventory updated, and main account posted.'
        : 'Seller journal entry saved and inventory updated.',
      data: {
        entry: serializeJournalEntry(entry.toObject ? entry.toObject() : entry),
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.submitPremiumVerification = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = req.user?.id || req.user?._id;
    const businessUrls = parseBusinessUrls(req.body.businessUrls);
    const verification = {
      storefrontName: String(req.body.storefrontName || '').trim(),
      governmentBusinessName: String(req.body.governmentBusinessName || '').trim(),
      businessEmail: String(req.body.businessEmail || '').trim().toLowerCase(),
      businessUrls,
      planId: String(req.body.planId || '').trim(),
      submittedAt: new Date(),
      status: 'pending',
    };

    let documentRecord = null;
    if (req.file) {
      documentRecord = {
        documentType: 'business_permit',
        title: 'Premium seller verification document',
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        source: 'premium_seller_verification',
        uploadedAt: new Date(),
      };

      try {
        const result = await uploadToCloudinary(
          req.file.buffer,
          `seller-verification/${userId}`,
          req.file.mimetype
        );
        documentRecord.url = result.secure_url;
        documentRecord.publicId = result.public_id;
      } catch (uploadError) {
        documentRecord.uploadError = uploadError.message;
      }
    }

    const updates = {
      businessName: verification.storefrontName,
      verificationStatus: 'pending',
      premiumVerification: verification,
    };

    const update = { $set: updates };
    if (documentRecord) update.$push = { adminDocuments: documentRecord };

    const user = await User.findByIdAndUpdate(userId, update, {
      new: true,
      runValidators: false,
    }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Premium seller verification submitted',
      data: {
        verification,
        document: documentRecord,
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export seller-owned records as CSV
 * GET /api/v1/seller/export/:type
 */
exports.exportRecordsCsv = async (req, res, next) => {
  try {
    const sellerId = req.user?.id || req.user?._id;
    const type = String(req.params.type || '').trim().toLowerCase();

    if (!isExportingSeller(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only seller accounts can export seller records.',
      });
    }

    if (!SELLER_EXPORT_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported export type. Use one of: ${SELLER_EXPORT_TYPES.join(', ')}`,
      });
    }

    const rows = await getSellerExportRows(type, sellerId);
    sendCsv(res, `seller_${type}_${dateStamp()}.csv`, sellerCsvHeaders[type], rows || []);
  } catch (error) {
    next(error);
  }
};
