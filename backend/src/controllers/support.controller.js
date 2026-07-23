const { validationResult } = require('express-validator');
const SupportMessage = require('../models/SupportMessage.model');
const User = require('../models/User.model');
const notificationService = require('../services/notification/notification.service');
const emailService = require('../services/notification/email.service');
const smsService = require('../services/notification/sms.service');

const getUserId = (user) => user?._id || user?.id || user?.userId;

const getDisplayName = (user) =>
  user?.fullName || user?.name || user?.businessName || user?.email || user?.phone || 'User';

const getRequesterSnapshot = (user) => ({
  name: getDisplayName(user),
  email: user?.email || '',
  phone: user?.phone || '',
  businessName: user?.businessName || '',
});

const inquiryCategoryMap = {
  general: 'general',
  orders: 'orders',
  billing: 'payments',
  payments: 'payments',
  subscription: 'payments',
  technical: 'technical',
  partnership: 'general',
  logistics: 'logistics',
  products: 'products',
  account: 'account',
};

const getContactTicketId = (thread) => `CNT-${String(thread?._id || '').slice(-8).toUpperCase()}`;

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const sanitizeSupportMessage = (thread) => {
  const raw = thread?.toObject ? thread.toObject() : thread;
  return {
    ...raw,
    id: raw._id,
    requesterName: raw.requesterSnapshot?.name || getDisplayName(raw.requester),
    requesterEmail: raw.requesterSnapshot?.email || raw.requester?.email || '',
    requesterPhone: raw.requesterSnapshot?.phone || raw.requester?.phone || '',
  };
};

const createNotificationSafely = async (userId, payload) => {
  if (!userId) return null;
  try {
    return await notificationService.create(userId, payload);
  } catch (error) {
    console.warn('Support notification failed:', error.message);
    return null;
  }
};

const notifyAdminsOfNewMessage = async (thread, sender) => {
  const admins = await User.find({ role: 'admin', isActive: { $ne: false } }).select('_id').lean();
  if (!admins.length) return;

  await Promise.all(
    admins.map((adminUser) =>
      createNotificationSafely(adminUser._id, {
        type: 'in_app',
        channel: 'system',
        title: `New support message: ${thread.subject}`,
        body: `${getDisplayName(sender)} sent a message to admin support.`,
        status: 'sent',
        data: {
          source: 'support_message',
          supportMessageId: String(thread._id),
          href: '/admin/contact-queue',
        },
      })
    )
  );
};

exports.createPublicContactMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      fullName,
      name,
      email,
      phone,
      inquiryType = 'general',
      subject,
      message,
      source = 'web-contact-form',
      submittedAt,
    } = req.body;

    const normalizedInquiryType = String(inquiryType || 'general').trim().toLowerCase();
    const category = inquiryCategoryMap[normalizedInquiryType] || 'general';
    const requesterSnapshot = {
      name: String(fullName || name || 'Website visitor').trim(),
      email: String(email || '').trim().toLowerCase(),
      phone: String(phone || '').trim(),
      businessName: '',
    };
    const safeSubject = String(subject || `${normalizedInquiryType} inquiry`).trim();
    const bodyLines = [
      String(message || '').trim(),
      '',
      `Source: ${source}`,
      `Inquiry type: ${normalizedInquiryType}`,
      submittedAt ? `Submitted at: ${submittedAt}` : null,
    ].filter(Boolean);

    const thread = await SupportMessage.create({
      requester: undefined,
      requesterRole: 'guest',
      requesterSnapshot,
      subject: safeSubject,
      category,
      priority: ['orders', 'billing', 'technical'].includes(normalizedInquiryType) ? 'high' : 'normal',
      status: 'pending_admin',
      lastMessageAt: new Date(),
      messages: [{
        sender: undefined,
        senderRole: 'guest',
        body: bodyLines.join('\n'),
        channel: 'email',
        sentByAdmin: false,
      }],
    });

    await notifyAdminsOfNewMessage(thread, {
      fullName: requesterSnapshot.name,
      email: requesterSnapshot.email,
      phone: requesterSnapshot.phone,
      role: 'guest',
    });

    const sanitized = sanitizeSupportMessage(thread);
    const ticketId = getContactTicketId(thread);

    res.status(201).json({
      success: true,
      message: 'Contact message received. Our support team will respond shortly.',
      ticketId,
      data: {
        ...sanitized,
        ticketId,
      },
    });
  } catch (error) {
    next(error);
  }
};

