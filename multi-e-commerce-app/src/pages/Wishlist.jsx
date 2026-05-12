// src/pages/Wishlist.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { userService } from '../services/userService';
import { FaTrash, FaShoppingCart } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import { getMinimumOrderQuantity } from '../utils/moq';

const Wishlist = () => {
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated]);

  const fetchWishlist = async () => {
    try {
      const response = await userService.getWishlist();
      setWishlistItems(response?.items || []);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromWishlist = async (productId) => {
    try {
      await userService.removeFromWishlist(productId);
      setWishlistItems((prev) => prev.filter((item) => item.productId !== productId));
      toast.success('Removed from wishlist');
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to remove from wishlist';
      toast.error(message);
    }
  };

  const handleAddToCart = (product) => {
    const minOrderQty = getMinimumOrderQuantity(product);
    addToCart(product.id || product.productId || product._id, minOrderQty, null, product);
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Please Login</h2>
        <p className="text-gray-600 mb-8">Login to view your wishlist</p>
        <Link to="/login" className="btn-primary">
          Login Now
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Your Wishlist is Empty</h2>
        <p className="text-gray-600 mb-8">Save your favorite products here</p>
        <Link to="/products" className="btn-primary">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wishlistItems.map((item) => (
          <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <Link to={`/products/${item.productId}`}>
              <div className="h-48 bg-gray-200">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No Image
                  </div>
                )}
              </div>
            </Link>
            
            <div className="p-4">
              <Link to={`/products/${item.productId}`}>
                <h3 className="text-lg font-semibold text-dark hover:text-primary mb-2">
                  {item.name}
                </h3>
              </Link>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(item.price)}
                </span>
                {item.originalPrice && (
                  <span className="text-sm text-gray-400 line-through">
                    {formatCurrency(item.originalPrice)}
                  </span>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddToCart(item)}
                  className="flex-1 btn-primary py-2 flex items-center justify-center space-x-2"
                >
                  <FaShoppingCart />
                  <span>Add to Cart</span>
                </button>
                <button
                  onClick={() => handleRemoveFromWishlist(item.productId)}
                  className="px-4 border border-red-500 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Wishlist;
