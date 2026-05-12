import React, { useEffect, useMemo, useState } from 'react';
import { FaExclamationTriangle, FaMapMarkerAlt, FaShieldAlt } from 'react-icons/fa';
import { productService } from '../services/productService';

const RegionalScarcityBoard = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await productService.getMyProducts({ page: 1, limit: 100 });
        setProducts(res?.data || []);
      } catch (error) {
        console.error('Failed to load scarcity board data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const hubSummary = useMemo(() => {
    const grouped = {};
    products.forEach((product) => {
      const hub = product.locationHub || 'Unassigned Hub';
      if (!grouped[hub]) {
        grouped[hub] = { totalStock: 0, essentials: [], alerts: 0 };
      }

      const stock = Number(product.quantityAvailable ?? product.stock ?? 0);
      const threshold = Number(product.minThreshold ?? 0);
      grouped[hub].totalStock += stock;

      if (product.isEssentialCommodity) {
        grouped[hub].essentials.push({
          id: product.id || product._id,
          name: product.name,
          stock,
          threshold,
          ratio: threshold > 0 ? stock / threshold : 999,
        });
      }

      if (threshold > 0 && stock <= threshold) {
        grouped[hub].alerts += 1;
      }
    });

    return Object.entries(grouped).map(([hub, data]) => {
      const essentialsAtRisk = data.essentials.filter((item) => item.ratio <= 1.2);
      const guardianState = essentialsAtRisk.length > 0 ? 'scarcity-risk' : 'stable';
      return {
        hub,
        ...data,
        essentialsAtRisk,
        guardianState,
      };
    });
  }, [products]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Regional Scarcity Board</h1>
        <p className="text-gray-600 mt-1">
          Frontend intelligence view of hub-level stock health using your current inventory feed.
        </p>
      </div>

      {hubSummary.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-gray-600">
          No hub data yet. Add products with `locationHub` and `isEssentialCommodity` to activate this board.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hubSummary.map((hub) => (
            <div key={hub.hub} className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FaMapMarkerAlt className="text-[#F97316]" />
                  <h2 className="text-xl font-semibold">{hub.hub}</h2>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    hub.guardianState === 'scarcity-risk' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {hub.guardianState === 'scarcity-risk' ? 'Scarcity Risk' : 'Stable'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Total Stock</p>
                  <p className="text-xl font-bold text-gray-900">{hub.totalStock}</p>
                </div>
                <div className="rounded bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Alerted Items</p>
                  <p className="text-xl font-bold text-gray-900">{hub.alerts}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <FaShieldAlt className="text-[#16A34A]" />
                  Essential Commodity Watch
                </div>
                {hub.essentials.length === 0 ? (
                  <p className="text-sm text-gray-500">No essential commodities tagged in this hub.</p>
                ) : (
                  hub.essentials.slice(0, 5).map((item) => {
                    const atRisk = item.ratio <= 1.2;
                    return (
                      <div
                        key={item.id}
                        className={`rounded border p-2 ${atRisk ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{item.name}</p>
                          {atRisk && <FaExclamationTriangle className="text-red-500" />}
                        </div>
                        <p className="text-xs text-gray-600">
                          Stock {item.stock} | Threshold {item.threshold || 0}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegionalScarcityBoard;