const notifyRequesterOfReply = async (thread, { reply, channel }) => {
  const requester = thread.requester
    ? await User.findById(thread.requester).select('email phone fullName name businessName').lean()
    : null;
  const requesterSnapshot = thread.requesterSnapshot || {};
  const target = {
    _id: requester?._id || null,
    name: requester ? getDisplayName(requester) : requesterSnapshot.name || 'Customer',
    email: requester?.email || requesterSnapshot.email || '',
    phone: requester?.phone || requesterSnapshot.phone || '',
  };

  if (!target.email && !target.phone && !target._id) {
    return {
      email: { success: false, message: 'No requester email address found' },
      sms: { success: false, message: 'No requester phone number found' },
      inApp: null,
    };
  }

  const results = { email: null, sms: null, inApp: null };

  if (target._id) {
    results.inApp = await createNotificationSafely(target._id, {
      type: 'in_app',
      channel: 'system',
      title: `Admin replied: ${thread.subject}`,
      body: reply,
      status: 'sent',
      data: {
        source: 'support_reply',
        supportMessageId: String(thread._id),
        href: '/support',
      },
    });
  }

  const shouldEmail = ['email', 'all'].includes(channel) || (!target._id && channel === 'in_app');
  const shouldSms = ['sms', 'all'].includes(channel);

  if (shouldEmail && target.email) {
    const safeReplyHtml = escapeHtml(reply).replace(/\n/g, '<br />');
    const safeSubject = escapeHtml(thread.subject);
    const safeName = escapeHtml(target.name);
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="color:#F97316">Admin reply from Lango MarketPulse</h2>
        <p>Hello ${safeName},</p>
        <p><strong>${safeSubject}</strong></p>
        <div style="margin:16px 0;padding:14px 16px;border-left:4px solid #F97316;background:#FFF7ED">
          ${safeReplyHtml}
        </div>
        <p style="font-size:12px;color:#6B7280">Reply to this email or open your dashboard support inbox to continue the conversation.</p>
      </div>
    `;
    results.email = await emailService
      .sendEmail(target.email, `Admin reply: ${thread.subject}`, html, reply)
      .catch((error) => ({ success: false, error: error.message }));
  }

  if (shouldSms && target.phone) {
    results.sms = await smsService
      .sendToPhone(target.phone, `Lango Admin: ${reply}`)
      .catch((error) => ({ success: false, error: error.message }));
  }

  return results;
};

exports.createSupportMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { subject, message, category = 'general', priority = 'normal' } = req.body;
    const requesterId = getUserId(req.user);
    const thread = await SupportMessage.create({
      requester: requesterId,
      requesterRole: req.user.role || 'buyer',
      requesterSnapshot: getRequesterSnapshot(req.user),
      subject,
      category,
      priority,
      status: 'pending_admin',
      lastMessageAt: new Date(),
      messages: [{
        sender: requesterId,
        senderRole: req.user.role || 'user',
        body: message,
        channel: 'in_app',
        sentByAdmin: false,
      }],
    });

    await notifyAdminsOfNewMessage(thread, req.user);

    res.status(201).json({
      success: true,
      message: 'Message sent to admin support',
      data: sanitizeSupportMessage(thread),
    });
  } catch (error) {
    next(error);
  }
};

exports.getMySupportMessages = async (req, res, next) => {
  try {
    const { status = 'all', page = 1, limit = 20 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));
    const query = { requester: getUserId(req.user) };
    if (status !== 'all') query.status = status;

    const [threads, total] = await Promise.all([
      SupportMessage.find(query)
        .populate('requester', 'fullName name businessName email phone role')
        .populate('messages.sender', 'fullName name businessName email phone role')
        .sort('-lastMessageAt')
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      SupportMessage.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: threads.map(sanitizeSupportMessage),
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.addUserReply = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const thread = await SupportMessage.findOne({
      _id: req.params.messageId,
      requester: getUserId(req.user),
    });

    if (!thread) {
      return res.status(404).json({ success: false, message: 'Support message not found' });
    }

    thread.messages.push({
      sender: getUserId(req.user),
      senderRole: req.user.role || 'user',
      body: req.body.message,
      channel: 'in_app',
      sentByAdmin: false,
    });
    thread.status = 'pending_admin';
    thread.lastMessageAt = new Date();
    thread.closedAt = undefined;
    await thread.save();
    await notifyAdminsOfNewMessage(thread, req.user);

    const populated = await SupportMessage.findById(thread._id)
      .populate('requester', 'fullName name businessName email phone role')
      .populate('messages.sender', 'fullName name businessName email phone role');

    res.status(200).json({
      success: true,
      message: 'Reply sent to admin support',
      data: sanitizeSupportMessage(populated),
    });
  } catch (error) {
    next(error);
  }
};

exports.getAdminSupportMessages = async (req, res, next) => {
  try {
    const { status = 'all', role = 'all', search = '', page = 1, limit = 25 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 25));
    const query = {};

    if (status !== 'all') query.status = status;
    if (role !== 'all') query.requesterRole = role;
    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { subject: searchRegex },
        { 'requesterSnapshot.name': searchRegex },
        { 'requesterSnapshot.email': searchRegex },
        { 'requesterSnapshot.phone': searchRegex },
        { 'messages.body': searchRegex },
      ];
    }

    const [threads, total, counts] = await Promise.all([
      SupportMessage.find(query)
        .populate('requester', 'fullName name businessName email phone role')
        .populate('messages.sender', 'fullName name businessName email phone role')
        .sort('-lastMessageAt')
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      SupportMessage.countDocuments(query),
      SupportMessage.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    res.status(200).json({
      success: true,
      data: threads.map(sanitizeSupportMessage),
      counts,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.adminReplyToSupportMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { message, channel = 'in_app', status = 'pending_user' } = req.body;
    const thread = await SupportMessage.findById(req.params.messageId);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Support message not found' });
    }

    thread.messages.push({
      sender: getUserId(req.user),
      senderRole: 'admin',
      body: message,
      channel,
      sentByAdmin: true,
    });
    thread.status = status;
    thread.lastMessageAt = new Date();
    thread.lastAdminReplyAt = new Date();
    thread.closedAt = ['resolved', 'closed'].includes(status) ? new Date() : undefined;
    await thread.save();

    const delivery = await notifyRequesterOfReply(thread, { reply: message, channel });
    const populated = await SupportMessage.findById(thread._id)
      .populate('requester', 'fullName name businessName email phone role')
      .populate('messages.sender', 'fullName name businessName email phone role');

    res.status(200).json({
      success: true,
      message: 'Admin reply sent',
      data: sanitizeSupportMessage(populated),
      delivery,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateSupportMessageStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const updates = {
      status: req.body.status,
      closedAt: ['resolved', 'closed'].includes(req.body.status) ? new Date() : undefined,
    };
    const thread = await SupportMessage.findByIdAndUpdate(req.params.messageId, updates, { new: true })
      .populate('requester', 'fullName name businessName email phone role')
      .populate('messages.sender', 'fullName name businessName email phone role');

    if (!thread) {
      return res.status(404).json({ success: false, message: 'Support message not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Support status updated',
      data: sanitizeSupportMessage(thread),
    });
  } catch (error) {
    next(error);
  }
};
