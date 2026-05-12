// src/components/RatingStars.jsx
import React from 'react';
import { FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';

const RatingStars = ({ rating, onRate, size = 'md', interactive = false }) => {
  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  const starSize = sizes[size] || sizes.md;

  const renderStar = (index) => {
    const starValue = index + 1;
    
    if (starValue <= rating) {
      return <FaStar className={`text-yellow-400 ${starSize}`} />;
    }
    if (starValue - rating < 1) {
      return <FaStarHalfAlt className={`text-yellow-400 ${starSize}`} />;
    }
    return <FaRegStar className={`text-gray-300 ${starSize}`} />;
  };

  if (interactive) {
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, index) => (
          <button
            key={index}
            onClick={() => onRate(index + 1)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            {renderStar(index)}
          </button>
        ))}
      </div>
    );
  }

  return <div className="flex gap-1">{[...Array(5)].map((_, index) => renderStar(index))}</div>;
};

export default RatingStars;