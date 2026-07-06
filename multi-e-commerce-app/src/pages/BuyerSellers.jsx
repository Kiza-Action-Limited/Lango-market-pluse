import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBoxOpen, FaEnvelopeOpenText, FaSearch, FaStore, FaTruck } from 'react-icons/fa';
import { orderService } from '../services/orderService';
import { formatCurrency, formatDate } from '../utils/formatters';

const getSellerName = (seller = {}) => seller.businessName || seller.fullName || seller.name || 'Seller';

const BuyerSellers = () => {
  const [sellers, setSellers] = useState([]);
  const [summary, setSummary] = useState({ sellers: 0, activeOrders: 0, deliveredOrders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSellers = async () => {
      try {
        const response = await orderService.getBuyerSellers();
        setSellers(Array.isArray(response.data) ? response.data : []);
        setSummary(response.summary || { sellers: 0, activeOrders: 0, deliveredOrders: 0 });
      } catch (error) {
        console.error('Error loading buyer sellers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSellers();
  }, []);

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#F97316]">Buyer sellers</p>
              <h2 className="mt-1 text-2xl font-bold text-gray-950">My Sellers</h2>
              <p className="mt-2 text-sm text-gray-600">Sellers you have ordered from, with delivery and spending history.</p>
            </div>
            <Link to="/products" className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C]">
              <FaSearch /> Find more sellers
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Sellers</p>
            <p className="mt-2 text-2xl font-bold text-gray-950">{summary.sellers}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Active orders</p>
            <p className="mt-2 text-2xl font-bold text-[#0B2D55]">{summary.activeOrders}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Delivered orders</p>
            <p className="mt-2 text-2xl font-bold text-green-700">{summary.deliveredOrders}</p>
          </div>
        </section>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-52 rounded-lg border border-gray-100 bg-white skeleton-shimmer" />
            ))}
          </div>
        ) : sellers.length ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sellers.map((item) => {
              const seller = item.seller || {};
              const sellerName = getSellerName(seller);
              return (
                <article key={item.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    {seller.businessLogoUrl ? (
                      <img src={seller.businessLogoUrl} alt={sellerName} className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#FFF7ED] text-[#F97316]">
                        <FaStore />
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-gray-950">{sellerName}</h3>
                      <p className="text-sm capitalize text-gray-500">{seller.businessType || seller.role || 'seller'}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Orders</p>
                      <p className="font-bold text-gray-950">{item.orderCount}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Spent</p>
                      <p className="font-bold text-green-700">{formatCurrency(item.totalSpent)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Active</p>
                      <p className="font-bold text-[#0B2D55]">{item.activeOrders}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Last order</p>
                      <p className="font-bold text-gray-950">{formatDate(item.lastOrderAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link to={`/products?seller=${item.id}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                      <FaBoxOpen /> Products
                    </Link>
                    <Link to="/buyer/support" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0B2D55] px-3 py-2 text-sm font-semibold text-white hover:bg-[#123B6D]">
                      <FaEnvelopeOpenText /> Message
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <FaTruck className="mx-auto text-3xl text-[#F97316]" />
            <h3 className="mt-3 font-semibold text-gray-950">No sellers yet</h3>
            <p className="mt-1 text-sm text-gray-500">Your sellers appear here after your first order.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerSellers;
