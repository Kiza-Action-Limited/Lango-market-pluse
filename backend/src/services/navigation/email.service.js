const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initTransporter();
  }

  initTransporter() {
    const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST;
    const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD;

    if (!smtpHost || !smtpUser || !smtpPass) {
      logger.warn('Navigation email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    this.isConfigured = true;
  }

  async sendEmail(to, subject, html) {
    try {
      if (!this.isConfigured || !this.transporter) {
        logger.warn(`Navigation email not configured. Would send to ${to}:`, subject);
        return { success: true, message: 'Email queued (mock mode)' };
      }

      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.MAIL_FROM || `"MarketPulse" <${process.env.SMTP_USER || process.env.MAIL_USER}>`,
        to,
        subject,
        html,
      });
      logger.info(`Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Email send error:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendWelcomeEmail(userEmail, userName) {
    const html = `<h1>Welcome to MarketPulse, ${userName}!</h1><p>Start trading smarter.</p>`;
    return this.sendEmail(userEmail, 'Welcome to MarketPulse', html);
  }
}

module.exports = new EmailService();
