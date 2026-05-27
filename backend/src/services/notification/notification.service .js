/**
 * Lango MarketPulse — Supply Chain Notification Service
 * Kakuma–Kitale Corridor | Plan 4 "Mizigo"
 *
 * Roles   : farmer | wholesaler | manufacturer | retailer | logistics
 * Channels: order_update | payment | scarcity_alert | group_buy
 *           new_product  | logistics | dispute | system
 *
 * Delivery: Push (FCM/Expo) · SMS (Africa's Talking) · Email · In-App
 */

'use strict';

const Notification  = require('../models/Notification');
const User          = require('../models/User');
const pushService   = require('./channels/push.service');
const smsService    = require('./channels/sms.service');
const emailService  = require('./channels/email.service');
const logger        = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const NAIROBI_TZ = 'Africa/Nairobi';

/**
 * Format a Date (or ISO string) for Kenyan locale display.
 * @param {Date|string} date
 * @returns {string}
 */
function formatKE(date) {
  return new Date(date).toLocaleString('en-KE', { timeZone: NAIROBI_TZ });
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch a notification to one or many users across all active channels.
 * Every notification is persisted to the database (in_app) regardless of
 * push / SMS / email delivery outcome.
 *
 * @param {Object}          opts
 * @param {string|string[]} opts.userIds        - Target user ID(s)
 * @param {'push'|'sms'|'email'|'in_app'} opts.type
 * @param {string}          opts.channel        - Notification channel enum
 * @param {string}          opts.title
 * @param {string}          opts.body
 * @param {Object}          [opts.data]         - Extra metadata (orderId, etc.)
 * @param {string}          [opts.emailHtml]    - HTML body for email delivery
 * @param {string}          [opts.emailSubject] - Subject line for email delivery
 * @returns {Promise<PromiseSettledResult[]>}
 */
async function dispatch({
  userIds,
  type,
  channel,
  title,
  body,
  data        = {},
  emailHtml,
  emailSubject,
}) {
  const ids   = Array.isArray(userIds) ? userIds : [userIds];
  if (!ids.length) return [];

  const users = await User.find({ _id: { $in: ids } }).select(
    'name email phone notificationPreferences pushTokens role'
  );

  const results = await Promise.allSettled(
    users.map(async (user) => {
      const prefs = user.notificationPreferences ?? {};

      // Always persist — in-app record is source of truth
      const record = await Notification.create({
        user    : user._id,
        type,
        channel,
        title,
        body,
        data,
        status  : 'pending',
      });

      const deliveries = [];

      // ── Push ──────────────────────────────────────────────────────────────
      if (prefs.pushEnabled !== false && user.pushTokens?.length) {
        deliveries.push(
          pushService
            .sendToUser(user._id, { title, body, data })
            .then(() => record.updateOne({ status: 'sent' }))
            .catch((err) => {
              logger.warn(`Push failed uid=${user._id} err=${err.message}`);
              return record.updateOne({ status: 'failed', failedReason: err.message });
            })
        );
      }

      // ── SMS ───────────────────────────────────────────────────────────────
      if (prefs.smsEnabled && user.phone) {
        deliveries.push(
          smsService
            .sendToUser(user._id, `${title}: ${body}`)
            .catch((err) => logger.warn(`SMS failed uid=${user._id} err=${err.message}`))
        );
      }

      // ── Email ─────────────────────────────────────────────────────────────
      if (prefs.emailEnabled && user.email && emailHtml) {
        deliveries.push(
          emailService
            .sendEmail(user.email, emailSubject ?? title, emailHtml)
            .catch((err) => logger.warn(`Email failed uid=${user._id} err=${err.message}`))
        );
      }

      await Promise.allSettled(deliveries);
      return record;
    })
  );

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Return active user IDs for a given platform role. */
async function getActiveUserIdsByRole(role) {
  const users = await User.find({ role, isActive: true }).select('_id');
  return users.map((u) => u._id);
}

// ─────────────────────────────────────────────────────────────────────────────
// FARMER NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fired when a farmer lists a new harvest on the platform.
 * Recipients: all active wholesalers + manufacturers.
 *
 * @param {Object} p
 * @param {string} p.farmerId
 * @param {string} p.farmerName
 * @param {string} p.productName
 * @param {number} p.quantity
 * @param {string} p.unit
 * @param {string} [p.grade]          - e.g. "Grade A"
 * @param {number} p.pricePerUnit     - KES
 * @param {string} p.listingId
 */
async function notifyNewFarmerProduct({
  farmerId, farmerName, productName,
  quantity, unit, grade, pricePerUnit, listingId,
}) {
  const [wholesalerIds, manufacturerIds] = await Promise.all([
    getActiveUserIdsByRole('wholesaler'),
    getActiveUserIdsByRole('manufacturer'),
  ]);

  const recipientIds = [...wholesalerIds, ...manufacturerIds];
  if (!recipientIds.length) return [];

  const gradeStr = grade ? ` — ${grade}` : '';

  return dispatch({
    userIds      : recipientIds,
    type         : 'push',
    channel      : 'new_product',
    title        : `New listing: ${productName} from ${farmerName}`,
    body         : `${quantity} ${unit}${gradeStr} now available at KES ${pricePerUnit}/${unit}. Order before stock runs out.`,
    data         : { farmerId, listingId, productName, quantity, unit },
    emailSubject : `New Farm Listing — ${productName} | ${farmerName}`,
    emailHtml    : `
      <h2 style="color:#2E7D32;">New Farm Listing</h2>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px;font-weight:bold;">Farmer</td><td>${farmerName}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Product</td><td>${productName}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Quantity</td><td>${quantity} ${unit}${gradeStr}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Price</td><td>KES ${pricePerUnit} per ${unit}</td></tr>
      </table>
      <p style="margin-top:16px;">
        <a href="/listings/${listingId}" style="background:#2E7D32;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
          View Listing &amp; Place Order →
        </a>
      </p>
    `,
  });
}

/**
 * Fired when a farmer reports a significant supply drop.
 * Recipients: all active wholesalers + manufacturers.
 *
 * @param {Object} p
 * @param {string} p.farmerId
 * @param {string} p.farmerName
 * @param {string} p.productName
 * @param {number} p.dropPercentage
 * @param {string} p.reason             - e.g. "drought", "disease"
 * @param {string[]} [p.affectedListingIds]
 */
async function notifyFarmerScarcityAlert({
  farmerId, farmerName, productName,
  dropPercentage, reason, affectedListingIds = [],
}) {
  const [wholesalerIds, manufacturerIds] = await Promise.all([
    getActiveUserIdsByRole('wholesaler'),
    getActiveUserIdsByRole('manufacturer'),
  ]);

  const recipientIds = [...wholesalerIds, ...manufacturerIds];
  if (!recipientIds.length) return [];

  return dispatch({
    userIds      : recipientIds,
    type         : 'push',
    channel      : 'scarcity_alert',
    title        : `⚠ Scarcity alert: ${productName} supply down ${dropPercentage}%`,
    body         : `${farmerName} reports a ${dropPercentage}% drop in ${productName} due to ${reason}. Adjust procurement plans.`,
    data         : { farmerId, productName, dropPercentage, reason, affectedListingIds },
    emailSubject : `Supply Disruption Alert — ${productName}`,
    emailHtml    : `
      <h2 style="color:#C62828;">⚠ Supply Scarcity Alert</h2>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px;font-weight:bold;">Product</td><td>${productName}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Farmer</td><td>${farmerName}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Supply Drop</td><td>${dropPercentage}%</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Reason</td><td>${reason}</td></tr>
      </table>
      <p style="margin-top:12px;color:#555;">
        We recommend sourcing from alternative suppliers until supply stabilises.
        Check the Market View for available alternatives.
      </p>
    `,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WHOLESALER NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fired when a wholesaler makes new stock available to retailers.
 * Recipients: all active retailers.
 *
 * @param {Object} p
 * @param {string} p.wholesalerId
 * @param {string} p.wholesalerName
 * @param {string} p.productName
 * @param {number} p.quantity
 * @param {string} p.unit
 * @param {number} p.retailPrice        - KES
 * @param {number} [p.discountPct]      - Optional introductory discount %
 * @param {number} p.minOrderQty
 * @param {string} p.stockId
 */
async function notifyWholesalerNewStock({
  wholesalerId, wholesalerName, productName,
  quantity, unit, retailPrice, discountPct, minOrderQty, stockId,
}) {
  const retailerIds = await getActiveUserIdsByRole('retailer');
  if (!retailerIds.length) return [];

  const discountStr = discountPct ? ` (${discountPct}% introductory discount)` : '';

  return dispatch({
    userIds      : retailerIds,
    type         : 'push',
    channel      : 'new_product',
    title        : `New stock: ${productName} at ${wholesalerName}`,
    body         : `${quantity} ${unit} available at KES ${retailPrice}/${unit}${discountStr}. Min. order: ${minOrderQty} ${unit}.`,
    data         : { wholesalerId, stockId, productName, quantity },
    emailSubject : `New Stock Available — ${productName} | ${wholesalerName}`,
    emailHtml    : `
      <h2 style="color:#1565C0;">New Stock Available</h2>
      <p>From <strong>${wholesalerName}</strong></p>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px;font-weight:bold;">Product</td><td>${productName}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Quantity</td><td>${quantity} ${unit}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Retail Price</td><td>KES ${retailPrice}/${unit}</td></tr>
        ${discountPct ? `<tr><td style="padding:6px;font-weight:bold;">Discount</td><td>${discountPct}% — limited time offer</td></tr>` : ''}
        <tr><td style="padding:6px;font-weight:bold;">Min. Order</td><td>${minOrderQty} ${unit}</td></tr>
      </table>
      <p style="margin-top:16px;">
        <a href="/stock/${stockId}" style="background:#1565C0;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
          Order Now →
        </a>
      </p>
    `,
  });
}

/**
 * Fired when a retailer's order is packed and ready for dispatch.
 * Recipient: the specific retailer only.
 *
 * @param {Object}   p
 * @param {string}   p.retailerId
 * @param {string}   p.wholesalerName
 * @param {string}   p.orderId
 * @param {Array<{name:string,quantity:number,unit:string}>} p.items
 * @param {string}   p.dispatchDate       - Human-readable date string
 */
async function notifyOrderReady({
  retailerId, wholesalerName, orderId, items, dispatchDate,
}) {
  const itemSummary = items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(', ');

  return dispatch({
    userIds      : [retailerId],
    type         : 'push',
    channel      : 'order_update',
    title        : `Order #${orderId} is packed and ready`,
    body         : `${itemSummary} — ready for dispatch on ${dispatchDate}. Confirm or schedule pickup.`,
    data         : { orderId, dispatchDate },
    emailSubject : `Order #${orderId} Ready for Dispatch — ${wholesalerName}`,
    emailHtml    : `
      <h2 style="color:#1565C0;">Your Order Is Ready</h2>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px;font-weight:bold;">Order</td><td>#${orderId}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Items</td><td>${itemSummary}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Dispatch Date</td><td>${dispatchDate}</td></tr>
      </table>
      <p style="margin-top:16px;">
        <a href="/orders/${orderId}/confirm" style="background:#1565C0;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
          Confirm Delivery →
        </a>
      </p>
    `,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUFACTURER NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fired when a manufacturer launches a new processed product.
 * Recipients: all active retailers + wholesalers.
 *
 * @param {Object}   p
 * @param {string}   p.manufacturerId
 * @param {string}   p.manufacturerName
 * @param {string}   p.productName
 * @param {string[]} [p.variants]
 * @param {string[]} [p.certifications]
 * @param {number}   p.wholesalePrice   - KES
 * @param {number}   p.retailPrice      - KES
 * @param {string}   p.productId
 */
async function notifyManufacturerNewProduct({
  manufacturerId, manufacturerName, productName,
  variants = [], certifications = [], wholesalePrice, retailPrice, productId,
}) {
  const [retailerIds, wholesalerIds] = await Promise.all([
    getActiveUserIdsByRole('retailer'),
    getActiveUserIdsByRole('wholesaler'),
  ]);

  const recipientIds = [...retailerIds, ...wholesalerIds];
  if (!recipientIds.length) return [];

  const certStr    = certifications.length ? `Certified: ${certifications.join(', ')}. ` : '';
  const variantStr = variants.length ? `Available in: ${variants.join(', ')}. ` : '';

  return dispatch({
    userIds      : recipientIds,
    type         : 'push',
    channel      : 'new_product',
    title        : `New product: ${productName} by ${manufacturerName}`,
    body         : `${variantStr}${certStr}Wholesale KES ${wholesalePrice} | Retail KES ${retailPrice}. Request samples or place a bulk order.`,
    data         : { manufacturerId, productId, productName },
    emailSubject : `New Product Launch — ${productName} | ${manufacturerName}`,
    emailHtml    : `
      <h2 style="color:#4A148C;">${productName} — Now Available</h2>
      <p>By <strong>${manufacturerName}</strong></p>
      ${variants.length ? `<p><strong>Variants:</strong> ${variants.join(', ')}</p>` : ''}
      ${certifications.length ? `<p><strong>Certifications:</strong> ${certifications.join(', ')}</p>` : ''}
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px;font-weight:bold;">Wholesale Price</td><td>KES ${wholesalePrice}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Retail Price</td><td>KES ${retailPrice}</td></tr>
      </table>
      <p style="margin-top:16px;">
        <a href="/products/${productId}" style="background:#4A148C;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
          View Product &amp; Request Samples →
        </a>
      </p>
    `,
  });
}

/**
 * Fired for a time-limited exclusive promotion targeting registered retailers.
 * Recipients: all active retailers.
 *
 * @param {Object} p
 * @param {string} p.manufacturerId
 * @param {string} p.manufacturerName
 * @param {string} p.productName
 * @param {string} p.promoDescription
 * @param {Date|string} p.expiresAt
 * @param {string} p.promoId
 */
async function notifyRetailerPromotion({
  manufacturerId, manufacturerName, productName,
  promoDescription, expiresAt, promoId,
}) {
  const retailerIds = await getActiveUserIdsByRole('retailer');
  if (!retailerIds.length) return [];

  const hoursLeft = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 36e5));

  return dispatch({
    userIds      : retailerIds,
    type         : 'push',
    channel      : 'group_buy',
    title        : `Retailer promo: ${productName} — ${hoursLeft} hrs left`,
    body         : `${promoDescription} | From ${manufacturerName}. Registered retailers only. Expires in ${hoursLeft} hours.`,
    data         : { manufacturerId, promoId, productName, expiresAt },
    emailSubject : `Exclusive Retailer Offer — ${productName} | ${manufacturerName}`,
    emailHtml    : `
      <h2 style="color:#E65100;">Exclusive Retailer Promotion</h2>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px;font-weight:bold;">Product</td><td>${productName}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Offer</td><td>${promoDescription}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">By</td><td>${manufacturerName}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Expires</td><td>${formatKE(expiresAt)}</td></tr>
      </table>
      <p style="margin-top:16px;">
        <a href="/promotions/${promoId}" style="background:#E65100;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
          Claim Offer →
        </a>
      </p>
    `,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGISTICS NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fired when a shipper creates a new transport job on the platform.
 * Recipients: all active logistics/driver accounts.
 * Drivers have 3 minutes to accept urgent express jobs.
 *
 * @param {Object} p
 * @param {string} p.shipperId
 * @param {string} p.shipperName
 * @param {string} p.shipperRole         - 'wholesaler' | 'manufacturer' | 'farmer'
 * @param {string} p.jobId
 * @param {string} p.origin              - e.g. "Kakuma"
 * @param {string} p.destination         - e.g. "Kitale"
 * @param {string} p.cargoType           - e.g. "Maize"
 * @param {number} p.weightTons          - metric tons
 * @param {string} p.departureDate       - Human-readable
 * @param {number} p.offeredRate         - KES
 * @param {boolean} [p.isExpress=false]  - Express 3-minute accept window
 */
async function notifyLogisticsNewJob({
  shipperId, shipperName, shipperRole,
  jobId, origin, destination,
  cargoType, weightTons, departureDate, offeredRate,
  isExpress = false,
}) {
  const driverIds = await getActiveUserIdsByRole('logistics');
  if (!driverIds.length) return [];

  const urgencyTag  = isExpress ? 'URGENT JOB — Accept within 3 min. ' : '';
  const urgencyBadge = isExpress
    ? '<span style="background:#C62828;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;">URGENT — 3 min to accept</span>'
    : '';

  return dispatch({
    userIds      : driverIds,
    type         : 'push',
    channel      : 'logistics',
    title        : `${isExpress ? '🚨 URGENT ' : ''}Job: ${origin} → ${destination}`,
    body         : `${urgencyTag}${weightTons}t of ${cargoType}. Departs: ${departureDate}. Rate: KES ${offeredRate}.`,
    data         : { shipperId, jobId, origin, destination, cargoType, weightTons, departureDate, isExpress },
    emailSubject : `${isExpress ? '[URGENT] ' : ''}Logistics Job #${jobId} — ${origin} → ${destination}`,
    emailHtml    : `
      <h2 style="color:#37474F;">New Transport Job ${urgencyBadge}</h2>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px;font-weight:bold;">Route</td><td>${origin} → ${destination}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Cargo</td><td>${cargoType} (${weightTons} metric tons)</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Departure</td><td>${departureDate}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Offered Rate</td><td>KES ${offeredRate}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Shipper</td><td>${shipperName} (${shipperRole})</td></tr>
      </table>
      <p style="margin-top:16px;">
        <a href="/jobs/${jobId}/accept" style="background:#37474F;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
          Accept Job →
        </a>
      </p>
    `,
  });
}

/**
 * Fired when a driver confirms pickup by scanning the seller's QR code.
 * Recipient: the seller (farmer / wholesaler / manufacturer) only.
 *
 * @param {Object} p
 * @param {string} p.sellerId
 * @param {string} p.driverName
 * @param {string} p.vehiclePlate
 * @param {string} p.shipmentId
 * @param {string} p.cargoSummary
 * @param {string} p.destinationName
 * @param {string} p.estimatedArrival     - Human-readable ETA
 */
async function notifyPickupConfirmed({
  sellerId, driverName, vehiclePlate,
  shipmentId, cargoSummary, destinationName, estimatedArrival,
}) {
  return dispatch({
    userIds      : [sellerId],
    type         : 'push',
    channel      : 'logistics',
    title        : `Pickup confirmed — Shipment #${shipmentId} in transit`,
    body         : `Driver ${driverName} (${vehiclePlate}) collected ${cargoSummary}. ETA to ${destinationName}: ${estimatedArrival}.`,
    data         : { shipmentId, driverName, vehiclePlate, destinationName },
    emailSubject : `Pickup Confirmed — Shipment #${shipmentId}`,
    emailHtml    : `
      <h2 style="color:#1565C0;">Cargo Picked Up — In Transit</h2>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px;font-weight:bold;">Shipment</td><td>#${shipmentId}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Cargo</td><td>${cargoSummary}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Driver</td><td>${driverName} — ${vehiclePlate}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Destination</td><td>${destinationName}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">ETA</td><td>${estimatedArrival}</td></tr>
      </table>
      <p style="color:#555;margin-top:12px;">Payment is held in escrow and will be released once the buyer scans the delivery QR code.</p>
    `,
  });
}

/**
 * Fired when a driver is approaching the delivery point (within 15 min / 50 m GPS radius).
 * Recipient: the buyer (retailer / wholesaler) only.
 *
 * @param {Object} p
 * @param {string} p.buyerId
 * @param {string} p.driverName
 * @param {string} p.minutesAway
 * @param {string} p.shipmentId
 */
async function notifyDriverApproaching({
  buyerId, driverName, minutesAway, shipmentId,
}) {
  return dispatch({
    userIds : [buyerId],
    type    : 'push',
    channel : 'logistics',
    title   : `Driver ${driverName} is ${minutesAway} minutes away`,
    body    : `Prepare to scan the QR code at your delivery point. Shipment #${shipmentId}.`,
    data    : { shipmentId, driverName, minutesAway },
  });
}

/**
 * Fired after buyer scans driver's QR at delivery — escrow released.
 * Recipients: the seller (payment confirmation) and the driver (payout notice).
 *
 * @param {Object} p
 * @param {string} p.sellerId
 * @param {string} p.driverId
 * @param {string} p.shipmentId
 * @param {string} p.cargoSummary
 * @param {string} p.deliveredAt       - Human-readable timestamp
 * @param {number} p.sellerPayout      - KES released to seller
 * @param {number} p.driverPayout      - KES released to driver (after commission & sinking fund)
 * @param {string} [p.proofUrl]        - Delivery proof document URL
 * @param {string} [p.paymentEta]      - Expected M-Pesa settlement time
 */
async function notifyDeliveryConfirmed({
  sellerId, driverId, shipmentId, cargoSummary,
  deliveredAt, sellerPayout, driverPayout, proofUrl, paymentEta,
}) {
  const sellerNotification = dispatch({
    userIds      : [sellerId],
    type         : 'push',
    channel      : 'payment',
    title        : `Delivery confirmed — KES ${sellerPayout.toLocaleString()} released`,
    body         : `${cargoSummary} delivered and signed off at ${deliveredAt}. ${paymentEta ? `Payment to your wallet by ${paymentEta}.` : ''}`,
    data         : { shipmentId, deliveredAt, proofUrl, amount: sellerPayout },
    emailSubject : `Delivery Confirmed & Payment Released — Shipment #${shipmentId}`,
    emailHtml    : `
      <h2 style="color:#2E7D32;">Delivery Confirmed</h2>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px;font-weight:bold;">Shipment</td><td>#${shipmentId}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Cargo</td><td>${cargoSummary}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Delivered</td><td>${deliveredAt}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Payout</td><td>KES ${sellerPayout.toLocaleString()}</td></tr>
        ${paymentEta ? `<tr><td style="padding:6px;font-weight:bold;">Payment ETA</td><td>${paymentEta}</td></tr>` : ''}
      </table>
      ${proofUrl ? `<p style="margin-top:12px;"><a href="${proofUrl}">View Proof of Delivery →</a></p>` : ''}
    `,
  });

  const driverNotification = dispatch({
    userIds : [driverId],
    type    : 'push',
    channel : 'payment',
    title   : `Trip complete — KES ${driverPayout.toLocaleString()} earned`,
    body    : `Shipment #${shipmentId} delivered. After platform fee and sinking fund deduction, KES ${driverPayout.toLocaleString()} is on its way to your wallet.`,
    data    : { shipmentId, deliveredAt, amount: driverPayout },
  });

  return Promise.all([sellerNotification, driverNotification]);
}

/**
 * Fired 72 hours after delivery when escrow auto-releases without dispute.
 * Recipients: seller + driver.
 *
 * @param {Object} p
 * @param {string} p.sellerId
 * @param {string} p.driverId
 * @param {string} p.shipmentId
 * @param {number} p.sellerPayout   - KES
 * @param {number} p.driverPayout   - KES
 */
async function notifyEscrowAutoReleased({
  sellerId, driverId, shipmentId, sellerPayout, driverPayout,
}) {
  return Promise.all([
    dispatch({
      userIds : [sellerId],
      type    : 'in_app',
      channel : 'payment',
      title   : `Escrow auto-released — KES ${sellerPayout.toLocaleString()}`,
      body    : `72-hour dispute window passed. KES ${sellerPayout.toLocaleString()} for Shipment #${shipmentId} has been released to your wallet.`,
      data    : { shipmentId, amount: sellerPayout },
    }),
    dispatch({
      userIds : [driverId],
      type    : 'in_app',
      channel : 'payment',
      title   : `Payment auto-released — KES ${driverPayout.toLocaleString()}`,
      body    : `Shipment #${shipmentId} — dispute window closed. KES ${driverPayout.toLocaleString()} released to your wallet.`,
      data    : { shipmentId, amount: driverPayout },
    }),
  ]);
}

/**
 * Fired when a group trip reaches 80% capacity and is ready to depart.
 * Recipients: all drivers who have accepted slots in the group trip.
 *
 * @param {Object}   p
 * @param {string[]} p.driverIds
 * @param {string}   p.tripId
 * @param {number}   p.pickupCount      - Number of pickups loaded
 * @param {number}   p.totalFare        - KES total for the trip
 * @param {string}   p.origin
 * @param {string}   p.destination
 */
async function notifyGroupTripReady({
  driverIds, tripId, pickupCount, totalFare, origin, destination,
}) {
  return dispatch({
    userIds : driverIds,
    type    : 'push',
    channel : 'logistics',
    title   : `Group trip ready — ${origin} → ${destination}`,
    body    : `${pickupCount} pickups loaded at 80%+ capacity. Total fare: KES ${totalFare.toLocaleString()}. Start the trip now.`,
    data    : { tripId, pickupCount, totalFare, origin, destination },
  });
}

/**
 * Fired when a driver's vehicle approaches a service milestone (km/oil).
 * Recipient: the specific driver only.
 *
 * @param {Object} p
 * @param {string} p.driverId
 * @param {string} p.vehiclePlate
 * @param {number} p.currentKm
 * @param {number} p.serviceKm         - Milestone that triggered the alert
 * @param {string} p.serviceType       - e.g. "oil change"
 * @param {number} p.sinkingFundBalance - KES available in maintenance fund
 */
async function notifyVehicleServiceDue({
  driverId, vehiclePlate, currentKm, serviceKm, serviceType, sinkingFundBalance,
}) {
  return dispatch({
    userIds : [driverId],
    type    : 'sms',
    channel : 'system',
    title   : `Service alert: ${vehiclePlate} — ${serviceType} due`,
    body    : `Your truck is at ${currentKm.toLocaleString()} km. ${serviceType} is due at ${serviceKm.toLocaleString()} km. Sinking Fund balance: KES ${sinkingFundBalance.toLocaleString()}.`,
    data    : { vehiclePlate, currentKm, serviceKm, serviceType, sinkingFundBalance },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK & INVENTORY NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fired when a stock level falls below a role-configured minimum threshold.
 * Recipient: the specific user (wholesaler or retailer) only.
 *
 * @param {Object} p
 * @param {string} p.userId
 * @param {string} p.productName
 * @param {number} p.currentStock
 * @param {number} p.minThreshold
 * @param {string} p.unit
 * @param {string} [p.suggestedSupplierId]
 */
async function notifyLowStockAlert({
  userId, productName, currentStock, minThreshold, unit, suggestedSupplierId,
}) {
  const actionStr = suggestedSupplierId ? ` Tap to restock from nearest supplier.` : '';

  return dispatch({
    userIds : [userId],
    type    : 'push',
    channel : 'scarcity_alert',
    title   : `Low stock: ${productName} at ${currentStock} ${unit}`,
    body    : `Below your minimum of ${minThreshold} ${unit}.${actionStr}`,
    data    : { productName, currentStock, minThreshold, suggestedSupplierId },
  });
}

/**
 * Fired when an item has not sold within a configurable dead-stock window.
 * Recipient: the specific retailer only.
 *
 * @param {Object} p
 * @param {string} p.retailerId
 * @param {string} p.productName
 * @param {number} p.quantity
 * @param {number} p.daysSinceLastSale
 * @param {number} [p.suggestedDiscountPct]
 */
async function notifyDeadStockAlert({
  retailerId, productName, quantity, daysSinceLastSale, suggestedDiscountPct,
}) {
  const promoStr = suggestedDiscountPct
    ? ` Suggested: flash sale at ${suggestedDiscountPct}% off.`
    : '';

  return dispatch({
    userIds : [retailerId],
    type    : 'in_app',
    channel : 'system',
    title   : `Dead stock: ${productName} (${quantity} units)`,
    body    : `Not sold in ${daysSinceLastSale} days.${promoStr}`,
    data    : { productName, quantity, daysSinceLastSale, suggestedDiscountPct },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fired when an M-Pesa payment is confirmed and credited to a user's wallet.
 * Recipient: the payee only.
 *
 * @param {Object} p
 * @param {string} p.userId
 * @param {number} p.amount           - KES
 * @param {string} p.reference        - Transaction / order reference
 * @param {string} p.paidBy           - Name of payer
 */
async function notifyPaymentReceived({ userId, amount, reference, paidBy }) {
  return dispatch({
    userIds : [userId],
    type    : 'sms',
    channel : 'payment',
    title   : `Payment received: KES ${amount.toLocaleString()}`,
    body    : `KES ${amount.toLocaleString()} from ${paidBy} — Ref: ${reference}. Credited to your Lango wallet.`,
    data    : { amount, reference, paidBy },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Core dispatcher
  dispatch,

  // Farmer
  notifyNewFarmerProduct,
  notifyFarmerScarcityAlert,

  // Wholesaler
  notifyWholesalerNewStock,
  notifyOrderReady,

  // Manufacturer
  notifyManufacturerNewProduct,
  notifyRetailerPromotion,

  // Logistics — jobs & tracking
  notifyLogisticsNewJob,
  notifyPickupConfirmed,
  notifyDriverApproaching,
  notifyDeliveryConfirmed,
  notifyEscrowAutoReleased,
  notifyGroupTripReady,
  notifyVehicleServiceDue,

  // Inventory
  notifyLowStockAlert,
  notifyDeadStockAlert,

  // Payments
  notifyPaymentReceived,
};