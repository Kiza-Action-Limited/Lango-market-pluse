import { API_BASE_URL } from '../config/apiBase';

const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

const getApiAssetOrigin = () => {
  if (!API_BASE_URL || API_BASE_URL.startsWith('/')) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }

  return trimTrailingSlash(API_BASE_URL.replace(/\/api(?:\/v\d+)?$/i, ''));
};

const isLocalHost = (hostname = '') =>
  ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(String(hostname).toLowerCase());

export const normalizeAssetUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(data|blob):/i.test(raw)) return raw;

  const assetOrigin = getApiAssetOrigin();

  if (raw.startsWith('/uploads/')) {
    return `${assetOrigin}${raw}`;
  }

  if (raw.startsWith('uploads/')) {
    return `${assetOrigin}/${raw}`;
  }

  try {
    const url = new URL(raw);
    const isUpload = url.pathname.startsWith('/uploads/');
    const pageIsHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

    if (isUpload && isLocalHost(url.hostname)) {
      return `${assetOrigin}${url.pathname}${url.search}`;
    }

    if (pageIsHttps && url.protocol === 'http:' && url.hostname === window.location.hostname) {
      url.protocol = 'https:';
      return url.toString();
    }

    return raw;
  } catch {
    return raw;
  }
};

const IMAGE_URL_KEYS = new Set([
  'businessLogoUrl',
  'profileImageUrl',
  'image',
  'imageUrl',
  'logo',
  'coverImage',
  'thumbnail',
  'qrImage',
  'url',
]);

export const normalizeApiAssetUrls = (value, key = '') => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeApiAssetUrls(item, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        normalizeApiAssetUrls(entryValue, entryKey),
      ])
    );
  }

  if (typeof value === 'string' && IMAGE_URL_KEYS.has(key)) {
    return normalizeAssetUrl(value);
  }

  return value;
};
