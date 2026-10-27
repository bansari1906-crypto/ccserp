import React, { useState } from 'react';
import { Product, Dealer, Order, OrderItem } from '../../types';
import { computeProductCasePricing } from '../../utils/packaging';

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
  const [searchQuery, setSearchQuery] = useState('');

  // Quantities map: productId -> number of full master cases
  const [cartItems, setCartItems] = useState<{ [productId: string]: number }>({});

  const selectedDealer = dealers.find((d) => d.id === selectedDealerId) || dealers[0];

  const isProductUnavailable = (p: Product) => {
    if (p.is_available !== undefined) return !p.is_available;
    const statusLower = (p.status || '').toLowerCase();
    return statusLower === 'unavailable' || statusLower === 'inactive' || statusLower === 'discontinued';
  };

  const updateQuantity = (productId: string, rawCases: number) => {
    const targetProduct = products.find((p) => p.id === productId);
    const caseQty = Math.max(0, Math.floor(rawCases));

    if (targetProduct && isProductUnavailable(targetProduct) && caseQty > (cartItems[productId] || 0)) {
      alert(`Cannot order "${targetProduct.name}": Product is currently marked as Unavailable. Only Available products can be ordered.`);
      return;
    }

    if (caseQty <= 0) {
      const next = { ...cartItems };
      delete next[productId];
      setCartItems(next);
    } else {
      setCartItems({ ...cartItems, [productId]: caseQty });
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (p.name || '').toLowerCase().includes(q);
    const codeMatch = (p.code || (p as any).productCode || (p as any).sku || '').toLowerCase().includes(q);
    const techMatch = (p.technicalName || '').toLowerCase().includes(q);
    const catMatch = (p.category || '').toLowerCase().includes(q);
    const packMatch = (p.packSize || '').toLowerCase().includes(q);

    return nameMatch || codeMatch || techMatch || catMatch || packMatch;
  });

  // Calculate order items based on full cases only
  const orderItemsList: OrderItem[] = Object.entries(cartItems)
    .map(([pId, rawQty]): OrderItem | null => {
      const caseQty = Math.max(0, Math.floor(Number(rawQty)));
      const prod = products.find((p) => p.id === pId);
      if (!prod || caseQty <= 0) return null;

      const pkg = computeProductCasePricing(prod.dealerPrice, prod.packSize);
      const bottlesPerCase = prod.bottlesPerCase || pkg.bottlesPerCase;
      const casePrice = prod.casePrice || pkg.casePrice;
      const totalBottles = caseQty * bottlesPerCase;
      const itemSubtotal = Math.round(casePrice * caseQty * 100) / 100;

      return {
        id: `ITEM-${Math.random().toString(36).substr(2, 6)}`,
        productId: prod.id,
        productName: prod.name,
        productCode: prod.code,
        packSize: prod.packSize,
        quantity: caseQty, // Full master cases
        cases: caseQty,
        bottlesPerCase,
        casePrice,
        totalBottles,
        dealerPrice: prod.dealerPrice, // Unit / Bottle price
        mrp: prod.mrp,
        subtotal: itemSubtotal,
        imageUrl: prod.imageUrl,
      };
    })
    .filter((item): item is OrderItem => item !== null);

  const rawSubtotal = orderItemsList.reduce((acc, item) => acc + item.subtotal, 0);
  const gstTotal = Math.round(rawSubtotal * 0.18);
  const grandTotal = rawSubtotal + gstTotal;
  const totalCasesCount = orderItemsList.reduce((acc, item) => acc + item.quantity, 0);
  const totalBottlesCount = orderItemsList.reduce((acc, item) => acc + (item.totalBottles || 0), 0);

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItemsList.length === 0) {
      alert('Please select at least one product full case to create an order.');
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
      remarks: remarks || `Payment terms: ${paymentTerms}. B2B Wholesale Case Order placement (${totalCasesCount} Cases / ${totalBottlesCount} Units).`,
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
            Wholesale case ordering • Supplied in full master cartons only • Individual bottle sales strictly disallowed
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="carbon-btn-ghost px-3 py-1.5 text-xs border border-[#e0e0e0] bg-white cursor-pointer"
        >
          Back to Orders
        </button>
      </div>

      {/* Case Policy Reminder Banner */}
      <div className="p-3 bg-[#f0f9ff] border border-[#0284c7] rounded-md text-xs text-[#0369a1] flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#0284c7] text-[20px]">inventory_2</span>
          <div>
            <strong className="text-[#0c4a6e]">Full Case Ordering Policy:</strong> All products are sold exclusively in complete master cartons (e.g., 10 bottles/10 L for 1L packs, 20 bottles/10 L for 500ml packs). Quantities indicate number of full cases.
          </div>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 bg-[#0284c7] text-white rounded">
          Full Cases Only
        </span>
      </div>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Setup & Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Dealer & Payment Terms */}
          <div className="bg-white border border-[#e0e0e0] p-4 shadow-xs space-y-4">
            <h3 className="font-bold text-xs text-[#161616] uppercase tracking-wider border-b border-[#e0e0e0] pb-2">
              1. Select Recipient Distributor / Dealer
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-[#525252] mb-1">Target Distributor / Dealer</label>
                <select
                  value={selectedDealerId}
                  onChange={(e) => setSelectedDealerId(e.target.value)}
                  className="w-full p-2 border border-[#e0e0e0] bg-white text-xs text-[#161616] focus:outline-none focus:border-[#0f62fe]"
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
                  className="w-full p-2 border border-[#e0e0e0] bg-white text-xs text-[#161616] focus:outline-none focus:border-[#0f62fe]"
                >
                  <option value="Credit 30 Days">Credit (30 Days Net)</option>
                  <option value="Credit 45 Days">Credit (45 Days Net)</option>
                  <option value="Cash (15 Days)">Cash (15 Days Prompt)</option>
                  <option value="Advance Payment">Advance Payment (100% Cash)</option>
                </select>
              </div>
            </div>

            {selectedDealer && (
              <div className="p-2.5 bg-[#e5f0ff] border border-[#a6c8ff] text-[11px] text-[#001d6c] flex justify-between items-center">
                <span>
                  <strong>Selected:</strong> {selectedDealer.name} • GST: {selectedDealer.gstin}
                </span>
                <span>
                  <strong>Credit Limit:</strong> ₹{(selectedDealer.creditLimit || 200000).toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>

          {/* Section 2: Product Catalog Picker (All Products with Search Bar) */}
          <div className="bg-white border border-[#e0e0e0] shadow-xs">
            <div className="p-3 bg-[#f4f4f4] border-b border-[#e0e0e0] space-y-2.5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="font-bold text-xs text-[#161616] uppercase tracking-wider">
                  2. Add Chemical SKUs & Quantities (Full Master Cases Only)
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
                  placeholder="Search products by Name, SKU / Product Code, Technical Name, or Pack Size..."
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
            </div>

            <div className="divide-y divide-[#e0e0e0] max-h-[500px] overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="p-6 text-center text-[#525252]">
                  <p className="font-medium text-xs">No products found matching &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-[11px] text-[#8d8d8d] mt-1">Try searching by product name, SKU, or technical name.</p>
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
                  const caseQty = cartItems[p.id] || 0;
                  const unavailable = isProductUnavailable(p);
                  const statusLabel = unavailable ? 'Unavailable' : 'Available';

                  const pkg = computeProductCasePricing(p.dealerPrice, p.packSize);
                  const bottlesPerCase = p.bottlesPerCase || pkg.bottlesPerCase;
                  const casePrice = p.casePrice || pkg.casePrice;
                  const caseSize = p.caseSize || pkg.caseSize;
                  const unitLabel = p.unitLabel || pkg.unitLabel;
                  const gstRate = p.gst || 18;

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                        unavailable ? 'bg-[#fafafa] opacity-75' : caseQty > 0 ? 'bg-[#f0fdf4] hover:bg-[#dcfce7]' : 'hover:bg-[#f4f4f4]'
                      }`}
                    >
                      <div className="flex-1 space-y-1">
                        {/* Title and Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#161616]">{p.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd] rounded">
                            Pack: {p.packSize}
                          </span>
                          {p.code && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#f4f4f4] text-[#525252] border border-[#e0e0e0] rounded">
                              SKU: {p.code}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 border rounded ${
                              unavailable
                                ? 'bg-[#ffebee] text-[#da1e28] border-[#ffb3b8]'
                                : 'bg-[#defbe6] text-[#0e6027] border-[#a7f0ba]'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>

                        {/* Technical Name */}
                        <div className="text-[11px] text-[#525252]">
                          Technical: <span className="italic font-medium text-[#334155]">{p.technicalName || 'N/A'}</span>
                        </div>

                        {/* Master Case Packaging & Price Breakdown Card */}
                        <div className="p-2 bg-white/80 border border-[#cbd5e1] rounded text-[11px] flex flex-wrap items-center gap-x-4 gap-y-1">
                          <div className="flex items-center gap-1 text-[#0f172a]">
                            <span className="text-[#64748b]">Case Packaging:</span>
                            <span className="font-bold text-[#0369a1]">📦 {caseSize}</span>
                          </div>
                          <div className="text-[#475569]">
                            Unit Price: <span className="font-semibold text-[#1e293b]">₹{p.dealerPrice.toLocaleString('en-IN')}</span> / {unitLabel === 'bottles' ? 'bottle' : 'unit'}
                          </div>
                          <div className="text-[#0f172a]">
                            <strong className="text-[#16a34a] font-extrabold text-xs">
                              Case Price: ₹{casePrice.toLocaleString('en-IN')}
                            </strong>
                            <span className="text-[10px] text-[#64748b]"> / case</span>
                          </div>
                          <div className="text-[#475569]">
                            GST: <span className="font-semibold text-[#0f172a]">{gstRate}%</span>
                          </div>
                        </div>

                        {/* Active Selection Indicator */}
                        {caseQty > 0 && (
                          <div className="text-[11px] font-bold text-[#15803d] flex items-center gap-1.5 pt-0.5">
                            <span>✓ {caseQty} {caseQty === 1 ? 'Case' : 'Cases'} = {caseQty * bottlesPerCase} {unitLabel}</span>
                            <span>•</span>
                            <span>Case Subtotal: ₹{(caseQty * casePrice).toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </div>

                      {/* Quantity Stepper (Strictly Full Master Cases Only) */}
                      <div className="flex flex-col sm:items-end gap-1 shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                          Number of Cases
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(p.id, caseQty - 1)}
                            disabled={caseQty === 0}
                            className="w-8 h-8 bg-[#e0e0e0] hover:bg-[#8d8d8d] text-[#161616] font-bold rounded flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title="Decrease case quantity by 1"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={caseQty}
                            disabled={unavailable && caseQty === 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              updateQuantity(p.id, isNaN(val) ? 0 : Math.max(0, Math.floor(val)));
                            }}
                            className="w-14 h-8 text-center font-extrabold border border-[#cbd5e1] rounded bg-white text-xs text-[#0f172a] disabled:bg-[#f4f4f4] disabled:opacity-60"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(p.id, caseQty + 1)}
                            disabled={unavailable}
                            title={unavailable ? 'Unavailable product cannot be ordered' : 'Add 1 full master case'}
                            className="w-8 h-8 bg-[#0f62fe] hover:bg-[#0043ce] text-white font-bold rounded flex items-center justify-center cursor-pointer disabled:bg-[#c6c6c6] disabled:cursor-not-allowed transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-[10px] text-[#64748b]">
                          {caseQty === 1 ? '1 full case' : `${caseQty} full cases`}
                        </span>
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
            <div className="border-b border-[#e0e0e0] pb-2">
              <h3 className="font-bold text-xs text-[#161616] uppercase tracking-wider">
                3. Order Summary & Tax Invoice
              </h3>
              <p className="text-[10px] text-[#64748b] mt-0.5">
                Wholesale billing by complete master cartons
              </p>
            </div>

            {/* Selected Items Breakdown */}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {orderItemsList.length === 0 ? (
                <div className="p-4 text-center bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded text-[#64748b] space-y-1">
                  <span className="material-symbols-outlined text-[24px] text-[#94a3b8]">shopping_cart</span>
                  <p className="text-xs font-medium">No cases added yet.</p>
                  <p className="text-[10px]">Select master cases from catalog above.</p>
                </div>
              ) : (
                orderItemsList.map((item) => (
                  <div key={item.id} className="p-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded text-xs space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="font-bold text-[#0f172a]">{item.productName}</div>
                        <div className="text-[10px] text-[#64748b]">
                          Pack: <span className="font-medium">{item.packSize}</span> • {item.quantity} {item.quantity === 1 ? 'Case' : 'Cases'} ({item.totalBottles} {item.bottlesPerCase === 1 ? 'bag' : 'bottles'})
                        </div>
                        <div className="text-[10px] text-[#0284c7] font-semibold">
                          ₹{item.casePrice?.toLocaleString('en-IN')} / case (₹{item.dealerPrice.toLocaleString('en-IN')}/bottle)
                        </div>
                      </div>
                      <div className="font-extrabold text-[#0f172a] text-right">
                        ₹{item.subtotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Packaging summary pill if items selected */}
            {orderItemsList.length > 0 && (
              <div className="p-2 bg-[#ecfdf5] border border-[#a7f3d0] rounded text-[11px] text-[#065f46] flex justify-between">
                <span>Total Master Cartons:</span>
                <span className="font-bold">{totalCasesCount} Cases ({totalBottlesCount} Units)</span>
              </div>
            )}

            {/* Financial Totals */}
            <div className="space-y-1.5 pt-2 border-t border-[#e0e0e0] text-xs">
              <div className="flex justify-between text-[#525252]">
                <span>Wholesale Subtotal (Full Cases):</span>
                <span className="font-mono font-semibold">₹{rawSubtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[#525252]">
                <span>GST (Estimated 18%):</span>
                <span className="font-mono font-semibold">₹{gstTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#161616] pt-2 border-t border-[#e0e0e0]">
                <span>Grand Total:</span>
                <span className="text-[#0f62fe] font-mono text-base">₹{grandTotal.toLocaleString('en-IN')}</span>
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
                Confirm & Submit Order ({totalCasesCount} Cases)
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
