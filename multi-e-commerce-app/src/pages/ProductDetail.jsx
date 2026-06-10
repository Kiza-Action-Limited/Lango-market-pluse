// src/pages/ProductDetail.jsx
import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { productService } from '../services/productService';
import { userService } from '../services/userService';
import { FaStar, FaStarHalfAlt, FaRegStar, FaShoppingCart, FaHeart, FaRegHeart, FaTruck, FaShieldAlt, FaUndo } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import { clampToMinimumOrder, getMinimumOrderQuantity, MQQ_TIERS } from '../utils/moq';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [reviewEligibility, setReviewEligibility] = useState({
    loading: false,
    canReview: false,
    message: 'Complete payment for this product before writing a review.',
  });
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

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
      setReviews(productPayload?.reviews || []);
      if (isAuthenticated) {
        checkWishlist();
        checkReviewEligibility();
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Product not found');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const checkWishlist = async () => {
    try {
      const response = await userService.checkWishlist(id);
      setIsWishlisted(Boolean(response?.isWishlisted));
    } catch (error) {
      console.error('Error checking wishlist:', error);
    }
  };

  const checkReviewEligibility = async () => {
    setReviewEligibility((prev) => ({ ...prev, loading: true }));
    try {
      const response = await productService.getReviewEligibility(id);
      setReviewEligibility({
        loading: false,
        canReview: Boolean(response?.canReview),
        message: response?.message || 'Complete payment for this product before writing a review.',
      });
    } catch (error) {
      const message = error?.response?.data?.message || 'Complete payment for this product before writing a review.';
      setReviewEligibility({
        loading: false,
        canReview: false,
        message,
      });
    }
  };

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
  const metadataEntries = Object.entries(product.attributes || {}).filter(([, value]) => value !== '' && value !== null && value !== undefined);

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

          {/* Shipping Info */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center text-gray-600">
              <FaTruck className="mr-2" />
              <span>Free shipping on orders over KSh 50</span>
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

      {/* Reviews Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>
        
        {/* Write Review */}
        {!isAuthenticated ? (
          <div className="bg-gray-50 p-6 rounded-lg mb-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Write a Review</h3>
            <p className="text-gray-600">Log in after completing payment to review this product.</p>
            <button type="button" onClick={() => navigate('/login')} className="btn-primary mt-4">
              Log In
            </button>
          </div>
        ) : reviewEligibility.loading ? (
          <div className="bg-gray-50 p-6 rounded-lg mb-8 text-gray-600">
            Checking review eligibility...
          </div>
        ) : reviewEligibility.canReview ? (
          <form onSubmit={handleSubmitReview} className="bg-gray-50 p-6 rounded-lg mb-8">
            <h3 className="text-lg font-semibold mb-4">Write a Review</h3>
            <div className="mb-4">
              <label className="block mb-2">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewReview({ ...newReview, rating: star })}
                    className="text-2xl"
                  >
                    {star <= newReview.rating ? (
                      <FaStar className="text-yellow-400" />
                    ) : (
                      <FaRegStar className="text-gray-300" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <textarea
                value={newReview.comment}
                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                placeholder="Write your review..."
                rows="4"
                className="w-full px-4 py-2 border rounded-lg"
                required
              />
            </div>
            <button type="submit" className="btn-primary">
              Submit Review
            </button>
          </form>
        ) : (
          <div className="bg-gray-50 p-6 rounded-lg mb-8">
            <h3 className="text-lg font-semibold mb-2">Write a Review</h3>
            <p className="text-gray-600">{reviewEligibility.message}</p>
          </div>
        )}

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No reviews yet. Be the first to review!</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id || review._id} className="border-b pb-4">
                <div className="flex items-center mb-2">
                  <div className="flex mr-2">{renderStars(review.rating)}</div>
                  <span className="font-semibold">{review.user?.name}</span>
                  <span className="text-gray-500 text-sm ml-2">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-600">{review.comment}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
