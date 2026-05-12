// src/pages/Reviews.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';
import toast from 'react-hot-toast';

const Reviews = () => {
  const { productId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newReview, setNewReview] = useState({
    rating: 5,
    comment: ''
  });

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    try {
      const [productRes, reviewsRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/products/${productId}`),
        axios.get(`http://localhost:5000/api/products/${productId}/reviews`)
      ]);
      setProduct(productRes.data.product);
      setReviews(reviewsRes.data.reviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to submit a review');
      return;
    }

    try {
      const response = await axios.post(
        `http://localhost:5000/api/products/${productId}/reviews`,
        newReview,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setReviews([response.data.review, ...reviews]);
      setNewReview({ rating: 5, comment: '' });
      toast.success('Review submitted successfully');
    } catch (error) {
      toast.error('Failed to submit review');
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

      {/* Write Review */}
      {isAuthenticated && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Write a Review</h2>
          <form onSubmit={handleSubmitReview}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewReview({ ...newReview, rating: star })}
                    className="text-2xl focus:outline-none"
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
                placeholder="Share your experience with this product..."
                rows="4"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-primary"
                required
              />
            </div>
            <button type="submit" className="btn-primary">
              Submit Review
            </button>
          </form>
        </div>
      )}

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
            <div key={review.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                    {review.user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{review.user?.name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex">
                  {renderStars(review.rating)}
                </div>
              </div>
              <p className="text-gray-700">{review.comment}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Reviews;