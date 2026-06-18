import { productService } from './productService';
import { prefetchData } from '../hooks/useFetchData';

export const HOME_DATA_KEY = 'home:critical';

export const fetchHomePayload = async () => {
  const productsRes = await productService.getAll({ page: 1, limit: 100, sortBy: 'newest' });
  const sellerProducts = productsRes?.products || productsRes?.data || [];
  const featuredProducts = sellerProducts.slice(0, 8);

  const categorySet = Array.from(new Set(featuredProducts.map((item) => item?.category).filter(Boolean)));
  const categories = categorySet.map((name) => ({ id: name, name }));

  const bySeller = new Map();

  sellerProducts.forEach((product) => {
    const seller = product?.seller;
    const sellerId = seller?.id || seller?._id;
    const sellerName = seller?.businessName || seller?.fullName || seller?.name;
    const logo = seller?.businessLogoUrl;

    if (!sellerId || !sellerName || !logo) return;
    if (!bySeller.has(String(sellerId))) {
      bySeller.set(String(sellerId), { id: String(sellerId), name: sellerName, logo });
    }
  });

  return {
    featuredProducts,
    categories,
    businessPartners: Array.from(bySeller.values()),
  };
};

export const prefetchHomeData = () => prefetchData(HOME_DATA_KEY, fetchHomePayload);
