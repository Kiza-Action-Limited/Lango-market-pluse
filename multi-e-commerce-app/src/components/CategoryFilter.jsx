// src/components/CategoryFilter.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CategoryFilter = ({ selectedCategory, onCategoryChange }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/categories');
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-10 bg-gray-200 rounded"></div>;
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Category</label>
      <select
        value={selectedCategory || ''}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
      >
        <option value="">All Categories</option>
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>
    </div>
  );
};

export default CategoryFilter;