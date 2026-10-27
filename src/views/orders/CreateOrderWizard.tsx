import React, { useState } from 'react';
import type { Product, Dealer, Order, OrderItem } from '../../types/stitchTypes';

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

  // Quantities map: productId -> number
  const [cartItems, setCartItems] = useState<{ [productId: string]: number }>({
    'p-1': 5,
  });

  const selectedDealer = dealers.find((d) => d.id === selectedDealerId) || dealers[0];

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      const next = { ...cartItems };
      delete next[productId];
      setCartItems(next);
    } else {
      setCartItems({ ...cartItems, [productId]: qty });
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
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

    const newOrder: Order = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      orderNumber: `CCS-2023-${Math.floor(10000 + Math.random() * 90000)}`,
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
            Select products, review wholesale pricing with GST, and dispatch to dealer store
          </p>
        </div>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs border border-[#e0e0e0] bg-white cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Dealer Selection & Product Catalog */}
        <div className="lg:col-span-2 space-y-4">
          {/* Dealer Selection Box */}
          <div className="bg-white border border-[#e0e0e0] p-4 shadow-xs space-y-3">
            <h3 className="font-bold text-xs text-[#161616] uppercase tracking-wider border-b border-[#e0e0e0] pb-2">
              1. Select Recipient Dealer Store
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#525252] mb-1">Target Dealer</label>
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
                  <option value="Credit 30 Days">Credit 30 Days (Standard B2B)</option>
                  <option value="Direct Payment">Direct Online Bank Transfer</option>
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

            {/* Product Catalog Picker */}
            <div className="bg-white border border-[#e0e0e0] shadow-xs">
              <div className="p-3 bg-[#f4f4f4] border-b border-[#e0e0e0] space-y-2.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="font-bold text-xs text-[#161616] uppercase tracking-wider">
                    2. Add Chemical SKUs & Quantities
                  </span>
                  <span className="text-[11px] text-[#525252]">
                    Showing {filteredProducts.length} of {products.length} products
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search products by Name, SKU, Technical Name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#e0e0e0] text-xs text-[#161616] placeholder-[#8d8d8d] focus:outline-none focus:border-[#0f62fe]"
                  />
                </div>
              </div>

            <div className="divide-y divide-[#e0e0e0] max-h-96 overflow-y-auto">
              {filteredProducts.map((p) => {
                const qty = cartItems[p.id] || 0;
                return (
                  <div key={p.id} className="p-3 hover:bg-[#f4f4f4] flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#161616]">{p.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#e5f0ff] text-[#0f62fe] border border-[#a6c8ff]">
                          {p.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#525252] mt-0.5">
                        Technical: <span className="italic">{p.technicalName}</span> • Pack: {p.packSize}
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
                        className="w-7 h-7 bg-[#e0e0e0] text-[#161616] font-bold rounded-none flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={qty}
                        onChange={(e) => updateQuantity(p.id, parseInt(e.target.value) || 0)}
                        className="w-12 h-7 text-center font-bold border border-[#e0e0e0] bg-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(p.id, qty + 1)}
                        className="w-7 h-7 bg-[#0f62fe] text-white font-bold rounded-none flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
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
                className="w-full h-10 bg-[#0f62fe] hover:bg-[#0043ce] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Confirm & Submit Order
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="w-full h-9 text-xs border border-[#e0e0e0] bg-white cursor-pointer"
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
