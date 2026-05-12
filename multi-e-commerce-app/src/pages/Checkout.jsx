// src/pages/Checkout.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../config/axios';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import { FaTruck, FaShieldAlt, FaBrain, FaLock, FaArrowLeft } from 'react-icons/fa';
import { getMinimumOrderQuantity, MQQ_TIERS } from '../utils/moq';

const Checkout = () => {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({
    fullName: user?.name || '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Kenya',
    phone: ''
  });
  const paymentMethod = 'mpesa';

  if (cartItems.length === 0) {
    navigate('/cart');
    return null;
  }

  const handleAddressChange = (e) => {
    setShippingAddress({
      ...shippingAddress,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    const invalidItems = cartItems.filter((item) => {
      const minOrderQty = item.minOrderQuantity || getMinimumOrderQuantity(item);
      return Number(item.quantity || 0) < minOrderQty;
    });

    if (invalidItems.length > 0) {
      toast.error('Some items are below the minimum order quantity. Please update your cart.');
      navigate('/cart');
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        items: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        shippingAddress,
        paymentMethod: 'mpesa',
        total: getCartTotal()
      };

      let response;
      try {
        response = await api.post('/v1/orders', orderData);
      } catch (error) {
        if (error.response?.status === 404) {
          response = await api.post('/orders', orderData);
        } else {
          throw error;
        }
      }

      toast.success('Order placed successfully!');
      clearCart();
      const orderId =
        response?.data?.order?.id ||
        response?.data?.order?._id ||
        response?.data?.data?.order?.id ||
        response?.data?.data?.order?._id;
      if (orderId) {
        navigate(`/orders/${orderId}/track`);
      } else {
        navigate('/orders');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const subtotal = getCartTotal();
  const shipping = subtotal >= 50 ? 0 : 5;
  const total = subtotal + shipping;

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => navigate('/cart')}
            className="flex items-center gap-2 text-[#F97316] hover:text-[#FB923C] mb-4 transition-colors"
          >
            <FaArrowLeft size={14} />
            <span className="text-sm font-medium">Back to Cart</span>
          </button>
          <h1 className="text-3xl font-bold text-[#F97316] mb-2">Checkout</h1>
          <p className="text-[#6B7280]">Lango Lako la Biashara Smart — Complete your order securely</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmitOrder}>
              {/* Shipping Address */}
              <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-[#F97316]">
                <div className="flex items-center gap-2 mb-4">
                  <FaTruck className="text-[#F97316] text-xl" />
                  <h2 className="text-xl font-semibold text-[#111827]">Shipping Address</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#111827]">Full Name *</label>
                    <input
                      type="text"
                      name="fullName"
                      value={shippingAddress.fullName}
                      onChange={handleAddressChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#111827]">Phone Number *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={shippingAddress.phone}
                      onChange={handleAddressChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                      placeholder="+254 700 000000"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2 text-[#111827]">Address Line 1 *</label>
                    <input
                      type="text"
                      name="addressLine1"
                      value={shippingAddress.addressLine1}
                      onChange={handleAddressChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                      placeholder="Street address, P.O. Box"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2 text-[#111827]">Address Line 2 (Optional)</label>
                    <input
                      type="text"
                      name="addressLine2"
                      value={shippingAddress.addressLine2}
                      onChange={handleAddressChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:border-transparent"
                      placeholder="Apartment, suite, unit, building, floor"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#111827]">City *</label>
                    <input
                      type="text"
                      name="city"
                      value={shippingAddress.city}
                      onChange={handleAddressChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                      placeholder="Nairobi"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#111827]">County/State *</label>
                    <input
                      type="text"
                      name="state"
                      value={shippingAddress.state}
                      onChange={handleAddressChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                      placeholder="Nairobi County"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#111827]">ZIP Code *</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={shippingAddress.zipCode}
                      onChange={handleAddressChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                      placeholder="00100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#111827]">Country *</label>
                    <input
                      type="text"
                      name="country"
                      value={shippingAddress.country}
                      onChange={handleAddressChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                      placeholder="Kenya"
                    />
                  </div>
                </div>
              </div>
              
              {/* Payment Method */}
              <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-[#16A34A]">
                <div className="flex items-center gap-2 mb-4">
                  <FaLock className="text-[#16A34A] text-xl" />
                  <h2 className="text-xl font-semibold text-[#111827]">Payment Method</h2>
                </div>
                <div className="p-4 rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/5">
                  <p className="font-semibold text-[#111827]">M-Pesa</p>
                  <p className="text-sm text-[#6B7280] mt-1">
                    Pay securely via M-Pesa STK Push. A prompt will be sent to your phone number.
                  </p>
                </div>
              </div>
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#F97316] text-white rounded-xl font-semibold text-lg hover:bg-[#F97316]/90 transition-colors disabled:opacity-50 shadow-md"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : (
                  `Place Order • ${formatCurrency(total)}`
                )}
              </button>
            </form>
          </div>
          
          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-24">
              <h2 className="text-xl font-bold text-[#111827] mb-4">Order Summary</h2>
              
              {/* Items */}
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {cartItems.map((item) => {
                  const minOrderQty = item.minOrderQuantity || getMinimumOrderQuantity(item);
                  const itemId = item.id || item._id;

                  return (
                  <div key={itemId} className="flex justify-between text-sm py-2 border-b border-gray-100">
                    <div className="flex-1">
                      <span className="text-[#111827] font-medium">{item.name}</span>
                      <span className="text-[#6B7280] text-xs ml-1">x{item.quantity}</span>
                      {minOrderQty > 1 && (
                        <div className="mt-1 text-[11px] text-orange-700">
                          {MQQ_TIERS[0].label}: {MQQ_TIERS[0].range} | {MQQ_TIERS[1].label}: {MQQ_TIERS[1].range}
                        </div>
                      )}
                    </div>
                    <span className="text-[#F97316] font-medium">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                  );
                })}
              </div>
              
              {/* Totals */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-[#6B7280]">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#6B7280]">
                  <span>Shipping</span>
                  <span className="flex items-center gap-1">
                    {shipping === 0 ? (
                      <>
                        <FaTruck className="text-[#16A34A] text-xs" />
                        <span className="text-[#16A34A]">Free</span>
                      </>
                    ) : (
                      formatCurrency(shipping)
                    )}
                  </span>
                </div>
                {shipping === 0 && subtotal >= 50 && (
                  <div className="bg-[#16A34A]/10 rounded-lg p-2 text-center">
                    <span className="text-[#16A34A] text-xs font-medium">✓ Free Shipping Applied</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3 mt-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-[#F97316]">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
              
              {/* Trust Badges */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-[#6B7280] mb-2">
                  <FaShieldAlt className="text-[#16A34A]" />
                  <span>Secure checkout with 256-bit encryption</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                  <FaTruck className="text-[#F97316]" />
                  <span>Track your order in real-time</span>
                </div>
              </div>
            </div>
            
            {/* AI Intelligence Tip */}
            {subtotal < 50 && (
             <div className="mt-4 bg-linear-to-r from-[#F97316]/10 to-[#FB923C]/10 rounded-xl p-4 border border-[#F97316]/20">
                <div className="flex items-start gap-2">
                  <FaBrain className="text-[#F97316] text-lg mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[#111827] text-sm">Smart Savings Tip</h4>
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

export default Checkout;
