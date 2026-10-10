import React, { useState } from 'react';
import { Product } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';

interface AdminProductsProps {
  products?: Product[];
  onAddProduct?: (product: any) => Promise<any> | void;
  onUpdateProduct?: (id: string, product: Partial<Product>) => Promise<any> | void;
  onDeleteProduct?: (id: string) => Promise<any> | void;
  userRole?: string;
}

export const AdminProducts: React.FC<AdminProductsProps> = ({
  products = [],
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  userRole = 'ADMIN',
}) => {
  const isAdmin = !userRole || userRole.toUpperCase() === 'ADMIN';

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Available' | 'Unavailable'>('ALL');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Form state
  const [name, setName] = useState('');
  const [techName, setTechName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Fertilizers');
  const [packSize, setPackSize] = useState('1 Ltr');
  const [dealerPrice, setDealerPrice] = useState('1200');
  const [distributorPrice, setDistributorPrice] = useState('1056');
  const [mrp, setMrp] = useState('1500');
  const [gst, setGst] = useState('18');
  const [availability, setAvailability] = useState<'Available' | 'Unavailable'>('Available');

  // Edit Form state
  const [editName, setEditName] = useState('');
  const [editTechName, setEditTechName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editCategory, setEditCategory] = useState('Fertilizers');
  const [editPackSize, setEditPackSize] = useState('');
  const [editDealerPrice, setEditDealerPrice] = useState('');
  const [editDistributorPrice, setEditDistributorPrice] = useState('');
  const [editMrp, setEditMrp] = useState('');
  const [editGst, setEditGst] = useState('18');
  const [editAvailability, setEditAvailability] = useState<'Available' | 'Unavailable'>('Available');

  // Extract unique categories
  const categories = [
    'ALL',
    ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
  ];

  // Helper: check availability
  const isProductAvailable = (p: Product) => {
    if (p.is_available !== undefined) return p.is_available;
    const st = (p.status || '').toLowerCase();
    return st === 'available' || st === 'active';
  };

  // Filtered products list
  const filtered = (products || []).filter((p) => {
    const s = (search || '').toLowerCase();
    const matchesSearch =
      (p.name || '').toLowerCase().includes(s) ||
      (p.code || '').toLowerCase().includes(s) ||
      (p.technicalName || '').toLowerCase().includes(s);

    const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;

    const available = isProductAvailable(p);
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'Available' && available) ||
      (statusFilter === 'Unavailable' && !available);

    return matchesSearch && matchesCat && matchesStatus;
  });

  const availableCount = products.filter(isProductAvailable).length;
  const unavailableCount = products.length - availableCount;

  // Open Edit Modal
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name || '');
    setEditTechName(p.technicalName || '');
    setEditCode(p.code || '');
    setEditCategory(p.category || 'Fertilizers');
    setEditPackSize(p.packSize || '1 Ltr');
    setEditDealerPrice(String(p.dealerPrice || 0));
    setEditDistributorPrice(String(p.distributorPrice || Math.round((p.dealerPrice || 0) * 0.88)));
    setEditMrp(String(p.mrp || 0));
    setEditGst(String(p.gst !== undefined ? p.gst : 18));
    setEditAvailability(isProductAvailable(p) ? 'Available' : 'Unavailable');
  };

  // Toggle availability inline
  const handleToggleAvailability = async (p: Product) => {
    if (!isAdmin) return;
    const newStatus: 'Available' | 'Unavailable' = isProductAvailable(p) ? 'Unavailable' : 'Available';
    try {
      if (onUpdateProduct) {
        await onUpdateProduct(p.id, { status: newStatus });
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to update product availability');
    }
  };

  // Handle Add Product Submission
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        technicalName: techName.trim() || 'Formulated Solution',
        code: code.trim() || `PRD-${Math.floor(100 + Math.random() * 900)}`,
        category,
        packSize: packSize.trim() || '1 Ltr',
        mrp: parseFloat(mrp) || 0,
        dealerPrice: parseFloat(dealerPrice) || 0,
        distributorPrice: parseFloat(distributorPrice) || (parseFloat(dealerPrice) || 0) * 0.88,
        gst: parseFloat(gst) || 18,
        status: availability,
        description: `${name} agricultural formulation.`,
      };

      if (onAddProduct) {
        await onAddProduct(payload);
      }

      setName('');
      setTechName('');
      setCode('');
      setShowAddModal(false);
    } catch (e: any) {
      alert(e?.message || 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Product Submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editName.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<Product> = {
        name: editName.trim(),
        technicalName: editTechName.trim(),
        code: editCode.trim(),
        category: editCategory,
        packSize: editPackSize.trim(),
        mrp: parseFloat(editMrp) || 0,
        dealerPrice: parseFloat(editDealerPrice) || 0,
        distributorPrice: parseFloat(editDistributorPrice) || 0,
        gst: parseFloat(editGst) || 18,
        status: editAvailability,
      };

      if (onUpdateProduct) {
        await onUpdateProduct(editingProduct.id, payload);
      }
      setEditingProduct(null);
    } catch (e: any) {
      alert(e?.message || 'Failed to update product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsSubmitting(true);
    setDeleteError(null);
    try {
      if (onDeleteProduct) {
        await onDeleteProduct(deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (e: any) {
      const msg = e?.message || 'Cannot delete product with existing order history.';
      setDeleteError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safely Deactivate instead of deleting
  const handleDeactivateInstead = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      if (onUpdateProduct) {
        await onUpdateProduct(deleteTarget.id, { status: 'Unavailable' });
      }
      setDeleteTarget(null);
      setDeleteError(null);
    } catch (e: any) {
      alert(e?.message || 'Failed to deactivate product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-body text-xs">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e0e0e0] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-light text-[#161616]">Product Master Catalog</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#e0e0e0] text-[#161616] tracking-wider">
              Admin Control
            </span>
          </div>
          <p className="text-xs text-[#525252] mt-0.5">
            Manage SKUs, technical chemical formulations, pack sizes, B2B wholesale rates, and active order availability
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="carbon-btn-primary text-xs h-9 px-4 cursor-pointer flex items-center shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px] mr-1.5">add</span>
            Add New Product
          </button>
        )}
      </div>

      {/* KPI Availability Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3 border border-[#e0e0e0] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#525252] uppercase tracking-wider">Total SKUs in Catalog</div>
            <div className="text-xl font-extrabold text-[#161616] mt-0.5">{products.length}</div>
          </div>
          <span className="material-symbols-outlined text-[#0f62fe] text-[24px]">category</span>
        </div>

        <div className="bg-white p-3 border border-[#a7f0ba] bg-[#f6fdf8] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#0e6027] uppercase tracking-wider">Available for Orders</div>
            <div className="text-xl font-extrabold text-[#198038] mt-0.5">{availableCount}</div>
          </div>
          <span className="material-symbols-outlined text-[#198038] text-[24px]">check_circle</span>
        </div>

        <div className="bg-white p-3 border border-[#ffb3b8] bg-[#fff8f8] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#da1e28] uppercase tracking-wider">Unavailable / Inactive</div>
            <div className="text-xl font-extrabold text-[#da1e28] mt-0.5">{unavailableCount}</div>
          </div>
          <span className="material-symbols-outlined text-[#da1e28] text-[24px]">block</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 border border-[#e0e0e0] flex flex-col md:flex-row justify-between gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#8d8d8d] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name, SKU / barcode, or technical chemical formulation..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#f4f4f4] border border-[#e0e0e0] text-xs text-[#161616] focus:outline-none focus:border-[#0f62fe]"
          />
        </div>

        {/* Availability Status Filter */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-[#525252] mr-1">Status:</span>
          {(['ALL', 'Available', 'Unavailable'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer border ${
                statusFilter === st
                  ? 'bg-[#0f62fe] text-white border-[#0f62fe]'
                  : 'bg-[#f4f4f4] text-[#525252] border-[#e0e0e0] hover:bg-[#e0e0e0]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex gap-1 overflow-x-auto max-w-md">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer border ${
                categoryFilter === cat
                  ? 'bg-[#161616] text-white border-[#161616]'
                  : 'bg-[#f4f4f4] text-[#525252] border-[#e0e0e0] hover:bg-[#e0e0e0]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Master Table */}
      <div className="bg-white border border-[#e0e0e0] overflow-x-auto shadow-xs">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-[#f4f4f4] text-[#525252] border-b border-[#e0e0e0] uppercase text-[11px] tracking-wider">
            <tr>
              <th className="p-3 font-semibold">SKU / Code</th>
              <th className="p-3 font-semibold">Product Name</th>
              <th className="p-3 font-semibold">Technical Formulation</th>
              <th className="p-3 font-semibold">Category</th>
              <th className="p-3 font-semibold">Pack Size</th>
              <th className="p-3 font-semibold text-right">MRP (₹)</th>
              <th className="p-3 font-semibold text-right">Dealer Price (₹)</th>
              <th className="p-3 font-semibold text-center">Availability Status</th>
              {isAdmin && <th className="p-3 font-semibold text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e0e0e0]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} className="p-8 text-center text-[#64748b]">
                  No products found matching the current search or filters.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const available = isProductAvailable(p);
                return (
                  <tr key={p.id} className={`hover:bg-[#f4f4f4] ${!available ? 'bg-[#fafafa]' : ''}`}>
                    <td className="p-3 font-mono font-bold text-[#0f62fe]">{p.code}</td>
                    <td className="p-3 font-bold text-[#161616]">{p.name}</td>
                    <td className="p-3 text-[#525252] max-w-xs truncate" title={p.technicalName}>
                      {p.technicalName || 'N/A'}
                    </td>
                    <td className="p-3 text-[#525252]">
                      <span className="px-1.5 py-0.5 bg-[#f4f4f4] border border-[#e0e0e0] text-[10px] font-semibold">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-3 text-[#525252] font-medium">{p.packSize}</td>
                    <td className="p-3 text-right text-[#525252]">₹{p.mrp?.toLocaleString('en-IN') || 0}</td>
                    <td className="p-3 text-right font-bold text-[#161616]">
                      ₹{p.dealerPrice?.toLocaleString('en-IN') || 0}
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={available ? 'Available' : 'Unavailable'} />
                    </td>
                    {isAdmin && (
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Quick Availability Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(p)}
                            title={available ? 'Click to mark as Unavailable' : 'Click to mark as Available'}
                            className={`px-2 py-1 text-[11px] font-bold cursor-pointer border flex items-center gap-1 transition-colors ${
                              available
                                ? 'bg-white hover:bg-[#fff1f1] text-[#da1e28] border-[#ffb3b8]'
                                : 'bg-[#defbe6] hover:bg-[#c6f6d5] text-[#0e6027] border-[#a7f0ba]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {available ? 'toggle_on' : 'toggle_off'}
                            </span>
                            {available ? 'Deactivate' : 'Activate'}
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit product formulation and rates"
                            className="p-1 text-[#0f62fe] hover:bg-[#e5f0ff] border border-transparent hover:border-[#a6c8ff] cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(p);
                              setDeleteError(null);
                            }}
                            title="Delete or deactivate product"
                            className="p-1 text-[#da1e28] hover:bg-[#fff1f1] border border-transparent hover:border-[#ffb3b8] cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-[#e0e0e0] w-full max-w-lg p-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#e0e0e0] pb-2 mb-4">
              <h3 className="text-sm font-bold text-[#161616] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#0f62fe] text-[18px]">add_box</span>
                Add New Product Formulation
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#525252] hover:text-[#161616] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#525252]">Product Brand Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chlorpyrifos 20% EC"
                  className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#525252]">Technical Chemical Formulation</label>
                <input
                  type="text"
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  placeholder="e.g. Chlorpyrifos 20% Emulsifiable Concentrate"
                  className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">SKU / Product Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. PRD-CHLOR-1L"
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-mono font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  >
                    <option value="Fertilizers">Fertilizers</option>
                    <option value="Pesticides">Pesticides</option>
                    <option value="Seeds">Seeds</option>
                    <option value="Bio Products">Bio Products</option>
                    <option value="Fungicides">Fungicides</option>
                    <option value="Herbicides">Herbicides</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">Pack Size</label>
                  <input
                    type="text"
                    value={packSize}
                    onChange={(e) => setPackSize(e.target.value)}
                    placeholder="e.g. 1 Ltr / 500 ml / 5 Kg"
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">Availability Status</label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value as any)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  >
                    <option value="Available">Available (Orderable)</option>
                    <option value="Unavailable">Unavailable (Blocked)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">Dealer Rate (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={dealerPrice}
                    onChange={(e) => setDealerPrice(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">Distributor (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={distributorPrice}
                    onChange={(e) => setDistributorPrice(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">GST (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gst}
                    onChange={(e) => setGst(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e0e0e0]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-[#e0e0e0] text-[#161616] cursor-pointer hover:bg-[#f4f4f4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#0f62fe] hover:bg-[#0043ce] text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-[#e0e0e0] w-full max-w-lg p-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#e0e0e0] pb-2 mb-4">
              <h3 className="text-sm font-bold text-[#161616] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#0f62fe] text-[18px]">edit</span>
                Edit Product Master: {editingProduct.name}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-[#525252] hover:text-[#161616] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#525252]">Product Brand Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#525252]">Technical Chemical Formulation</label>
                <input
                  type="text"
                  value={editTechName}
                  onChange={(e) => setEditTechName(e.target.value)}
                  className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">SKU / Product Code</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-mono font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  >
                    <option value="Fertilizers">Fertilizers</option>
                    <option value="Pesticides">Pesticides</option>
                    <option value="Seeds">Seeds</option>
                    <option value="Bio Products">Bio Products</option>
                    <option value="Fungicides">Fungicides</option>
                    <option value="Herbicides">Herbicides</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">Pack Size</label>
                  <input
                    type="text"
                    value={editPackSize}
                    onChange={(e) => setEditPackSize(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">Availability Status</label>
                  <select
                    value={editAvailability}
                    onChange={(e) => setEditAvailability(e.target.value as any)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  >
                    <option value="Available">Available (Orderable)</option>
                    <option value="Unavailable">Unavailable (Blocked)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editMrp}
                    onChange={(e) => setEditMrp(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">Dealer Rate (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editDealerPrice}
                    onChange={(e) => setEditDealerPrice(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">Distributor (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editDistributorPrice}
                    onChange={(e) => setEditDistributorPrice(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#525252]">GST (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editGst}
                    onChange={(e) => setEditGst(e.target.value)}
                    className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs font-medium focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e0e0e0]">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-3 py-1.5 border border-[#e0e0e0] text-[#161616] cursor-pointer hover:bg-[#f4f4f4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#0f62fe] hover:bg-[#0043ce] text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DESTRUCTIVE ACTION / DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-[#e0e0e0] w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-[#da1e28] border-b border-[#e0e0e0] pb-2 mb-3">
              <span className="material-symbols-outlined text-[22px]">warning</span>
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Product Removal Confirmation
              </h3>
            </div>

            <p className="text-xs text-[#161616] leading-relaxed">
              Are you sure you want to permanently delete product:
            </p>
            <div className="my-2 p-2.5 bg-[#f4f4f4] border border-[#e0e0e0]">
              <div className="font-bold text-sm text-[#161616]">{deleteTarget.name}</div>
              <div className="text-[11px] text-[#525252] mt-0.5 font-mono">
                SKU: {deleteTarget.code} • Formulation: {deleteTarget.technicalName || 'N/A'}
              </div>
            </div>

            {deleteError ? (
              <div className="my-3 p-3 bg-[#fff1f1] border border-[#ffb3b8] text-xs text-[#750e13] space-y-2">
                <div className="font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  Permanent Deletion Blocked
                </div>
                <p className="text-[11px]">{deleteError}</p>
                <p className="text-[11px] font-semibold text-[#161616]">
                  To protect business transaction records, you can deactivate this product instead.
                  Deactivated products are marked as Unavailable and blocked from new orders while keeping all historical records intact.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDeactivateInstead}
                    disabled={isSubmitting}
                    className="w-full py-2 bg-[#da1e28] hover:bg-[#b81921] text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">block</span>
                    Deactivate Product (Set to Unavailable)
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[#525252] mt-2 mb-4">
                If this product has existing orders or transaction records, permanent deletion is prevented to protect ledger integrity; you will be prompted to deactivate it instead.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e0e0e0]">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="px-3 py-1.5 border border-[#e0e0e0] text-[#161616] cursor-pointer hover:bg-[#f4f4f4]"
              >
                Cancel
              </button>
              {!deleteError && (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#da1e28] hover:bg-[#b81921] text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
