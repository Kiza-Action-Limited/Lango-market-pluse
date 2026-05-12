// import image01 from '../assets/images/240_F_1204665252_ZX7G4szbgbzeLf9M2OSYKu32GfBT6qWC.jpg';
// import image02 from '../assets/images/240_F_1671818644_Ddbso43PyJfSVubnXaL7rmXfRww6Dkjz.jpg';
// import image03 from '../assets/images/240_F_1693527828_L7tgoYmYIn1hayBctZQBpBy1gMLpK4pQ.jpg';
// import image04 from '../assets/images/240_F_1727631229_Jvja9SE3o82p1C7Io8pDek06qHddbyp8.jpg';
// import image05 from '../assets/images/240_F_1770944832_gErqIw7TSdo3GuKK7fnZ8VyExTFEynyJ.jpg';
// import image06 from '../assets/images/240_F_1774361843_6YgNSKGVwKOPZSrhZ4P326nfhq8atTuG.jpg';
// import image07 from '../assets/images/240_F_1800860956_ZH84qygqUhJsGcZZsa47eDYk35xtUCbT.jpg';
// import image08 from '../assets/images/240_F_1840014310_pA6GZCvvAPsWdsFhaHxoK0Mb35c6FRYC.jpg';

// const imgs = [image01, image02, image03, image04, image05, image06, image07, image08];
// const PRODUCT_COUNT_PER_BUSINESS = 15;

// const buildProducts = (prefix, priceStart, minOrderStart, imageOffset = 0) =>
//   Array.from({ length: PRODUCT_COUNT_PER_BUSINESS }).map((_, index) => ({
//     id: `${prefix}-${index + 1}`,
//     name: `${prefix.toUpperCase()} product ${index + 1}`,
//     image: imgs[(index + imageOffset) % imgs.length],
//     priceText: `KSh ${(priceStart + index * 140).toLocaleString('en-KE')}`,
//     minOrder: `Min. order: ${minOrderStart + index * 2} pieces`,
//   }));

