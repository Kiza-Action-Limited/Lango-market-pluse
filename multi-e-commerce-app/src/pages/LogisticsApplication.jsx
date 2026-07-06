import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate } from 'react-router-dom';
import { FaCheckCircle, FaClock, FaFileAlt, FaLocationArrow, FaTimes, FaTimesCircle, FaTruck, FaUpload } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { logisticsService } from '../services/logisticsService';

const statusCopy = {
  verified: {
    icon: FaCheckCircle,
    tone: 'border-green-200 bg-green-50 text-green-800',
    title: 'Approved logistics account',
    body: 'Your dashboard is active. You can accept delivery work and complete QR handoffs.',
  },
  pending: {
    icon: FaClock,
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
    title: 'Application awaiting admin review',
    body: 'Admin is checking your documents, vehicle details, and GPS hub.',
  },
  rejected: {
    icon: FaTimesCircle,
    tone: 'border-red-200 bg-red-50 text-red-800',
    title: 'Application needs changes',
    body: 'Update your details and resubmit the required documents.',
  },
};

const LogisticsApplication = () => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState(null);
  const [rejectionMessage, setRejectionMessage] = useState(null);
  const [previousStatus, setPreviousStatus] = useState(null);
  const [form, setForm] = useState({
    businessName: user?.businessName || user?.fullName || '',
    driverMode: 'owner_operator',
    baseHub: user?.locationHub || user?.city || '',
    operatingAddress: user?.address || '',
    serviceAreas: '',
    vehicleType: '',
    fleetSize: '1',
    vehiclePlate: '',
    cargoCapacityKg: '',
    documentType: 'national_id',
    documentNumber: '',
    fleetOwnerId: '',
    gpsLat: '',
    gpsLng: '',
  });
  const [nationalIdImage, setNationalIdImage] = useState(null);
  const [businessPermitImage, setBusinessPermitImage] = useState(null);
  const [driverLicenseImage, setDriverLicenseImage] = useState(null);
  const [vehicleLogbookImage, setVehicleLogbookImage] = useState(null);
  const [insuranceCertificateImage, setInsuranceCertificateImage] = useState(null);
  const [kraPinCertificateImage, setKraPinCertificateImage] = useState(null);
  const verificationStatus = application?.logisticsProfile?.verificationStatus || 'unverified';
  const role = String(user?.role || '').toLowerCase();

  // Initial load
  useEffect(() => {
    const load = async () => {
      try {
        const data = await logisticsService.getMyApplication();
        setApplication(data);
        setPreviousStatus(data?.logisticsProfile?.verificationStatus || 'unverified');
      } catch (error) {
        // ignore first-time empty state issues
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && role === 'logistics') {
      load();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, role]);

  // Monitor for rejection status changes and auto-refresh
  useEffect(() => {
    // Check if status changed to rejected
    const currentStatus = application?.logisticsProfile?.verificationStatus || 'unverified';
    
    if (previousStatus && currentStatus === 'rejected' && previousStatus !== 'rejected') {
      // New rejection detected!
      const rejectionNote = application?.logisticsProfile?.reviewNotes || 'Your application does not meet the requirements.';
      
      // Show rejection toast + message
      toast.error('Your application was rejected', { duration: 3000 });
      setRejectionMessage(rejectionNote);
      
      // Auto-dismiss rejection message after 3 seconds
      const dismissTimeout = setTimeout(() => {
        setRejectionMessage(null);
      }, 3000);
      
      // Reset form after dismissal
      const resetTimeout = setTimeout(() => {
        resetForm();
      }, 3000);
      
      return () => {
        clearTimeout(dismissTimeout);
        clearTimeout(resetTimeout);
      };
    }
    
    setPreviousStatus(currentStatus);
  }, [application?.logisticsProfile?.verificationStatus, previousStatus, application?.logisticsProfile?.reviewNotes]);

  // Periodic refresh to detect status changes (every 10 seconds)
  useEffect(() => {
    if (!isAuthenticated || role !== 'logistics') return;

    const interval = setInterval(async () => {
      try {
        const data = await logisticsService.getMyApplication();
        setApplication(data);
      } catch (error) {
        // silently ignore refresh errors
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isAuthenticated, role]);

  const resetForm = () => {
    setForm({
      businessName: user?.businessName || user?.fullName || '',
      driverMode: 'owner_operator',
      baseHub: user?.locationHub || user?.city || '',
      operatingAddress: user?.address || '',
      serviceAreas: '',
      vehicleType: '',
      fleetSize: '1',
      vehiclePlate: '',
      cargoCapacityKg: '',
      documentType: 'national_id',
      documentNumber: '',
      fleetOwnerId: '',
      gpsLat: '',
      gpsLng: '',
    });
    setNationalIdImage(null);
    setBusinessPermitImage(null);
    setDriverLicenseImage(null);
    setVehicleLogbookImage(null);
    setInsuranceCertificateImage(null);
    setKraPinCertificateImage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nationalIdImage || !businessPermitImage) {
      toast.error('Upload National ID and permit/logbook documents before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('driverMode', form.driverMode);
      payload.append('businessName', form.businessName.trim());
      payload.append('baseHub', form.baseHub.trim());
      payload.append('locationHub', form.baseHub.trim());
      payload.append('operatingAddress', form.operatingAddress.trim());
      payload.append('serviceAreas', form.serviceAreas.trim());
      payload.append('vehicleType', form.vehicleType.trim());
      payload.append('fleetSize', String(form.fleetSize || 1));
      payload.append('vehiclePlate', form.vehiclePlate.trim().toUpperCase());
      payload.append('cargoCapacityKg', String(form.cargoCapacityKg));
      payload.append('documentType', form.documentType);
      payload.append('documentNumber', form.documentNumber.trim());
      if (form.driverMode === 'hired_driver' && form.fleetOwnerId.trim()) {
        payload.append('fleetOwnerId', form.fleetOwnerId.trim());
      }
      if (form.gpsLat && form.gpsLng) {
        payload.append('gpsLat', form.gpsLat);
        payload.append('gpsLng', form.gpsLng);
      }
      if (nationalIdImage) payload.append('nationalIdImage', nationalIdImage);
      if (businessPermitImage) payload.append('businessPermitImage', businessPermitImage);
      if (driverLicenseImage) payload.append('driverLicenseImage', driverLicenseImage);
      if (vehicleLogbookImage) payload.append('vehicleLogbookImage', vehicleLogbookImage);
      if (insuranceCertificateImage) payload.append('insuranceCertificateImage', insuranceCertificateImage);
      if (kraPinCertificateImage) payload.append('kraPinCertificateImage', kraPinCertificateImage);

      await logisticsService.applyAsLogistics(payload);
      toast.success('Application submitted successfully. Admin will review shortly.');

      const latest = await logisticsService.getMyApplication();
      setApplication(latest);
      setPreviousStatus(latest?.logisticsProfile?.verificationStatus || 'unverified');
      resetForm();
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to submit logistics application';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const captureGpsLocation = () => {
    if (!navigator.geolocation) {
      toast.error('GPS is not supported by this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          gpsLat: String(position.coords.latitude),
          gpsLng: String(position.coords.longitude),
        }));
        toast.success('GPS location captured');
      },
      (error) => toast.error(error.message || 'Unable to capture GPS location'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
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

  if (role !== 'logistics') {
    return <Navigate to={role === 'seller' ? '/seller' : '/'} replace />;
  }

  if (loading) {
    return <div className="min-h-screen bg-[#F9FAFB] p-8">Loading logistics application...</div>;
  }

  const savedDocuments = Array.isArray(application?.logisticsProfile?.documents)
    ? application.logisticsProfile.documents
    : [];
  const currentStatus = statusCopy[verificationStatus] || {
    icon: FaClock,
    tone: 'border-gray-200 bg-white text-gray-800',
    title: 'Start logistics verification',
    body: 'Submit your company, vehicle, location, and compliance documents for admin approval.',
  };
  const StatusIcon = currentStatus.icon;
  const profile = application?.logisticsProfile || {};

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {rejectionMessage && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <FaTimesCircle className="mt-0.5 shrink-0 text-lg text-red-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Application Rejected</h3>
                <p className="mt-1 text-sm text-red-800">{rejectionMessage}</p>
                <p className="mt-2 text-xs text-red-700">This message will dismiss automatically. You can resubmit your application with updated information.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectionMessage(null);
                  resetForm();
                }}
                className="shrink-0 text-red-600 hover:text-red-800 transition"
                aria-label="Close rejection message"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>
          </div>
        )}
        
        <div className={`rounded-lg border p-5 ${currentStatus.tone}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <StatusIcon className="mt-1 shrink-0 text-xl" />
              <div>
                <h1 className="text-2xl font-bold text-[#111827]">Logistics Application</h1>
                <p className="mt-1 font-semibold">{currentStatus.title}</p>
                <p className="mt-1 text-sm opacity-90">{currentStatus.body}</p>
              </div>
            </div>
            <span className="rounded-full border border-current px-3 py-1 text-xs font-bold uppercase">
              {verificationStatus.replace(/_/g, ' ')}
            </span>
          </div>
          {profile.reviewNotes ? (
            <p className="mt-3 rounded-md bg-white/70 px-3 py-2 text-sm">
              Admin note: {profile.reviewNotes}
            </p>
          ) : null}
        </div>

        {savedDocuments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                  <FaFileAlt className="text-[#F97316]" /> Saved Documents
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {savedDocuments.map((doc, index) => (
                    <a
                      key={`${doc.publicId || doc.url || index}`}
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#2563EB] hover:bg-gray-50"
                    >
                      <span className="block font-semibold capitalize">{String(doc.documentType || 'document').replace(/_/g, ' ')}</span>
                      <span className="block truncate text-xs text-gray-500">{doc.originalName || doc.mimeType || `Document ${index + 1}`}</span>
                    </a>
                  ))}
                </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Business and Vehicle Details</h2>
            <p className="mt-1 text-sm text-gray-500">These details appear in admin review and seller provider selection.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm text-[#111827]">
              Business / Driver Name
              <input
                value={form.businessName}
                onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Mizigo Transport Ltd"
                required
              />
            </label>

            <label className="text-sm text-[#111827]">
              Base Hub
              <input
                value={form.baseHub}
                onChange={(e) => setForm((prev) => ({ ...prev, baseHub: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Kitale"
                required
              />
            </label>

            <label className="text-sm text-[#111827] md:col-span-2">
              Operating Address
              <input
                value={form.operatingAddress}
                onChange={(e) => setForm((prev) => ({ ...prev, operatingAddress: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Yard, street, or loading point"
              />
            </label>

            <label className="text-sm text-[#111827] md:col-span-2">
              Service Areas
              <input
                value={form.serviceAreas}
                onChange={(e) => setForm((prev) => ({ ...prev, serviceAreas: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Kakuma, Lodwar, Kitale"
              />
            </label>

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
              Vehicle Type
              <input
                value={form.vehicleType}
                onChange={(e) => setForm((prev) => ({ ...prev, vehicleType: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Pickup, truck, van"
              />
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
              Fleet Size
              <input
                type="number"
                min="1"
                value={form.fleetSize}
                onChange={(e) => setForm((prev) => ({ ...prev, fleetSize: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
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
                <option value="driver_license">Driver License</option>
                <option value="vehicle_logbook">Vehicle Logbook</option>
                <option value="insurance_certificate">Insurance Certificate</option>
                <option value="kra_pin_certificate">KRA PIN Certificate</option>
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

            <div className="md:col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">GPS Hub Location</p>
                  <p className="text-xs text-[#6B7280]">Save your real-world logistics location for nearby seller assignments and map tracking.</p>
                </div>
                <button
                  type="button"
                  onClick={captureGpsLocation}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-[#374151]"
                >
                  <FaLocationArrow /> Capture GPS
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  step="any"
                  value={form.gpsLat}
                  onChange={(e) => setForm((prev) => ({ ...prev, gpsLat: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Latitude"
                />
                <input
                  type="number"
                  step="any"
                  value={form.gpsLng}
                  onChange={(e) => setForm((prev) => ({ ...prev, gpsLng: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Longitude"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-5">
            <h2 className="text-lg font-semibold text-[#111827]">Documents</h2>
            <p className="mt-1 text-sm text-gray-500">National ID and permit/logbook are required. Extra documents help admin approve faster.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-sm text-[#111827]">
              National ID File *
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setNationalIdImage(e.target.files?.[0] || null)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </label>

            <label className="text-sm text-[#111827]">
              Permit / Logbook File *
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setBusinessPermitImage(e.target.files?.[0] || null)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </label>

            <label className="text-sm text-[#111827]">
              Driver License
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setDriverLicenseImage(e.target.files?.[0] || null)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </label>

            <label className="text-sm text-[#111827]">
              Vehicle Logbook
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setVehicleLogbookImage(e.target.files?.[0] || null)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </label>

            <label className="text-sm text-[#111827]">
              Insurance Certificate
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setInsuranceCertificateImage(e.target.files?.[0] || null)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </label>

            <label className="text-sm text-[#111827]">
              KRA PIN Certificate
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setKraPinCertificateImage(e.target.files?.[0] || null)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || verificationStatus === 'pending' || verificationStatus === 'verified'}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F97316] text-white font-semibold hover:bg-[#EA580C] disabled:opacity-60"
          >
            <FaUpload />
            {submitting ? 'Submitting...' : verificationStatus === 'verified' ? 'Approved' : verificationStatus === 'pending' ? 'Awaiting Review' : 'Submit Application'}
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
