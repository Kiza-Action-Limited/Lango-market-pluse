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
  const [commentError, setCommentError] = useState('');

  const handleSubmit = (event) => {
    const trimmedComment = String(draft?.comment || '').trim();

    if (trimmedComment.length < 2) {
      event.preventDefault();
      setCommentError('Write at least 2 characters.');
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
          <label className="block text-sm font-medium text-[#111827]">Rating</label>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onDraftChange({ ...draft, rating: star })}
                className="rounded p-1 text-2xl transition hover:scale-105 focus:outline-none"
                aria-label={`${star} star rating`}
              >
                {star <= rating ? (
                  <FaStar className="text-yellow-400" />
                ) : (
                  <FaRegStar className="text-gray-300" />
                )}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={draft?.comment || ''}
          onChange={(event) => {
            setCommentError('');
            onDraftChange({ ...draft, comment: event.target.value });
          }}
          placeholder="Share your experience with this product..."
          rows="4"
          maxLength={1000}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          required
        />
        {commentError && <p className="-mt-3 text-sm text-red-600">{commentError}</p>}

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
