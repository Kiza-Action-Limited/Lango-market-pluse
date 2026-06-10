import { formatCurrency } from './formatters';

const toTitle = (value = '') =>
  String(value)
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const buildCategoryTabs = (categories = []) => {
  const base = [{ id: 'all', name: 'All categories' }];
  return [
    ...base,
    ...categories.map((category) => ({
      id: category.id,
      name: category.name,
    })),
  ];
};

const normalize = (value = '') => String(value).trim().toLowerCase();
const clean = (value = '') => String(value || '').trim();
const isMoqBusiness = (type = '') => {
  const t = normalize(type);
  return t === 'manufacturer' || t === 'wholesaler';
};

const getProductSellerId = (product = {}) =>
  clean(
    product?.seller?.id ||
      product?.seller?._id ||
      product?.sellerId ||
      product?.ownerId ||
      product?.userId ||
      product?.createdBy ||
      product?.vendorId
  );

const getProductSellerName = (product = {}) =>
  clean(
    product?.seller?.businessName ||
      product?.seller?.storeName ||
      product?.seller?.companyName ||
      product?.seller?.fullName ||
      product?.seller?.name ||
      product?.businessName ||
      product?.storeName ||
      product?.vendorName ||
      product?.sellerName
  );

const getProductSellerType = (product = {}) =>
  clean(product?.seller?.businessType || product?.seller?.role || product?.businessType || product?.sellerType);

export const buildSupplierCards = (products = [], users = [], premiumProfiles = [], businesses = []) => {
  const sellerUsers = users.filter((user) => user?.role === 'seller');
  const businessById = new Map(
    businesses.map((biz) => [
      String(biz?.id || biz?._id || biz?.userId || ''),
      biz,
    ])
  );
  const businessByName = new Map(
    businesses.map((biz) => [
      normalize(biz?.name || biz?.businessName || biz?.storeName || ''),
      biz,
    ])
  );

  const bySeller = products.reduce((acc, product) => {
    const sellerId = getProductSellerId(product);
    const sellerName = getProductSellerName(product);
    const sellerKey = sellerId || sellerName || `unknown-supplier-${product?.id || product?._id || Math.random()}`;
    if (!acc[sellerKey]) acc[sellerKey] = [];
    acc[sellerKey].push(product);
    return acc;
  }, {});

  return Object.entries(bySeller).map(([sellerKey, sellerProducts], index) => {
    const first = sellerProducts[0];
    const productSellerId = getProductSellerId(first);
    const productSellerName = getProductSellerName(first);
    const businessByIdMatch = businessById.get(String(productSellerId || ''));
    const businessByNameMatch = businessByName.get(normalize(productSellerName));
    const linkedBusiness = businessByIdMatch || businessByNameMatch || null;

    const sellerName =
      productSellerName ||
      clean(linkedBusiness?.name || linkedBusiness?.businessName || linkedBusiness?.storeName) ||
      'Unknown Supplier';
    const matchedUser =
      sellerUsers.find(
        (user) =>
          normalize(user?.name) === normalize(sellerName) ||
          normalize(user?.fullName) === normalize(sellerName) ||
          normalize(user?.businessName) === normalize(sellerName) ||
          normalize(user?.businessType) === normalize(getProductSellerType(first))
      ) ||
      null;
    const avgRating =
      sellerProducts.reduce((sum, product) => sum + (Number(product.rating) || 0), 0) /
      Math.max(1, sellerProducts.length);
    const low = Math.min(...sellerProducts.map((product) => Number(product.price) || 0));
    const high = Math.max(...sellerProducts.map((product) => Number(product.price) || 0));

    const capabilityPool = [
      'Low MOQ for customization',
      'Sample-based customization',
      'Quality management certified',
      'Minor customization',
      'Response time ≤ 1h',
      'On-time delivery 98%+',
      'ODM service available',
      'OEM for known brands',
    ];

    const startIdx = index % capabilityPool.length;
    const capabilities = [
      capabilityPool[startIdx],
      capabilityPool[(startIdx + 2) % capabilityPool.length],
      capabilityPool[(startIdx + 4) % capabilityPool.length],
      capabilityPool[(startIdx + 6) % capabilityPool.length],
    ];

    const premiumProfile =
      premiumProfiles.find((profile) => normalize(profile.storefrontName) === normalize(sellerName)) ||
      premiumProfiles.find((profile) => normalize(profile.governmentBusinessName) === normalize(sellerName)) ||
      null;

    return {
      id: String(first?.seller?.id || first?.seller?._id || sellerKey || `supplier-${index + 1}`),
      name: sellerName,
      categoryId: first?.categoryId || 'all',
      verified: true,
      years: 1 + (index % 12),
      staffRange: `${10 + index * 8}+ staff`,
      annualSales: `${formatCurrency((high + low) * 1200, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}+`,
      rating: Number.isFinite(avgRating) ? avgRating.toFixed(1) : '0.0',
      reviews: sellerProducts.reduce((sum, product) => sum + (product.reviews?.length || 0), 0),
      businessType: toTitle(
        getProductSellerType(first) ||
          linkedBusiness?.businessType ||
          matchedUser?.businessType ||
          'supplier'
      ),
      contactEmail: premiumProfile?.businessEmail || matchedUser?.email || '',
      contactPhone: matchedUser?.phone || '',
      website: premiumProfile?.businessUrls?.[0] || '',
      capabilities,
      products: sellerProducts.map((product, i) => ({
        id: product.id || product._id,
        name: product.name,
        image: product.images?.[0]?.url || product.images?.[0],
        priceText: `${formatCurrency(product.price, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        minOrder: `Min. order: ${10 + i * 5} pieces`,
      })),
      coverImage:
        sellerProducts[0]?.images?.[0]?.url ||
        sellerProducts[0]?.images?.[0] ||
        linkedBusiness?.logo ||
        linkedBusiness?.image ||
        '',
      createdAt: matchedUser?.createdAt || null,
      premiumProfile,
      moqOptions: isMoqBusiness(first?.seller?.businessType)
        ? [
            { label: 'MQQ1', value: '10 - 2,999 pieces', pricce: ''},
            { label: 'MQQ2', value: '3,000+ pieces', pricce: ''},
          ]
        : [],
      farmerOptional: normalize(first?.seller?.businessType) === 'farmer',
    };
  });
};

export const buildCapabilityChips = (suppliers = []) => {
  const seen = new Set();
  const chips = [];
  suppliers.forEach((supplier) => {
    supplier.capabilities.forEach((capability) => {
      if (!seen.has(capability) && chips.length < 6) {
        seen.add(capability);
        chips.push(capability);
      }
    });
  });
  return chips;
};
