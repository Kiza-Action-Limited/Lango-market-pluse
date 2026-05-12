import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FaCheckCircle, FaGlobe, FaSearch, FaSyncAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';
import SourcingOverview from '../components/business/SourcingOverview';
import SupplierCard from '../components/business/SupplierCard';
import { useRealtimeManufacturers } from '../hooks/useRealtimeManufacturers';
import { manufacturerService } from '../services/manufacturerService';
import { buildCapabilityChips, buildCategoryTabs } from '../utils/manufacturerMapper';

const Business = () => {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'all';
  const initialSearch = searchParams.get('search') || '';

  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeBusinessType, setActiveBusinessType] = useState('all');
  const [activeMode, setActiveMode] = useState('Businesses');
  const [draftQuery, setDraftQuery] = useState(initialSearch);
  const [query, setQuery] = useState(initialSearch);
  const [predictedSuppliers, setPredictedSuppliers] = useState([]);
  const [predicting, setPredicting] = useState(false);
  const [serverSearchSuppliers, setServerSearchSuppliers] = useState([]);
  const [serverSearching, setServerSearching] = useState(false);
  const [imageSearching, setImageSearching] = useState(false);
  const fileInputRef = useRef(null);

  const {
    categories,
    products,
    loading,
    refreshing,
    sourceMode,
    lastSyncedAt,
    headerConfig,
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

  const onSearchSubmit = (event) => {
    event.preventDefault();
    setQuery(draftQuery);
  };
  
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

  const onClickImageSearch = () => {
    fileInputRef.current?.click();
  };

  const onFileSearchChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageSearching(true);
    try {
      const result = await manufacturerService.searchByImage(file);
      const directSuppliers = Array.isArray(result?.suppliers) ? result.suppliers : [];
      if (directSuppliers.length) {
        setServerSearchSuppliers(directSuppliers);
        toast.success(`Image search found ${directSuppliers.length} business matches`);
      } else {
        toast.error('No image matches found');
      }
    } catch (error) {
      toast.error('Image search endpoint unavailable right now');
    } finally {
      setImageSearching(false);
      event.target.value = '';
    }
  };

  const syncedText = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Not synced yet';
  const aiPromptSuggestions = [
    'Find high confidence businesses for electronics bulk orders',
    'Show fast-response suppliers with low MOQ',
    'Suggest best businesses for private label customization',
    'Find reliable grocery suppliers for weekly restock',
  ];
  const aiTopMatches = useMemo(() => {
    return [...suppliers]
      .sort((a, b) => (b.aiPrediction?.confidence || 0) - (a.aiPrediction?.confidence || 0))
      .slice(0, 3);
  }, [suppliers]);

  return (
    <div className="bg-[#F3F4F6] min-h-screen">
      <section className="bg-[#F7F2F2] border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-3 text-sm mb-4">
            <div className="flex items-center gap-4 text-[#374151]">
              {(headerConfig?.topLinks || []).map((linkLabel, idx) => (
                <span key={linkLabel} className={idx === 0 ? 'font-semibold' : ''}>
                  {linkLabel}
                </span>
              ))}
            </div>
            <div className="text-[#6B7280] flex items-center gap-2">
              <FaGlobe />
              <span>{headerConfig?.countryLabel || 'Kenya'}</span>
            </div>
          </div>

          <div className="text-center mb-5">
            <div className="inline-flex gap-6 text-4xl font-semibold text-[#111827] mb-4">
              {(headerConfig?.modeTabs || [])
                .filter((tab) => String(tab).toLowerCase() !== 'worldwide')
                .map((tab) => {
                const lower = String(tab).toLowerCase();
                const isActive = tab === activeMode;
                if (lower.includes('product')) {
                  return (
                    <Link key={tab} to="/products" className={isActive ? 'text-[#F97316] border-b-4 border-[#F97316] pb-1' : ''}>
                      {tab}
                    </Link>
                  );
                }
                return (
                  <button
                    type="button"
                    key={tab}
                    onClick={() => setActiveMode(tab)}
                    className={isActive ? 'text-[#F97316] border-b-4 border-[#F97316] pb-1' : ''}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <form onSubmit={onSearchSubmit} className="max-w-3xl mx-auto bg-white rounded-2xl border-[3px] border-[#F97316] shadow-lg p-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftQuery}
                  onChange={(e) => setDraftQuery(e.target.value)}
                  placeholder={headerConfig?.searchPlaceholder || 'Search suppliers, products, capabilities...'}
                  className="flex-1 px-3 py-3 rounded-xl outline-none"
                />
                <button type="submit" className="px-5 py-3 rounded-xl bg-linear-to-r from-[#F97316] to-[#FB923C] text-white font-semibold inline-flex items-center gap-2">
                  <FaSearch />
                  {serverSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
              <div className="text-xs text-[#6B7280] mt-2 text-left px-2 flex items-center gap-3">
                <button type="button" onClick={onClickImageSearch} className="hover:text-[#F97316]">
                  {imageSearching ? 'Searching image...' : (headerConfig?.hints?.[0] || 'Image Search')}
                </button>
                <span>|</span>
                <button type="button" onClick={onClickImageSearch} className="hover:text-[#F97316]">
                  {headerConfig?.hints?.[1] || 'Search with File'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSearchChange} />
              </div>
            </form>
          </div>

          <div className="text-center pb-3">
            <h2 className="text-3xl font-semibold text-[#111827]">
              Connect with <span className="text-[#2563EB]">{suppliers.length}+</span> verified businesses
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-2 text-sm text-[#4B5563]">
              <span className="inline-flex items-center gap-1">
                <FaCheckCircle size={12} />
                5K+ industries covered
              </span>
              <span className="inline-flex items-center gap-1">
                <FaCheckCircle size={12} />
                Factory-direct pricing
              </span>
              <span className="inline-flex items-center gap-1">
                <FaCheckCircle size={12} />
                Sample and customization available
              </span>
            </div>
          </div>
        </div>
      </section>

      {activeMode === 'AI Mode' && (
        <section className="max-w-screen-2xl mx-auto px-4 pt-4">
          <div className="bg-white rounded-xl border border-[#FB923C]/30 p-4">
            <h3 className="text-lg font-semibold text-[#111827]">AI Mode (Mock Intelligence)</h3>
            <p className="text-sm text-[#6B7280] mt-1">
              Ask AI for sourcing guidance. Insights are generated from your current mock + live supplier dataset.
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {aiPromptSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setDraftQuery(prompt);
                    setQuery(prompt);
                  }}
                  className="px-3 py-1.5 rounded-full border border-gray-300 text-xs hover:border-[#F97316] hover:text-[#F97316]"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {aiTopMatches.map((match) => (
                <div key={match.id} className="rounded-lg border border-gray-200 p-3 bg-[#F9FAFB]">
                  <p className="font-semibold text-[#111827]">{match.name}</p>
                  <p className="text-xs text-[#6B7280] mt-1">{match.businessType}</p>
                  <p className="text-sm text-[#F97316] font-semibold mt-2">
                    AI Confidence: {match.aiPrediction?.confidence || 0}%
                  </p>
                  <p className="text-xs text-[#4B5563] mt-1">{match.aiPrediction?.trend || 'Stable candidate'}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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
                  setDraftQuery(chip);
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
