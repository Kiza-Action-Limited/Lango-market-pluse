const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(to, subject, html) {
    try {
      const info = await this.transporter.sendMail({
        from: `"MarketPulse" <${process.env.SMTP_FROM}>`,
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