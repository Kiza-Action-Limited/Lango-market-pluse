'use strict';

const LOCAL_LOCATIONS = [
  { names: ['kakuma', 'kakuma town'], lat: 3.7167, lng: 34.8667, formattedAddress: 'Kakuma, Turkana County, Kenya' },
  { names: ['kalobeyei'], lat: 3.7441, lng: 34.7657, formattedAddress: 'Kalobeyei, Turkana County, Kenya' },
  { names: ['lokichoggio', 'lokichogio'], lat: 4.2045, lng: 34.3531, formattedAddress: 'Lokichoggio, Turkana County, Kenya' },
  { names: ['lodwar'], lat: 3.1191, lng: 35.5966, formattedAddress: 'Lodwar, Turkana County, Kenya' },
  { names: ['kitale'], lat: 1.0157, lng: 35.0062, formattedAddress: 'Kitale, Trans-Nzoia County, Kenya' },
  { names: ['eldoret'], lat: 0.5143, lng: 35.2698, formattedAddress: 'Eldoret, Uasin Gishu County, Kenya' },
  { names: ['webuye'], lat: 0.6075, lng: 34.7697, formattedAddress: 'Webuye, Bungoma County, Kenya' },
  { names: ['bungoma'], lat: 0.5695, lng: 34.5584, formattedAddress: 'Bungoma, Bungoma County, Kenya' },
  { names: ['nairobi'], lat: -1.2921, lng: 36.8219, formattedAddress: 'Nairobi, Kenya' },
  { names: ['kisumu'], lat: -0.0917, lng: 34.7680, formattedAddress: 'Kisumu, Kenya' },
  { names: ['nakuru'], lat: -0.3031, lng: 36.0800, formattedAddress: 'Nakuru, Kenya' },
];

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const addressToText = (address) => {
  if (typeof address === 'string') return address;

  return [
    address?.label,
    address?.street,
    address?.town,
    address?.county,
    address?.country || 'Kenya',
  ].filter(Boolean).join(', ');
};

const geocodeAddress = (address) => {
  const normalizedAddress = normalize(addressToText(address));
  if (!normalizedAddress) return null;

  const match = LOCAL_LOCATIONS.find((location) => (
    location.names.some((name) => normalizedAddress.includes(normalize(name)))
  ));

  if (!match) return null;

  return {
    lat: match.lat,
    lng: match.lng,
    formattedAddress: match.formattedAddress,
    source: 'local_fallback',
    approximate: true,
  };
};

module.exports = {
  geocodeAddress,
};
