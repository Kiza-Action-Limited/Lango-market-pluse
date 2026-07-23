// src/pages/Reviews.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { productService } from '../services/productService';
import ProductReviewModal from '../components/ProductReviewModal';

const getReviewerName = (review = {}) => (
  review.user?.fullName || review.user?.name || 'Verified buyer'
);

const getReviewerImage = (review = {}) => review.user?.profileImageUrl || '';

const getReviewerInitial = (review = {}) => getReviewerName(review).charAt(0).toUpperCase() || 'V';

const Reviews = () => {
  const params = useParams();
  const productId = params.productId || params.id;
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
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
      setNewReview({ rating: 5, comment: '' });
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{product?.name}</h1>
        <p className="text-gray-600">Customer Reviews</p>
      </div>

      <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
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
        <h2 className="text-xl font-semibold mb-4">
          All Reviews ({reviews.length})
        </h2>
        
        {reviews.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">No reviews yet. Be the first to review!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id || review._id} className="bg-white rounded-lg shadow-md p-6">
              <div className="mb-4 flex items-center gap-3">
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
                  <p className="text-sm text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mb-2 flex">{renderStars(review.rating)}</div>
              <p className="text-gray-700">{review.comment}</p>
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
