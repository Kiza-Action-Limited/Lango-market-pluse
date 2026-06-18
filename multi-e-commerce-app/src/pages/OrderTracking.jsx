// src/pages/OrderTracking.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  FaCheckCircle, FaTruck, FaBox, FaHourglassHalf, FaMapMarkerAlt, 
  FaClock, FaPhone, FaBrain, FaArrowLeft, FaCreditCard, FaMobileAlt, FaSyncAlt
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import { orderService } from '../services/orderService';
import { paymentService } from '../services/paymentService';
import { normalizeOrder, normalizeTracking } from '../utils/orderAdapter';

const OrderTracking = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [sendingPayment, setSendingPayment] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      const response = await orderService.getById(id);
      const normalizedOrder = normalizeOrder(response.data || response.order || response);
      setOrder(normalizedOrder);
      setTracking(normalizeTracking(normalizedOrder));
      setMpesaPhone((previous) => previous || normalizedOrder.shippingAddress?.phone || '');
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'pending_payment':
      case 'AWAITING_PAYMENT':
        return 'text-[#F97316] border-[#F97316]/30 bg-[#F97316]/5';
      case 'processing':
      case 'payment_escrowed':
      case 'FUNDS_HELD':
        return 'text-[#FB923C] border-[#FB923C]/30 bg-[#FB923C]/5';
      case 'shipped':
      case 'dispatched':
      case 'IN_TRANSIT':
        return 'text-[#F97316] border-[#F97316]/30 bg-[#F97316]/5';
      case 'delivered':
      case 'DELIVERED':
      case 'completed':
      case 'RELEASED':
        return 'text-[#16A34A] border-[#16A34A]/30 bg-[#16A34A]/5';
      default:
        return 'text-gray-600 border-gray-200 bg-gray-50';
    }
  };

  const getStatusStep = (status) => {
    if (['pending', 'pending_payment', 'AWAITING_PAYMENT'].includes(status)) return 0;
    if (['processing', 'payment_escrowed', 'FUNDS_HELD'].includes(status)) return 1;
    if (['shipped', 'dispatched', 'IN_TRANSIT'].includes(status)) return 2;
    if (['delivered', 'DELIVERED', 'completed', 'RELEASED'].includes(status)) return 3;
    return 0;
  };

  const isAwaitingPayment = (status) => ['pending', 'pending_payment', 'AWAITING_PAYMENT'].includes(status);

  const refreshOrderAfterPayment = async () => {
    const response = await orderService.getById(id);
    const normalizedOrder = normalizeOrder(response.data || response.order || response);
    setOrder(normalizedOrder);
    setTracking(normalizeTracking(normalizedOrder));
    return normalizedOrder;
  };

  const sendMpesaPrompt = async () => {
    if (!mpesaPhone.trim()) {
      toast.error('Enter the M-Pesa phone number that will receive the STK prompt');
      return;
    }

    setSendingPayment(true);
    setPaymentStatus('');

    try {
      const result = await paymentService.initiateMpesaPayment({
        orderId: order.id,
        phoneNumber: mpesaPhone.trim(),
      });
      const requestId = result?.checkoutRequestId || result?.CheckoutRequestID;

      if (requestId) {
        setCheckoutRequestId(requestId);
        setPaymentStatus('STK Push sent. Enter your M-Pesa PIN on your phone to complete payment.');
        toast.success('M-Pesa STK Push sent');
      } else {
        setPaymentStatus(result?.message || 'Payment request sent. Check your phone.');
        toast.success('Payment request sent');
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to send M-Pesa prompt';
      setPaymentStatus(message);
      toast.error(message);
    } finally {
      setSendingPayment(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!checkoutRequestId) {
      toast.error('Send an STK Push first');
      return;
    }

    setCheckingPayment(true);

    try {
      const result = await paymentService.checkMpesaStatus(checkoutRequestId);
      const status = result?.status || '';
      const message = result?.message || 'Payment status checked';

      setPaymentStatus(message);

      if (status === 'completed') {
        const refreshedOrder = await refreshOrderAfterPayment();
        if (isAwaitingPayment(refreshedOrder.status)) {
          setOrder((previous) => ({ ...previous, status: 'FUNDS_HELD', paidAt: new Date().toISOString() }));
        }
        toast.success('Payment confirmed. Tracking is now available.');
      } else if (status === 'failed') {
        toast.error(message || 'Payment was not completed');
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to confirm payment yet';
      setPaymentStatus(message);
      toast.error(message);
    } finally {
      setCheckingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-[#F9FAFB] min-h-screen py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-8">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-[#F97316] mb-4">Order Not Found</h2>
            <p className="text-[#6B7280] mb-6">The order you're looking for doesn't exist or has been removed.</p>
            <Link to="/orders" className="inline-block px-6 py-3 bg-[#F97316] text-white rounded-lg font-semibold hover:bg-[#F97316]/90 transition-colors">
              View My Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentStep = getStatusStep(order.status);
  const awaitingPayment = isAwaitingPayment(order.status);
  const steps = [
    { label: 'Order Placed', icon: FaBox, status: 'pending', description: 'Your order has been received' },
    { label: 'Processing', icon: FaHourglassHalf, status: 'processing', description: 'Seller is preparing your order' },
    { label: 'Shipped', icon: FaTruck, status: 'shipped', description: 'Your order is on the way' },
    { label: 'Delivered', icon: FaMapMarkerAlt, status: 'delivered', description: 'Order has been delivered' }
  ];

  const estimatedDelivery = () => {
    if (['delivered', 'DELIVERED', 'completed', 'RELEASED'].includes(order.status)) return 'Delivered';
    if (['shipped', 'dispatched', 'IN_TRANSIT'].includes(order.status)) return 'Estimated: 2-5 business days';
    if (['processing', 'payment_escrowed', 'FUNDS_HELD'].includes(order.status)) return 'Estimated: 3-7 business days';
    return 'Processing will begin shortly';
  };

  const PaymentRequiredCard = () => (
    <div className="rounded-xl border border-[#16A34A]/30 bg-white p-6 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#16A34A]">
            <FaCreditCard />
            <h2 className="text-xl font-bold text-[#111827]">Complete M-Pesa Payment</h2>
          </div>
          <p className="mt-2 text-sm text-[#6B7280]">
            Pay {formatCurrency(order.total)} before tracking, seller processing, and delivery updates are shown.
          </p>
        </div>
        <span className="rounded-full border border-[#F97316]/30 bg-[#F97316]/10 px-3 py-1 text-xs font-semibold text-[#9A3412]">
          PAYMENT REQUIRED
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="block text-sm font-semibold text-[#111827]" htmlFor="trackingMpesaPhone">
          M-Pesa phone number
          <div className="relative mt-2">
            <FaMobileAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="trackingMpesaPhone"
              type="tel"
              value={mpesaPhone}
              onChange={(event) => setMpesaPhone(event.target.value)}
              placeholder="07XXXXXXXX or 2547XXXXXXXX"
              className="h-11 w-full rounded-lg border border-gray-300 pl-10 pr-3 text-sm outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20"
            />
          </div>
        </label>

        <button
          type="button"
          onClick={sendMpesaPrompt}
          disabled={sendingPayment || checkingPayment}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-5 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-60"
        >
          <FaCreditCard />
          {sendingPayment ? 'Sending...' : checkoutRequestId ? 'Resend STK Push' : 'Send STK Push'}
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-[#111827]">M-Pesa PIN</p>
        <p className="mt-1 text-sm text-[#6B7280]">
          Enter your M-Pesa PIN on the secure prompt that appears on your phone. Do not type your PIN into this website.
        </p>
      </div>

      {checkoutRequestId && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#16A34A]/20 bg-[#16A34A]/5 p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#15803D]">Checkout Request ID</p>
            <p className="mt-1 break-all text-sm text-[#111827]">{checkoutRequestId}</p>
          </div>
          <button
            type="button"
            onClick={checkPaymentStatus}
            disabled={checkingPayment || sendingPayment}
            className="inline-flex items-center gap-2 rounded-lg border border-[#16A34A] bg-white px-4 py-2 text-sm font-semibold text-[#15803D] hover:bg-[#F0FDF4] disabled:opacity-60"
          >
            <FaSyncAlt className={checkingPayment ? 'animate-spin' : ''} />
            {checkingPayment ? 'Checking...' : 'I Have Paid'}
          </button>
        </div>
      )}

      {paymentStatus && (
        <div className="mt-4 rounded-lg border border-[#FDBA74] bg-[#FFF7ED] p-4 text-sm text-[#9A3412]">
          {paymentStatus}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header with Back Button */}
        <div className="mb-6">
          <Link to="/orders" className="inline-flex items-center gap-2 text-[#F97316] hover:text-[#FB923C] transition-colors mb-4">
            <FaArrowLeft size={14} />
            <span className="text-sm font-medium">Back to Orders</span>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <FaTruck className="text-[#16A34A] text-3xl" />
            <h1 className="text-3xl font-bold text-[#F97316]">Track Order</h1>
          </div>
          <p className="text-[#6B7280]">Order #{String(order.id).slice(-8)} • Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
        </div>

        {awaitingPayment && (
          <>
            <PaymentRequiredCard />
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-md">
              <h2 className="text-xl font-semibold text-[#111827]">Order Summary</h2>
              <div className="mt-4 space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 border-b border-gray-100 pb-3 last:border-0">
                    <div>
                      <p className="font-medium text-[#111827]">{item.name}</p>
                      <p className="text-sm text-[#6B7280]">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-semibold text-[#F97316]">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between border-t border-gray-200 pt-4 text-lg font-bold">
                <span>Total</span>
                <span className="text-[#16A34A]">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </>
        )}
        
        {/* Order Status Timeline */}
        {!awaitingPayment && <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-[#F97316]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-[#111827]">Order Status</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(order.status)}`}>
              {order.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
          
          <div className="relative">
            <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full"></div>
            <div 
              className="absolute top-5 left-0 h-1 rounded-full transition-all duration-500"
              style={{ 
                width: `${(currentStep / (steps.length - 1)) * 100}%`,
                background: 'linear-gradient(90deg, #F97316, #FB923C)'
              }}
            ></div>
            
            <div className="relative flex justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index <= currentStep;
                const isCurrent = index === currentStep;
                
                return (
                  <div key={index} className="flex flex-col items-center text-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                      isCompleted 
                        ? 'bg-linear-to-r from-[#F97316] to-[#FB923C] text-white' 
                        : 'bg-gray-200 text-gray-400'
                    } ${isCurrent ? 'ring-4 ring-[#F97316]/30' : ''}`}>
                      {isCompleted ? <FaCheckCircle /> : <Icon />}
                    </div>
                    <div className="mt-3">
                      <p className={`text-xs font-semibold ${isCompleted ? 'text-[#F97316]' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-[#6B7280] mt-1 max-w-20 hidden sm:block">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Delivery Estimate */}
          <div className="mt-8 pt-4 border-t border-gray-100 text-center">
            <p className="text-sm text-[#6B7280]">
              <FaClock className="inline mr-1 text-[#F97316]" />
              {estimatedDelivery()}
            </p>
          </div>
        </div>}
        
        {/* Tracking Updates */}
        {!awaitingPayment && tracking && tracking.updates && tracking.updates.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-[#FB923C]">
            <h2 className="text-xl font-semibold mb-4 text-[#111827] flex items-center gap-2">
              <FaTruck className="text-[#FB923C]" />
              Tracking Updates
            </h2>
            <div className="space-y-4">
              {tracking.updates.map((update, index) => (
                <div key={index} className="flex gap-4 border-l-2 border-[#F97316] pl-4 pb-4 last:pb-0">
                  <div className="w-2 h-2 rounded-full bg-[#F97316] mt-1.5 -ml-[1.1rem]"></div>
                  <div className="flex-1">
                    <div className="flex flex-wrap justify-between items-start gap-2">
                      <p className="font-semibold text-[#111827] capitalize">{update.status}</p>
                      <p className="text-xs text-[#6B7280]">{new Date(update.timestamp).toLocaleString()}</p>
                    </div>
                    {update.location && (
                      <p className="text-sm text-[#6B7280] mt-1">
                        <FaMapMarkerAlt className="inline mr-1 text-[#F97316] text-xs" />
                        {update.location}
                      </p>
                    )}
                    {update.description && (
                      <p className="text-sm text-[#6B7280] mt-1">{update.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Order Summary */}
        {!awaitingPayment && <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-linear-to-r from-gray-50 to-white px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-[#111827]">Order Summary</h2>
          </div>
          
          <div className="p-6">
            {/* Items */}
            <div className="space-y-3 mb-6">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.image || 'https://via.placeholder.com/50'}
                      alt={item.name}
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                    <div>
                      <p className="font-medium text-[#111827]">{item.name}</p>
                      <p className="text-sm text-[#6B7280]">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-[#F97316]">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            
            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[#6B7280]">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal || order.total - (order.shippingCost || 0))}</span>
                </div>
                <div className="flex justify-between text-[#6B7280]">
                  <span>Shipping</span>
                  <span>{order.shippingCost === 0 ? 'Free' : formatCurrency(order.shippingCost)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-[#16A34A]">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>
            
            {/* Shipping Address */}
            <div className="mb-4">
              <h3 className="font-semibold mb-3 text-[#111827] flex items-center gap-2">
                <FaMapMarkerAlt className="text-[#F97316]" />
                Shipping Address
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-[#6B7280]">
                <p className="font-medium text-[#111827]">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.addressLine1}</p>
                {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</p>
                <p>{order.shippingAddress.country}</p>
                <p className="mt-2 flex items-center gap-1">
                  <FaPhone className="text-xs" />
                  {order.shippingAddress.phone}
                </p>
              </div>
            </div>
          </div>
        </div>}
        
        {/* AI Intelligence Tip */}
        {!awaitingPayment && <div className="mt-6 bg-linear-to-r from-[#FB923C]/10 to-[#F97316]/10 rounded-xl p-4 border border-[#FB923C]/20">
          <div className="flex items-start gap-3">
            <FaBrain className="text-[#FB923C] text-xl mt-0.5" />
            <div>
              <h4 className="font-semibold text-[#111827] mb-1">AI Intelligence Insight</h4>
              <p className="text-sm text-[#6B7280]">
                {['pending', 'pending_payment', 'AWAITING_PAYMENT'].includes(order.status) && "Your order is awaiting payment. You'll receive updates once it moves forward."}
                {['processing', 'payment_escrowed', 'FUNDS_HELD'].includes(order.status) && "The seller is preparing your order. Most orders ship within 24-48 hours."}
                {['shipped', 'dispatched', 'IN_TRANSIT'].includes(order.status) && "Your package is on its way! Track real-time location updates above."}
                {['delivered', 'DELIVERED', 'completed', 'RELEASED'].includes(order.status) && "Great! Your order has been delivered. Rate your purchase to help other customers."}
              </p>
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
};

export default OrderTracking;