// export const mockBusinessSuppliers = [
//   {
//     id: 'net-1',
//     name: 'Accio Tech Devices Ltd',
//     categoryId: 'electronics',
//     verified: true,
//     years: 7,
//     staffRange: '120+ staff',
//     annualSales: 'KSh 89.0M+',
//     rating: '4.8',
//     reviews: 128,
//     businessType: 'Brand',
//     capabilities: ['Low MOQ for customization', 'Quality management certified', 'Response time <= 1h', 'ODM service available'],
//     products: buildProducts('accio-tech', 2150, 10, 0),
//     coverImage: imgs[0],
//   },
//   {
//     id: 'net-2',
//     name: 'Kakuma Agro Link',
//     categoryId: 'groceries',
//     verified: true,
//     years: 5,
//     staffRange: '48+ staff',
//     annualSales: 'KSh 36.0M+',
//     rating: '4.5',
//     reviews: 84,
//     businessType: 'Farmer',
//     capabilities: ['On-time delivery 98%+', 'Sample-based customization', 'Response time <= 2h', 'Bulk seasonal contracts'],
//     products: buildProducts('agro-link', 420, 100, 2),
//     coverImage: imgs[1],
//   },
//   {
//     id: 'net-3',
//     name: 'Kitale Metal Works',
//     categoryId: 'home',
//     verified: true,
//     years: 9,
//     staffRange: '210+ staff',
//     annualSales: 'KSh 122.0M+',
//     rating: '4.6',
//     reviews: 211,
//     businessType: 'Manufacturer',
//     capabilities: ['OEM for known brands', 'Minor customization', 'Quality management certified', 'Response time <= 1h'],
//     products: buildProducts('kitale-metal', 2500, 20, 1),
//     coverImage: imgs[2],
//   },
//   {
//     id: 'net-4',
//     name: 'Prime Corridor Wholesale',
//     categoryId: 'electronics',
//     verified: true,
//     years: 11,
//     staffRange: '330+ staff',
//     annualSales: 'KSh 180.0M+',
//     rating: '4.4',
//     reviews: 172,
//     businessType: 'Wholesaler',
//     capabilities: ['Low MOQ for customization', 'On-time delivery 99%', 'Fast RFQ processing', 'Regional supply hubs'],
//     products: buildProducts('prime-corridor', 980, 30, 3),
//     coverImage: imgs[3],
//   },
//   {
//     id: 'net-5',
//     name: 'Urban Basket Retail Hub',
//     categoryId: 'fashion',
//     verified: true,
//     years: 4,
//     staffRange: '26+ staff',
//     annualSales: 'KSh 19.0M+',
//     rating: '4.2',
//     reviews: 64,
//     businessType: 'Retailer',
//     capabilities: ['Sample-based customization', 'Quick replenishment', 'Response time <= 2h', 'Flexible bundles'],
//     products: buildProducts('urban-basket', 620, 12, 4),
//     coverImage: imgs[4],
//   },
//   {
//     id: 'net-6',
//     name: 'Savanna Small Biz Collective',
//     categoryId: 'beauty',
//     verified: true,
//     years: 3,
//     staffRange: '18+ staff',
//     annualSales: 'KSh 12.0M+',
//     rating: '4.3',
//     reviews: 51,
//     businessType: 'Small Business',
//     capabilities: ['Minor customization', 'Local fulfillment support', 'Response time <= 3h', 'Community-certified products'],
//     products: buildProducts('savanna-collective', 360, 8, 5),
//     coverImage: imgs[5],
//   },
//   {
//     id: 'net-7',
//     name: 'Mizigo Fleet Exchange',
//     categoryId: 'all',
//     verified: true,
//     years: 8,
//     staffRange: '95+ staff',
//     annualSales: 'KSh 74.0M+',
//     rating: '4.7',
//     reviews: 138,
//     businessType: 'Logistics',
//     capabilities: ['Group-buy route matching', 'Predictive route scheduling', 'On-time delivery 99%', 'Live trip visibility'],
//     products: buildProducts('mizigo-fleet', 1750, 5, 6),
//     coverImage: imgs[6],
//   },
//   {
//     id: 'net-8',
//     name: 'Great Rift Industrial Supply',
//     categoryId: 'sports',
//     verified: true,
//     years: 10,
//     staffRange: '140+ staff',
//     annualSales: 'KSh 98.0M+',
//     rating: '4.6',
//     reviews: 146,
//     businessType: 'Distributor',
//     capabilities: ['OEM for known brands', 'Minor customization', 'Response time <= 1h', 'Warehouse across counties'],
//     products: buildProducts('great-rift', 1400, 18, 7),
//     coverImage: imgs[7],
//   },
// ];

// const extraBusinessTypes = [
//   'Brand',
//   'Wholesaler',
//   'Manufacturer',
//   'Retailer',
//   'Farmer',
//   'Small Business',
//   'Distributor',
//   'Logistics',
//   'Exporter',
//   'Importer',
// ];

// const extraCategories = ['electronics', 'fashion', 'home', 'beauty', 'sports', 'groceries'];

// const extraBusinesses = Array.from({ length: 10 }).map((_, idx) => {
//   const n = idx + 9;
//   const businessType = extraBusinessTypes[idx % extraBusinessTypes.length];
//   const categoryId = extraCategories[idx % extraCategories.length];

//   return {
//     id: `net-${n}`,
//     name: `Lango Trade Network ${n}`,
//     categoryId,
//     verified: true,
//     years: 2 + (idx % 12),
//     staffRange: `${24 + idx * 11}+ staff`,
//     annualSales: `KSh ${(16 + idx * 8).toFixed(1)}M+`,
//     rating: (4 + ((idx % 8) + 2) / 10).toFixed(1),
//     reviews: 42 + idx * 9,
//     businessType,
//     capabilities: [
//       'Low MOQ for customization',
//       'Sample-based customization',
//       'Quality management certified',
//       idx % 2 === 0 ? 'On-time delivery 99%' : 'Response time <= 1h',
//     ],
//     products: buildProducts(`lango-net-${n}`, 700 + idx * 90, 10 + idx, idx % imgs.length),
//     coverImage: imgs[idx % imgs.length],
//   };
// });

// mockBusinessSuppliers.push(...extraBusinesses);
