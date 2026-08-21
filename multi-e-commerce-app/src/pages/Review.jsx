// src/pages/Reviews.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaCheckCircle, FaStar, FaStarHalfAlt, FaRegStar, FaStore } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { productService } from '../services/productService';
import ProductReviewModal from '../components/ProductReviewModal';

const getReviewerName = (review = {}) => (
  review.user?.fullName || review.user?.name || 'Verified buyer'
);

const getReviewerImage = (review = {}) => review.user?.profileImageUrl || '';

const getReviewerInitial = (review = {}) => getReviewerName(review).charAt(0).toUpperCase() || 'V';

const getReviewTitle = (review = {}) => (
  review.title || (Number(review.rating || 0) >= 4 ? 'Good product experience' : 'Product feedback')
);

const getReviewOrderLabel = (review = {}) => {
  const order = review.order || {};
  const orderNumber = order.orderNumber || order.id || order._id;
  return orderNumber ? `Order ${String(orderNumber).slice(-8)}` : '';
};

const Reviews = () => {
  const params = useParams();
  const productId = params.productId || params.id;
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ averageRating: 0, totalReviews: 0, verifiedReviews: 0, recommendedPercent: 0, ratingCounts: {} });
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState({
    loading: false,
    canReview: false,
    message: 'Complete payment for this product before writing a review.',
  });
  const [newReview, setNewReview] = useState({
    rating: 5,
    title: '',
    comment: ''
  });

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    try {
      const requests = [
        productService.getById(productId),
        productService.getReviews(productId),
      ];

      const [productRes, reviewsRes] = await Promise.all(requests);
      setProduct(productRes?.product || productRes?.data || productRes);
      setReviews(reviewsRes?.reviews || []);
      setSummary(reviewsRes?.summary || productRes?.reviewSummary || productRes?.data?.reviewSummary || { averageRating: 0, totalReviews: 0, verifiedReviews: 0, recommendedPercent: 0, ratingCounts: {} });
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setReviewEligibility({
        loading: false,
        canReview: false,
        message: 'Log in after completing payment to review this product.',
      });
      return;
    }

    setReviewEligibility((prev) => ({ ...prev, loading: true }));
    productService.getReviewEligibility(productId)
      .then((response) => {
        setReviewEligibility({
          loading: false,
          canReview: Boolean(response.canReview),
          message: response.message || 'Complete payment for this product before writing a review.',
        });
      })
      .catch((error) => {
        setReviewEligibility({
          loading: false,
          canReview: false,
          message: error?.response?.data?.message || 'Complete payment for this product before writing a review.',
        });
      });
  }, [productId, isAuthenticated]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to submit a review');
      return;
    }

    if (!reviewEligibility.canReview) {
      toast.error(reviewEligibility.message);
      return;
    }

    try {
      const response = await productService.addReview(productId, newReview);
      const createdReview = response?.review || response?.data?.review || response?.data || response;
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
      if (response?.summary) setSummary(response.summary);
      setNewReview({ rating: 5, title: '', comment: '' });
      setIsReviewModalOpen(false);
      toast.success('Review submitted successfully');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to submit review');
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

  const reviewCount = Number(summary.totalReviews ?? reviews.length);
  const ratingCounts = summary.ratingCounts || {};
  const averageRating = Number(summary.averageRating || product?.rating || 0);
  const verifiedReviewCount = Number(summary.verifiedReviews ?? reviews.filter((review) => review.verified !== false).length);
  const recommendedPercent = Number(summary.recommendedPercent || 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-[#F97316]">Verified customer feedback</p>
        <h1 className="mt-1 text-3xl font-bold text-[#111827]">{product?.name}</h1>
        <p className="mt-2 text-gray-600">Ratings from buyers who completed payment through Lango Market Pulse.</p>
      </div>

      <div className="mb-8 grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-[220px_1fr]">
        <div className="flex flex-col justify-center rounded-lg bg-gray-50 p-4 text-center">
          <p className="text-4xl font-bold text-[#111827]">{averageRating.toFixed(1)}</p>
          <div className="mt-2 flex justify-center">{renderStars(averageRating)}</div>
          <p className="mt-2 text-sm text-gray-600">{reviewCount} review{reviewCount === 1 ? '' : 's'}</p>
          <p className="mt-1 text-xs font-semibold text-green-700">{verifiedReviewCount} verified purchase{verifiedReviewCount === 1 ? '' : 's'}</p>
        </div>
        <div className="space-y-2">
          <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
            {recommendedPercent}% of buyers rated this product 4 stars or higher.
          </div>
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

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Write a Review</h2>
            <p className="mt-1 text-gray-600">
              {!isAuthenticated
                ? 'Log in after completing payment to review this product.'
                : reviewEligibility.loading
                  ? 'Checking review eligibility...'
                  : reviewEligibility.canReview
                    ? 'Share feedback for this verified purchase.'
                    : reviewEligibility.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsReviewModalOpen(true)}
            disabled={!isAuthenticated || reviewEligibility.loading || !reviewEligibility.canReview}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Write a Review
          </button>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        <h2 className="mb-4 text-xl font-semibold text-[#111827]">
          All Reviews ({reviewCount})
        </h2>
        
        {reviews.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center">
            <p className="text-gray-500">No reviews yet. Be the first to review!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id || review._id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#111827]">{getReviewerName(review)}</p>
                    {review.verified !== false && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                        <FaCheckCircle /> Verified purchase
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString()}
                    {getReviewOrderLabel(review) ? ` . ${getReviewOrderLabel(review)}` : ''}
                  </p>
                </div>
              </div>
              <div className="mb-2 flex">{renderStars(review.rating)}</div>
              <h3 className="mb-1 font-semibold text-[#111827]">{getReviewTitle(review)}</h3>
              <p className="text-gray-700">{review.comment}</p>
              {review.sellerResponse?.comment && (
                <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-orange-800">
                    <FaStore /> Seller response
                  </p>
                  <p className="mt-1 text-sm text-orange-900">{review.sellerResponse.comment}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ProductReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSubmit={handleSubmitReview}
        draft={newReview}
        onDraftChange={setNewReview}
        productName={product?.name || 'Product'}
      />
    </div>
  );
};

export default Reviews;
