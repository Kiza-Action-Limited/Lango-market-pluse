// src/hooks/useCart.js
import { useCart as useCartContext } from '../context/CartContext';
import { useState, useEffect } from 'react';

export const useCart = () => {
  const cart = useCartContext();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartAnimation, setCartAnimation] = useState(false);

  useEffect(() => {
    if (cartAnimation) {
      const timer = setTimeout(() => setCartAnimation(false), 500);
      return () => clearTimeout(timer);
    }
  }, [cartAnimation]);

  const addToCartWithAnimation = async (productId, quantity = 1, variant = null) => {
    setCartAnimation(true);
    await cart.addToCart(productId, quantity, variant);
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const toggleCart = () => setIsCartOpen(prev => !prev);

  const getItemCount = () => {
    return cart.cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const getItemById = (productId) => {
    return cart.cartItems.find(item => item.productId === productId);
  };

  const isInCart = (productId) => {
    return cart.cartItems.some(item => item.productId === productId);
  };

  const getTotalItems = () => {
    return cart.cartItems.length;
  };

  const getSubtotal = () => {
    return cart.getSubtotal();
  };

  const getTotal = () => {
    return cart.getTotal();
  };

  const getShippingCost = () => {
    return cart.getShippingCost();
  };

  const getTax = () => {
    return cart.getTax();
  };

  return {
    ...cart,
    isCartOpen,
    cartAnimation,
    addToCartWithAnimation,
    openCart,
    closeCart,
    toggleCart,
    getItemCount,
    getItemById,
    isInCart,
    getTotalItems,
    getSubtotal,
    getTotal,
    getShippingCost,
    getTax
  };
};