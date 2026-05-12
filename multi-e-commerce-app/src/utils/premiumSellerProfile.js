const STORAGE_KEY = 'marketpulse_premium_seller_profiles_v1';

const getUserKey = (user) => user?.id || user?._id || user?.email || null;

export const getPremiumProfiles = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const savePremiumProfiles = (profiles) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
};

export const getPremiumProfileForUser = (user) => {
  const userKey = getUserKey(user);
  if (!userKey) return null;
  const profiles = getPremiumProfiles();
  return profiles.find((profile) => profile.userKey === userKey) || null;
};

export const hasPremiumVerification = (user) => !!getPremiumProfileForUser(user);

export const upsertPremiumProfileForUser = (user, profileInput) => {
  const userKey = getUserKey(user);
  if (!userKey) return null;

  const profiles = getPremiumProfiles();
  const now = new Date().toISOString();
  const idx = profiles.findIndex((profile) => profile.userKey === userKey);
  const current = idx >= 0 ? profiles[idx] : null;

  const next = {
    id: current?.id || `premium-${Date.now()}`,
    userKey,
    userEmail: user?.email || '',
    storefrontName: profileInput.storefrontName || '',
    governmentBusinessName: profileInput.governmentBusinessName || '',
    businessEmail: profileInput.businessEmail || '',
    businessUrls: Array.isArray(profileInput.businessUrls) ? profileInput.businessUrls : [],
    licenseFileName: profileInput.licenseFileName || '',
    licenseFileSize: profileInput.licenseFileSize || 0,
    licenseFileType: profileInput.licenseFileType || '',
    status: 'verified',
    createdAt: current?.createdAt || now,
    updatedAt: now,
  };

  if (idx >= 0) profiles[idx] = next;
  else profiles.push(next);

  savePremiumProfiles(profiles);
  return next;
};
