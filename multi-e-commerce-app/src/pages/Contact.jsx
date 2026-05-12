/* eslint-disable react-hooks/incompatible-library */
import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, FaPaperPlane, FaClock } from 'react-icons/fa';
import api from '../config/axios';

const contactSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  phone: z
    .string()
    .min(9, 'Enter a valid phone number')
    .max(20, 'Phone number is too long')
    .regex(/^[+\d\s()-]+$/, 'Use only numbers and symbols like +, -, ()'),
  inquiryType: z.string().min(1, 'Select an inquiry type'),
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(100, 'Subject is too long'),
  message: z.string().min(20, 'Message must be at least 20 characters').max(1000, 'Message is too long'),
  consent: z.boolean().refine((val) => val === true, 'You must agree before submitting'),
});

const inquiryOptions = [
  { value: 'general', label: 'General Inquiry', eta: 'within 24 hours' },
  { value: 'orders', label: 'Order Support', eta: 'within 12 hours' },
  { value: 'billing', label: 'Billing & Subscription', eta: 'within 12 hours' },
  { value: 'technical', label: 'Technical Support', eta: 'within 6 hours' },
  { value: 'partnership', label: 'Partnership', eta: 'within 48 hours' },
];

const OFFLINE_QUEUE_KEY = 'marketpulse_contact_queue';

const queueOfflineContact = (payload) => {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  queue.push({
    ...payload,
    queuedAt: new Date().toISOString(),
    id: `OFF-${Date.now()}`,
  });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
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

const Contact = () => {
  const [submitStatus, setSubmitStatus] = useState(null);
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') || '';
  const initialSubject = searchParams.get('subject') || '';

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm({
    resolver: zodResolver(contactSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      inquiryType: initialType,
      subject: initialSubject,
      message: '',
      consent: false,
    },
  });

  const watchedType = watch('inquiryType');
  const watchedMessage = watch('message') || '';

  const selectedInquiry = useMemo(
    () => inquiryOptions.find((option) => option.value === watchedType),
    [watchedType]
  );

  const onSubmit = async (values) => {
    setSubmitStatus(null);
    const payload = {
      ...values,
      source: 'web-contact-form',
      submittedAt: new Date().toISOString(),
    };

    try {
      const response = await deliverContactPayload(payload);
      const ticketId = response?.data?.ticketId || `TKT-${Date.now()}`;
      setSubmitStatus({ ok: true, ticketId, queued: false });
      toast.success('Message sent successfully');
      reset();
    } catch (error) {
      queueOfflineContact(payload);
      const fallbackTicketId = `Q-${Date.now()}`;
      setSubmitStatus({ ok: true, ticketId: fallbackTicketId, queued: true });
      toast.success('Message saved and queued for delivery');
    }
  };

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-10">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <section className="lg:col-span-2 bg-[#111827] text-white rounded-2xl p-6">
            <h1 className="text-3xl font-bold">Contact Us</h1>
            <p className="text-white/80 mt-2 leading-7">
              Reach the Lango Market Pulse team for support, subscriptions, partnerships, and technical issues.
            </p>

            <div className="space-y-4 mt-8">
              <div className="flex items-start gap-3">
                <FaPhoneAlt className="mt-1 text-[#FB923C]" />
                <div>
                  <p className="font-semibold">Phone</p>
                  <p className="text-white/80 text-sm">+254 700 000000</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaEnvelope className="mt-1 text-[#FB923C]" />
                <div>
                  <p className="font-semibold">Email</p>
                  <p className="text-white/80 text-sm">support@langomarketpulse.com</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaMapMarkerAlt className="mt-1 text-[#FB923C]" />
                <div>
                  <p className="font-semibold">Office</p>
                  <p className="text-white/80 text-sm">Kakuma - Kitale Trade Corridor, Kenya</p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-white/10 border border-white/10">
              <div className="flex items-center gap-2 text-[#FDBA74]">
                <FaClock />
                <p className="font-semibold">Live Response Estimate</p>
              </div>
              <p className="text-sm text-white/85 mt-2">
                {selectedInquiry
                  ? `For ${selectedInquiry.label}, our team usually responds ${selectedInquiry.eta}.`
                  : 'Select an inquiry type to see expected response time.'}
              </p>
            </div>
          </section>

          <section className="lg:col-span-3 bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-2xl font-semibold text-[#111827]">Send a Message</h2>
            <p className="text-sm text-[#6B7280] mt-1">All fields marked with * are required.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1">Full Name *</label>
                  <input
                    type="text"
                    {...register('fullName')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    placeholder="Jane Akinyi"
                  />
                  {errors.fullName && <p className="text-red-600 text-xs mt-1">{errors.fullName.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1">Email *</label>
                  <input
                    type="email"
                    {...register('email')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    placeholder="you@example.com"
                  />
                  {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1">Phone *</label>
                  <input
                    type="tel"
                    {...register('phone')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    placeholder="+254 700 000000"
                  />
                  {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1">Inquiry Type *</label>
                  <select
                    {...register('inquiryType')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] bg-white"
                  >
                    <option value="">Select inquiry type</option>
                    {inquiryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.inquiryType && <p className="text-red-600 text-xs mt-1">{errors.inquiryType.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">Subject *</label>
                <input
                  type="text"
                  {...register('subject')}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  placeholder="Brief summary of your request"
                />
                {errors.subject && <p className="text-red-600 text-xs mt-1">{errors.subject.message}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-[#111827]">Message *</label>
                  <span className={`text-xs ${watchedMessage.length > 1000 ? 'text-red-600' : 'text-[#6B7280]'}`}>
                    {watchedMessage.length}/1000
                  </span>
                </div>
                <textarea
                  rows="6"
                  {...register('message')}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  placeholder="Please share relevant details so we can help quickly."
                />
                {errors.message && <p className="text-red-600 text-xs mt-1">{errors.message.message}</p>}
              </div>

              <div>
                <label className="flex items-start gap-2 text-sm text-[#374151]">
                  <input type="checkbox" {...register('consent')} className="mt-1 accent-[#F97316]" />
                  <span>I agree to be contacted regarding this request and to the processing of this data.</span>
                </label>
                {errors.consent && <p className="text-red-600 text-xs mt-1">{errors.consent.message}</p>}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F97316] text-white rounded-lg font-semibold hover:bg-[#EA580C] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isSubmitting ? 'Sending...' : 'Submit Message'}
                  {!isSubmitting && <FaPaperPlane size={14} />}
                </button>
              </div>
            </form>

            {submitStatus?.ok && (
              <div className="mt-5 p-4 rounded-lg border border-green-200 bg-green-50">
                <p className="text-green-800 font-medium">Submission received</p>
                <p className="text-sm text-green-700 mt-1">Ticket: {submitStatus.ticketId}</p>
                {submitStatus.queued && (
                  <p className="text-xs text-green-700 mt-1">
                    Endpoint unavailable right now. Your request has been queued locally and can be retried by support sync.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Contact;
