import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaCheckCircle,
  FaMapMarkerAlt,
  FaPhone,
  FaSave,
  FaSpinner,
  FaTimesCircle,
  FaTruck,
} from 'react-icons/fa';
import { logisticsService } from '../services/logisticsService';

const getProviderId = (provider) => provider?.id || provider?._id;

const getProviderName = (provider = {}) => (
  provider.name ||
  provider.businessName ||
  provider.fullName ||
  'Verified logistics company'
);

const BuyerLogisticsPreference = () => {
  const [providers, setProviders] = useState([]);
  const [preference, setPreference] = useState(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [deliveryHub, setDeliveryHub] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [providerRows, savedPreference] = await Promise.all([
          logisticsService.getVerifiedProviders({ limit: 100 }),
          logisticsService.getBuyerPreference().catch(() => null),
        ]);
        const nextProviders = Array.isArray(providerRows) ? providerRows : [];
        setProviders(nextProviders);
        setPreference(savedPreference);
        setSelectedProviderId(savedPreference?.selectedProviderId || savedPreference?.selectedProvider?.id || '');
        setDeliveryHub(savedPreference?.deliveryHub || '');
        setNotes(savedPreference?.notes || '');
      } catch (error) {
        toast.error(error.response?.data?.message || 'Unable to load verified logistics companies');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((provider) => String(getProviderId(provider)) === String(selectedProviderId)),
    [providers, selectedProviderId]
  );

  const savePreference = async () => {
    if (!selectedProviderId) {
      toast.error('Choose a verified logistics company first');
      return;
    }

    setSaving(true);
    try {
      const saved = await logisticsService.updateBuyerPreference({
        active: true,
        logisticsProviderId: selectedProviderId,
        deliveryHub,
        notes,
      });
      setPreference(saved);
      toast.success('Logistics choice saved and will be sent to sellers');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save logistics choice');
    } finally {
      setSaving(false);
    }
  };

  const clearPreference = async () => {
    setSaving(true);
    try {
      const saved = await logisticsService.updateBuyerPreference({ active: false });
      setPreference(saved);
      setSelectedProviderId('');
      setDeliveryHub('');
      setNotes('');
      toast.success('Buyer logistics choice cleared');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to clear logistics choice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-screen-xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase text-[#F97316]">Verified logistics</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950">Choose your transport company</h2>
              <p className="mt-2 text-sm text-gray-600">
                Your saved verified company is attached to new checkout orders and shown to the seller as the buyer requested transport.
              </p>
            </div>
            <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <p className="font-semibold">{preference?.active ? 'Preference active' : 'No active preference'}</p>
              <p className="mt-1 text-xs text-sky-700">
                {preference?.active ? getProviderName(preference.selectedProvider || preference.selectedProviderSnapshot) : 'Seller preferred logistics will be used.'}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h3 className="font-semibold text-gray-950">Available verified companies</h3>
              <p className="mt-1 text-sm text-gray-500">Choose the company you want sellers to use when moving your products.</p>
            </div>

            {loading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-24 rounded-lg bg-gray-100 skeleton-shimmer" />
                ))}
              </div>
            ) : providers.length ? (
              <div className="divide-y divide-gray-100">
                {providers.map((provider) => {
                  const providerId = getProviderId(provider);
                  const active = String(providerId) === String(selectedProviderId);

                  return (
                    <label
                      key={providerId}
                      className={`block cursor-pointer px-5 py-4 transition ${active ? 'bg-sky-50' : 'hover:bg-gray-50'}`}
                    >
                      <input
                        type="radio"
                        name="buyerLogisticsProvider"
                        value={providerId}
                        checked={active}
                        onChange={() => setSelectedProviderId(providerId)}
                        className="sr-only"
                      />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-gray-950">{getProviderName(provider)}</p>
                            <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">Verified</span>
                            {provider.isOnline && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Online</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                            <span className="inline-flex items-center gap-1"><FaMapMarkerAlt className="text-[#F97316]" /> {provider.hub || 'Hub not set'}</span>
                            {provider.phone && <span className="inline-flex items-center gap-1"><FaPhone className="text-[#F97316]" /> {provider.phone}</span>}
                            {provider.vehicleType && <span className="inline-flex items-center gap-1"><FaTruck className="text-[#F97316]" /> {provider.vehicleType}</span>}
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            {[provider.vehiclePlate, provider.cargoCapacityKg ? `${provider.cargoCapacityKg} kg capacity` : '', provider.distanceKm !== null && provider.distanceKm !== undefined ? `${provider.distanceKm} km away` : ''].filter(Boolean).join(' - ')}
                          </p>
                        </div>
                        {active && <FaCheckCircle className="text-xl text-[#0EA5E9]" />}
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <FaTruck className="mx-auto text-3xl text-[#F97316]" />
                <h3 className="mt-3 font-semibold text-gray-950">No verified logistics companies yet</h3>
                <p className="mt-1 text-sm text-gray-500">Verified providers will appear here after admin approval.</p>
              </div>
            )}
          </div>

          <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-950">Seller request</h3>
            <p className="mt-1 text-sm text-gray-500">This message is attached to new orders so the seller can start transport with your chosen company.</p>

            <label className="mt-5 block text-sm font-medium text-gray-800">
              Buyer delivery hub
              <input
                type="text"
                value={deliveryHub}
                onChange={(event) => setDeliveryHub(event.target.value)}
                placeholder="Example: Kakuma 1, Zone 3"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-gray-800">
              Note to seller
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                maxLength={300}
                placeholder="Please use this logistics company for transport to my location."
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </label>

            <div className="mt-5 rounded-md border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-950">{selectedProvider ? getProviderName(selectedProvider) : 'No company selected'}</p>
              <p className="mt-1 text-xs">{selectedProvider?.hub || 'Choose a verified company to activate this request.'}</p>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={savePreference}
                disabled={saving || !selectedProviderId}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                Save logistics choice
              </button>
              <button
                type="button"
                onClick={clearPreference}
                disabled={saving || !preference?.active}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaTimesCircle />
                Clear choice
              </button>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default BuyerLogisticsPreference;
