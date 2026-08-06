// src/pages/ProductDetail.jsx
import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { productService } from '../services/productService';
import { rfqService } from '../services/rfqService';
import { userService } from '../services/userService';
import { FaStar, FaStarHalfAlt, FaRegStar, FaShoppingCart, FaHeart, FaRegHeart, FaTruck, FaShieldAlt, FaUndo, FaFileInvoiceDollar } from 'react-icons/fa';
import ProductCard from '../components/ProductCard';
import ProductReviewModal from '../components/ProductReviewModal';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import { clampToMinimumOrder, getMinimumOrderQuantity, MQQ_TIERS } from '../utils/moq';

const getProductId = (product = {}) => product.id || product._id;

const getReviewerName = (review = {}) => (
  review.user?.fullName || review.user?.name || 'Verified buyer'
);

const getReviewerImage = (review = {}) => review.user?.profileImageUrl || '';

const getReviewerInitial = (review = {}) => getReviewerName(review).charAt(0).toUpperCase() || 'V';

const unpackProductList = (payload) => {
  const list = payload?.products || payload?.data?.products || payload?.data || [];
  return Array.isArray(list) ? list : [];
};

const ProductRelationSection = ({ title, description, products, loading }) => {
  if (!loading && products.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#111827]">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,220px))] justify-center gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-72 rounded-md border border-gray-200 bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,220px))] justify-center gap-4">
          {products.map((item) => (
            <ProductCard key={getProductId(item)} product={item} />
          ))}
        </div>
      )}
    </section>
  );
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState({
    loading: false,
    canReview: false,
    message: 'Complete payment for this product before writing a review.',
  });
  const [rfqForm, setRfqForm] = useState({
    targetPrice: '',
    deliveryLocation: '',
    neededBy: '',
    message: '',
  });
  const [submittingRfq, setSubmittingRfq] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const loadedProductId = product ? getProductId(product) : '';

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const productPayload = await productService.getById(id);
      const fetchedProduct = productPayload?.product || productPayload?.data || productPayload;

      if (!fetchedProduct) {
        throw new Error('Missing product payload');
      }

      setProduct(fetchedProduct);
      setQuantity(getMinimumOrderQuantity(fetchedProduct));
      setReviews(productPayload?.reviews || fetchedProduct.reviews || []);
      loadProductRelations(fetchedProduct);
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Product not found');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadedProductId) return;

    if (!isAuthenticated) {
      setIsWishlisted(false);
      setReviewEligibility({
        loading: false,
        canReview: false,
        message: 'Log in after completing payment to review this product.',
      });
      return;
    }

    let isActive = true;

    userService.checkWishlist(id)
      .then((response) => {
        if (isActive) setIsWishlisted(Boolean(response?.isWishlisted));
      })
      .catch((error) => {
        console.error('Error checking wishlist:', error);
      });

    setReviewEligibility((prev) => ({ ...prev, loading: true }));
    productService.getReviewEligibility(id)
      .then((response) => {
        if (!isActive) return;
        setReviewEligibility({
          loading: false,
          canReview: Boolean(response?.canReview),
          message: response?.message || 'Complete payment for this product before writing a review.',
        });
      })
      .catch((error) => {
        if (!isActive) return;
        const message = error?.response?.data?.message || 'Complete payment for this product before writing a review.';
        setReviewEligibility({
          loading: false,
          canReview: false,
          message,
        });
      });

    return () => {
      isActive = false;
    };
  }, [id, isAuthenticated, loadedProductId]);

  const handleAddToCart = () => {
    const minOrderQty = getMinimumOrderQuantity(product);
    const productId = product.id || product._id;
    const validQuantity = clampToMinimumOrder(quantity, minOrderQty);

    if (validQuantity !== quantity) {
      setQuantity(validQuantity);
      toast.error(`Minimum order is ${minOrderQty} pieces for this seller type`);
      return;
    }

    addToCart(productId, validQuantity, selectedVariant, product);
  };

  const handleBuyNow = () => {
    const minOrderQty = getMinimumOrderQuantity(product);
    const productId = product.id || product._id;
    const validQuantity = clampToMinimumOrder(quantity, minOrderQty);

    if (validQuantity !== quantity) {
      setQuantity(validQuantity);
      toast.error(`Minimum order is ${minOrderQty} pieces for this seller type`);
      return;
    }

    addToCart(productId, validQuantity, selectedVariant, product);
    navigate('/checkout');
  };

  const handleSubmitRfq = async (event) => {
    event.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to request a quote');
      navigate('/login');
      return;
    }

    setSubmittingRfq(true);
    try {
      await rfqService.create({
        productId: product.id || product._id,
        quantity,
        unit: product.unit,
        targetPrice: rfqForm.targetPrice,
        deliveryLocation: rfqForm.deliveryLocation,
        neededBy: rfqForm.neededBy,
        message: rfqForm.message,
      });
      setRfqForm({
        targetPrice: '',
        deliveryLocation: '',
        neededBy: '',
        message: '',
      });
      toast.success('RFQ sent to seller');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to send RFQ');
    } finally {
      setSubmittingRfq(false);
    }
  };

  const loadProductRelations = async (sourceProduct) => {
    const currentProductId = String(getProductId(sourceProduct) || id);
    const sourceSellerId = sourceProduct?.seller?._id || sourceProduct?.seller?.id || sourceProduct?.seller;

    setRelationsLoading(true);
    try {
      const requests = [];

      requests.push(
        sourceProduct.category
          ? productService.getAll({ category: sourceProduct.category, limit: 9, sortBy: 'rating' }).catch((error) => ({ __error: error }))
          : Promise.resolve(null)
      );

      requests.push(
        sourceSellerId
          ? productService.getAll({ seller: sourceSellerId, limit: 7, sortBy: 'newest' }).catch((error) => ({ __error: error }))
          : Promise.resolve(null)
      );

      const [relatedResponse, sellerResponse] = await Promise.all(requests);
      const normalizeList = (response) => unpackProductList(response)
        .filter((item) => String(getProductId(item) || '') !== currentProductId);

      setRelatedProducts(normalizeList(relatedResponse).slice(0, 4));
      setSellerProducts(normalizeList(sellerResponse).slice(0, 4));
    } catch (error) {
      console.error('Error loading product relations:', error);
      setRelatedProducts([]);
      setSellerProducts([]);
    } finally {
      setRelationsLoading(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to add to wishlist');
      navigate('/login');
      return;
    }

    try {
      if (isWishlisted) {
        await userService.removeFromWishlist(id);
        setIsWishlisted(false);
        toast.success('Removed from wishlist');
      } else {
        await userService.addToWishlist(id);
        setIsWishlisted(true);
        toast.success('Added to wishlist');
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to update wishlist';
      toast.error(message);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to review');
      navigate('/login');
      return;
    }

    if (!reviewEligibility.canReview) {
      toast.error(reviewEligibility.message);
      return;
    }

    try {
      const response = await productService.addReview(id, newReview);
      const createdReview = response?.review || response?.data?.review || response?.data || response;

      if (!createdReview) {
        throw new Error('Review was not returned by the API');
      }

      setReviews((prev) => {
        const createdReviewId = createdReview?._id || createdReview?.id;
        const createdReviewUserId = createdReview?.user?._id || createdReview?.user;
        const next = prev.filter((review) => {
          const reviewId = review?._id || review?.id;
          const reviewUserId = review?.user?._id || review?.user;
          return reviewId !== createdReviewId && String(reviewUserId || '') !== String(createdReviewUserId || '');
        });
        return [createdReview, ...next];
      });
      setNewReview({ rating: 5, comment: '' });
      setIsReviewModalOpen(false);
      toast.success('Review submitted');
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to submit review';
      toast.error(message);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= rating) {
        stars.push(<FaStar key={i} className="text-yellow-400" />);
      } else if (i - rating < 1) {
        stars.push(<FaStarHalfAlt key={i} className="text-yellow-400" />);
      } else {
        stars.push(<FaRegStar key={i} className="text-gray-300" />);
      }
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const productImages = (product.images || [])
    .map((image) => (typeof image === 'string' ? image : image?.url))
    .filter(Boolean);
  const safeProductImages = productImages.length ? productImages : ['https://via.placeholder.com/500'];
  const availableStock = Number(product.stock ?? product.quantityAvailable ?? 0);
  const minOrderQty = getMinimumOrderQuantity(product);
  const isMqqRestricted = minOrderQty > 1;
  const sellerId = product?.seller?._id || product?.seller?.id || product?.seller;
  const sellerBusinessName = product?.seller?.businessName || product?.seller?.fullName || product?.seller?.name || 'Verified Seller';
  const metadataSource = product.attributes || product.customAttributes || product.metadata || {};
  const metadataEntries = Object.entries(metadataSource).filter(([, value]) => value !== '' && value !== null && value !== undefined);
  const averageRating = Number(product.rating || 0);
  const reviewCount = reviews.length;
  const ratingCounts = reviews.reduce((acc, review) => {
    const rating = Math.max(1, Math.min(5, Math.round(Number(review.rating || 0))));
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {});
  const productFacts = [
    { label: 'SKU', value: product.sku || product.trackingSku || 'Not assigned' },
    { label: 'Category', value: product.category || 'Uncategorized' },
    { label: 'Fulfillment hub', value: product.locationHub || 'Seller pickup hub' },
    { label: 'Warehouse status', value: product.warehouseStatus ? String(product.warehouseStatus).replaceAll('_', ' ') : 'Seller storage' },
    { label: 'MOQ', value: `${minOrderQty} ${product.unit || 'unit'}` },
    { label: 'Available stock', value: `${availableStock} ${product.unit || 'unit'}` },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Images */}
        <div>
          <div className="bg-gray-100 rounded-lg overflow-hidden mb-4">
            <img
              src={safeProductImages[activeImage]}
              alt={product.name}
              className="w-full h-96 object-contain"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {safeProductImages.map((img, index) => (
              <button
                key={index}
                onClick={() => setActiveImage(index)}
                className={`w-20 h-20 border-2 rounded-lg overflow-hidden ${activeImage === index ? 'border-primary' : 'border-gray-300'}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
          
          <div className="flex items-center mb-4">
            <div className="flex mr-2">{renderStars(product.rating || 0)}</div>
            <span className="text-gray-500">({reviews.length} reviews)</span>
            <span className="mx-2">|</span>
            <span className="text-gray-500">{product.soldCount || 0} sold</span>
          </div>

          <div className="mb-4">
            <span className="text-3xl font-bold text-primary">{formatCurrency(product.price)}</span>
            {product.originalPrice && (
              <span className="text-lg text-gray-400 line-through ml-2">{formatCurrency(product.originalPrice)}</span>
            )}
          </div>

          <div className="mb-4">
            <p className="text-gray-600">{product.description}</p>
          </div>

          <div className="mb-4">
            <div className="flex items-center mb-2">
              <span className="font-semibold w-24">Seller:</span>
              {sellerId ? (
                <Link to={`/businesses/${sellerId}`} className="font-semibold text-[#F97316] hover:underline">
                  {sellerBusinessName}
                </Link>
              ) : (
                <span className="font-semibold text-[#111827]">{sellerBusinessName}</span>
              )}
              <span className="ml-2 text-sm text-gray-500">({product.seller?.businessType})</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold w-24">Availability:</span>
              <span className={availableStock > 0 ? 'text-green-600' : 'text-red-600'}>
                {availableStock > 0 ? `${availableStock} in stock` : 'Out of stock'}
              </span>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 font-semibold text-[#111827]">More Product Details</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {productFacts.map((fact) => (
                <div key={fact.label} className="rounded-md bg-gray-50 px-3 py-2">
                  <p className="text-xs font-medium uppercase text-gray-500">{fact.label}</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-[#111827]">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>

          {metadataEntries.length > 0 && (
            <div className="mb-4 border rounded-lg p-3 bg-gray-50">
              <h3 className="font-semibold mb-2">Product Attributes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {metadataEntries.map(([key, value]) => (
                  <div key={key} className="text-sm text-gray-700">
                    <span className="font-medium">{key.replaceAll('_', ' ')}:</span> {String(value)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isMqqRestricted && (
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="font-semibold text-orange-900">Bulk order terms</p>
              <p className="text-sm text-orange-800">{MQQ_TIERS[0].label}: {MQQ_TIERS[0].range}</p>
              <p className="text-sm text-orange-800">{MQQ_TIERS[1].label}: {MQQ_TIERS[1].range}</p>
              <p className="mt-1 text-sm font-medium text-orange-900">Minimum order: {minOrderQty} pieces</p>
            </div>
          )}

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="mb-4">
              <span className="font-semibold block mb-2">Variants:</span>
              <div className="flex gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant)}
                    className={`px-4 py-2 border rounded-lg ${selectedVariant?.id === variant.id ? 'border-primary bg-primary/10' : 'border-gray-300'}`}
                  >
                    {variant.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mb-4">
            <span className="font-semibold block mb-2">Quantity:</span>
            <div className="flex items-center">
              <button
                onClick={() => setQuantity(Math.max(minOrderQty, quantity - 1))}
                className="w-10 h-10 border rounded-l-lg hover:bg-gray-100"
              >
                -
              </button>
              <input
                type="number"
                min={minOrderQty}
                value={quantity}
                onChange={(e) => setQuantity(clampToMinimumOrder(e.target.value, minOrderQty))}
                className="w-16 h-10 border-t border-b text-center"
              />
              <button
                onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                className="w-10 h-10 border rounded-r-lg hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={handleAddToCart}
              disabled={availableStock === 0}
              className="flex-1 btn-secondary flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <FaShoppingCart />
              <span>Add to Cart</span>
            </button>
            <button
              onClick={handleBuyNow}
              disabled={availableStock === 0}
              className="flex-1 btn-primary flex items-center justify-center disabled:opacity-50"
            >
              Buy Now
            </button>
            <button
              onClick={handleToggleWishlist}
              className="px-4 border rounded-lg hover:bg-gray-100"
            >
              {isWishlisted ? <FaHeart className="text-red-500" size={20} /> : <FaRegHeart size={20} />}
            </button>
          </div>

          <form onSubmit={handleSubmitRfq} className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <FaFileInvoiceDollar className="text-blue-700" />
              <div>
                <h3 className="font-semibold text-[#111827]">Request a Bulk Quote</h3>
                <p className="text-sm text-gray-600">Send quantity, target price, and delivery needs directly to the seller.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium text-[#111827]">
                Target unit price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rfqForm.targetPrice}
                  onChange={(event) => setRfqForm((prev) => ({ ...prev, targetPrice: event.target.value }))}
                  placeholder="Optional"
                  className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="text-sm font-medium text-[#111827]">
                Delivery location
                <input
                  value={rfqForm.deliveryLocation}
                  onChange={(event) => setRfqForm((prev) => ({ ...prev, deliveryLocation: event.target.value }))}
                  placeholder="Town, depot, or delivery hub"
                  className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="text-sm font-medium text-[#111827]">
                Needed by
                <input
                  type="date"
                  value={rfqForm.neededBy}
                  onChange={(event) => setRfqForm((prev) => ({ ...prev, neededBy: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
            <textarea
              value={rfqForm.message}
              onChange={(event) => setRfqForm((prev) => ({ ...prev, message: event.target.value }))}
              placeholder="Add packaging, pickup, delivery, or negotiation notes..."
              rows="3"
              className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-blue-900">RFQ quantity uses your selected quantity: {quantity} {product.unit || 'unit'}.</p>
              <button
                type="submit"
                disabled={submittingRfq}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingRfq ? 'Sending RFQ...' : 'Send RFQ'}
              </button>
            </div>
          </form>

          {/* Shipping Info */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center text-gray-600">
              <FaTruck className="mr-2" />
              <span>Delivery charges apply at checkout</span>
            </div>
            <div className="flex items-center text-gray-600">
              <FaShieldAlt className="mr-2" />
              <span>Secure payment guaranteed</span>
            </div>
            <div className="flex items-center text-gray-600">
              <FaUndo className="mr-2" />
              <span>30-day return policy</span>
            </div>
          </div>
        </div>
      </div>

      <ProductRelationSection
        title="Related Products"
        description="Similar items from the same category."
        products={relatedProducts}
        loading={relationsLoading}
      />

      <ProductRelationSection
        title="More From This Seller"
        description={`Other listings from ${sellerBusinessName}.`}
        products={sellerProducts}
        loading={relationsLoading}
      />

      {/* Reviews Section */}
      <div className="mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#111827]">Product Reviews</h2>
            <p className="mt-1 text-sm text-gray-600">Verified buyer feedback and rating history.</p>
          </div>
          <Link to={`/products/${getProductId(product)}/reviews`} className="text-sm font-semibold text-[#F97316] hover:underline">
            View review page
          </Link>
        </div>

        <div className="mb-8 grid gap-4 rounded-lg border border-gray-200 bg-white p-5 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col justify-center rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-4xl font-bold text-[#111827]">{averageRating.toFixed(1)}</p>
            <div className="mt-2 flex justify-center">{renderStars(averageRating)}</div>
            <p className="mt-2 text-sm text-gray-600">{reviewCount} review{reviewCount === 1 ? '' : 's'}</p>
          </div>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = ratingCounts[rating] || 0;
              const pct = reviewCount ? Math.round((count / reviewCount) * 100) : 0;
              return (
                <div key={rating} className="grid grid-cols-[52px_1fr_42px] items-center gap-3 text-sm">
                  <span className="font-medium text-[#111827]">{rating} star</span>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-[#F59E0B]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-right text-gray-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-[#111827]">Write a Review</h3>
              <p className="mt-1 text-sm text-gray-600">
                {!isAuthenticated
                  ? 'Log in after completing payment to review this product.'
                  : reviewEligibility.loading
                    ? 'Checking review eligibility...'
                    : reviewEligibility.canReview
                      ? 'Share feedback for this verified purchase.'
                      : reviewEligibility.message}
              </p>
            </div>
            {!isAuthenticated ? (
              <button type="button" onClick={() => navigate('/login')} className="btn-primary">
                Log In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(true)}
                disabled={reviewEligibility.loading || !reviewEligibility.canReview}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Write a Review
              </button>
            )}
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <p className="rounded-lg bg-gray-50 py-8 text-center text-gray-500">No reviews yet.</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id || review._id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-3">
                  {getReviewerImage(review) ? (
                    <img
                      src={getReviewerImage(review)}
                      alt={getReviewerName(review)}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold text-white">
                      {getReviewerInitial(review)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-[#111827]">{getReviewerName(review)}</p>
                    <p className="text-sm text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="mb-2 flex">{renderStars(review.rating)}</div>
                <p className="text-gray-600">{review.comment}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <ProductReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSubmit={handleSubmitReview}
        draft={newReview}
        onDraftChange={setNewReview}
        productName={product.name}
      />
    </div>
  );
};

export default ProductDetail;
