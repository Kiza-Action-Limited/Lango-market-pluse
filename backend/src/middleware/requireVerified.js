module.exports = (req, res, next) => {
  const user = req.user;
  const verified = user?.kycVerified === true
    || ['verified', 'gold'].includes(user?.verificationStatus)
    || user?.logisticsProfile?.verificationStatus === 'verified';

  if (verified) return next();

  return res.status(403).json({
    success: false,
    message: 'Escrow access requires verified KYB status.',
  });
};
