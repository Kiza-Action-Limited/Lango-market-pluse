// config/email.js
// Professional email service using Nodemailer with Gmail SMTP
// Supports HTML emails, attachments, and email templates

const nodemailer = require('nodemailer');
const logger = require('../utils/logger'); // Optional: add logger utility

/**
 * Email service configuration
 * Supports multiple email providers (Gmail, SendGrid, Mailgun, etc.)
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.defaultFrom = process.env.EMAIL_FROM || '"Lango Market Pulse" <noreply@langomarket.com>';
    this.supportEmail = process.env.EMAIL_SUPPORT || 'support@langomarket.com';
    this.isInitialized = false;
  }

  /**
   * Initialize and verify SMTP connection
   * @returns {Promise<boolean>}
   */
  async initialize() {
    if (this.isInitialized) return true;

    const config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true, // Use pooled connections
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000, // Rate limit: 1 second between messages
      rateLimit: 5, // Max 5 messages per second
    };

    // Validate required config
    if (!config.auth.user || !config.auth.pass) {
      throw new Error('SMTP credentials missing. Check SMTP_USER and SMTP_PASS in .env');
    }

    this.transporter = nodemailer.createTransport(config);
    
    // Verify connection
    try {
      await this.transporter.verify();
      this.isInitialized = true;
      logger.info('Email service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Email service initialization failed:', error.message);
      throw new Error(`SMTP connection failed: ${error.message}`);
    }
  }

  /**
   * Send email with retry logic
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} [options.text] - Plain text body
   * @param {string} [options.html] - HTML body
   * @param {string} [options.from] - Sender email (overrides default)
   * @param {Array} [options.attachments] - File attachments
   * @param {Object} [options.headers] - Custom headers
   * @param {number} [retries=3] - Number of retry attempts
   * @returns {Promise<Object>}
   */
  async sendEmail(options, retries = 3) {
    await this.initialize();

    const mailOptions = {
      from: options.from || this.defaultFrom,
      to: options.to,
      subject: options.subject,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'Lango Market Pulse',
        'X-Support-Email': this.supportEmail,
        ...options.headers,
      },
      ...(options.text && { text: options.text }),
      ...(options.html && { html: options.html }),
      ...(options.attachments && { attachments: options.attachments }),
    };

    // Validate recipient
    if (!mailOptions.to) {
      throw new Error('Recipient email address is required');
    }

    // Attempt sending with retries
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.transporter.sendMail(mailOptions);
        logger.info(`Email sent to ${options.to}`, { messageId: result.messageId });
        return {
          success: true,
          messageId: result.messageId,
          response: result.response,
          accepted: result.accepted,
          rejected: result.rejected,
        };
      } catch (error) {
        logger.error(`Email send attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          throw new Error(`Failed to send email after ${retries} attempts: ${error.message}`);
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Send OTP verification email
   * @param {string} to - Recipient email
   * @param {string} code - 6-digit OTP code
   * @param {number} expiresIn - Expiry time in minutes
   * @returns {Promise<Object>}
   */
  async sendOtpEmail(to, code, expiresIn = 10) {
    const subject = 'Verify Your Email - Lango Market Pulse';
    const text = `Your verification code is: ${code}\n\nThis code expires in ${expiresIn} minutes. Do not share it with anyone.\n\nIf you didn't request this, please ignore this email or contact support at ${this.supportEmail}.`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .content { padding: 40px 30px; }
          .code-container { background: #f7f7f7; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0; border: 1px solid #e0e0e0; }
          .code { font-size: 48px; font-weight: 700; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace; }
          .timer { color: #666; font-size: 14px; margin-top: 15px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; font-size: 14px; color: #856404; }
          .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e0e0e0; }
          .button { display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin-top: 20px; }
          @media (max-width: 600px) { .content { padding: 20px; } .code { font-size: 32px; letter-spacing: 4px; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${process.env.APP_NAME || 'Lango Market Pulse'}</h1>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">Verify Your Email Address</h2>
            <p>Hello,</p>
            <p>Thank you for registering with Lango Market Pulse. Please use the verification code below to complete your email verification.</p>
            
            <div class="code-container">
              <div class="code">${code}</div>
              <div class="timer">⏰ This code expires in <strong>${expiresIn} minutes</strong></div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Alert:</strong> Never share this code with anyone, including anyone claiming to be from Lango Market Pulse support.
            </div>
            
            <p style="margin-bottom: 5px;">If you didn't request this verification, you can safely ignore this email.</p>
            <p style="margin-top: 5px; color: #666; font-size: 14px;">Need help? Contact our support team at <a href="mailto:${this.supportEmail}">${this.supportEmail}</a></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${process.env.APP_NAME || 'Lango Market Pulse'}. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to, subject, text, html });
  }

  /**
   * Send welcome email to new users
   * @param {string} to - Recipient email
   * @param {string} name - User's name
   * @returns {Promise<Object>}
   */
  async sendWelcomeEmail(to, name) {
    const subject = 'Welcome to Lango Market Pulse!';
    const text = `Welcome ${name}! Thank you for joining Lango Market Pulse. We're excited to have you on board.\n\nGet started by exploring our platform and discovering market insights.\n\nBest regards,\nThe Lango Market Pulse Team`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Welcome to Lango Market Pulse</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { padding: 30px; background: white; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px; }
          .button { display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Lango Market Pulse!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Thank you for joining <strong>Lango Market Pulse</strong>! We're excited to have you on board.</p>
            <p>With Lango Market Pulse, you can:</p>
            <ul>
              <li>Get real-time market updates</li>
              <li>Receive personalized alerts</li>
              <li>Access exclusive market insights</li>
              <li>Connect with local vendors and buyers</li>
            </ul>
            <a href="${process.env.APP_URL}/dashboard" class="button">Get Started</a>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">If you have any questions, feel free to reply to this email or contact our support team.</p>
            <p>Best regards,<br>The Lango Market Pulse Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to, subject, text, html });
  }

  /**
   * Send password reset email
   * @param {string} to - Recipient email
   * @param {string} resetToken - Password reset token
   * @param {number} expiresIn - Expiry time in minutes
   * @returns {Promise<Object>}
   */
  async sendPasswordResetEmail(to, resetToken, expiresIn = 60) {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request - Lango Market Pulse';
    const text = `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link expires in ${expiresIn} minutes.\n\nIf you didn't request this, please ignore this email.`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #667eea;">Password Reset Request</h2>
          <p>You requested to reset your password. Click the button below to proceed:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="background: #f5f5f5; padding: 10px; word-break: break-all;">${resetUrl}</p>
          <p>This link expires in <strong>${expiresIn} minutes</strong>.</p>
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email. Your password won't change until you create a new one.</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to, subject, text, html });
  }

  /**
   * Test email configuration
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      await this.initialize();
      return true;
    } catch (error) {
      logger.error('Email test failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
const emailService = new EmailService();

// Backward compatibility functions
const sendEmail = async (options) => emailService.sendEmail(options);
const sendEmailOtp = async (to, code) => emailService.sendOtpEmail(to, code);
const verifyConnection = () => emailService.testConnection();

module.exports = {
  EmailService,
  emailService,
  sendEmail,
  sendEmailOtp,
  verifyConnection,
};