import { formatCurrency } from './formatters';
import { getMinimumOrderQuantity, isMqqRestrictedBusinessType } from './moq';

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
  return isMqqRestrictedBusinessType(type);
};

const getOrderTermText = (product = {}) => {
  const minOrder = getMinimumOrderQuantity(product);
  return minOrder > 1 ? `Min. order: ${minOrder} pieces` : 'Any quantity';
};

const getProductId = (product = {}) => clean(product?.id || product?._id);

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

const getProductBusinessId = (product = {}) =>
  clean(
    product?.business?.id ||
      product?.business?._id ||
      product?.businessId ||
      product?.companyId ||
      product?.storeId
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

const getBusinessId = (business = {}) => clean(business?.id || business?._id || business?.userId || business?.ownerId);

const getBusinessName = (business = {}) =>
  clean(business?.name || business?.businessName || business?.storeName || business?.companyName);

const getProductCategoryId = (product = {}, linkedBusiness = null) => {
  const category = product?.category;
  if (typeof category === 'object' && category) {
    return clean(category.id || category._id || category.slug || category.value || category.name);
  }
  return clean(product?.categoryId || product?.category || linkedBusiness?.categoryId || linkedBusiness?.category || 'all');
};

const getProductImage = (product = {}) =>
  product?.images?.[0]?.url || product?.images?.[0] || product?.image || product?.thumbnail || '';

export const buildSupplierCards = (products = [], users = [], premiumProfiles = [], businesses = []) => {
  const sellerUsers = users.filter((user) => user?.role === 'seller');
  const businessById = new Map(
    businesses
      .map((biz) => [getBusinessId(biz), biz])
      .filter(([id]) => id)
  );
  const businessByName = new Map(
    businesses
      .map((biz) => [normalize(getBusinessName(biz)), biz])
      .filter(([name]) => name)
  );

  const bySeller = products.reduce((acc, product) => {
    const productId = getProductId(product);
    const productName = clean(product?.name);
    const status = normalize(product?.status);
    if (!productId || !productName || product?.isActive === false || ['draft', 'inactive', 'deleted'].includes(status)) {
      return acc;
    }

    const sellerId = getProductSellerId(product);
    const businessId = getProductBusinessId(product);
    const sellerName = getProductSellerName(product);
    const linkedBusiness =
      businessById.get(String(sellerId || '')) ||
      businessById.get(String(businessId || '')) ||
      businessByName.get(normalize(sellerName));
    const sellerKey = sellerId || businessId || getBusinessId(linkedBusiness) || sellerName || getBusinessName(linkedBusiness);
    if (!sellerKey) return acc;

    if (!acc[sellerKey]) acc[sellerKey] = [];
    acc[sellerKey].push(product);
    return acc;
  }, {});

  const productSuppliers = Object.entries(bySeller).map(([sellerKey, sellerProducts], index) => {
    const first = sellerProducts[0];
    const productSellerId = getProductSellerId(first);
    const productBusinessId = getProductBusinessId(first);
    const productSellerName = getProductSellerName(first);
    const businessByIdMatch = businessById.get(String(productSellerId || '')) || businessById.get(String(productBusinessId || ''));
    const businessByNameMatch = businessByName.get(normalize(productSellerName));
    const linkedBusiness = businessByIdMatch || businessByNameMatch || null;

    const sellerName =
      productSellerName ||
      getBusinessName(linkedBusiness);
    if (!sellerName) return null;

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
      id: String(productSellerId || productBusinessId || getBusinessId(linkedBusiness) || sellerKey),
      name: sellerName,
      categoryId: getProductCategoryId(first, linkedBusiness),
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
        id: getProductId(product),
        name: product.name,
        image: getProductImage(product),
        priceText: `${formatCurrency(product.price, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        minOrder: getOrderTermText(product),
      })),
      coverImage:
        getProductImage(sellerProducts[0]) ||
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
  }).filter(Boolean);

  const mappedSupplierKeys = new Set(
    productSuppliers.flatMap((supplier) => [
      normalize(supplier.id),
      normalize(supplier.name),
    ])
  );

  const businessSuppliers = businesses
    .filter((business) => {
      const id = getBusinessId(business);
      const name = getBusinessName(business);
      const status = normalize(business?.status);
      if (!id || !name || business?.isActive === false || ['draft', 'inactive', 'deleted'].includes(status)) {
        return false;
      }
      return !mappedSupplierKeys.has(normalize(id)) && !mappedSupplierKeys.has(normalize(name));
    })
    .map((business, index) => {
      const businessType = toTitle(business?.businessType || business?.type || business?.role || 'supplier');
      const capabilities = Array.isArray(business?.capabilities) && business.capabilities.length
        ? business.capabilities.slice(0, 4)
        : ['Verified business profile', 'Direct supplier contact', 'Marketplace sourcing', `${businessType} services`];

      return {
        id: String(getBusinessId(business)),
        name: getBusinessName(business),
        categoryId: clean(business?.categoryId || business?.category || 'all'),
        verified: business?.verified !== false,
        years: Number(business?.yearsActive || business?.years || 1 + (index % 12)),
        staffRange: business?.staffRange || business?.employees || `${10 + index * 8}+ staff`,
        annualSales:
          business?.annualSales ||
          business?.annualRevenue ||
          `${formatCurrency((Number(business?.revenue) || 1000) * 12, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}+`,
        rating: Number(business?.rating || 0).toFixed(1),
        reviews: Number(business?.reviewsCount || business?.reviewCount || 0),
        businessType,
        contactEmail: business?.email || business?.contactEmail || '',
        contactPhone: business?.phone || business?.contactPhone || '',
        website: business?.website || '',
        capabilities,
        products: [],
        coverImage: business?.logo || business?.image || business?.coverImage || '',
        createdAt: business?.createdAt || null,
        premiumProfile: null,
        moqOptions: isMoqBusiness(business?.businessType)
          ? [
              { label: 'MQQ1', value: '10 - 2,999 pieces', pricce: '' },
              { label: 'MQQ2', value: '3,000+ pieces', pricce: '' },
            ]
          : [],
        farmerOptional: normalize(business?.businessType) === 'farmer',
      };
    });

  return [...productSuppliers, ...businessSuppliers];
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
