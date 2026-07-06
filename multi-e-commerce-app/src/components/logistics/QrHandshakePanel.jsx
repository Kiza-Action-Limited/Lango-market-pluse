import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaCamera,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaLocationArrow,
  FaQrcode,
  FaShieldAlt,
  FaStop,
  FaTimesCircle,
} from 'react-icons/fa';

const hasCoords = (coords) => Number.isFinite(Number(coords?.lat)) && Number.isFinite(Number(coords?.lng));

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : 'Pending');

const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return 'No expiry';
  const safe = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${safe}s`;
};

const normalizeToken = (token) => ({
  ...token,
  status: token?.status || (token?.isUsed ? 'used' : token?.expiresAt && new Date(token.expiresAt) <= new Date() ? 'expired' : 'active'),
});

const toneForStatus = (status) => {
  if (status === 'used') return 'border-green-200 bg-green-50 text-green-800';
  if (status === 'expired') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-orange-200 bg-orange-50 text-orange-800';
};

export const QrTokenStatus = ({ qrState, logistics, showImages = true }) => {
  const tokens = useMemo(() => (
    (qrState?.tokens || qrState?.availableTokens || []).map(normalizeToken)
  ), [qrState]);
  const scans = qrState?.scanAudit || logistics?.qrScans || [];
  const pickupDone = Boolean(qrState?.pickupQrConfirmed || logistics?.pickupQrConfirmed || scans.some((scan) => scan.step === 'pickup' && scan.verified !== false));
  const deliveryDone = Boolean(qrState?.deliveryQrConfirmed || logistics?.deliveryQrConfirmed || scans.some((scan) => scan.step === 'delivery' && scan.verified !== false));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className={`rounded-lg border p-3 ${pickupDone ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
          <p className="text-xs font-semibold uppercase text-gray-500">Pickup QR</p>
          <p className={`mt-1 text-sm font-semibold ${pickupDone ? 'text-green-800' : 'text-[#111827]'}`}>
            {pickupDone ? 'Confirmed' : 'Waiting for driver scan'}
          </p>
        </div>
        <div className={`rounded-lg border p-3 ${deliveryDone ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
          <p className="text-xs font-semibold uppercase text-gray-500">Delivery QR</p>
          <p className={`mt-1 text-sm font-semibold ${deliveryDone ? 'text-green-800' : 'text-[#111827]'}`}>
            {deliveryDone ? 'Confirmed' : 'Waiting for receiver scan'}
          </p>
        </div>
      </div>

      {tokens.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {tokens.map((token) => (
            <div key={token.id || `${token.type}-${token.token}`} className={`rounded-lg border p-3 ${toneForStatus(token.status)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase">{token.type} token</p>
                  <p className="mt-1 break-all font-mono text-xs text-[#111827]">{String(token.token || '').slice(0, 36)}...</p>
                  <p className="mt-2 flex items-center gap-2 text-xs">
                    <FaClock /> {token.status === 'active' ? `Expires in ${formatDuration(token.secondsUntilExpiry)}` : `${token.status} at ${formatDateTime(token.usedAt || token.expiresAt)}`}
                  </p>
                </div>
                {showImages && token.qrImage && (
                  <img src={token.qrImage} alt={`${token.type} QR`} className="h-20 w-20 shrink-0 rounded-md border border-white bg-white p-1" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const QrAuditTrail = ({ scans = [], title = 'QR scan audit trail' }) => {
  const sorted = [...(scans || [])].sort((a, b) => new Date(b.scannedAt || b.timestamp || 0) - new Date(a.scannedAt || a.timestamp || 0));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <FaShieldAlt className="text-[#16A34A]" />
        <p className="text-sm font-semibold text-[#111827]">{title}</p>
      </div>
      <div className="mt-3 space-y-2">
        {sorted.length ? sorted.map((scan) => {
          const scanner = scan.scannedBy?.name || scan.scannedBy?.fullName || scan.scannedBy?.phone || 'Authorized user';
          return (
            <div key={scan.id || scan._id || `${scan.step}-${scan.scannedAt}`} className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold capitalize text-[#111827]">{scan.step} scan</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${scan.verified === false ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {scan.verified === false ? <FaTimesCircle /> : <FaCheckCircle />}
                  {scan.verified === false ? 'Flagged' : 'Verified'}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">{formatDateTime(scan.scannedAt || scan.timestamp)} by {scanner}</p>
              <p className="mt-1 text-xs text-gray-600">
                GPS: {hasCoords(scan.gpsCoords) ? `${Number(scan.gpsCoords.lat).toFixed(5)}, ${Number(scan.gpsCoords.lng).toFixed(5)}` : 'Not captured'}
              </p>
            </div>
          );
        }) : (
          <p className="rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">No QR scans recorded yet.</p>
        )}
      </div>
    </div>
  );
};

const QrHandshakePanel = ({
  title = 'QR Handshake Scanner',
  subtitle = 'Scan the authorized shipment QR code to record handoff proof.',
  defaultStep = 'pickup',
  allowedSteps = ['pickup', 'delivery'],
  qrState,
  logistics,
  loading = false,
  scanning = false,
  showTokenGallery = false,
  onGenerate,
  onScan,
  onScanned,
}) => {
  const [step, setStep] = useState(defaultStep);
  const [token, setToken] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [failedScans, setFailedScans] = useState([]);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    setStep(defaultStep);
  }, [defaultStep]);

  const stopCamera = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => () => stopCamera(), []);

  const addFailedScan = (message, details = {}) => {
    setFailedScans((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        message,
        step,
        tokenPreview: token ? `${token.slice(0, 16)}...` : 'No token',
        at: new Date().toISOString(),
        ...details,
      },
      ...current,
    ].slice(0, 5));
  };

  const readGps = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS is not supported in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
  });

  const captureGps = async () => {
    try {
      const coords = await readGps();
      setGpsCoords(coords);
      toast.success('GPS attached to QR scan');
      return coords;
    } catch (error) {
      toast.error(error?.message || 'Unable to capture GPS');
      return null;
    }
  };

  const startCamera = async () => {
    if (!window.BarcodeDetector) {
      toast.error('Camera QR scanning is not supported in this browser. Paste the QR token instead.');
      return;
    }

    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      timerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        const codes = await detector.detect(videoRef.current);
        if (codes?.[0]?.rawValue) {
          setToken(codes[0].rawValue);
          stopCamera();
          toast.success('QR token captured');
        }
      }, 700);
    } catch (error) {
      stopCamera();
      toast.error(error?.message || 'Unable to start camera scanner');
    }
  };

  const submitScan = async () => {
    const cleanToken = token.trim();
    if (!cleanToken) {
      addFailedScan('No QR token was provided.');
      toast.error('Scan or paste a QR token first');
      return;
    }

    let coords = gpsCoords;
    if (step === 'delivery' && !hasCoords(coords)) {
      coords = await captureGps();
      if (!hasCoords(coords)) {
        addFailedScan('Delivery scan blocked because GPS was not available.');
        return;
      }
    }

    try {
      const result = await onScan?.({ step, token: cleanToken, qrPayload: cleanToken, gpsCoords: coords });
      setToken('');
      if (step === 'delivery') setGpsCoords(null);
      onScanned?.(result);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'QR scan failed';
      addFailedScan(message, { code: error?.response?.data?.code });
      toast.error(message);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[#F97316]">
            <FaQrcode /> QR handshake
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#111827]">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-[#F97316] bg-white px-3 py-2 text-sm font-semibold text-[#F97316] hover:bg-[#FFF7ED] disabled:opacity-60"
          >
            <FaQrcode />
            {loading ? 'Generating...' : 'Generate tokens'}
          </button>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <FaExclamationTriangle className="mr-2 inline" />
        Confirm the shipment number, route, and receiver before scanning. Reject screenshots, reused codes, expired tokens, or codes from another shipment.
      </div>

      {showTokenGallery && (
        <div className="mt-4">
          <QrTokenStatus qrState={qrState} logistics={logistics} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-3">
          <video ref={videoRef} className={`h-56 w-full rounded-lg border border-gray-200 bg-black object-cover ${cameraActive ? 'block' : 'hidden'}`} muted playsInline />
          {!cameraActive && (
            <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center">
              <div>
                <FaCamera className="mx-auto text-3xl text-gray-400" />
                <p className="mt-2 text-sm font-semibold text-[#111827]">Camera scanner idle</p>
                <p className="mt-1 text-xs text-gray-500">Use camera when available, or paste the QR payload.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-[150px_1fr]">
            <select
              value={step}
              onChange={(event) => setStep(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
            >
              {allowedSteps.map((item) => (
                <option key={item} value={item}>{item === 'pickup' ? 'Pickup QR' : 'Delivery QR'}</option>
              ))}
            </select>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste QR token or scanned payload"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startCamera} disabled={cameraActive || scanning} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50 disabled:opacity-60">
              <FaCamera /> Start camera
            </button>
            <button type="button" onClick={stopCamera} disabled={!cameraActive} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50 disabled:opacity-60">
              <FaStop /> Stop
            </button>
            <button type="button" onClick={captureGps} disabled={scanning} className="inline-flex items-center gap-2 rounded-lg border border-[#16A34A] bg-white px-3 py-2 text-sm font-semibold text-[#15803D] hover:bg-green-50 disabled:opacity-60">
              <FaLocationArrow /> Attach GPS
            </button>
            <button type="button" onClick={submitScan} disabled={scanning} className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60">
              <FaQrcode /> {scanning ? 'Scanning...' : 'Submit scan'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className={`rounded-lg border p-3 ${hasCoords(gpsCoords) ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
            <p className="text-xs font-semibold uppercase text-gray-500">GPS telemetry</p>
            <p className="mt-1 text-sm font-semibold text-[#111827]">
              {hasCoords(gpsCoords) ? `${Number(gpsCoords.lat).toFixed(5)}, ${Number(gpsCoords.lng).toFixed(5)}` : 'Not attached yet'}
            </p>
            <p className="mt-1 text-xs text-gray-500">Delivery scans require live GPS near the receiver location.</p>
          </div>

          <QrAuditTrail scans={qrState?.scanAudit || logistics?.qrScans || []} />

          {failedScans.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                <FaTimesCircle /> Failed scan handling
              </p>
              <div className="mt-2 space-y-2">
                {failedScans.map((failure) => (
                  <div key={failure.id} className="rounded-md bg-white p-2 text-xs text-red-900">
                    <p className="font-semibold">{failure.message}</p>
                    <p className="mt-1">Step: {failure.step} | Token: {failure.tokenPreview} | {formatDateTime(failure.at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrHandshakePanel;
