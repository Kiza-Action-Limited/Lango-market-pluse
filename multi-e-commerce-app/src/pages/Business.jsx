import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FaSyncAlt } from 'react-icons/fa';
import SourcingOverview from '../components/business/SourcingOverview';
import SupplierCard from '../components/business/SupplierCard';
import { useRealtimeManufacturers } from '../hooks/useRealtimeManufacturers';
import { buildCapabilityChips, buildCategoryTabs } from '../utils/manufacturerMapper';

const Business = () => {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'all';
  const initialSearch = searchParams.get('search') || '';

  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeBusinessType, setActiveBusinessType] = useState('all');
  const [query, setQuery] = useState(initialSearch);
  const [predictedSuppliers, setPredictedSuppliers] = useState([]);
  const [predicting, setPredicting] = useState(false);
  const [serverSearchSuppliers, setServerSearchSuppliers] = useState([]);
  const [serverSearching, setServerSearching] = useState(false);

  const {
    categories,
    products,
    loading,
    refreshing,
    sourceMode,
    lastSyncedAt,
    baseSuppliers,
    reload,
    getSuppliersWithPrediction,
    searchSuppliersRealtime,
  } = useRealtimeManufacturers();

  useEffect(() => {
    let active = true;
    const runPrediction = async () => {
      setPredicting(true);
      const result = await getSuppliersWithPrediction(query);
      if (active) setPredictedSuppliers(result);
      setPredicting(false);
    };
    runPrediction();
    return () => {
      active = false;
    };
  }, [baseSuppliers, getSuppliersWithPrediction, query]);

  const categoryTabs = useMemo(() => buildCategoryTabs(categories), [categories]);
  const suppliers =
    serverSearchSuppliers.length > 0
      ? serverSearchSuppliers
      : predictedSuppliers.length
      ? predictedSuppliers
      : baseSuppliers;
  const businessTypes = useMemo(() => {
    const types = Array.from(new Set(suppliers.map((supplier) => supplier.businessType).filter(Boolean)));
    return ['all', ...types];
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const categoryOk = activeCategory === 'all' || supplier.categoryId === activeCategory;
      const typeOk =
        activeBusinessType === 'all' ||
        String(supplier.businessType || '').toLowerCase() === activeBusinessType.toLowerCase();
      const queryValue = query.trim().toLowerCase();
      if (!queryValue) return categoryOk && typeOk;
      const queryOk =
        supplier.name.toLowerCase().includes(queryValue) ||
        supplier.businessType.toLowerCase().includes(queryValue) ||
        supplier.capabilities.some((capability) => capability.toLowerCase().includes(queryValue)) ||
        supplier.products.some((product) => product.name.toLowerCase().includes(queryValue));
      return categoryOk && typeOk && queryOk;
    });
  }, [suppliers, activeCategory, activeBusinessType, query]);

  const capabilityChips = useMemo(() => buildCapabilityChips(suppliers), [suppliers]);
  
  useEffect(() => {
    let active = true;
    const runServerSearch = async () => {
      if (!query.trim()) {
        setServerSearchSuppliers([]);
        return;
      }
      setServerSearching(true);
      try {
        const results = await searchSuppliersRealtime({
          query,
          category: activeCategory === 'all' ? '' : activeCategory,
          businessType: activeBusinessType === 'all' ? '' : activeBusinessType,
        });
        if (active && Array.isArray(results)) {
          setServerSearchSuppliers(results);
        }
      } catch (error) {
        if (active) setServerSearchSuppliers([]);
      } finally {
        if (active) setServerSearching(false);
      }
    };
    runServerSearch();
    return () => {
      active = false;
    };
  }, [query, activeCategory, activeBusinessType, searchSuppliersRealtime]);

  const syncedText = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Not synced yet';

  return (
    <div className="bg-[#F3F4F6] min-h-screen">
      <section className="max-w-screen-2xl mx-auto px-4 py-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
          <SourcingOverview categories={categories} products={products} topSuppliers={suppliers} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
          <div className="flex flex-wrap items-center gap-2 justify-between mb-3">
            <p className="text-xs text-[#6B7280]">
              Source: <span className="font-semibold uppercase">{sourceMode}</span> | Last sync: {syncedText}
              {predicting ? ' | AI scoring...' : ''}
              {serverSearching ? ' | Server search...' : ''}
            </p>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-300 text-sm hover:bg-gray-50"
            >
              <FaSyncAlt className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="flex overflow-x-auto gap-6 pb-2">
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`whitespace-nowrap text-sm font-medium border-b-2 pb-2 ${
                  activeCategory === tab.id ? 'text-[#111827] border-[#111827]' : 'text-[#6B7280] border-transparent'
                }`}
              >
                {tab.name}
              </button>
            ))}
            <Link to="/categories" className="ml-auto whitespace-nowrap text-sm px-3 py-1 border border-gray-400 rounded-full">
              View more
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {businessTypes.map((type) => (
              <button
                key={type}
                onClick={() => setActiveBusinessType(type)}
                className={`px-3 py-1 rounded-full border text-xs ${
                  activeBusinessType === type
                    ? 'border-[#111827] bg-[#111827] text-white'
                    : 'border-gray-400 text-[#374151] hover:border-[#F97316] hover:text-[#F97316]'
                }`}
              >
                {type === 'all' ? 'All business types' : type}
              </button>
            ))}
            <Link
              to={`/businesses${activeBusinessType !== 'all' ? `?type=${encodeURIComponent(activeBusinessType)}` : ''}`}
              className="ml-auto px-3 py-1 rounded-full border border-[#F97316] text-[#F97316] text-xs hover:bg-[#F97316]/10"
            >
              Open business directory
            </Link>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {capabilityChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  setQuery(chip);
                }}
                className="px-3 py-1 rounded-full border-2 border-gray-400 text-xs hover:border-[#F97316] hover:text-[#F97316]"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]" />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h3 className="text-xl font-semibold text-[#111827] mb-2">No suppliers match your filters</h3>
            <p className="text-[#6B7280]">Try a different category or search term.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSuppliers.map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Business;
