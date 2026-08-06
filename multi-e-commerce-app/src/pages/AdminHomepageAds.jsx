import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FaBullhorn, FaCloudUploadAlt, FaImage, FaSave, FaSpinner } from 'react-icons/fa';
import { marketingContentService } from '../services/marketingContentService';

const makeItem = (title) => ({
  title,
  imageUrl: '',
  linkUrl: '/products',
  isActive: true,
});

const DEFAULT_FORM = {
  slides: [
    makeItem('Slide 1'),
    makeItem('Slide 2'),
    makeItem('Slide 3'),
  ],
  sideAds: [
    makeItem('Ad card 1'),
    makeItem('Ad card 2'),
    makeItem('Ad card 3'),
    makeItem('Ad card 4'),
  ],
};

const normalizeItems = (items = [], count, label) => (
  Array.from({ length: count }, (_, index) => ({
    ...makeItem(`${label} ${index + 1}`),
    ...(Array.isArray(items) ? items[index] : {}),
  }))
);

const normalizeForm = (payload = {}) => ({
  slides: normalizeItems(payload.slides, 3, 'Slide'),
  sideAds: normalizeItems(payload.sideAds, 4, 'Ad card'),
});

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
    {children}
  </label>
);

const Preview = ({ item, fallbackLabel }) => (
  <div className="relative h-32 overflow-hidden rounded-md border border-gray-200 bg-gray-100">
    {item.imageUrl ? (
      <img src={item.imageUrl} alt={item.title || fallbackLabel} className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full flex-col items-center justify-center text-gray-400">
        <FaImage className="mb-2 text-2xl" />
        <span className="text-xs">No image</span>
      </div>
    )}
    <span className="absolute left-2 top-2 rounded bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
      {fallbackLabel}
    </span>
  </div>
);

const AdminHomepageAds = () => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');

  const activeSummary = useMemo(() => ({
    slides: form.slides.filter((item) => item.isActive && item.imageUrl).length,
    sideAds: form.sideAds.filter((item) => item.isActive && item.imageUrl).length,
  }), [form]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const data = await marketingContentService.getAdminHomepageAds();
      setForm(normalizeForm(data));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load homepage ads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, []);

  const updateItem = (section, index, patch) => {
    setForm((current) => ({
      ...current,
      [section]: current[section].map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  };

  const handleUpload = async (section, index, file) => {
    if (!file) return;
    const key = `${section}-${index}`;
    setUploadingKey(key);
    try {
      const result = await marketingContentService.uploadHomepageAdImage(file, section);
      updateItem(section, index, { imageUrl: result.imageUrl });
      toast.success('Image uploaded');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingKey('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await marketingContentService.saveAdminHomepageAds(form);
      setForm(normalizeForm(data));
      toast.success('Homepage ads saved');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save homepage ads');
    } finally {
      setSaving(false);
    }
  };

  const renderEditor = (section, title, description, countLabel) => (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-[#111827]">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        {form[section].map((item, index) => {
          const uploadKey = `${section}-${index}`;
          return (
            <article key={uploadKey} className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-semibold text-[#111827]">{countLabel} {index + 1}</p>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={item.isActive}
                    onChange={(event) => updateItem(section, index, { isActive: event.target.checked })}
                  />
                  Active
                </label>
              </div>

              <Preview item={item} fallbackLabel={`${countLabel} ${index + 1}`} />

              <div className="mt-4 grid gap-3">
                <Field label="Title">
                  <input
                    value={item.title}
                    onChange={(event) => updateItem(section, index, { title: event.target.value })}
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  />
                </Field>
                <Field label="Image URL">
                  <input
                    value={item.imageUrl}
                    onChange={(event) => updateItem(section, index, { imageUrl: event.target.value })}
                    placeholder="https://..."
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  />
                </Field>
                <Field label="Click Link">
                  <input
                    value={item.linkUrl}
                    onChange={(event) => updateItem(section, index, { linkUrl: event.target.value })}
                    placeholder="/products or https://..."
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  />
                </Field>
                <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  {uploadingKey === uploadKey ? <FaSpinner className="animate-spin" /> : <FaCloudUploadAlt />}
                  {uploadingKey === uploadKey ? 'Uploading' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={Boolean(uploadingKey)}
                    onChange={(event) => {
                      handleUpload(section, index, event.target.files?.[0]);
                      event.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-64 rounded bg-gray-200 skeleton-shimmer" />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-64 rounded-lg border border-gray-100 bg-white skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app-page p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F97316]">
            <FaBullhorn />
            Homepage Marketing
          </div>
          <h1 className="text-2xl font-bold text-[#111827]">Ad Cards & Slider</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure three center slider images and four side ad cards for the homepage showcase.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
        >
          {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
          {saving ? 'Saving' : 'Save ads'}
        </button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active Slides</p>
          <p className="mt-1 text-3xl font-bold text-[#111827]">{activeSummary.slides}/3</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active Side Ads</p>
          <p className="mt-1 text-3xl font-bold text-[#111827]">{activeSummary.sideAds}/4</p>
        </div>
      </div>

      <div className="grid gap-5">
        {renderEditor('slides', 'Three Image Slides', 'These images rotate in the large center banner.', 'Slide')}
        {renderEditor('sideAds', 'Side Ad Cards', 'First two show on the left, last two show on the right.', 'Ad card')}
      </div>
    </div>
  );
};

export default AdminHomepageAds;
