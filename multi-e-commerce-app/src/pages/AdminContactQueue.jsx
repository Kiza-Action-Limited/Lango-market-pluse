import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FaEnvelopeOpenText, FaPaperPlane, FaTrash, FaSyncAlt, FaInbox } from 'react-icons/fa';
import api from '../config/axios';

const OFFLINE_QUEUE_KEY = 'marketpulse_contact_queue';

const readQueue = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const writeQueue = (items) => {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const deliverContactPayload = async (payload) => {
  try {
    return await api.post('/v1/contact', payload);
  } catch (error) {
    if (error.response?.status === 404) {
      return api.post('/contact', payload);
    }
    throw error;
  }
};

const AdminContactQueue = () => {
  const [queue, setQueue] = useState(readQueue());
  const [sendingId, setSendingId] = useState(null);

  const sortedQueue = useMemo(
    () =>
      [...queue].sort((a, b) => {
        const aTime = new Date(a.queuedAt || a.submittedAt || 0).getTime();
        const bTime = new Date(b.queuedAt || b.submittedAt || 0).getTime();
        return bTime - aTime;
      }),
    [queue]
  );

  const refresh = () => setQueue(readQueue());

  const removeOne = (id) => {
    const updated = queue.filter((item) => item.id !== id);
    writeQueue(updated);
    setQueue(updated);
    toast.success('Queued message removed');
  };

  const clearAll = () => {
    if (!queue.length) return;
    if (!window.confirm('Clear all queued contact messages?')) return;
    writeQueue([]);
    setQueue([]);
    toast.success('Contact queue cleared');
  };

  const retrySingle = async (item) => {
    setSendingId(item.id);
    try {
      await deliverContactPayload({
        fullName: item.fullName,
        email: item.email,
        phone: item.phone,
        inquiryType: item.inquiryType,
        subject: item.subject,
        message: item.message,
        consent: item.consent ?? true,
        source: item.source || 'web-contact-form',
        submittedAt: item.submittedAt || new Date().toISOString(),
      });
      const updated = queue.filter((q) => q.id !== item.id);
      writeQueue(updated);
      setQueue(updated);
      toast.success('Message delivered to backend');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delivery failed. Queue item kept for retry.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FaEnvelopeOpenText className="text-[#F97316] text-3xl" />
              <h1 className="text-3xl font-bold text-[#F97316]">Contact Queue</h1>
            </div>
            <p className="text-[#6B7280]">Manage offline contact submissions waiting for backend delivery.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium"
            >
              <span className="inline-flex items-center gap-2">
                <FaSyncAlt /> Refresh
              </span>
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium"
            >
              <span className="inline-flex items-center gap-2">
                <FaTrash /> Clear All
              </span>
            </button>
          </div>
        </div>

        {!sortedQueue.length ? (
          <div className="bg-white rounded-xl p-10 border border-gray-200 text-center">
            <FaInbox className="text-4xl text-gray-300 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-[#111827]">Queue is empty</h2>
            <p className="text-[#6B7280] mt-1">No pending contact submissions in local storage.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedQueue.map((item) => (
              <article key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[#111827]">{item.subject || 'No subject'}</h2>
                    <p className="text-sm text-[#6B7280]">
                      {item.fullName || 'Unknown Sender'} • {item.email || 'No Email'} • {item.phone || '-'}
                    </p>
                  </div>
                  <div className="text-sm text-[#6B7280]">
                    <p>Type: <span className="font-medium text-[#111827]">{item.inquiryType || 'general'}</span></p>
                    <p>Queued: {formatDateTime(item.queuedAt)}</p>
                  </div>
                </div>

                <p className="text-[#374151] mt-4 whitespace-pre-wrap leading-7">{item.message || '-'}</p>

                <div className="flex flex-wrap gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => retrySingle(item)}
                    disabled={sendingId === item.id}
                    className="px-4 py-2 rounded-lg bg-[#F97316] text-white hover:bg-[#EA580C] disabled:opacity-60 text-sm font-medium"
                  >
                    <span className="inline-flex items-center gap-2">
                      <FaPaperPlane />
                      {sendingId === item.id ? 'Sending...' : 'Retry Send'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOne(item.id)}
                    className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium"
                  >
                    <span className="inline-flex items-center gap-2">
                      <FaTrash />
                      Remove
                    </span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminContactQueue;
