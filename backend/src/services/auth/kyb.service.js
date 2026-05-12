const axios = require('axios');
const User = require('../../models/User.model');
const logger = require('../../utils/logger');

class KYBService {
  /**
   * Perform ID verification using external OCR service or government API
   */
  async verifyIdentity(idNumber, idImageUrl, fullName) {
    // Example: call a third-party verification API (e.g., Smile Identity, YouVerify)
    try {
      const response = await axios.post(
        process.env.KYB_API_URL,
        {
          idNumber,
          idImageUrl,
          fullName,
        },
        {
          headers: { Authorization: `Bearer ${process.env.KYB_API_KEY}` },
          timeout: 10000,
        }
      );

      return {
        verified: response.data.verified,
        confidence: response.data.confidence,
        details: response.data.details,
      };
    } catch (error) {
      logger.error('KYB verification failed:', error.message);
      // Fallback to manual review flag
      return { verified: false, confidence: 0, reason: 'API error' };
    }
  }

  /**
   * Submit user for manual review if automated fails
   */
  async requestManualReview(userId, reason) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.kycDetails.manualReviewRequested = true;
    user.kycDetails.manualReviewReason = reason;
    await user.save();

    // Notify admin via notification service
    // await notificationService.notifyAdmins('KYC Review Needed', { userId, reason });

    return { status: 'manual_review_requested' };
  }

  /**
   * Admin approves KYC
   */
  async approveKYC(userId, adminId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.kycVerified = true;
    user.kycDetails.verifiedAt = new Date();
    user.kycDetails.verifiedBy = adminId;
    user.kycDetails.manualReviewRequested = false;
    await user.save();

    return { kycVerified: true };
  }

  /**
   * Admin rejects KYC
   */
  async rejectKYC(userId, adminId, reason) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.kycVerified = false;
    user.kycDetails.rejectedAt = new Date();
    user.kycDetails.rejectedBy = adminId;
    user.kycDetails.rejectionReason = reason;
    await user.save();

    return { kycVerified: false, reason };
  }
}

module.exports = new KYBService();