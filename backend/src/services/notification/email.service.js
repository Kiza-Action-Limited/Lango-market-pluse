const nodemailer = require('nodemailer');
const User = require('../../models/User.model');
const logger = require('../../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initTransporter();
  }

  initTransporter() {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_HOST) {
        logger.warn('Email service not fully configured. Set SMTP_USER, SMTP_PASS, SMTP_HOST in .env');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      this.isConfigured = true;
      logger.info('Email service initialized');
    } catch (error) {
      logger.error('Error initializing email service:', error);
    }
  }

  async sendEmail(to, subject, html, text = null) {
    try {
      if (!this.isConfigured || !this.transporter) {
        logger.warn(`Email not configured. Would send to ${to}:`, subject);
        return { success: true, message: 'Email queued (mock mode)' };
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
        text: text || subject,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${to}:`, info.messageId);

      return {
        success: true,
        message: 'Email sent successfully',
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  async sendToUser(userId, subject, html, text = null) {
    try {
      const user = await User.findById(userId).select('email');
      if (!user || !user.email) {
        logger.warn(`No email found for user ${userId}`);
        return { success: false, message: 'No email address' };
      }

      return await this.sendEmail(user.email, subject, html, text);
    } catch (error) {
      logger.error('Error sending email to user:', error);
      throw error;
    }
  }

  async sendBatch(userIds, subject, html, text = null) {
    try {
      const results = await Promise.all(
        userIds.map(userId => this.sendToUser(userId, subject, html, text).catch(err => ({ error: err.message })))
      );

      return {
        success: true,
        results,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => r.error).length,
      };
    } catch (error) {
      logger.error('Error sending batch emails:', error);
      throw error;
    }
  }

  async broadcast(subject, html, userRole, text = null) {
    try {
      const users = await User.find({ role: userRole }).select('_id');
      const userIds = users.map(u => u._id);

      return await this.sendBatch(userIds, subject, html, text);
    } catch (error) {
      logger.error('Error broadcasting email:', error);
      throw error;
    }
  }

  async sendTemplate(to, templateName, data = {}) {
    try {
      let html = '';
      let subject = '';

      switch (templateName) {
        case 'order-confirmed':
          subject = `Order Confirmed - Lango MarketPulse`;
          html = `
            <h2>Order Confirmed</h2>
            <p>Hello ${data.userName},</p>
            <p>Your order has been confirmed and is being processed.</p>
            <p><strong>Order #:</strong> ${data.orderId}</p>
            <p><strong>Total:</strong> KES ${data.amount}</p>
            <p>Tracking link: <a href="${data.trackingLink}">View Order</a></p>
          `;
          break;

        case 'payment-received':
          subject = `Payment Received - Lango MarketPulse`;
          html = `
            <h2>Payment Received</h2>
            <p>Hello ${data.userName},</p>
            <p>Payment of KES ${data.amount} has been received for Order #${data.orderId}.</p>
            <p>Thank you for using Lango MarketPulse!</p>
          `;
          break;

        case 'driver-assigned':
          subject = `Driver Assigned to Your Order`;
          html = `
            <h2>Driver Assigned</h2>
            <p>Hello ${data.userName},</p>
            <p>Driver <strong>${data.driverName}</strong> has been assigned to your order.</p>
            <p><strong>Vehicle:</strong> ${data.vehiclePlate}</p>
            <p><strong>ETA:</strong> ${data.eta} minutes</p>
          `;
          break;

        default:
          html = data.html || `<p>${data.message}</p>`;
          subject = data.subject || templateName;
      }

      return await this.sendEmail(to, subject, html);
    } catch (error) {
      logger.error('Error sending template email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
