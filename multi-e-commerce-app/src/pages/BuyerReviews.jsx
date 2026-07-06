import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaCheckCircle, FaStar, FaStore } from 'react-icons/fa';
import { orderService } from '../services/orderService';
import { productService } from '../services/productService';
import { formatCurrency, formatDate } from '../utils/formatters';

const getImageUrl = (product = {}) => {
  const image = product.images?.[0];
  if (!image) return 'https://via.placeholder.com/96';
  return typeof image === 'string' ? image : image.url || 'https://via.placeholder.com/96';
};

const BuyerReviews = () => {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, reviewed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState({});
  const [savingId, setSavingId] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    try {
      const response = await orderService.getBuyerReviewQueue();
      setItems(Array.isArray(response.data) ? response.data : []);
      setSummary(response.summary || { total: 0, reviewed: 0, pending: 0 });
    } catch (error) {
      console.error('Error loading reviews:', error);
      toast.error('Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const updateForm = (productId, patch) => {
    setFormState((current) => ({
      ...current,
      [productId]: {
        rating: 5,
        comment: '',
        ...(current[productId] || {}),
        ...patch,
      },
    }));
  };

  const submitReview = async (productId) => {
    const draft = formState[productId] || { rating: 5, comment: '' };
    if (!String(draft.comment || '').trim()) {
      toast.error('Write a short review comment');
      return;
    }

    setSavingId(productId);
    try {
      await productService.addReview(productId, {
        rating: Number(draft.rating || 5),
        comment: String(draft.comment).trim(),
      });
      toast.success('Review saved');
      await loadQueue();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save review');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-[#F97316]">Verified purchases</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950">My Reviews</h2>
          <p className="mt-2 text-sm text-gray-600">Review products you bought from sellers and help other buyers choose confidently.</p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Reviewable</p>
            <p className="mt-2 text-2xl font-bold text-gray-950">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Reviewed</p>
            <p className="mt-2 text-2xl font-bold text-green-700">{summary.reviewed}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Pending</p>
            <p className="mt-2 text-2xl font-bold text-[#F97316]">{summary.pending}</p>
          </div>
        </section>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-44 rounded-lg border border-gray-100 bg-white skeleton-shimmer" />
            ))}
          </div>
        ) : items.length ? (
          <section className="space-y-4">
            {items.map((item) => {
              const product = item.product || {};
              const seller = item.seller || {};
              const productId = product._id || product.id;
              const draft = formState[productId] || { rating: item.review?.rating || 5, comment: item.review?.comment || '' };
              return (
                <article key={`${item.order?.id}-${productId}`} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="grid gap-4 lg:grid-cols-[auto_1fr_auto]">
                    <img src={getImageUrl(product)} alt={product.name} className="h-24 w-24 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold text-gray-950">{product.name}</h3>
                        {item.reviewed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                            <FaCheckCircle /> Reviewed
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                        <FaStore className="text-[#F97316]" />
                        {seller.businessName || seller.fullName || seller.name || 'Seller'}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Order #{String(item.order?.orderNumber || item.order?.id || '').slice(-8)} . {formatDate(item.order?.deliveredAt || item.order?.updatedAt)}
                      </p>
                      <p className="mt-2 font-semibold text-green-700">{formatCurrency(item.order?.totalAmount || product.price || 0)}</p>
                    </div>
                    <Link to={`/products/${productId}/reviews`} className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                      View public reviews
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_auto] md:items-end">
                    <label className="text-sm font-semibold text-gray-900">
                      Rating
                      <select
                        value={draft.rating}
                        onChange={(event) => updateForm(productId, { rating: event.target.value })}
                        className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]"
                      >
                        {[5, 4, 3, 2, 1].map((rating) => (
                          <option key={rating} value={rating}>{rating} stars</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-gray-900">
                      Review
                      <textarea
                        value={draft.comment}
                        onChange={(event) => updateForm(productId, { comment: event.target.value })}
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                        placeholder="Share product quality, seller communication, and delivery experience"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => submitReview(productId)}
                      disabled={savingId === productId}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                    >
                      <FaStar />
                      {savingId === productId ? 'Saving...' : item.reviewed ? 'Update Review' : 'Add Review'}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <FaStar className="mx-auto text-3xl text-[#F97316]" />
            <h3 className="mt-3 font-semibold text-gray-950">No delivered products to review yet</h3>
            <p className="mt-1 text-sm text-gray-500">Delivered purchases will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerReviews;
