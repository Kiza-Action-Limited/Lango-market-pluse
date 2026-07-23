// src/pages/Checkout.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../config/axios';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import { paymentService } from '../services/paymentService';
import { logisticsService } from '../services/logisticsService';
import { FaTruck, FaShieldAlt, FaLock, FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { getMinimumOrderQuantity, MQQ_TIERS } from '../utils/moq';
import { calculateDistanceKm } from '../utils/logisticsAddon';

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
    phone: user?.phone || '',
    gpsLat: '',
    gpsLng: '',
  });
  const [mpesaPhone, setMpesaPhone] = useState(user?.phone || '');
  const [logisticsProviders, setLogisticsProviders] = useState([]);
  const [selectedLogisticsProviderId, setSelectedLogisticsProviderId] = useState('');
  const [buyerLogisticsPreference, setBuyerLogisticsPreference] = useState(null);
  const [providersLoading, setProvidersLoading] = useState(false);
  const paymentMethod = 'mpesa';
  const kenyaMpesaPhonePattern = /^(\+?254|0)?[71][0-9]{8}$/;

  useEffect(() => {
    const fetchLogisticsProviders = async () => {
      setProvidersLoading(true);
      try {
        const params = { limit: 50 };
        if (shippingAddress.gpsLat && shippingAddress.gpsLng) {
          params.lat = shippingAddress.gpsLat;
          params.lng = shippingAddress.gpsLng;
        }
        const providers = await logisticsService.getVerifiedProviders(params);
        setLogisticsProviders(Array.isArray(providers) ? providers : []);
      } catch (error) {
        setLogisticsProviders([]);
      } finally {
        setProvidersLoading(false);
      }
    };

    fetchLogisticsProviders();
  }, [shippingAddress.gpsLat, shippingAddress.gpsLng]);

  useEffect(() => {
    const loadBuyerLogisticsPreference = async () => {
      try {
        const savedPreference = await logisticsService.getBuyerPreference();
        setBuyerLogisticsPreference(savedPreference);
        if (savedPreference?.active && (savedPreference.selectedProviderId || savedPreference.selectedProvider?.id)) {
          setSelectedLogisticsProviderId(savedPreference.selectedProviderId || savedPreference.selectedProvider.id);
        }
      } catch (error) {
        setBuyerLogisticsPreference(null);
      }
    };

    loadBuyerLogisticsPreference();
  }, []);

  const buildDeliveryAddress = () => ({
    label: [
      shippingAddress.addressLine1,
      shippingAddress.addressLine2,
      shippingAddress.city,
      shippingAddress.state,
      shippingAddress.zipCode,
    ].filter(Boolean).join(', '),
    street: [shippingAddress.addressLine1, shippingAddress.addressLine2].filter(Boolean).join(', '),
    town: shippingAddress.city,
    county: shippingAddress.state,
    country: shippingAddress.country || 'Kenya',
    gpsLat: shippingAddress.gpsLat ? Number(shippingAddress.gpsLat) : undefined,
    gpsLng: shippingAddress.gpsLng ? Number(shippingAddress.gpsLng) : undefined,
  });

  const getOrderId = (response) =>
    response?.data?.order?.id ||
    response?.data?.order?._id ||
    response?.data?.data?.order?.id ||
    response?.data?.data?.order?._id ||
    response?.data?.data?.id ||
    response?.data?.data?._id;

  const getCreatedOrder = (response) =>
    response?.data?.data ||
    response?.data?.order ||
    response?.data?.data?.order ||
    response?.data;

  const getCartItemProductId = (item = {}) => {
    const product = item.productId || item.product || item.id || item._id;
    return typeof product === 'object' ? product.id || product._id : product;
  };

  const getSellerHub = (item = {}) => (
    item.pickupAddress?.town ||
    item.pickupAddress?.city ||
    item.locationHub ||
    item.seller?.locationHub ||
    item.seller?.city ||
    item.seller?.address ||
    ''
  );

  const estimateItemWeightKg = (item = {}) => {
    const quantity = Number(item.quantity || 1);
    const unit = String(item.unit || '').toLowerCase();
    const explicitWeight = Number(item.weightKg || item.metadata?.weightKg || 0);
    if (explicitWeight > 0) return Math.max(1, explicitWeight * quantity);
    if (unit === 'g') return Math.max(1, quantity / 1000);
    if (unit === 'ton') return Math.max(1, quantity * 1000);
    return Math.max(1, quantity);
  };

  const estimateLogisticsForItem = (item = {}) => {
    const destination = shippingAddress.gpsLat && shippingAddress.gpsLng
      ? { lat: Number(shippingAddress.gpsLat), lng: Number(shippingAddress.gpsLng) }
      : shippingAddress.city || shippingAddress.state;
    const distanceKm = calculateDistanceKm(getSellerHub(item), destination);
    const weightKg = estimateItemWeightKg(item);
    const baseFee = 250;
    const ratePerKm = 45;
    const weightRate = 15;
    const minimumFee = 500;
    const fee = distanceKm
      ? Math.max(minimumFee, Math.ceil(baseFee + (distanceKm * ratePerKm) + (weightKg * weightRate)))
      : minimumFee;

    return {
      fee,
      distanceKm: distanceKm || 0,
      weightKg,
      estimated: !distanceKm,
    };
  };

  const selectedLogisticsProvider = useMemo(
    () => logisticsProviders.find((provider) => String(provider.id || provider._id) === String(selectedLogisticsProviderId)),
    [logisticsProviders, selectedLogisticsProviderId]
  );
  const selectedLogisticsDisplay = selectedLogisticsProvider ||
    (String(buyerLogisticsPreference?.selectedProviderId || buyerLogisticsPreference?.selectedProvider?.id || '') === String(selectedLogisticsProviderId)
      ? buyerLogisticsPreference?.selectedProvider
      : null);

  if (cartItems.length === 0) {
    navigate('/cart');
    return null;
  }

  const handleAddressChange = (e) => {
    setShippingAddress({
      ...shippingAddress,
      [e.target.name]: e.target.value,
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

    const paymentPhone = mpesaPhone.trim();
    if (!paymentPhone) {
      toast.error('Enter the buyer M-Pesa phone number');
      return;
    }

    if (!kenyaMpesaPhonePattern.test(paymentPhone)) {
      toast.error('Enter a valid M-Pesa number, for example 0712345678');
      return;
    }

    setLoading(true);

    try {
      const deliveryAddress = buildDeliveryAddress();
      const orderResponses = [];

      for (const item of cartItems) {
        const orderData = {
          product: getCartItemProductId(item),
          quantity: item.quantity,
          deliveryAddress,
          paymentMethod,
          logisticsProviderId: selectedLogisticsProviderId || undefined,
          logisticsPreference: {
            notes: selectedLogisticsDisplay
              ? `Buyer requested ${selectedLogisticsDisplay.name || selectedLogisticsDisplay.businessName || 'this logistics company'} at checkout.`
              : '',
          },
        };

        orderResponses.push(await api.post('/v1/orders', orderData));
      }

      toast.success('Order placed successfully! Complete payment before reviewing products.');
      const firstCreatedOrder = getCreatedOrder(orderResponses[0]);
      if (firstCreatedOrder?.totalAmount) {
        toast.success(`Escrow amount includes logistics: ${formatCurrency(firstCreatedOrder.totalAmount)}`);
      }

      const orderIds = orderResponses.map(getOrderId).filter(Boolean);
      const primaryOrderId = orderIds[0];
      const nextPath = primaryOrderId ? `/buyer/orders/${primaryOrderId}/track` : '/buyer/orders';

      await clearCart();

      const paymentRequests = [];
      let failedPaymentPrompts = 0;

      for (const orderId of orderIds) {
        try {
          const paymentResult = await paymentService.initiateMpesaPayment({
            orderId,
            phoneNumber: paymentPhone,
          });
          const checkoutRequestId =
            paymentResult?.checkoutRequestId ||
            paymentResult?.CheckoutRequestID ||
            paymentResult?.data?.checkoutRequestId ||
            paymentResult?.data?.CheckoutRequestID;
          paymentRequests.push({ orderId, checkoutRequestId });
        } catch (paymentError) {
          failedPaymentPrompts += 1;
          console.error('Unable to send payment prompt:', paymentError);
        }
      }

      const sentPromptCount = paymentRequests.filter((request) => request.checkoutRequestId).length;
      if (sentPromptCount > 0) {
        toast.success(sentPromptCount === 1 ? 'M-Pesa prompt sent to your phone' : `${sentPromptCount} M-Pesa prompts sent to your phone`);
      }

      if (failedPaymentPrompts > 0) {
        toast.error(`${failedPaymentPrompts} payment prompt${failedPaymentPrompts === 1 ? '' : 's'} could not be sent`);
      }

      const firstPaymentRequest = paymentRequests.find(
        (request) => request.orderId === primaryOrderId && request.checkoutRequestId
      );
      const nextPathWithPayment = firstPaymentRequest
        ? `${nextPath}?checkoutRequestId=${encodeURIComponent(firstPaymentRequest.checkoutRequestId)}`
        : nextPath;

      navigate(nextPathWithPayment);
    } catch (error) {
      const validationMessage = error.response?.data?.errors?.[0]?.msg;
      toast.error(validationMessage || error.response?.data?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const subtotal = getCartTotal();
  const logisticsQuotes = cartItems.map((item) => ({
    id: item.id || item._id || getCartItemProductId(item),
    ...estimateLogisticsForItem(item),
  }));
  const shipping = logisticsQuotes.reduce((sum, quote) => sum + quote.fee, 0);
  const total = subtotal + shipping;
  const estimatedDistanceKm = logisticsQuotes.reduce((sum, quote) => sum + Number(quote.distanceKm || 0), 0);

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="mb-4 flex items-center gap-2 text-[#F97316] transition-colors hover:text-[#FB923C]"
          >
            <FaArrowLeft size={14} />
            <span className="text-sm font-medium">Back to Cart</span>
          </button>
          <h1 className="mb-2 text-3xl font-bold text-[#F97316]">Checkout</h1>
          <p className="text-[#6B7280]">Lango Lako la Biashara Smart - Complete your order securely</p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmitOrder}>
              <div className="mb-6 rounded-xl border-l-4 border-[#F97316] bg-white p-6 shadow-md">
                <div className="mb-4 flex items-center gap-2">
                  <FaTruck className="text-xl text-[#F97316]" />
                  <h2 className="text-xl font-semibold text-[#111827]">Shipping Address</h2>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-[#111827]">
                    Full Name *
                    <input
                      type="text"
                      name="fullName"
                      value={shippingAddress.fullName}
                      onChange={handleAddressChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="John Doe"
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#111827]">
                    Phone Number *
                    <input
                      type="tel"
                      name="phone"
                      value={shippingAddress.phone}
                      onChange={handleAddressChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="+254 700 000000"
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#111827] md:col-span-2">
                    Address Line 1 *
                    <input
                      type="text"
                      name="addressLine1"
                      value={shippingAddress.addressLine1}
                      onChange={handleAddressChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="Street address, P.O. Box"
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#111827] md:col-span-2">
                    Address Line 2 (Optional)
                    <input
                      type="text"
                      name="addressLine2"
                      value={shippingAddress.addressLine2}
                      onChange={handleAddressChange}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FB923C]"
                      placeholder="Apartment, suite, unit, building, floor"
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#111827]">
                    City *
                    <input
                      type="text"
                      name="city"
                      value={shippingAddress.city}
                      onChange={handleAddressChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="Nairobi"
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#111827]">
                    County/State *
                    <input
                      type="text"
                      name="state"
                      value={shippingAddress.state}
                      onChange={handleAddressChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="Nairobi County"
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#111827]">
                    ZIP Code *
                    <input
                      type="text"
                      name="zipCode"
                      value={shippingAddress.zipCode}
                      onChange={handleAddressChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="00100"
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#111827]">
                    Country *
                    <input
                      type="text"
                      name="country"
                      value={shippingAddress.country}
                      onChange={handleAddressChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="Kenya"
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#111827]">
                    GPS Latitude (Optional)
                    <input
                      type="number"
                      step="0.000001"
                      name="gpsLat"
                      value={shippingAddress.gpsLat}
                      onChange={handleAddressChange}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="-1.292100"
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#111827]">
                    GPS Longitude (Optional)
                    <input
                      type="number"
                      step="0.000001"
                      name="gpsLng"
                      value={shippingAddress.gpsLng}
                      onChange={handleAddressChange}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="36.821900"
                    />
                  </label>
                </div>
              </div>

              <div className="mb-6 rounded-xl border-l-4 border-[#0EA5E9] bg-white p-6 shadow-md">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FaTruck className="text-xl text-[#0EA5E9]" />
                    <h2 className="text-xl font-semibold text-[#111827]">Logistics Company</h2>
                  </div>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    {providersLoading ? 'Loading' : `${logisticsProviders.length} verified`}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <label
                    className={`block cursor-pointer rounded-lg border p-4 transition ${
                      selectedLogisticsProviderId === ''
                        ? 'border-[#0EA5E9] bg-sky-50'
                        : 'border-gray-200 hover:border-sky-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="logisticsProvider"
                      value=""
                      checked={selectedLogisticsProviderId === ''}
                      onChange={() => setSelectedLogisticsProviderId('')}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#111827]">Let seller use their preferred logistics</p>
                        <p className="mt-1 text-sm text-gray-500">The seller can use their saved logistics company or the nearest verified driver.</p>
                      </div>
                      {selectedLogisticsProviderId === '' && <FaCheckCircle className="mt-1 shrink-0 text-[#0EA5E9]" />}
                    </div>
                  </label>

                  {logisticsProviders.map((provider) => {
                    const providerId = provider.id || provider._id;
                    const active = String(selectedLogisticsProviderId) === String(providerId);
                    return (
                      <label
                        key={providerId}
                        className={`block cursor-pointer rounded-lg border p-4 transition ${
                          active
                            ? 'border-[#0EA5E9] bg-sky-50'
                            : 'border-gray-200 hover:border-sky-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="logisticsProvider"
                          value={providerId}
                          checked={active}
                          onChange={() => setSelectedLogisticsProviderId(providerId)}
                          className="sr-only"
                        />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#111827]">{provider.name || provider.businessName || 'Verified logistics company'}</p>
                            <p className="mt-1 text-sm text-gray-500">
                              {[provider.hub, provider.vehicleType, provider.vehiclePlate].filter(Boolean).join(' - ') || 'Verified logistics provider'}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-green-50 px-2 py-1 font-semibold text-green-700">Verified</span>
                              {provider.isOnline && <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">Online</span>}
                              {provider.distanceKm !== null && provider.distanceKm !== undefined && (
                                <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-600">{provider.distanceKm} km away</span>
                              )}
                            </div>
                          </div>
                          {active && <FaCheckCircle className="mt-1 shrink-0 text-[#0EA5E9]" />}
                        </div>
                      </label>
                    );
                  })}

                  {selectedLogisticsDisplay && !selectedLogisticsProvider && selectedLogisticsProviderId && (
                    <label className="block cursor-pointer rounded-lg border border-[#0EA5E9] bg-sky-50 p-4 transition">
                      <input
                        type="radio"
                        name="logisticsProvider"
                        value={selectedLogisticsProviderId}
                        checked
                        onChange={() => setSelectedLogisticsProviderId(selectedLogisticsProviderId)}
                        className="sr-only"
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#111827]">{selectedLogisticsDisplay.name || 'Saved verified logistics company'}</p>
                          <p className="mt-1 text-sm text-gray-500">{selectedLogisticsDisplay.hub || 'Saved from buyer logistics preference'}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-green-50 px-2 py-1 font-semibold text-green-700">Saved choice</span>
                          </div>
                        </div>
                        <FaCheckCircle className="mt-1 shrink-0 text-[#0EA5E9]" />
                      </div>
                    </label>
                  )}

                  {!providersLoading && logisticsProviders.length === 0 && (
                    <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
                      No verified logistics companies are available now. The seller can still create shipment with their default logistics option.
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-6 rounded-xl border-l-4 border-[#16A34A] bg-white p-6 shadow-md">
                <div className="mb-4 flex items-center gap-2">
                  <FaLock className="text-xl text-[#16A34A]" />
                  <h2 className="text-xl font-semibold text-[#111827]">Payment Method</h2>
                </div>
                <div className="rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/5 p-4">
                  <p className="font-semibold text-[#111827]">M-Pesa</p>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    Pay securely via M-Pesa STK Push. A prompt will be sent to your phone number.
                  </p>
                  <label className="mt-4 block text-sm font-medium text-[#111827]">
                    M-Pesa Phone Number *
                    <input
                      type="tel"
                      value={mpesaPhone}
                      onChange={(event) => setMpesaPhone(event.target.value)}
                      required
                      inputMode="tel"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                      placeholder="0712345678"
                    />
                  </label>
                  <p className="mt-2 text-xs text-[#166534]">
                    Enter the buyer number that should receive the STK Push.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#F97316] py-3 text-lg font-semibold text-white shadow-md transition-colors hover:bg-[#F97316]/90 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Processing...
                  </span>
                ) : (
                  'Place Order - M-Pesa includes logistics'
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-xl bg-white p-6 shadow-md">
              <h2 className="mb-4 text-xl font-bold text-[#111827]">Order Summary</h2>

              <div className="mb-4 max-h-64 space-y-3 overflow-y-auto">
                {cartItems.map((item) => {
                  const minOrderQty = item.minOrderQuantity || getMinimumOrderQuantity(item);
                  const itemId = item.id || item._id;

                  return (
                    <div key={itemId} className="flex justify-between border-b border-gray-100 py-2 text-sm">
                      <div className="flex-1">
                        <span className="font-medium text-[#111827]">{item.name}</span>
                        <span className="ml-1 text-xs text-[#6B7280]">x{item.quantity}</span>
                        {minOrderQty > 1 && (
                          <div className="mt-1 text-[11px] text-orange-700">
                            {MQQ_TIERS[0].label}: {MQQ_TIERS[0].range} | {MQQ_TIERS[1].label}: {MQQ_TIERS[1].range}
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-[#F97316]">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 border-t border-gray-200 pt-4">
                <div className="flex justify-between text-[#6B7280]">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#6B7280]">
                  <span>Calculated logistics</span>
                  <span>{formatCurrency(shipping)}</span>
                </div>
                <div className="flex justify-between gap-4 text-[#6B7280]">
                  <span>Logistics company</span>
                  <span className="text-right font-medium text-[#111827]">
                    {selectedLogisticsProvider
                      ? selectedLogisticsProvider.name || selectedLogisticsProvider.businessName || 'Selected provider'
                      : selectedLogisticsDisplay
                        ? selectedLogisticsDisplay.name || 'Selected provider'
                      : 'Seller preferred'}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-[#6B7280]">
                  <span>{estimatedDistanceKm ? `${estimatedDistanceKm.toFixed(1)} km estimated route` : 'Minimum fee until GPS/hub route is known'}</span>
                  <span>Held in escrow</span>
                </div>
                <div className="mt-2 border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total to pay</span>
                    <span className="text-[#F97316]">{formatCurrency(total)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Buyer payment holds product and logistics money in escrow until delivery QR confirmation.
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-[#6B7280]">
                  <FaShieldAlt className="text-[#16A34A]" />
                  <span>Secure checkout with 256-bit encryption</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                  <FaTruck className="text-[#F97316]" />
                  <span>Track your order in real-time</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
