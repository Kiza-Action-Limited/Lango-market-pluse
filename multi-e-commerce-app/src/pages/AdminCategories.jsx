// src/pages/AdminCategories.jsx
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaArchive,
  FaBoxes,
  FaCheckCircle,
  FaEdit,
  FaFilter,
  FaLayerGroup,
  FaPlus,
  FaSearch,
  FaStore,
  FaTag,
  FaTimesCircle,
  FaTrash,
} from 'react-icons/fa';
import api from '../config/axios';

const categoryTypes = [
  'general',
  'brand',
  'farmer',
  'wholesaler',
  'retailer',
  'manufacturer',
  'small_business',
  'logistics',
];

const emptyForm = {
  name: '',
  description: '',
  icon: '',
  image: '',
  categoryType: 'general',
  isActive: true,
};

const humanize = (value) => String(value || 'general')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'Not available');

const normalizeList = (payload) => (
  payload?.categories ||
  payload?.data?.categories ||
  payload?.data ||
  payload ||
  []
);

const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
    active
      ? 'border-green-200 bg-green-50 text-green-700'
      : 'border-gray-200 bg-gray-100 text-gray-600'
  }`}
  >
    {active ? <FaCheckCircle /> : <FaTimesCircle />}
    {active ? 'Active' : 'Inactive'}
  </span>
);

const KpiCard = ({ label, value, icon: Icon, tone = 'orange' }) => {
  const tones = {
    orange: 'bg-[#FFF7ED] text-[#F97316]',
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${tones[tone] || tones.orange}`}>
          <Icon />
        </div>
      </div>
    </div>
  );
};

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, linkedProducts: 0, byType: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    type: 'all',
  });

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await api.get('/v1/categories/admin/manage', { params: filters });
      const payload = response.data || {};
      const categoryList = normalizeList(payload);
      setCategories(Array.isArray(categoryList) ? categoryList : []);
      setSummary(payload.summary || {
        total: categoryList.length || 0,
        active: categoryList.filter?.((category) => category.isActive).length || 0,
        inactive: categoryList.filter?.((category) => !category.isActive).length || 0,
        linkedProducts: categoryList.reduce?.((sum, category) => sum + Number(category.productCount || 0), 0) || 0,
        byType: {},
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load categories', { id: 'admin-categories-load' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [filters.status, filters.type]);

  const filteredCategories = useMemo(() => categories, [categories]);
  const mostUsedType = useMemo(() => {
    const entries = Object.entries(summary.byType || {});
    if (!entries.length) return 'None';
    return humanize(entries.sort((a, b) => b[1] - a[1])[0][0]);
  }, [summary.byType]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      description: category.description || '',
      icon: category.icon || '',
      image: category.image || '',
      categoryType: category.categoryType || 'general',
      isActive: category.isActive !== false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim(),
        icon: formData.icon.trim(),
        image: formData.image.trim(),
      };

      if (editingCategory) {
        await api.put(`/v1/categories/${editingCategory._id || editingCategory.id}`, payload);
        toast.success('Category updated');
      } else {
        await api.post('/v1/categories', payload);
        toast.success('Category created');
      }

      setShowModal(false);
      setEditingCategory(null);
      setFormData(emptyForm);
      loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (category, isActive) => {
    try {
      await api.put(`/v1/categories/${category._id || category.id}`, { isActive });
      toast.success(isActive ? 'Category restored' : 'Category deactivated');
      loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update category status');
    }
  };

  const handleDelete = async (category) => {
    const confirmed = window.confirm(`Deactivate "${category.name}"? Products using this category will remain unchanged.`);
    if (!confirmed) return;

    try {
      await api.delete(`/v1/categories/${category._id || category.id}`);
      toast.success('Category deactivated');
      loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to deactivate category');
    }
  };

  const applySearch = (event) => {
    event.preventDefault();
    loadCategories();
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8">
      <div className="container mx-auto space-y-6 px-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F97316]">Catalog administration</p>
            <h1 className="mt-2 text-3xl font-bold text-[#111827]">Category Management</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Create, organize, activate, and retire marketplace categories used across product listings and storefront navigation.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#EA580C]"
          >
            <FaPlus /> New Category
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <KpiCard label="Total Categories" value={summary.total || 0} icon={FaLayerGroup} />
          <KpiCard label="Active" value={summary.active || 0} icon={FaCheckCircle} tone="green" />
          <KpiCard label="Linked Products" value={summary.linkedProducts || 0} icon={FaBoxes} tone="blue" />
          <KpiCard label="Top Type" value={mostUsedType} icon={FaStore} tone="slate" />
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_200px_auto]">
            <form onSubmit={applySearch} className="relative">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search category name, slug, or description"
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-[#F97316]"
              />
            </form>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={filters.type}
              onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
            >
              <option value="all">All Types</option>
              {categoryTypes.map((type) => (
                <option key={type} value={type}>{humanize(type)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadCategories}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50"
            >
              <FaFilter /> Apply
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[#111827]">
              <FaTag className="text-[#F97316]" /> Marketplace Categories
            </h2>
          </div>

          {loading ? (
            <div className="p-6">
              <div className="h-10 rounded bg-gray-200 skeleton-shimmer" />
              <div className="mt-3 h-10 rounded bg-gray-200 skeleton-shimmer" />
              <div className="mt-3 h-10 rounded bg-gray-200 skeleton-shimmer" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F9FAFB]">
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Products</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Updated</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => (
                    <tr key={category._id || category.id} className="border-t border-gray-200">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FFF7ED] text-lg font-bold text-[#F97316]">
                            {category.icon || String(category.name || 'C').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#111827]">{humanize(category.name)}</p>
                            <p className="truncate text-xs text-gray-500">{category.description || 'No description provided'}</p>
                            <p className="mt-1 font-mono text-xs text-gray-400">{category.slug || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                          {humanize(category.categoryType)}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#111827]">{category.productCount || 0}</td>
                      <td className="px-5 py-4"><StatusBadge active={category.isActive !== false} /></td>
                      <td className="px-5 py-4 text-gray-600">{formatDate(category.updatedAt || category.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(category)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-[#F97316] hover:bg-[#FFF7ED]"
                            title="Edit category"
                          >
                            <FaEdit />
                          </button>
                          {category.isActive === false ? (
                            <button
                              onClick={() => updateStatus(category, true)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-green-200 text-green-700 hover:bg-green-50"
                              title="Restore category"
                            >
                              <FaArchive />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDelete(category)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                              title="Deactivate category"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCategories.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                        No categories match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="inline-flex items-center gap-2 text-xl font-bold text-[#111827]">
                  <FaTag className="text-[#F97316]" />
                  {editingCategory ? 'Edit Category' : 'Create Category'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-[#111827]">
                    Category Name
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                      placeholder="e.g. electronics"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#111827]">
                    Category Type
                    <select
                      value={formData.categoryType}
                      onChange={(event) => setFormData((current) => ({ ...current, categoryType: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                    >
                      {categoryTypes.map((type) => (
                        <option key={type} value={type}>{humanize(type)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-[#111827]">
                    Icon Symbol
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(event) => setFormData((current) => ({ ...current, icon: event.target.value.slice(0, 8) }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                      placeholder="Optional short symbol"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#111827]">
                    Image URL
                    <input
                      type="url"
                      value={formData.image}
                      onChange={(event) => setFormData((current) => ({ ...current, image: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                      placeholder="https://..."
                    />
                  </label>
                </div>
                <label className="block text-sm font-semibold text-[#111827]">
                  Description
                  <textarea
                    value={formData.description}
                    onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                    rows="4"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                    placeholder="Describe what products belong in this category"
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-[#F97316]"
                  />
                  Active category
                </label>
                <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-[#F97316] px-5 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCategories;
