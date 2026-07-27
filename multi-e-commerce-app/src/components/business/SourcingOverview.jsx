import React from 'react';
import { Link } from 'react-router-dom';
import { FaChevronRight, FaClipboardList, FaIndustry, FaUserCircle } from 'react-icons/fa';

const normalize = (value = '') => String(value || '').trim().toLowerCase();

const getProductId = (product = {}) => product?.id || product?._id;

const getProductImage = (product = {}) =>
  product?.images?.[0]?.url || product?.images?.[0] || product?.image || product?.thumbnail || '';

const getCategoryId = (category = {}) => category?.id || category?._id || category?.slug || category?.name;

const getCategoryName = (category = {}) => category?.name || category?.title || category?.label || getCategoryId(category);

const getUniqueProducts = (products = []) => {
  const seen = new Set();

  return products.filter((product) => {
    const id = getProductId(product);
    const name = String(product?.name || '').trim();
    const status = normalize(product?.status);
    if (!id || !name || product?.isActive === false || ['draft', 'inactive', 'deleted'].includes(status)) return false;

    const key = normalize(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getRankedSuppliers = (suppliers = []) => {
  const seen = new Set();
  const validSuppliers = suppliers.filter((supplier) => {
    const id = supplier?.id || supplier?._id;
    const name = String(supplier?.name || '').trim();
    if (!id || !name || normalize(name) === 'unknown supplier') return false;

    const key = `${String(id).toLowerCase()}::${normalize(name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const manufacturers = validSuppliers.filter((supplier) => normalize(supplier?.businessType).includes('manufacturer'));
  const source = manufacturers.length ? manufacturers : validSuppliers;

  return [...source]
    .sort((a, b) => {
      const scoreA = (Number(a.rating) || 0) * 10 + (Number(a.reviews) || 0) + (a.products?.length || 0);
      const scoreB = (Number(b.rating) || 0) * 10 + (Number(b.reviews) || 0) + (b.products?.length || 0);
      return scoreB - scoreA;
    })
    .slice(0, 4);
};

const SourcingOverview = ({ categories = [], products = [], topSuppliers = [] }) => {
  const uniqueProducts = getUniqueProducts(products);
  const sampleProducts = uniqueProducts.slice(0, 2);
  const rankedSuppliers = getRankedSuppliers(topSuppliers);

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <article className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-[#111827] mb-3">Source by category</h3>
        <ul className="space-y-2">
          {categories.slice(0, 6).map((category) => (
            <li key={getCategoryId(category)}>
              <Link to={`/products?category=${getCategoryId(category)}`} className="flex items-center justify-between text-sm text-[#374151] hover:text-[#F97316]">
                <span>{getCategoryName(category)}</span>
                <FaChevronRight size={12} />
              </Link>
            </li>
          ))}
        </ul>
      </article>

      <article className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-[#111827] mb-3">Get samples</h3>
        <div className="grid grid-cols-2 gap-2">
          {sampleProducts.map((product) => (
            <Link key={getProductId(product)} to={`/products/${getProductId(product)}`} className="rounded-lg bg-gray-50 p-2 hover:shadow-sm transition">
              {getProductImage(product) ? (
                <img src={getProductImage(product)} alt={product.name} className="w-full h-20 object-cover rounded-md" />
              ) : (
                <div className="w-full h-20 rounded-md bg-gray-200 flex items-center justify-center text-gray-500">
                  <FaIndustry />
                </div>
              )}
              <p className="mt-2 text-xs text-[#111827] line-clamp-2">{product.name}</p>
            </Link>
          ))}
          {sampleProducts.length === 0 && (
            <p className="col-span-2 text-sm text-[#6B7280]">No live sample products yet.</p>
          )}
        </div>
      </article>

      <article className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-[#111827] mb-3">Top-ranking manufacturers</h3>
        <div className="grid grid-cols-2 gap-2">
          {rankedSuppliers.map((supplier) => (
            <Link key={supplier.id} to={`/businesses/${supplier.id}`} className="rounded-lg bg-gray-50 p-2 hover:shadow-sm transition">
              {supplier.coverImage || supplier.products?.[0]?.image ? (
                <img src={supplier.coverImage || supplier.products?.[0]?.image} alt={supplier.name} className="w-full h-20 object-cover rounded-md" />
              ) : (
                <div className="w-full h-20 rounded-md bg-gray-200 flex items-center justify-center text-gray-500">
                  <FaIndustry />
                </div>
              )}
              <p className="mt-2 text-xs font-medium text-[#111827] line-clamp-1">{supplier.name}</p>
              <p className="text-[11px] text-[#6B7280] line-clamp-1">{supplier.businessType}</p>
            </Link>
          ))}
          {rankedSuppliers.length === 0 && (
            <p className="col-span-2 text-sm text-[#6B7280]">No live manufacturers yet.</p>
          )}
        </div>
      </article>

      <article className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-[#6B7280] mb-4">
          <FaUserCircle />
          <p className="text-sm">Welcome! Guest</p>
        </div>
        <div className="flex gap-2 mb-4">
          <Link to="/login" className="flex-1 text-center px-3 py-2 rounded-full bg-[#F97316] text-white text-sm font-semibold hover:bg-[#EA580C]">
            Sign in
          </Link>
          <Link to="/register" className="flex-1 text-center px-3 py-2 rounded-full bg-[#FB923C] text-white text-sm font-semibold hover:opacity-90">
            Join for free
          </Link>
        </div>
        <div className="text-xs text-[#6B7280] mb-2">One request, multiple quotes</div>
        <Link to="/contact" className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full border-2 border-[#111827] text-sm font-semibold hover:bg-gray-50">
          <FaClipboardList />
          Request for Quotation
        </Link>
        <div className="mt-3 text-xs text-[#6B7280]">
          Top suppliers now: <span className="font-semibold text-[#111827]">{rankedSuppliers.length}</span>
        </div>
      </article>
    </section>
  );
};

export default SourcingOverview;
