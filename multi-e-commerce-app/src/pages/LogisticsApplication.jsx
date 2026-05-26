import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FaCheckCircle, FaIdCard, FaTruck, FaUpload } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { logisticsService } from '../services/logisticsService';

const LogisticsApplication = () => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState(null);
  const [form, setForm] = useState({
    driverMode: 'owner_operator',
    vehiclePlate: '',
    cargoCapacityKg: '',
    documentType: 'national_id',
    documentNumber: '',
    fleetOwnerId: '',
  });
  const [nationalIdImage, setNationalIdImage] = useState(null);
  const [businessPermitImage, setBusinessPermitImage] = useState(null);
  const flowSteps = [
    'Register',
    'Apply as Logistics',
    'Upload Documents',
    'Admin Verification',
    'Approval',
    'Can Accept Orders',
    'QR Pickup + Delivery',
    'Escrow Release',
  ];

  const verificationStatus = application?.logisticsProfile?.verificationStatus || 'unverified';

  useEffect(() => {
    const load = async () => {
      try {
        const data = await logisticsService.getMyApplication();
        setApplication(data);
      } catch (error) {
        // ignore first-time empty state issues
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      load();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const statusLabel = useMemo(() => {
    if (verificationStatus === 'pending') return 'Pending Admin Verification';
    if (verificationStatus === 'verified') return 'Approved';
    if (verificationStatus === 'rejected') return 'Rejected';
    return 'Not Applied';
  }, [verificationStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nationalIdImage && !businessPermitImage) {
      toast.error('Upload at least one document image/PDF before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('driverMode', form.driverMode);
      payload.append('vehiclePlate', form.vehiclePlate.trim().toUpperCase());
      payload.append('cargoCapacityKg', String(form.cargoCapacityKg));
      payload.append('documentType', form.documentType);
      payload.append('documentNumber', form.documentNumber.trim());
      if (form.driverMode === 'hired_driver' && form.fleetOwnerId.trim()) {
        payload.append('fleetOwnerId', form.fleetOwnerId.trim());
      }
      if (nationalIdImage) payload.append('nationalIdImage', nationalIdImage);
      if (businessPermitImage) payload.append('businessPermitImage', businessPermitImage);

      await logisticsService.applyAsLogistics(payload);
      toast.success('Application submitted successfully. Admin will review shortly.');

      const latest = await logisticsService.getMyApplication();
      setApplication(latest);
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to submit logistics application';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] py-10 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-[#111827]">Please sign in first to apply as a logistics provider.</p>
          <Link to="/login" className="inline-block mt-4 px-4 py-2 bg-[#F97316] text-white rounded-lg">Sign In</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-[#F9FAFB] p-8">Loading logistics application...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-[#111827]">Apply as Logistics</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Register your truck details, upload verification documents, and wait for admin approval.
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            {flowSteps.map((step, idx) => (
              <div key={step} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {idx + 1}. {step}
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 rounded-lg bg-[#F9FAFB] border border-gray-200">
            <p className="text-sm text-[#6B7280]">Current Status</p>
            <p className="text-lg font-semibold text-[#111827]">{statusLabel}</p>
            {verificationStatus === 'verified' && (
              <p className="text-sm text-green-700 mt-1 inline-flex items-center gap-2">
                <FaCheckCircle /> You can now accept logistics orders.
              </p>
            )}
            {verificationStatus === 'rejected' && (
              <p className="text-sm text-red-700 mt-1">
                {application?.logisticsProfile?.reviewNotes || 'Application was rejected. Update and re-submit.'}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm text-[#111827]">
              Driver Mode
              <select
                value={form.driverMode}
                onChange={(e) => setForm((prev) => ({ ...prev, driverMode: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="owner_operator">Owner Operator</option>
                <option value="hired_driver">Hired Driver</option>
              </select>
            </label>

            <label className="text-sm text-[#111827]">
              Vehicle Plate
              <input
                value={form.vehiclePlate}
                onChange={(e) => setForm((prev) => ({ ...prev, vehiclePlate: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="KCA 123X"
                required
              />
            </label>

            <label className="text-sm text-[#111827]">
              Cargo Capacity (kg)
              <input
                type="number"
                min="1"
                value={form.cargoCapacityKg}
                onChange={(e) => setForm((prev) => ({ ...prev, cargoCapacityKg: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </label>

            <label className="text-sm text-[#111827]">
              Primary Document Type
              <select
                value={form.documentType}
                onChange={(e) => setForm((prev) => ({ ...prev, documentType: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="national_id">National ID</option>
                <option value="business_permit">Business Permit</option>
              </select>
            </label>

            <label className="text-sm text-[#111827] md:col-span-2">
              Document Number
              <input
                value={form.documentNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, documentNumber: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </label>

            {form.driverMode === 'hired_driver' && (
              <label className="text-sm text-[#111827] md:col-span-2">
                Fleet Owner User ID (optional if known)
                <input
                  value={form.fleetOwnerId}
                  onChange={(e) => setForm((prev) => ({ ...prev, fleetOwnerId: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Mongo User ID"
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm text-[#111827]">
              National ID File (image/pdf)
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setNationalIdImage(e.target.files?.[0] || null)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </label>

            <label className="text-sm text-[#111827]">
              Business Permit File (image/pdf)
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setBusinessPermitImage(e.target.files?.[0] || null)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || verificationStatus === 'pending'}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F97316] text-white font-semibold hover:bg-[#EA580C] disabled:opacity-60"
          >
            <FaUpload />
            {submitting ? 'Submitting...' : verificationStatus === 'pending' ? 'Awaiting Review' : 'Submit Application'}
          </button>
        </form>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#111827] inline-flex items-center gap-2"><FaTruck /> Next Step</h2>
          <p className="text-sm text-[#6B7280] mt-2">
            After approval, go to Logistics Status to accept jobs and complete QR pickup.
          </p>
          <Link to="/logistics/status" className="inline-block mt-3 text-[#F97316] font-medium hover:text-[#EA580C]">
            Open Logistics Status
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LogisticsApplication;
