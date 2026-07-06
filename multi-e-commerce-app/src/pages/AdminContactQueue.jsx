import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaBullhorn,
  FaCheckCircle,
  FaClock,
  FaComments,
  FaEnvelope,
  FaEnvelopeOpenText,
  FaInbox,
  FaPaperPlane,
  FaPhone,
  FaReply,
  FaSms,
  FaSyncAlt,
  FaTrash,
  FaUser,
  FaUsers,
} from 'react-icons/fa';
import api from '../config/axios';
import { supportService } from '../services/supportService';

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

const statusLabels = {
  open: 'Open',
  pending_admin: 'Waiting admin',
  pending_user: 'Waiting user',
  resolved: 'Resolved',
  closed: 'Closed',
};

const statusClasses = {
  open: 'border-blue-200 bg-blue-50 text-blue-700',
  pending_admin: 'border-amber-200 bg-amber-50 text-amber-700',
  pending_user: 'border-green-200 bg-green-50 text-green-700',
  resolved: 'border-gray-200 bg-gray-100 text-gray-700',
  closed: 'border-gray-200 bg-gray-100 text-gray-700',
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
  const [messageSending, setMessageSending] = useState(false);
  const [messageResult, setMessageResult] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const [supportStatus, setSupportStatus] = useState('all');
  const [supportRole, setSupportRole] = useState('all');
  const [supportSearch, setSupportSearch] = useState('');
  const [selectedSupportId, setSelectedSupportId] = useState(null);
  const [replySending, setReplySending] = useState(false);
  const [replyForm, setReplyForm] = useState({
    message: '',
    channel: 'in_app',
    status: 'pending_user',
  });
  const [messageForm, setMessageForm] = useState({
    type: 'all',
    targetMode: 'individual',
    title: '',
    message: '',
    targetRole: 'all',
    recipientEmail: '',
    recipientPhone: '',
  });

  const sortedQueue = useMemo(
    () =>
      [...queue].sort((a, b) => {
        const aTime = new Date(a.queuedAt || a.submittedAt || 0).getTime();
        const bTime = new Date(b.queuedAt || b.submittedAt || 0).getTime();
        return bTime - aTime;
      }),
    [queue]
  );
  const selectedSupport = useMemo(
    () =>
      supportMessages.find((item) => String(item._id || item.id) === String(selectedSupportId)) ||
      supportMessages[0] ||
      null,
    [supportMessages, selectedSupportId]
  );

  const fetchSupportMessages = async () => {
    setSupportLoading(true);
    try {
      const response = await supportService.getAdminMessages({
        status: supportStatus,
        role: supportRole,
        search: supportSearch,
        limit: 50,
      });
      const rows = response.data || [];
      setSupportMessages(rows);
      setSelectedSupportId((current) => current || rows[0]?._id || rows[0]?.id || null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load support inbox');
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    fetchSupportMessages();
  }, []);

  const refresh = () => setQueue(readQueue());

  const refreshAll = () => {
    refresh();
    fetchSupportMessages();
  };

  const updateMessageForm = (field, value) => {
    setMessageForm((current) => ({ ...current, [field]: value }));
  };

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

  const handleAdminMessage = async (event) => {
    event.preventDefault();

    if (!messageForm.message.trim()) {
      toast.error('Message is required');
      return;
    }

    if (
      messageForm.targetMode === 'individual' &&
      !messageForm.recipientEmail.trim() &&
      !messageForm.recipientPhone.trim()
    ) {
      toast.error('Enter an email address or phone number');
      return;
    }

    setMessageSending(true);
    try {
      const payload = {
        type: messageForm.type,
        targetMode: messageForm.targetMode,
        title: messageForm.title.trim() || 'Lango MarketPulse Update',
        message: messageForm.message.trim(),
        targetRole: messageForm.targetMode === 'all' ? messageForm.targetRole : 'all',
        recipientEmail: messageForm.targetMode === 'individual' ? messageForm.recipientEmail.trim() : undefined,
        recipientPhone: messageForm.targetMode === 'individual' ? messageForm.recipientPhone.trim() : undefined,
      };
      const response = await api.post('/v1/admin/broadcast', payload);
      setMessageResult(response.data?.results || response.data || null);
      toast.success(response.data?.message || 'Message sent');
      setMessageForm((current) => ({
        ...current,
        title: '',
        message: '',
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setMessageSending(false);
    }
  };

  const handleSupportFilter = async (event) => {
    event.preventDefault();
    setSelectedSupportId(null);
    await fetchSupportMessages();
  };

  const updateSelectedSupport = (updated) => {
    setSupportMessages((current) => current.map((item) => (
      String(item._id || item.id) === String(updated._id || updated.id) ? updated : item
    )));
    setSelectedSupportId(updated._id || updated.id);
  };

  const handleAdminReply = async (event) => {
    event.preventDefault();
    if (!selectedSupport || !replyForm.message.trim()) {
      toast.error('Reply message is required');
      return;
    }

    setReplySending(true);
    try {
      const response = await supportService.adminReply(selectedSupport._id || selectedSupport.id, {
        message: replyForm.message.trim(),
        channel: replyForm.channel,
        status: replyForm.status,
      });
      updateSelectedSupport(response.data);
      setReplyForm((current) => ({ ...current, message: '' }));
      toast.success('Reply sent to user');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reply');
    } finally {
      setReplySending(false);
    }
  };

  const handleStatusUpdate = async (status) => {
    if (!selectedSupport) return;
    try {
      const response = await supportService.updateStatus(selectedSupport._id || selectedSupport.id, status);
      updateSelectedSupport(response.data);
      toast.success('Support status updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
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
              onClick={refreshAll}
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

        <section className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <FaComments className="text-[#F97316]" />
                  <h2 className="text-xl font-bold text-[#111827]">User Messages Inbox</h2>
                </div>
                <p className="text-sm text-[#6B7280]">Messages sent directly from buyer, seller, and logistics dashboards.</p>
              </div>
              <form onSubmit={handleSupportFilter} className="grid gap-2 sm:grid-cols-[150px_150px_220px_auto]">
                <select
                  value={supportStatus}
                  onChange={(event) => setSupportStatus(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                >
                  <option value="all">All status</option>
                  <option value="pending_admin">Waiting admin</option>
                  <option value="pending_user">Waiting user</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <select
                  value={supportRole}
                  onChange={(event) => setSupportRole(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                >
                  <option value="all">All roles</option>
                  <option value="buyer">Buyers</option>
                  <option value="seller">Sellers</option>
                  <option value="farmer">Farmers</option>
                  <option value="logistics">Logistics</option>
                </select>
                <input
                  type="search"
                  value={supportSearch}
                  onChange={(event) => setSupportSearch(event.target.value)}
                  placeholder="Search messages"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-[#374151]"
                >
                  Filter
                </button>
              </form>
            </div>
          </div>

          {supportLoading ? (
            <div className="p-5">
              <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
            </div>
          ) : supportMessages.length === 0 ? (
            <div className="p-10 text-center">
              <FaInbox className="mx-auto mb-3 text-4xl text-gray-300" />
              <h3 className="text-lg font-semibold text-[#111827]">No user messages</h3>
              <p className="mt-1 text-sm text-[#6B7280]">New dashboard messages will appear here.</p>
            </div>
          ) : (
            <div className="grid min-h-[560px] lg:grid-cols-[360px_1fr]">
              <div className="border-b border-gray-200 lg:border-b-0 lg:border-r">
                {supportMessages.map((item) => {
                  const itemId = item._id || item.id;
                  const isActive = String(itemId) === String(selectedSupport?._id || selectedSupport?.id);
                  return (
                    <button
                      key={itemId}
                      type="button"
                      onClick={() => setSelectedSupportId(itemId)}
                      className={`block w-full border-b border-gray-100 px-4 py-4 text-left transition hover:bg-gray-50 ${
                        isActive ? 'bg-[#FFF7ED]' : 'bg-white'
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#111827]">{item.subject}</p>
                          <p className="mt-1 truncate text-sm text-[#6B7280]">
                            {item.requesterName || 'User'} · {item.requesterRole || 'user'}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClasses[item.status] || statusClasses.open}`}>
                          {statusLabels[item.status] || item.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                        <span className="inline-flex items-center gap-1">
                          <FaClock /> {formatDateTime(item.lastMessageAt)}
                        </span>
                        <span className="capitalize">{item.category}</span>
                        <span className="capitalize">{item.priority}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedSupport && (
                <div className="flex min-h-[560px] flex-col">
                  <div className="border-b border-gray-200 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-[#111827]">{selectedSupport.subject}</h3>
                        <p className="mt-1 text-sm text-[#6B7280]">
                          {selectedSupport.requesterName || 'User'} · {selectedSupport.requesterEmail || 'No email'} · {selectedSupport.requesterPhone || 'No phone'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate('resolved')}
                          className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
                        >
                          <FaCheckCircle /> Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate('closed')}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto bg-[#F9FAFB] p-5">
                    {(selectedSupport.messages || []).map((message) => {
                      const isAdminReply = message.sentByAdmin || message.senderRole === 'admin';
                      return (
                        <div key={message._id || message.createdAt} className={`flex ${isAdminReply ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-3xl rounded-lg border px-4 py-3 ${
                            isAdminReply ? 'border-[#F97316]/20 bg-[#FFF7ED]' : 'border-gray-200 bg-white'
                          }`}>
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold uppercase text-[#6B7280]">
                                {isAdminReply ? 'Admin reply' : selectedSupport.requesterName || 'User'}
                              </p>
                              <p className="text-xs text-[#6B7280]">{formatDateTime(message.createdAt)}</p>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-6 text-[#374151]">{message.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <form onSubmit={handleAdminReply} className="border-t border-gray-200 bg-white p-5">
                    <div className="grid gap-3 lg:grid-cols-[1fr_160px_170px]">
                      <textarea
                        rows="3"
                        value={replyForm.message}
                        onChange={(event) => setReplyForm((current) => ({ ...current, message: event.target.value }))}
                        placeholder="Reply to this user"
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                      />
                      <select
                        value={replyForm.channel}
                        onChange={(event) => setReplyForm((current) => ({ ...current, channel: event.target.value }))}
                        className="h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                      >
                        <option value="in_app">In-app only</option>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="all">All channels</option>
                      </select>
                      <select
                        value={replyForm.status}
                        onChange={(event) => setReplyForm((current) => ({ ...current, status: event.target.value }))}
                        className="h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                      >
                        <option value="pending_user">Waiting user</option>
                        <option value="pending_admin">Waiting admin</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        disabled={replySending || !replyForm.message.trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                      >
                        <FaReply />
                        {replySending ? 'Sending...' : 'Reply to User'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <FaBullhorn className="text-[#F97316]" />
                <h2 className="text-xl font-bold text-[#111827]">Admin Message Center</h2>
              </div>
              <p className="text-sm text-[#6B7280]">Send email and phone text messages to one user or the whole platform.</p>
            </div>
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-[#F9FAFB] p-1">
              <button
                type="button"
                onClick={() => updateMessageForm('targetMode', 'individual')}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                  messageForm.targetMode === 'individual' ? 'bg-white text-[#F97316] shadow-sm' : 'text-[#6B7280]'
                }`}
              >
                <FaUser /> Individual
              </button>
              <button
                type="button"
                onClick={() => updateMessageForm('targetMode', 'all')}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                  messageForm.targetMode === 'all' ? 'bg-white text-[#F97316] shadow-sm' : 'text-[#6B7280]'
                }`}
              >
                <FaUsers /> All Users
              </button>
            </div>
          </div>

          <form onSubmit={handleAdminMessage} className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Channel</label>
                <select
                  value={messageForm.type}
                  onChange={(event) => updateMessageForm('type', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                >
                  <option value="all">Email + SMS + In-App</option>
                  <option value="email">Email only</option>
                  <option value="sms">SMS only</option>
                  <option value="in_app">In-App only</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Title</label>
                <input
                  type="text"
                  value={messageForm.title}
                  onChange={(event) => updateMessageForm('title', event.target.value)}
                  placeholder="Message title"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                />
              </div>
            </div>

            {messageForm.targetMode === 'individual' ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                    <FaEnvelope className="text-[#6B7280]" /> Email
                  </label>
                  <input
                    type="email"
                    value={messageForm.recipientEmail}
                    onChange={(event) => updateMessageForm('recipientEmail', event.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                    <FaPhone className="text-[#6B7280]" /> Phone
                  </label>
                  <input
                    type="tel"
                    value={messageForm.recipientPhone}
                    onChange={(event) => updateMessageForm('recipientPhone', event.target.value)}
                    placeholder="+254700000000"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Audience</label>
                  <select
                    value={messageForm.targetRole}
                    onChange={(event) => updateMessageForm('targetRole', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  >
                    <option value="all">All users</option>
                    <option value="seller">Sellers</option>
                    <option value="farmer">Farmers</option>
                    <option value="wholesaler">Wholesalers</option>
                    <option value="manufacturer">Manufacturers</option>
                    <option value="retailer">Retailers</option>
                    <option value="consumer">Buyers</option>
                    <option value="logistics">Logistics</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#111827]">Message</label>
              <textarea
                rows="4"
                value={messageForm.message}
                onChange={(event) => updateMessageForm('message', event.target.value)}
                placeholder="Write the message users will receive"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {messageResult ? (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-[#F9FAFB] px-3 py-2">
                    <p className="text-xs text-[#6B7280]">Email</p>
                    <p className="font-bold text-[#111827]">{messageResult.email?.success ?? 0}/{messageResult.email?.attempted ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-[#F9FAFB] px-3 py-2">
                    <p className="text-xs text-[#6B7280]">SMS</p>
                    <p className="font-bold text-[#111827]">{messageResult.sms?.success ?? 0}/{messageResult.sms?.attempted ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-[#F9FAFB] px-3 py-2">
                    <p className="text-xs text-[#6B7280]">In-App</p>
                    <p className="font-bold text-[#111827]">{messageResult.inApp?.success ?? 0}/{messageResult.inApp?.attempted ?? 0}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#6B7280]">Email uses SMTP settings. SMS uses the configured phone provider.</p>
              )}

              <button
                type="submit"
                disabled={messageSending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#374151] disabled:opacity-60"
              >
                {messageForm.type === 'sms' ? <FaSms /> : <FaPaperPlane />}
                {messageSending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </section>

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
