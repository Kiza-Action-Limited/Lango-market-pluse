import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBox,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaPhone,
  FaSpinner,
  FaTruck,
} from 'react-icons/fa';
import { logisticsService } from '../services/logisticsService';
import { formatCurrency } from '../utils/formatters';

const formatStatus = (status) => String(status || 'pending').replace(/_/g, ' ');

const SellerLogisticsRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const rows = await logisticsService.getSellerBuyerRequests({ limit: 50 });
      setRequests(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-screen-xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase text-[#F97316]">Buyer logistics requests</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950">Transport companies chosen by buyers</h2>
              <p className="mt-2 text-sm text-gray-600">
                Use these requests to start shipment with the verified logistics company selected by the buyer.
              </p>
            </div>
            <button
              type="button"
              onClick={loadRequests}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? <FaSpinner className="animate-spin" /> : <FaTruck />}
              Refresh
            </button>
          </div>
        </section>

        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 rounded-lg border border-gray-100 bg-white skeleton-shimmer" />
            ))}
          </div>
        ) : requests.length ? (
          <div className="grid gap-4">
            {requests.map((request) => (
              <article key={request.id || request.orderId} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Buyer selected</span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700">{formatStatus(request.status)}</span>
                      {request.shipmentCreated && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          <FaCheckCircle />
                          Shipment created
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-gray-950">
                      {request.logisticsProvider?.name || 'Verified logistics company'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">{request.message}</p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-2"><FaBox className="text-[#F97316]" /> {request.product?.name || 'Order item'} x{request.quantity || 1}</span>
                      <span className="inline-flex items-center gap-2"><FaMapMarkerAlt className="text-[#F97316]" /> {[request.destination?.town, request.destination?.county].filter(Boolean).join(', ') || 'Buyer location'}</span>
                      {request.logisticsProvider?.phone && (
                        <span className="inline-flex items-center gap-2"><FaPhone className="text-[#F97316]" /> {request.logisticsProvider.phone}</span>
                      )}
                    </div>
                    {request.note && <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">{request.note}</p>}
                  </div>

                  <div className="shrink-0 text-left lg:text-right">
                    <p className="font-mono text-sm font-semibold text-[#F97316]">#{String(request.orderNumber || request.orderId).slice(-8)}</p>
                    <p className="mt-1 text-sm font-semibold text-green-700">{formatCurrency(request.totalAmount || 0)}</p>
                    <p className="mt-1 text-xs text-gray-500">{request.buyer?.name || 'Buyer'}</p>
                    <Link
                      to="/seller/orders"
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C]"
                    >
                      <FaTruck />
                      Open shipment
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
            <FaTruck className="mx-auto text-4xl text-[#F97316]" />
            <h3 className="mt-3 font-semibold text-gray-950">No buyer logistics requests yet</h3>
            <p className="mt-1 text-sm text-gray-500">When buyers choose a verified logistics company, the request appears here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerLogisticsRequests;
