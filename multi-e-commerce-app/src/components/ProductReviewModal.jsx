import React, { useState } from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import Modal from './Modal';

const ProductReviewModal = ({
  isOpen,
  onClose,
  onSubmit,
  draft,
  onDraftChange,
  productName = 'Product',
  productImage = '',
  helperText = 'Verified buyer feedback helps other customers choose confidently.',
  eyebrow = '',
  progressText = '',
  submitting = false,
  submitLabel = 'Submit Review',
  cancelLabel = 'Cancel',
}) => {
  const rating = Number(draft?.rating || 5);
  const titleLength = String(draft?.title || '').length;
  const commentLength = String(draft?.comment || '').length;
  const ratingLabels = {
    1: 'Poor',
    2: 'Needs work',
    3: 'Fair',
    4: 'Good',
    5: 'Excellent',
  };
  const [commentError, setCommentError] = useState('');

  const handleSubmit = (event) => {
    const trimmedTitle = String(draft?.title || '').trim();
    const trimmedComment = String(draft?.comment || '').trim();

    if (trimmedTitle.length > 100) {
      event.preventDefault();
      setCommentError('Keep your title under 100 characters.');
      return;
    }

    if (trimmedComment.length < 10) {
      event.preventDefault();
      setCommentError('Write at least 10 characters so other buyers can understand your experience.');
      return;
    }

    if (trimmedComment.length > 1000) {
      event.preventDefault();
      setCommentError('Keep your review under 1000 characters.');
      return;
    }

    setCommentError('');
    onSubmit(event);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Write a Review" size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wide text-[#16A34A]">{eyebrow}</p>
        )}

        <div className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {productImage && (
            <img
              src={productImage}
              alt={productName}
              className="h-14 w-14 rounded-lg object-cover"
            />
          )}
          <div>
            <p className="text-sm font-semibold text-[#111827]">{productName}</p>
            <p className="mt-1 text-xs text-gray-600">{helperText}</p>
            {progressText && <p className="mt-1 text-xs text-gray-600">{progressText}</p>}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-[#111827]">Rating</label>
            <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
              {ratingLabels[rating] || 'Rate'}
            </span>
          </div>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Product rating">
            {[1, 2, 3, 4, 5].map((star) => {
              const selected = star <= rating;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => onDraftChange({ ...draft, rating: star })}
                  className="rounded p-1 text-2xl transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  aria-label={`${star} star rating`}
                  aria-pressed={star === rating}
                >
                  {selected ? (
                    <FaStar className="text-yellow-400" />
                  ) : (
                    <FaRegStar className="text-gray-300" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#111827]">Review title</label>
          <input
            value={draft?.title || ''}
            onChange={(event) => {
              setCommentError('');
              onDraftChange({ ...draft, title: event.target.value });
            }}
            placeholder="Example: Fresh quality and smooth delivery"
            maxLength={100}
            className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-4 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
          <p className="mt-1 text-right text-xs text-gray-500">{titleLength}/100</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#111827]">Your experience</label>
          <textarea
            value={draft?.comment || ''}
            onChange={(event) => {
              setCommentError('');
              onDraftChange({ ...draft, comment: event.target.value });
            }}
            placeholder="Share product quality, packaging, seller communication, and delivery experience."
            rows="4"
            maxLength={1000}
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            required
          />
          <div className="mt-1 flex items-center justify-between gap-3">
            {commentError ? (
              <p className="text-sm text-red-600">{commentError}</p>
            ) : (
              <p className="text-xs text-gray-500">Verified purchase reviews are shown publicly.</p>
            )}
            <p className="text-xs text-gray-500">{commentLength}/1000</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-[#374151] hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#F97316] px-5 py-2 font-semibold text-white hover:bg-[#EA580C] disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ProductReviewModal;
