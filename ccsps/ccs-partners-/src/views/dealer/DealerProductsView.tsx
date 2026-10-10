import React, { useState } from 'react';
import { Product } from '../../types';

interface DealerProductsViewProps {
  products: Product[];
  onCreateOrder?: (product?: Product) => void;
}

export const DealerProductsView: React.FC<DealerProductsViewProps> = ({
  products = [],
  onCreateOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Fertilizers', 'Pesticides', 'Seeds', 'Bio Products', 'Fungicides'];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.technicalName && p.technicalName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6 font-body text-xs">
      {/* Header Banner */}
      <div className="bg-white border border-[#e2e8f0] p-5 rounded-lg shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#14532d] tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-[#16a34a]">inventory_2</span>
            Products Catalog
          </h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Browse official Chitra Crop Science products, specifications, pricing, and recommended uses.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-[#e2e8f0] p-4 rounded-lg shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#94a3b8] text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search products or chemical name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-[#cbd5e1] rounded text-xs focus:outline-none focus:border-[#16a34a]"
          />
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full font-bold text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#16a34a] text-white shadow-xs'
                  : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProducts.map((prod) => (
          <div
            key={prod.id}
            className="bg-white border border-[#e2e8f0] rounded-lg shadow-xs hover:shadow-md transition-shadow flex flex-col overflow-hidden"
          >
            {/* Product Image Box */}
            <div className="h-44 bg-[#f8fafc] border-b border-[#e2e8f0] relative flex items-center justify-center p-3">
              <img
                src={prod.imageUrl}
                alt={prod.name}
                className="max-h-full max-w-full object-contain filter drop-shadow-sm"
              />
              <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                (prod.is_available ?? (prod.status === 'Available' || prod.status === 'Active'))
                  ? 'bg-[#dcfce7] text-[#14532d] border-[#86efac]'
                  : 'bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]'
              }`}>
                {(prod.is_available ?? (prod.status === 'Available' || prod.status === 'Active')) ? 'Available' : 'Unavailable'}
              </span>
              <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-[#f1f5f9] text-[#334155] text-[10px] font-bold border border-[#cbd5e1] rounded-full">
                {prod.category}
              </span>
            </div>


            {/* Product Metadata Content */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-sm font-bold text-[#14532d] leading-snug">{prod.name}</h3>
                <div className="text-[11px] text-[#64748b] font-mono mt-0.5">{prod.technicalName}</div>

                <div className="mt-3 space-y-1.5 bg-[#f8fafc] p-2.5 rounded border border-[#e2e8f0]">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#64748b]">Product Type:</span>
                    <span className="font-semibold text-[#0f172a]">{prod.category}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#64748b]">Product Size:</span>
                    <span className="font-semibold text-[#0f172a]">{prod.packSize}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#64748b]">Dealer Price:</span>
                    <span className="font-extrabold text-[#15803d] text-xs">
                      ₹{prod.dealerPrice.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Uses */}
                <div className="mt-2 text-[11px] text-[#334155]">
                  <span className="font-bold text-[#14532d]">Recommended Uses: </span>
                  <span>{prod.description || `Effective control on ${prod.recommendedCrops.join(', ')} crops.`}</span>
                </div>
              </div>

              {/* View Details Button */}
              <button
                onClick={() => alert(`Product Information:\n\nName: ${prod.name}\nTechnical Name: ${prod.technicalName}\nCategory: ${prod.category}\nPack Size: ${prod.packSize}\nDealer Price: ₹${prod.dealerPrice.toLocaleString('en-IN')}\n\nRecommended Uses:\n${prod.description || 'Effective crop protection solution.'}`)}
                className="w-full border border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#334155] py-2 font-bold text-xs rounded-md shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                <span className="material-symbols-outlined text-[16px] text-[#16a34a]">info</span>
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
