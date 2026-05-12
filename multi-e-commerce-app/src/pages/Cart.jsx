// src/pages/Cart.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { FaTrash, FaPlus, FaMinus, FaShoppingCart, FaStore, FaTruck, FaBrain, FaShieldAlt } from 'react-icons/fa';
import { formatCurrency } from '../utils/formatters';
import { getMinimumOrderQuantity, MQQ_TIERS } from '../utils/moq';

const Cart = () => {
  const { cartItems, updateQuantity, removeFromCart, getCartTotal, loading } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (cartItems.length > 0) {
      navigate('/checkout');
    }
  };

  // Calculate shipping cost (free over KSh 50)
  const subtotal = getCartTotal();
  const shippingCost = subtotal >= 50 ? 0 : 5;
  const total = subtotal + shippingCost;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]"></div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="bg-[#F9FAFB] min-h-screen py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-8">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-2xl font-bold text-[#F97316] mb-4">Your Cart is Empty</h2>
            <p className="text-[#6B7280] mb-8">
              Looks like you haven't added any items to your cart yet. Start exploring products from our trusted sellers.
            </p>
            <Link to="/products" className="inline-block px-6 py-3 bg-[#F97316] text-white rounded-lg font-semibold hover:bg-[#F97316]/90 transition-colors">
              Start Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FaShoppingCart className="text-[#F97316] text-3xl" />
            <h1 className="text-3xl font-bold text-[#F97316]">Shopping Cart</h1>
          </div>
          <p className="text-[#6B7280]">Lango Lako la Biashara Smart — Review and manage your items before checkout</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-4 bg-[#F97316] text-white px-6 py-3 text-sm font-medium">
                <div className="col-span-6">Product</div>
                <div className="col-span-2 text-center">Quantity</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">Subtotal</div>
              </div>
              
              <div className="divide-y divide-gray-100">
                {cartItems.map((item) => {
                  const minOrderQty = item.minOrderQuantity || getMinimumOrderQuantity(item);
                  const stock = Number(item.stock ?? item.quantityAvailable ?? Number.MAX_SAFE_INTEGER);
                  const itemId = item.id || item._id;

                  return (
                  <div key={itemId} className="p-4 md:p-6 hover:bg-gray-50 transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      {/* Product Info */}
                      <div className="md:col-span-6">
                        <div className="flex gap-4">
                          <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                            <img
                              src={item.image || 'https://via.placeholder.com/100'}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <Link 
                              to={`/products/${item.productId}`} 
                              className="text-lg font-semibold text-[#111827] hover:text-[#F97316] transition-colors"
                            >
                              {item.name}
                            </Link>
                            <div className="flex items-center gap-1 mt-1">
                              <FaStore className="text-[#6B7280] text-xs" />
                              <p className="text-[#6B7280] text-sm">{item.seller?.businessName || 'Verified Seller'}</p>
                            </div>
                            {minOrderQty > 1 && (
                              <div className="mt-2 rounded-md border border-orange-200 bg-orange-50 p-2 text-xs text-orange-800">
                                <div className="font-semibold">Minimum order: {minOrderQty} pieces</div>
                                <div>{MQQ_TIERS[0].label}: {MQQ_TIERS[0].range}</div>
                                <div>{MQQ_TIERS[1].label}: {MQQ_TIERS[1].range}</div>
                              </div>
                            )}
                            <p className="text-[#F97316] font-semibold mt-1 md:hidden">
                              {formatCurrency(item.price)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Quantity Controls */}
                      <div className="md:col-span-2 flex justify-center">
                        <div className="flex items-center border border-gray-200 rounded-lg">
                          <button
                            onClick={() => updateQuantity(itemId, Math.max(minOrderQty, item.quantity - 1))}
                            className="w-8 h-8 rounded-l-lg hover:bg-gray-100 text-[#6B7280] hover:text-[#F97316] transition-colors"
                          >
                            <FaMinus size={12} className="mx-auto" />
                          </button>
                          <span className="w-10 text-center text-[#111827] font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, Math.min(stock, item.quantity + 1))}
                            className="w-8 h-8 rounded-r-lg hover:bg-gray-100 text-[#6B7280] hover:text-[#F97316] transition-colors"
                          >
                            <FaPlus size={12} className="mx-auto" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Unit Price */}
                      <div className="md:col-span-2 text-right hidden md:block">
                        <span className="text-[#111827] font-medium">{formatCurrency(item.price)}</span>
                      </div>
                      
                      {/* Subtotal & Actions */}
                      <div className="md:col-span-2 flex justify-between items-center">
                        <div className="md:text-right">
                          <span className="font-bold text-[#F97316] text-lg">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                        <button
                          onClick={() => removeFromCart(itemId)}
                          className="text-red-500 hover:text-red-700 transition-colors p-2"
                          title="Remove item"
                        >
                          <FaTrash size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                    );
                })}
              </div>
            </div>
            
            {/* Continue Shopping Link */}
            <div className="mt-4">
              <Link to="/products" className="inline-flex items-center gap-2 text-[#F97316] hover:text-[#FB923C] transition-colors font-medium">
                ← Continue Shopping
              </Link>
            </div>
          </div>
          
          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-24">
              <h2 className="text-xl font-bold text-[#111827] mb-4">Order Summary</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-[#6B7280]">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#6B7280]">
                  <span>Shipping</span>
                  <span className="flex items-center gap-1">
                    {shippingCost === 0 ? (
                      <>
                        <FaTruck className="text-[#16A34A] text-xs" />
                        <span className="text-[#16A34A]">Free</span>
                      </>
                    ) : (
                      formatCurrency(shippingCost)
                    )}
                  </span>
                </div>
                {subtotal >= 50 && (
                  <div className="bg-[#16A34A]/10 rounded-lg p-2 text-center">
                    <span className="text-[#16A34A] text-sm font-medium">✓ Free Shipping Applied</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-[#F97316]">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleCheckout}
                className="w-full py-3 bg-[#F97316] text-white rounded-lg font-semibold hover:bg-[#F97316]/90 transition-colors shadow-md"
              >
                Proceed to Checkout
              </button>
              
              {/* Trust Badges */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                  <FaShieldAlt className="text-[#16A34A]" />
                  <span>Secure checkout with encryption</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                  <FaTruck className="text-[#F97316]" />
                  <span>Trackable delivery on all orders</span>
                </div>
              </div>
            </div>
            
            {/* AI Intelligence Tip */}
            {cartItems.length > 0 && total < 50 && (
            <div className="mt-4 bg-linear-to-r from-[#F97316]/10 to-[#FB923C]/10 rounded-xl p-4 border border-[#F97316]/20">
                <div className="flex items-start gap-2">
                  <FaBrain className="text-[#F97316] text-lg mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[#111827] text-sm">Smart Tip</h4>
                    <p className="text-xs text-[#6B7280]">
                      Add <span className="font-bold text-[#16A34A]">{formatCurrency(50 - subtotal)}</span> more to qualify for <strong className="text-[#16A34A]">Free Shipping</strong>!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
