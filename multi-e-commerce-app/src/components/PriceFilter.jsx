// src/components/PriceFilter.jsx
import React, { useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';

const PriceFilter = ({ minPrice, maxPrice, onPriceChange }) => {
  const [min, setMin] = useState(minPrice || '');
  const [max, setMax] = useState(maxPrice || '');
  
  const debouncedMin = useDebounce(min, 500);
  const debouncedMax = useDebounce(max, 500);

  React.useEffect(() => {
    onPriceChange(debouncedMin, debouncedMax);
  }, [debouncedMin, debouncedMax]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Price Range</label>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Min"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className="w-1/2 px-3 py-2 border rounded-lg"
        />
        <input
          type="number"
          placeholder="Max"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          className="w-1/2 px-3 py-2 border rounded-lg"
        />
      </div>
    </div>
  );
};

export default PriceFilter;