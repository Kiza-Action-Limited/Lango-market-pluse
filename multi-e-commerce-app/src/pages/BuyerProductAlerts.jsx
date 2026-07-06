import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBell, FaBoxOpen, FaSearch, FaStore } from 'react-icons/fa';
import { notificationService } from '../services/notificationService';
import { productService } from '../services/productService';
import { formatCurrency, formatDateTime } from '../utils/formatters';

const getProductImage = (product = {}) => {
  const image = product.images?.[0];
  if (!image) return 'https://via.placeholder.com/96';
  return typeof image === 'string' ? image : image.url || 'https://via.placeholder.com/96';
};

const BuyerProductAlerts = () => {
  const [notifications, setNotifications] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const [notificationResponse, productsResponse] = await Promise.all([
          notificationService.getNotifications(),
          productService.getAll({ sortBy: 'newest', limit: 8 }),
        ]);
        setNotifications(Array.isArray(notificationResponse.notifications) ? notificationResponse.notifications : []);
        setProducts(productsResponse.products || productsResponse.data || []);
      } catch (error) {
        console.error('Error loading buyer product alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, []);

  const productAlerts = useMemo(() => (
    notifications.filter((notification) => (notification.channel || notification.type) === 'new_product')
  ), [notifications]);

  const alertCount = productAlerts.length;

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#F97316]">Buyer alerts</p>
              <h2 className="mt-1 text-2xl font-bold text-gray-950">Product Alerts</h2>
              <p className="mt-2 text-sm text-gray-600">New seller products and platform messages for faster buying decisions.</p>
            </div>
            <Link to="/buyer/notifications/preferences" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
              <FaBell /> Alert settings
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Total alerts</p>
            <p className="mt-2 text-2xl font-bold text-gray-950">{alertCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">New products</p>
            <p className="mt-2 text-2xl font-bold text-[#F97316]">{products.length}</p>
          </div>
        </section>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-56 rounded-lg border border-gray-100 bg-white skeleton-shimmer" />
            ))}
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div>
                  <h3 className="font-semibold text-gray-950">Recent alert messages</h3>
                  <p className="text-sm text-gray-500">New product and scarcity notifications</p>
                </div>
              </div>
              {productAlerts.length ? (
                <div className="divide-y divide-gray-100">
                  {productAlerts.slice(0, 8).map((alert) => (
                    <div key={alert.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-gray-950">{alert.title}</p>
                        <p className="mt-1 text-sm text-gray-600">{alert.message}</p>
                        <p className="mt-1 text-xs text-gray-400">{formatDateTime(alert.createdAt)}</p>
                      </div>
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                        {(alert.channel || alert.type || 'alert').replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-5 text-sm text-gray-500">No product alert messages yet.</p>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-gray-950">Newest seller products</h3>
                <Link to="/products" className="text-sm font-semibold text-[#F97316]">Browse all</Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {products.map((product) => (
                  <article key={product._id || product.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <img src={getProductImage(product)} alt={product.name} className="h-32 w-full rounded-lg object-cover" />
                    <h4 className="mt-3 truncate font-semibold text-gray-950">{product.name}</h4>
                    <p className="mt-1 flex items-center gap-2 truncate text-sm text-gray-500">
                      <FaStore className="text-[#F97316]" />
                      {product.seller?.businessName || product.seller?.fullName || product.seller?.name || 'Seller'}
                    </p>
                    <p className="mt-2 font-bold text-green-700">{formatCurrency(product.price || 0)}</p>
                    <Link to={`/products/${product._id || product.id}`} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#F97316] px-3 py-2 text-sm font-semibold text-white hover:bg-[#EA580C]">
                      <FaSearch /> View
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default BuyerProductAlerts;
