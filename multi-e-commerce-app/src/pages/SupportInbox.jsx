import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaCheckCircle,
  FaClock,
  FaEnvelopeOpenText,
  FaPaperPlane,
  FaReply,
  FaShieldAlt,
} from 'react-icons/fa';
import { supportService } from '../services/supportService';
import { useAuth } from '../context/AuthContext';

const statusLabels = {
  open: 'Open',
  pending_admin: 'Waiting for admin',
  pending_user: 'Admin replied',
  resolved: 'Resolved',
  closed: 'Closed',
};

const statusClass = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  pending_admin: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_user: 'bg-green-50 text-green-700 border-green-200',
  resolved: 'bg-gray-100 text-gray-700 border-gray-200',
  closed: 'bg-gray-100 text-gray-700 border-gray-200',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const MessageBubble = ({ message, currentUserId }) => {
  const senderId = message.sender?._id || message.sender?.id || message.sender;
  const isMine = !message.sentByAdmin && String(senderId || '') === String(currentUserId || '');
  const isAdmin = message.sentByAdmin || message.senderRole === 'admin';

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl rounded-lg border px-4 py-3 ${
        isMine
          ? 'border-[#F97316]/20 bg-[#FFF7ED]'
          : isAdmin
            ? 'border-green-200 bg-green-50'
            : 'border-gray-200 bg-white'
      }`}>
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-gray-500">
            {isAdmin ? 'Admin' : isMine ? 'You' : 'User'}
          </p>
          <p className="text-xs text-gray-500">{formatDateTime(message.createdAt)}</p>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">{message.body}</p>
      </div>
    </div>
  );
};

const SupportInbox = () => {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    category: 'general',
    priority: 'normal',
    message: '',
  });
  const [reply, setReply] = useState('');

  const currentUserId = user?._id || user?.id;
  const selectedThread = useMemo(
    () => threads.find((thread) => String(thread._id || thread.id) === String(selectedId)) || threads[0] || null,
    [threads, selectedId]
  );

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await supportService.getMyMessages({ limit: 30 });
      const rows = response.data || [];
      setThreads(rows);
      setSelectedId((current) => current || rows[0]?._id || rows[0]?.id || null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load support messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleFormChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('Subject and message are required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await supportService.createMessage({
        ...form,
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      const created = response.data;
      setThreads((current) => [created, ...current]);
      setSelectedId(created._id || created.id);
      setForm({ subject: '', category: 'general', priority: 'normal', message: '' });
      toast.success('Message sent to admin');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async (event) => {
    event.preventDefault();
    if (!selectedThread || !reply.trim()) return;

    setReplying(true);
    try {
      const response = await supportService.replyToMessage(selectedThread._id || selectedThread.id, reply.trim());
      const updated = response.data;
      setThreads((current) => current.map((thread) => (
        String(thread._id || thread.id) === String(updated._id || updated.id) ? updated : thread
      )));
      setReply('');
      toast.success('Reply sent');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#F97316]">Admin support</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950">Message the Lango MarketPulse admin team</h2>
              <p className="mt-2 text-sm text-gray-600">
                Send account, orders, payments, products, logistics, or technical questions directly to admin.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
              <FaShieldAlt />
              Protected inbox
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={submitMessage} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <FaPaperPlane className="text-[#F97316]" />
              <h3 className="text-lg font-bold text-gray-950">New Message</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Subject</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(event) => handleFormChange('subject', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  placeholder="What do you need help with?"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Category</label>
                  <select
                    value={form.category}
                    onChange={(event) => handleFormChange('category', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  >
                    <option value="general">General</option>
                    <option value="account">Account</option>
                    <option value="orders">Orders</option>
                    <option value="payments">Payments</option>
                    <option value="products">Products</option>
                    <option value="logistics">Logistics</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(event) => handleFormChange('priority', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Message</label>
                <textarea
                  rows="6"
                  value={form.message}
                  onChange={(event) => handleFormChange('message', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  placeholder="Write your message to admin"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
              >
                <FaPaperPlane />
                {submitting ? 'Sending...' : 'Send to Admin'}
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <FaEnvelopeOpenText className="text-[#F97316]" />
                <h3 className="font-bold text-gray-950">My Messages</h3>
              </div>
              <p className="mt-1 text-sm text-gray-500">Admin replies appear in the selected thread.</p>
            </div>

            {loading ? (
              <div className="p-5">
                <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center">
                <FaEnvelopeOpenText className="mx-auto mb-3 text-4xl text-gray-300" />
                <p className="font-semibold text-gray-900">No support messages yet</p>
                <p className="mt-1 text-sm text-gray-500">Send your first message to admin.</p>
              </div>
            ) : (
              <div className="grid min-h-[520px] lg:grid-cols-[280px_1fr]">
                <div className="border-b border-gray-200 lg:border-b-0 lg:border-r">
                  {threads.map((thread) => {
                    const threadId = thread._id || thread.id;
                    const isActive = String(threadId) === String(selectedThread?._id || selectedThread?.id);
                    return (
                      <button
                        key={threadId}
                        type="button"
                        onClick={() => setSelectedId(threadId)}
                        className={`block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${
                          isActive ? 'bg-[#FFF7ED]' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-1 font-semibold text-gray-950">{thread.subject}</p>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass[thread.status] || statusClass.open}`}>
                            {statusLabels[thread.status] || thread.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{formatDateTime(thread.lastMessageAt)}</p>
                      </button>
                    );
                  })}
                </div>

                {selectedThread && (
                  <div className="flex min-h-[520px] flex-col">
                    <div className="border-b border-gray-200 px-5 py-4">
                      <h4 className="font-bold text-gray-950">{selectedThread.subject}</h4>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600">
                          <FaClock /> {formatDateTime(selectedThread.lastMessageAt)}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 capitalize text-gray-600">
                          {selectedThread.category}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 capitalize text-gray-600">
                          {selectedThread.priority}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-5">
                      {(selectedThread.messages || []).map((message) => (
                        <MessageBubble key={message._id || message.createdAt} message={message} currentUserId={currentUserId} />
                      ))}
                    </div>

                    <form onSubmit={submitReply} className="border-t border-gray-200 bg-white p-4">
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Reply</label>
                      <textarea
                        rows="3"
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                        placeholder="Add more details for admin"
                      />
                      <div className="mt-3 flex justify-end">
                        <button
                          type="submit"
                          disabled={replying || !reply.trim()}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-[#374151] disabled:opacity-60"
                        >
                          {selectedThread.status === 'resolved' ? <FaCheckCircle /> : <FaReply />}
                          {replying ? 'Sending...' : 'Send Reply'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SupportInbox;
