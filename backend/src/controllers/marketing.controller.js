const MarketingContent = require('../models/MarketingContent.model');

const HOMEPAGE_ADS_KEY = 'homepage_ads';
const MAX_SLIDES = 3;
const MAX_SIDE_ADS = 4;

const isValidUrl = (value) => {
  try {
    const parsed = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const normalizeLinkUrl = (value = '') => {
  const link = String(value || '').trim();
  if (!link) return '/products';
  if (link.startsWith('/')) return link;
  return isValidUrl(link) ? link : '/products';
};

const normalizeImageItem = (item = {}, index = 0, fallbackTitle = 'Ad') => ({
  title: String(item.title || `${fallbackTitle} ${index + 1}`).trim().slice(0, 120),
  imageUrl: isValidUrl(item.imageUrl || item.image) ? String(item.imageUrl || item.image).trim() : '',
  linkUrl: normalizeLinkUrl(item.linkUrl || item.href || '/products'),
  isActive: item.isActive !== false,
});

const sanitizeHomepageAds = (payload = {}) => ({
  slides: (Array.isArray(payload.slides) ? payload.slides : [])
    .slice(0, MAX_SLIDES)
    .map((item, index) => normalizeImageItem(item, index, 'Slide')),
  sideAds: (Array.isArray(payload.sideAds) ? payload.sideAds : [])
    .slice(0, MAX_SIDE_ADS)
    .map((item, index) => normalizeImageItem(item, index, 'Ad card')),
});

const getHomepageAdsValue = async () => {
  const content = await MarketingContent.findOne({ key: HOMEPAGE_ADS_KEY }).lean();
  return sanitizeHomepageAds(content?.value || {});
};

exports.getPublicHomepageAds = async (req, res, next) => {
  try {
    const data = await getHomepageAdsValue();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getAdminHomepageAds = async (req, res, next) => {
  try {
    const data = await getHomepageAdsValue();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.updateAdminHomepageAds = async (req, res, next) => {
  try {
    const value = sanitizeHomepageAds(req.body || {});
    const content = await MarketingContent.findOneAndUpdate(
      { key: HOMEPAGE_ADS_KEY },
      {
        key: HOMEPAGE_ADS_KEY,
        value,
        updatedBy: req.user?._id || req.user?.id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.status(200).json({
      success: true,
      message: 'Homepage ads updated successfully',
      data: sanitizeHomepageAds(content.value),
    });
  } catch (error) {
    next(error);
  }
};

exports.HOMEPAGE_ADS_KEY = HOMEPAGE_ADS_KEY;
exports.sanitizeHomepageAds = sanitizeHomepageAds;
