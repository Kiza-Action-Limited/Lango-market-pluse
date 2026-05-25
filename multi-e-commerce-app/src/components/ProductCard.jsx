import React from 'react';
import { Link } from 'react-router-dom';
import { FaShoppingCart, FaStar, FaImage } from 'react-icons/fa';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../utils/formatters';
import { getMinimumOrderQuantity } from '../utils/moq';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const minOrderQty = getMinimumOrderQuantity(product);
  const isMqqRestricted = minOrderQty > 1;
  const productId = product.id || product._id;
  const availableStock = Number(product.stock ?? product.quantityAvailable ?? 0);
  const primaryImage = product.images?.[0];
  const primaryImageUrl = typeof primaryImage === 'string' ? primaryImage : primaryImage?.url;
  const rating = Number(product.rating ?? 0).toFixed(1);
  const hasDiscount = Number(product.originalPrice) > Number(product.price);
  const discountPct = hasDiscount
    ? Math.round(((Number(product.originalPrice) - Number(product.price)) / Number(product.originalPrice)) * 100)
    : 0;

  const campusLabel = product?.seller?.campus || '';
  const sellerType = product?.seller?.businessType ? String(product.seller.businessType).toUpperCase() : null;
  const buttonLabel = isMqqRestricted ? `Add to Cart (MOQ ${minOrderQty}+)` : 'Add to Cart';

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(productId, minOrderQty, null, product);
  };

  return (
    <div className="group hover-card bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
      <Link to={`/products/${productId}`} className="relative block">
        <div className="h-44 bg-gray-100">
          {primaryImageUrl ? (
            <img src={primaryImageUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
              <FaImage className="text-2xl mb-2" />
              <span className="text-xs">Image unavailable</span>
            </div>
          )}
        </div>

        <div className="absolute left-2 top-2 flex items-start gap-1">
          <span className="rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-[#111827] border border-gray-200">
            {sellerType || 'Marketplace'}
          </span>
          {hasDiscount && (
            <span className="rounded-md bg-[#F97316] px-2 py-1 text-[10px] font-semibold text-white">-{discountPct}%</span>
          )}
        </div>

        {availableStock > 0 ? (
          <button
            type="button"
            onClick={handleAddToCart}
            className="absolute left-2 right-2 bottom-2 h-7 rounded-md bg-[#F97316] text-white text-[11px] font-medium inline-flex items-center justify-center gap-1.5 shadow-md transition-all duration-200 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
          >
            <FaShoppingCart size={10} />
            {buttonLabel}
          </button>
        ) : (
          <div className="absolute left-2 right-2 bottom-2 h-7 rounded-md bg-gray-300 text-gray-600 text-[11px] font-medium inline-flex items-center justify-center">
            Out of Stock
          </div>
        )}
      </Link>

      <div className="p-2.5">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] text-gray-600">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium">KE</span>
          <span>{campusLabel || 'Online Seller'}</span>
        </div>

        <Link to={`/products/${productId}`}>
          <h3 className="mb-1 line-clamp-2 min-h-[2.2rem] text-[13px] leading-5 font-medium text-[#111827] hover:text-[#F97316]">
            {product.name}
            {hasDiscount && <span className="ml-1 font-semibold text-[#F97316]">-{discountPct}%</span>}
          </h3>
        </Link>

        <div className="mb-1">
          <span className="text-[14px] font-semibold text-[#111827]">{formatCurrency(product.price)}</span>
          {hasDiscount && (
            <span className="ml-1.5 text-[11px] text-gray-400 line-through">{formatCurrency(product.originalPrice)}</span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <FaStar className="text-[#F59E0B]" size={11} />
          <span>({rating})</span>
        </div>

        {isMqqRestricted && <div className="mt-1 text-[10px] text-[#F97316] font-semibold">MOQ {minOrderQty}+ pieces</div>}
        {!isMqqRestricted && <div className="h-3" />}
      </div>
    </div>
  );
};

export default ProductCard;
