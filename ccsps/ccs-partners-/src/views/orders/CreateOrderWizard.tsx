import React, { useState } from 'react';
import { Product, Dealer, Order, OrderItem } from '../../types';

interface CreateOrderWizardProps {
  products: Product[];
  dealers: Dealer[];
  onSaveOrder: (newOrder: Order) => void;
  onCancel: () => void;
}

export const CreateOrderWizard: React.FC<CreateOrderWizardProps> = ({
  products,
  dealers,
  onSaveOrder,
  onCancel,
}) => {
  const [selectedDealerId, setSelectedDealerId] = useState(dealers[0]?.id || 'd-1');
  const [paymentTerms, setPaymentTerms] = useState<string>('Credit 30 Days');
  const [remarks, setRemarks] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Quantities map: productId -> number
  const [cartItems, setCartItems] = useState<{ [productId: string]: number }>(() => {
    const defaultProduct = products && products.length > 0 ? products[0].id : 'p-1';
    return { [defaultProduct]: 2 };
  });

  const selectedDealer = dealers.find((d) => d.id === selectedDealerId) || dealers[0];

  const isProductUnavailable = (p: Product) => {
    if (p.is_available !== undefined) return !p.is_available;
    const statusLower = (p.status || '').toLowerCase();
    return statusLower === 'unavailable' || statusLower === 'inactive' || statusLower === 'discontinued';
  };

  const updateQuantity = (productId: string, qty: number) => {
    const targetProduct = products.find((p) => p.id === productId);
    if (targetProduct && isProductUnavailable(targetProduct) && qty > (cartItems[productId] || 0)) {
      alert(`Cannot order "${targetProduct.name}": Product is currently marked as Unavailable. Only Available products can be ordered.`);
      return;
    }

    if (qty <= 0) {
      const next = { ...cartItems };
      delete next[productId];
      setCartItems(next);
    } else {
      setCartItems({ ...cartItems, [productId]: qty });
    }
  };

  // Dynamically extract categories from real products
  const availableCategories = ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

  const filteredProducts = products.filter((p) => {
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (p.name || '').toLowerCase().includes(q);
    const codeMatch = (p.code || (p as any).productCode || (p as any).sku || '').toLowerCase().includes(q);
    const techMatch = (p.technicalName || '').toLowerCase().includes(q);
    const catMatch = (p.category || '').toLowerCase().includes(q);

    return nameMatch || codeMatch || techMatch || catMatch;
  });

  const orderItemsList: OrderItem[] = Object.entries(cartItems)
    .map(([pId, rawQty]): OrderItem | null => {
      const qty = Number(rawQty);
      const prod = products.find((p) => p.id === pId);
      if (!prod || qty <= 0) return null;
      const itemSubtotal = prod.dealerPrice * qty;
      return {
        id: `ITEM-${Math.random().toString(36).substr(2, 6)}`,
        productId: prod.id,
        productName: prod.name,
        productCode: prod.code,
        packSize: prod.packSize,
        quantity: qty,
        dealerPrice: prod.dealerPrice,
        mrp: prod.mrp,
        subtotal: itemSubtotal,
        imageUrl: prod.imageUrl,
      };
    })
    .filter((item): item is OrderItem => item !== null);

  const rawSubtotal = orderItemsList.reduce((acc, item) => acc + item.subtotal, 0);
  const gstTotal = Math.round(rawSubtotal * 0.18);
  const grandTotal = rawSubtotal + gstTotal;

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItemsList.length === 0) {
      alert('Please select at least one product SKU to create an order.');
      return;
    }

    // Validate that no unavailable products are in the order
    const unavailableSelected = orderItemsList.filter((item) => {
      const prod = products.find((p) => p.id === item.productId);
      return prod && isProductUnavailable(prod);
    });
    if (unavailableSelected.length > 0) {
      alert(`Cannot submit order: The following product(s) are currently marked as Unavailable: ${unavailableSelected.map(i => i.productName).join(', ')}. Please remove them from your order to proceed.`);
      return;
    }

    const newOrder: Order = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      orderNumber: `CCS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      date: new Date().toISOString().split('T')[0],
      dealerId: selectedDealer?.id || 'd-1',
      dealerName: selectedDealer?.name || 'Agri Solutions Ltd',
      dealerCode: selectedDealer?.code || 'ASL-092',
      dealerCity: selectedDealer?.city || 'Pune',
      distributorId: selectedDealer?.distributorId || 'dist-1',
      distributorName: selectedDealer?.distributorName || 'Chitra Sales Corp',
      status: 'Pending Approval',
      paymentStatus: 'Pending',
      subtotal: rawSubtotal,
      discount: 0,
      tax: gstTotal,
      grandTotal,
      items: orderItemsList,
      remarks: remarks || `Payment terms: ${paymentTerms}. B2B Order placement`,
      createdAt: new Date().toISOString(),
    };

    onSaveOrder(newOrder);
  };

  return (
    <div className="space-y-6 font-body text-xs max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-[#e0e0e0] pb-4">
        <div>
          <h1 className="text-2xl font-light text-[#161616]">B2B Bulk Crop Protection Order Entry</h1>
          <p className="text-xs text-[#525252] mt-0.5">
            Select products, review wholesale pricing with GST, and dispatch to distributor
          </p>
        </div>
        <button
          onClick={onCancel}
          className="carbon-btn-ghost text-xs h-8 px-3 border border-[#e0e0e0] cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Distributor Selection & Product Catalog */}
        <div className="lg:col-span-2 space-y-4">
          {/* Distributor Selection Box */}
          <div className="bg-white border border-[#e0e0e0] p-4 shadow-xs space-y-3">
            <h3 className="font-bold text-xs text-[#161616] uppercase tracking-wider border-b border-[#e0e0e0] pb-2">
              1. Select Recipient Distributor
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#525252] mb-1">Target Distributor</label>
                <select
                  value={selectedDealerId}
                  onChange={(e) => setSelectedDealerId(e.target.value)}
                  className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] font-medium text-xs focus:outline-none focus:border-[#0f62fe]"
                >
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.city}, {d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#525252] mb-1">Payment Term & Credit</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] font-medium text-xs focus:outline-none focus:border-[#0f62fe]"
                >
                  <option value="Cash (15 Days)">Cash (15 Days)</option>
                  <option value="Advance">Advance</option>
                  <option value="Credit (90 Days)">Credit (90 Days)</option>
                </select>
              </div>
            </div>

            {selectedDealer && (
              <div className="p-2.5 bg-[#e5f0ff] border border-[#a6c8ff] text-[11px] text-[#001d6c] flex justify-between items-center">
                <span>
                  <strong>Selected:</strong> {selectedDealer.name} • GST: {selectedDealer.gstin}
                </span>
                <span>
                  <strong>Credit Limit:</strong> ₹{selectedDealer.creditLimit.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>

          {/* Product Catalog Picker */}
          <div className="bg-white border border-[#e0e0e0] shadow-xs">
            {/* Search and Category Filter Section */}
            <div className="p-3 bg-[#f4f4f4] border-b border-[#e0e0e0] space-y-2.5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="font-bold text-xs text-[#161616] uppercase tracking-wider">
                  2. Add Chemical SKUs & Quantities
                </span>
                <span className="text-[11px] text-[#525252]">
                  Showing {filteredProducts.length} of {products.length} products
                </span>
              </div>

              {/* Responsive Product Search Box */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#8d8d8d] text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search products by Name, SKU / Product Code, Technical Name, or Category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 bg-white border border-[#e0e0e0] text-xs text-[#161616] placeholder-[#8d8d8d] focus:outline-none focus:border-[#0f62fe]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-[#8d8d8d] hover:text-[#161616] cursor-pointer"
                    title="Clear search"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-1 flex-wrap pt-1">
                {availableCategories.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2 py-1 text-[10px] font-bold border transition-colors cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-[#0f62fe] text-white border-[#0f62fe]'
                        : 'bg-white text-[#525252] border-[#e0e0e0] hover:bg-[#e0e0e0]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#e0e0e0] max-h-96 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="p-6 text-center text-[#525252]">
                  <p className="font-medium text-xs">No products found matching &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-[11px] text-[#8d8d8d] mt-1">Try searching by SKU, technical name, or changing category filter.</p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-xs text-[#0f62fe] font-bold hover:underline cursor-pointer"
                    >
                      Clear Search Filter
                    </button>
                  )}
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const qty = cartItems[p.id] || 0;
                  const unavailable = isProductUnavailable(p);
                  const statusLabel = unavailable ? 'Unavailable' : 'Available';

                  return (
                    <div
                      key={p.id}
                      className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                        unavailable ? 'bg-[#fafafa] opacity-75' : 'hover:bg-[#f4f4f4]'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#161616]">{p.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#e5f0ff] text-[#0f62fe] border border-[#a6c8ff]">
                            {p.category}
                          </span>
                          {p.code && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#f4f4f4] text-[#525252] border border-[#e0e0e0]">
                              SKU: {p.code}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 border ${
                              unavailable
                                ? 'bg-[#ffebee] text-[#da1e28] border-[#ffb3b8]'
                                : 'bg-[#defbe6] text-[#0e6027] border-[#a7f0ba]'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#525252] mt-0.5">
                          Technical: <span className="italic">{p.technicalName || 'N/A'}</span> • Pack: {p.packSize || 'Standard'}
                        </div>
                        <div className="text-[11px] font-semibold text-[#161616] mt-0.5">
                          Wholesale Price: ₹{p.dealerPrice.toLocaleString('en-IN')} (MRP: ₹{p.mrp.toLocaleString('en-IN')})
                        </div>
                      </div>

                      {/* Quantity Counter */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(p.id, qty - 1)}
                          disabled={qty === 0}
                          className="w-7 h-7 bg-[#e0e0e0] hover:bg-[#8d8d8d] text-[#161616] font-bold rounded-none flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={qty}
                          disabled={unavailable && qty === 0}
                          onChange={(e) => updateQuantity(p.id, parseInt(e.target.value) || 0)}
                          className="w-12 h-7 text-center font-bold border border-[#e0e0e0] bg-white text-xs disabled:bg-[#f4f4f4] disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(p.id, qty + 1)}
                          disabled={unavailable}
                          title={unavailable ? 'Unavailable product cannot be ordered' : 'Add to order'}
                          className="w-7 h-7 bg-[#0f62fe] hover:bg-[#0043ce] text-white font-bold rounded-none flex items-center justify-center cursor-pointer disabled:bg-[#c6c6c6] disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Order Summary & Place Order */}
        <div className="space-y-4">
          <div className="bg-white border border-[#e0e0e0] p-4 shadow-xs space-y-4 sticky top-4">
            <h3 className="font-bold text-xs text-[#161616] uppercase tracking-wider border-b border-[#e0e0e0] pb-2">
              3. Order Summary & Tax Invoice
            </h3>

            {/* Selected Items Breakdown */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {orderItemsList.length === 0 ? (
                <p className="text-xs text-[#525252] italic p-2 text-center bg-[#f4f4f4]">
                  No products added yet. Select items from catalog.
                </p>
              ) : (
                orderItemsList.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs pb-1 border-b border-[#e0e0e0]">
                    <div>
                      <div className="font-bold text-[#161616]">{item.productName}</div>
                      <div className="text-[10px] text-[#525252]">
                        {item.quantity} x ₹{item.dealerPrice.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="font-bold text-[#161616]">
                      ₹{item.subtotal.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Financial Totals */}
            <div className="space-y-1.5 pt-2 border-t border-[#e0e0e0] text-xs">
              <div className="flex justify-between text-[#525252]">
                <span>Wholesale Subtotal:</span>
                <span>₹{rawSubtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[#525252]">
                <span>GST (Estimated 18%):</span>
                <span>₹{gstTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#161616] pt-2 border-t border-[#e0e0e0]">
                <span>Grand Total:</span>
                <span className="text-[#0f62fe]">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-[11px] font-bold text-[#525252] mb-1">Shipping & Dispatch Instructions</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g., Deliver via V-Trans transport to Pune depot..."
                className="w-full p-2 border border-[#e0e0e0] bg-[#f4f4f4] text-xs focus:outline-none focus:border-[#0f62fe]"
              />
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={orderItemsList.length === 0}
                className="w-full carbon-btn-primary h-10 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Confirm & Submit Order
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="w-full carbon-btn-ghost h-9 text-xs border border-[#e0e0e0] bg-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
