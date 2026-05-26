module.exports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  if (req.user.role === 'admin') {
    return next();
  }

  if (req.user.role !== 'logistics') {
    return res.status(403).json({
      success: false,
      message: 'Only logistics users can perform this action.',
    });
  }

  const verificationStatus = req.user?.logisticsProfile?.verificationStatus || 'unverified';
  if (verificationStatus !== 'verified') {
    return res.status(403).json({
      success: false,
      message: 'Logistics account is not approved yet. Complete verification and wait for admin approval.',
      verificationStatus,
    });
  }

  return next();
};
