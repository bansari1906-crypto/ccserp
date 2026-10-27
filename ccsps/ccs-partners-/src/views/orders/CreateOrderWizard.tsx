import React, { useState, useMemo } from 'react';
import type { Product, Dealer, Order, OrderItem } from '../../types';
import { computeProductCasePricing, getCasePackaging } from '../../utils/packaging';
import { EXCEL_PRODUCTS } from '../../data/excelProducts';

interface CreateOrderWizardProps {
  products: Product[];
  dealers: Dealer[];
  onSaveOrder: (newOrder: Order) => void;
  onCancel: () => void;
}

export interface ProductGroup {
  name: string;
  technicalName: string;
  category: string;
  variants: Product[];
  totalVariants: number;
  pricedVariantsCount: number;
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

  // Expanded product cards map: productName -> boolean
  const [expandedProducts, setExpandedProducts] = useState<{ [productName: string]: boolean }>({});

  // Quantities map: variantId -> number of full master cases
  const [cartItems, setCartItems] = useState<{ [variantId: string]: number }>({});

  const selectedDealer = dealers.find((d) => d.id === selectedDealerId) || dealers[0];

  // 1. Combine props.products with EXCEL_PRODUCTS to ensure 100% complete Excel catalog
  // while preserving custom test products or backend items.
  const combinedVariants = useMemo(() => {
    const map = new Map<string, Product>();

    // Seed with all official Excel products first
    EXCEL_PRODUCTS.forEach((p) => {
      const key = `${p.name.trim().toLowerCase()}___${p.packSize.trim().toLowerCase()}`;
      map.set(key, p);
    });

    // Merge in any products passed via props (e.g. from backend or localStorage)
    (products || []).forEach((p) => {
      const key = `${p.name.trim().toLowerCase()}___${(p.packSize || 'Standard').trim().toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        map.set(key, { ...existing, ...p });
      } else {
        map.set(key, p);
      }
    });

    return Array.from(map.values());
  }, [products]);

  // 2. Group products by exact product name — show each product once
  const productGroups = useMemo((): ProductGroup[] => {
    const groupMap = new Map<string, ProductGroup>();

    combinedVariants.forEach((v) => {
      const pName = v.name.trim();
      if (!groupMap.has(pName)) {
        groupMap.set(pName, {
          name: pName,
          technicalName: v.technicalName || pName,
          category: v.category || 'Crop Protection',
          variants: [],
          totalVariants: 0,
          pricedVariantsCount: 0,
        });
      }
      const grp = groupMap.get(pName)!;

      // Ensure each pack size option is genuine and unique
      const exists = grp.variants.some(
        (existing) => existing.packSize.trim().toLowerCase() === v.packSize.trim().toLowerCase()
      );
      if (!exists) {
        // Compute packaging specs
        const pkg = computeProductCasePricing(v.dealerPrice, v.packSize);
        grp.variants.push({
          ...v,
          bottlesPerCase: v.bottlesPerCase || pkg.bottlesPerCase,
          casePrice: v.casePrice || pkg.casePrice,
          caseSize: v.caseSize || pkg.caseSize,
          unitLabel: v.unitLabel || pkg.unitLabel,
        });
      }
    });

    return Array.from(groupMap.values()).map((grp) => {
      // Sort pack sizes logically (smallest to largest)
      const sizeRank = [
        '5 ml',
        '30 ml',
        '40 gm',
        '60 ml',
        '100 ml',
        '100 gm',
        '150 ml',
        '250 ml',
        '250 gm',
        '300 ml',
        '300 gm',
        '500 ml',
        '500 gm',
        '600 gm',
        '1 ltr',
        '1 kg',
        '1200 gm',
        '3 kg',
        '5 ltr',
        '5 kg',
        '10 kg',
        '15 kg',
        '25 kg',
        '30 kg',
        '50 kg',
      ];

      grp.variants.sort((a, b) => {
        const normA = a.packSize.toLowerCase();
        const normB = b.packSize.toLowerCase();
        const idxA = sizeRank.findIndex((r) => normA.includes(r));
        const idxB = sizeRank.findIndex((r) => normB.includes(r));
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.packSize.localeCompare(b.packSize);
      });

      grp.totalVariants = grp.variants.length;
      grp.pricedVariantsCount = grp.variants.filter((v) => v.dealerPrice > 0).length;
      return grp;
    });
  }, [combinedVariants]);

  // 3. Search filter
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return productGroups;
    const q = searchQuery.toLowerCase().trim();
    return productGroups.filter((g) => {
      const nameMatch = g.name.toLowerCase().includes(q);
      const techMatch = g.technicalName.toLowerCase().includes(q);
      const catMatch = g.category.toLowerCase().includes(q);
      const packMatch = g.variants.some((v) => v.packSize.toLowerCase().includes(q));
      return nameMatch || techMatch || catMatch || packMatch;
    });
  }, [productGroups, searchQuery]);

  // Toggle expansion for a specific product
  const toggleExpand = (productName: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productName]: !prev[productName],
    }));
  };

  // Update case quantity for a specific pack-size variant (full cases only)
  const updateCaseQuantity = (variant: Product, rawCases: number) => {
    const caseQty = Math.max(0, Math.floor(rawCases));

    if (caseQty > 0 && (!variant.dealerPrice || variant.dealerPrice <= 0)) {
      alert(
        `Cannot order "${variant.name} (${variant.packSize})": Price is listed as NA (Price on Request). Only priced wholesale products can be ordered directly.`
      );
      return;
    }

    if (caseQty <= 0) {
      const next = { ...cartItems };
      delete next[variant.id];
      setCartItems(next);
    } else {
      setCartItems({ ...cartItems, [variant.id]: caseQty });
    }
  };

  // Calculate order items based on full cases only
  const orderItemsList: OrderItem[] = useMemo(() => {
    return Object.entries(cartItems)
      .map(([variantId, rawQty]): OrderItem | null => {
        const caseQty = Math.max(0, Math.floor(Number(rawQty)));
        if (caseQty <= 0) return null;

        const variant = combinedVariants.find((v) => v.id === variantId);
        if (!variant) return null;

        const pkg = computeProductCasePricing(variant.dealerPrice, variant.packSize);
        const bottlesPerCase = variant.bottlesPerCase || pkg.bottlesPerCase;
        const casePrice = variant.casePrice || pkg.casePrice;
        const totalBottles = caseQty * bottlesPerCase;
        const itemSubtotal = Math.round(casePrice * caseQty * 100) / 100;

        return {
          id: `ITEM-${Math.random().toString(36).substr(2, 6)}`,
          productId: variant.id,
          productName: `${variant.name} (${variant.packSize})`,
          productCode: variant.code,
          packSize: variant.packSize,
          quantity: caseQty, // Full master cases
          cases: caseQty,
          bottlesPerCase,
          casePrice,
          totalBottles,
          dealerPrice: variant.dealerPrice, // Price per bottle / unit
          mrp: variant.mrp,
          subtotal: itemSubtotal,
          imageUrl: variant.imageUrl,
        };
      })
      .filter((item): item is OrderItem => item !== null);
  }, [cartItems, combinedVariants]);

  // Financial calculations
  const rawSubtotal = useMemo(() => {
    return orderItemsList.reduce((acc, item) => acc + item.subtotal, 0);
  }, [orderItemsList]);

  const gstTotal = useMemo(() => {
    return Math.round(rawSubtotal * 0.18 * 100) / 100;
  }, [rawSubtotal]);

  const grandTotal = useMemo(() => {
    return Math.round((rawSubtotal + gstTotal) * 100) / 100;
  }, [rawSubtotal, gstTotal]);

  const totalCasesCount = useMemo(() => {
    return orderItemsList.reduce((acc, item) => acc + item.quantity, 0);
  }, [orderItemsList]);

  const totalBottlesCount = useMemo(() => {
    return orderItemsList.reduce((acc, item) => acc + (item.totalBottles || 0), 0);
  }, [orderItemsList]);

  // Helper to count cases in cart for a specific product group
  const getProductCartCases = (group: ProductGroup) => {
    return group.variants.reduce((acc, v) => acc + (cartItems[v.id] || 0), 0);
  };

  const getProductCartSubtotal = (group: ProductGroup) => {
    return group.variants.reduce((acc, v) => {
      const cases = cartItems[v.id] || 0;
      const pkg = computeProductCasePricing(v.dealerPrice, v.packSize);
      const casePrice = v.casePrice || pkg.casePrice;
      return acc + cases * casePrice;
    }, 0);
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItemsList.length === 0) {
      alert('Please select at least one product full case to place an order.');
      return;
    }

    const newOrder: Order = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      orderNumber: `CCS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      date: new Date().toISOString().split('T')[0],
      dealerId: selectedDealer?.id || 'd-1',
      dealerName: selectedDealer?.name || 'Partner Dealer',
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
      remarks:
        remarks ||
        `Payment terms: ${paymentTerms}. B2B Wholesale Case Order placement (${totalCasesCount} Cases / ${totalBottlesCount} Units).`,
      createdAt: new Date().toISOString(),
    };

    onSaveOrder(newOrder);
  };

  return (
    <div className="space-y-6 font-body text-xs max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-[#e0e0e0] pb-4">
        <div>
          <h1 className="text-2xl font-light text-[#161616]">B2B Crop Protection Order Entry</h1>
          <p className="text-xs text-[#525252] mt-0.5">
            Official Price List Catalog • Full Master Cases Only • Genuine Pack Sizes & Master Carton Pricing
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="carbon-btn-ghost px-3 py-1.5 text-xs border border-[#e0e0e0] bg-white cursor-pointer hover:bg-[#f4f4f4] transition-colors"
        >
          Back to Orders
        </button>
      </div>

      {/* Wholesale Master Carton Policy Banner */}
      <div className="p-3 bg-[#f0f9ff] border border-[#0284c7] rounded-md text-xs text-[#0369a1] flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#0284c7] text-[20px]">inventory_2</span>
          <div>
            <strong className="text-[#0c4a6e]">B2B Wholesale Master Case Policy:</strong> Products are supplied
            exclusively in complete master cartons (e.g. 10 bottles/10 L for 1L packs, 20 bottles/10 L for 500ml packs,
            40 bottles/10 L for 250ml packs, 100 bottles/10 L for 100ml packs). Click <strong>+</strong> on any product to
            choose genuine pack sizes.
          </div>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 bg-[#0284c7] text-white rounded shrink-0">
          Full Cases Only
        </span>
      </div>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recipient & Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Recipient Dealer & Payment Terms */}
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
                  <strong>Selected:</strong> {selectedDealer.name} • GSTIN: {selectedDealer.gstin || '27AAAAA0000A1Z5'}
                </span>
                <span>
                  <strong>Credit Limit:</strong> ₹{(selectedDealer.creditLimit || 200000).toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>

          {/* Section 2: Product Catalog (Each product shown ONCE, click + for genuine pack sizes) */}
          <div className="bg-white border border-[#e0e0e0] shadow-xs">
            <div className="p-3 bg-[#f4f4f4] border-b border-[#e0e0e0] space-y-2.5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="font-bold text-xs text-[#161616] uppercase tracking-wider">
                  2. Product Selection (Click + to View Genuine Pack Sizes & Master Cases)
                </span>
                <span className="text-[11px] text-[#525252]">
                  Showing {filteredGroups.length} of {productGroups.length} distinct products
                </span>
              </div>

              {/* Product Search Box */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#8d8d8d] text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search products by Name (e.g. ACTIVE 100, AGNEEPATH), Technical Name, or Pack Size..."
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

            {/* List of Products — Each Shown Once */}
            <div className="divide-y divide-[#e0e0e0] max-h-[620px] overflow-y-auto">
              {filteredGroups.length === 0 ? (
                <div className="p-8 text-center text-[#525252]">
                  <p className="font-medium text-xs">No products found matching &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-[11px] text-[#8d8d8d] mt-1">
                    Try searching by product brand name or active chemical technical name.
                  </p>
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
                filteredGroups.map((group) => {
                  const isExpanded = Boolean(expandedProducts[group.name]);
                  const cartCases = getProductCartCases(group);
                  const cartSubtotal = getProductCartSubtotal(group);
                  const hasPricedOptions = group.pricedVariantsCount > 0;

                  return (
                    <div
                      key={group.name}
                      className={`transition-colors ${
                        cartCases > 0 ? 'bg-[#f0fdf4]' : isExpanded ? 'bg-[#fafafa]' : 'hover:bg-[#fbfbfb]'
                      }`}
                    >
                      {/* Product Header Row (Shown ONCE per product) */}
                      <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[#161616]">{group.name}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#e5f0ff] text-[#0f62fe] border border-[#a6c8ff] rounded">
                              {group.category}
                            </span>
                            {hasPricedOptions ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#defbe6] text-[#0e6027] border border-[#a7f0ba] rounded">
                                {group.pricedVariantsCount} of {group.totalVariants} Sizes Priced
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#fff8e1] text-[#b78103] border border-[#ffe082] rounded">
                                Price on Request (NA)
                              </span>
                            )}
                          </div>

                          {/* Technical composition */}
                          <div className="text-[11px] text-[#525252]">
                            Technical: <span className="italic font-medium text-[#334155]">{group.technicalName}</span>
                          </div>

                          {/* Genuine Available Pack Sizes Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className="text-[10px] font-semibold text-[#64748b]">Available Sizes:</span>
                            {group.variants.map((v) => {
                              const vCases = cartItems[v.id] || 0;
                              return (
                                <span
                                  key={v.id}
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                                    vCases > 0
                                      ? 'bg-[#15803d] text-white border-[#15803d] font-bold'
                                      : v.dealerPrice > 0
                                      ? 'bg-white text-[#0369a1] border-[#cbd5e1]'
                                      : 'bg-[#f4f4f4] text-[#8d8d8d] border-[#e0e0e0]'
                                  }`}
                                >
                                  {v.packSize}
                                  {v.dealerPrice > 0 ? ` (₹${v.dealerPrice})` : ' (NA)'}
                                  {vCases > 0 && ` • ${vCases}c`}
                                </span>
                              );
                            })}
                          </div>

                          {/* Cart selection indicator for this product */}
                          {cartCases > 0 && (
                            <div className="text-[11px] font-bold text-[#15803d] flex items-center gap-1 pt-1">
                              <span>✓ {cartCases} {cartCases === 1 ? 'Case' : 'Cases'} selected</span>
                              <span>•</span>
                              <span>Subtotal: ₹{cartSubtotal.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                        </div>

                        {/* Expand / Plus Action Button */}
                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleExpand(group.name)}
                            className={`px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                              isExpanded
                                ? 'bg-[#161616] text-white hover:bg-[#262626]'
                                : cartCases > 0
                                ? 'bg-[#15803d] text-white hover:bg-[#166534]'
                                : 'bg-[#0f62fe] text-white hover:bg-[#0043ce]'
                            }`}
                            title={isExpanded ? 'Collapse pack sizes' : 'Click to view genuine pack size options and order master cases'}
                          >
                            <span className="text-sm font-extrabold">{isExpanded ? '−' : '+'}</span>
                            <span>{isExpanded ? 'Hide Sizes' : '+ Select Pack Sizes'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Section: Displays ONLY that product's genuine pack-size options */}
                      {isExpanded && (
                        <div className="p-3 bg-white border-t border-[#e0e0e0] space-y-2">
                          <div className="text-[11px] font-bold text-[#161616] uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span>Genuine Pack Sizes for {group.name}</span>
                            <span className="text-[10px] text-[#64748b] font-normal">
                              Supplied in full master cases only
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {group.variants.map((v) => {
                              const caseQty = cartItems[v.id] || 0;
                              const isPriced = v.dealerPrice > 0;
                              const pkg = computeProductCasePricing(v.dealerPrice, v.packSize);
                              const bottlesPerCase = v.bottlesPerCase || pkg.bottlesPerCase;
                              const casePrice = v.casePrice || pkg.casePrice;
                              const caseSize = v.caseSize || pkg.caseSize;
                              const unitLabel = v.unitLabel || pkg.unitLabel;

                              return (
                                <div
                                  key={v.id}
                                  className={`p-2.5 rounded border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                                    caseQty > 0
                                      ? 'bg-[#ecfdf5] border-[#10b981]'
                                      : isPriced
                                      ? 'bg-[#f8fafc] border-[#e2e8f0] hover:border-[#94a3b8]'
                                      : 'bg-[#fafafa] border-[#e0e0e0] opacity-80'
                                  }`}
                                >
                                  {/* Pack size info & pricing card */}
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-extrabold text-xs text-[#0f172a] bg-white px-2 py-0.5 border border-[#cbd5e1] rounded">
                                        Pack Size: {v.packSize}
                                      </span>
                                      <span className="text-[11px] font-bold text-[#0369a1] bg-[#e0f2fe] px-2 py-0.5 rounded border border-[#bae6fd]">
                                        📦 {caseSize}
                                      </span>
                                      {!isPriced && (
                                        <span className="text-[10px] font-bold text-[#b78103] bg-[#fff8e1] px-1.5 py-0.5 rounded border border-[#ffe082]">
                                          Price on Request (NA)
                                        </span>
                                      )}
                                    </div>

                                    {/* Breakdown: Price per bottle and Full-Case Price */}
                                    <div className="text-[11px] flex items-center gap-3 flex-wrap pt-0.5">
                                      {isPriced ? (
                                        <>
                                          <span className="text-[#475569]">
                                            Price per {unitLabel === 'bottles' ? 'bottle' : 'unit'}:{' '}
                                            <strong className="text-[#0f172a]">
                                              ₹{v.dealerPrice.toLocaleString('en-IN')}
                                            </strong>
                                          </span>
                                          <span className="text-[#64748b]">•</span>
                                          <span className="text-[#0f172a]">
                                            Full-Case Price ({bottlesPerCase} {unitLabel}):{' '}
                                            <strong className="text-[#16a34a] font-extrabold text-xs">
                                              ₹{casePrice.toLocaleString('en-IN')}
                                            </strong>{' '}
                                            / case
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-[#8d8d8d] italic text-[11px]">
                                          Price: NA in official price list • Contact sales office for custom quote
                                        </span>
                                      )}
                                    </div>

                                    {/* Active selection subtotal */}
                                    {caseQty > 0 && isPriced && (
                                      <div className="text-[11px] font-bold text-[#15803d]">
                                        ✓ {caseQty} {caseQty === 1 ? 'Case' : 'Cases'} = {caseQty * bottlesPerCase}{' '}
                                        {unitLabel} • Subtotal: ₹{(caseQty * casePrice).toLocaleString('en-IN')}
                                      </div>
                                    )}
                                  </div>

                                  {/* Stepper for Full Cases Only */}
                                  <div className="flex flex-col sm:items-end gap-1 shrink-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                                      Order Cases
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => updateCaseQuantity(v, caseQty - 1)}
                                        disabled={caseQty === 0}
                                        className="w-8 h-8 bg-[#e0e0e0] hover:bg-[#8d8d8d] text-[#161616] font-extrabold rounded flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Decrease by 1 full case"
                                      >
                                        −
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={caseQty}
                                        disabled={!isPriced}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value, 10);
                                          updateCaseQuantity(v, isNaN(val) ? 0 : Math.max(0, Math.floor(val)));
                                        }}
                                        className="w-14 h-8 text-center font-extrabold border border-[#cbd5e1] rounded bg-white text-xs text-[#0f172a] disabled:bg-[#f4f4f4] disabled:opacity-50"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => updateCaseQuantity(v, caseQty + 1)}
                                        disabled={!isPriced}
                                        title={
                                          isPriced
                                            ? `Add 1 full master case of ${v.packSize}`
                                            : 'Pricing unavailable in price list'
                                        }
                                        className={`w-8 h-8 font-extrabold rounded flex items-center justify-center cursor-pointer transition-colors ${
                                          isPriced
                                            ? 'bg-[#0f62fe] hover:bg-[#0043ce] text-white'
                                            : 'bg-[#e0e0e0] text-[#8d8d8d] cursor-not-allowed opacity-50'
                                        }`}
                                      >
                                        +
                                      </button>
                                    </div>
                                    <span className="text-[10px] text-[#64748b]">
                                      {caseQty === 1 ? '1 master case' : `${caseQty} master cases`}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Order Summary & Cart */}
        <div className="space-y-4">
          <div className="bg-white border border-[#e0e0e0] p-4 shadow-xs space-y-4 sticky top-4">
            <div className="border-b border-[#e0e0e0] pb-2">
              <h3 className="font-bold text-xs text-[#161616] uppercase tracking-wider">
                3. Order Summary & Invoice
              </h3>
              <p className="text-[10px] text-[#64748b] mt-0.5">Wholesale billing by complete master cartons</p>
            </div>

            {/* Selected Items Breakdown */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {orderItemsList.length === 0 ? (
                <div className="p-4 text-center bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded text-[#64748b] space-y-1">
                  <span className="material-symbols-outlined text-[24px] text-[#94a3b8]">shopping_cart</span>
                  <p className="text-xs font-medium">No master cases selected.</p>
                  <p className="text-[10px]">Click + on any product above to choose pack sizes.</p>
                </div>
              ) : (
                orderItemsList.map((item) => (
                  <div key={item.productId} className="p-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded text-xs space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="font-bold text-[#0f172a]">{item.productName}</div>
                        <div className="text-[10px] text-[#64748b]">
                          {item.quantity} {item.quantity === 1 ? 'Case' : 'Cases'} ({item.totalBottles}{' '}
                          {item.bottlesPerCase === 1 ? 'container' : 'units'})
                        </div>
                        <div className="text-[10px] text-[#0284c7] font-semibold">
                          ₹{item.casePrice?.toLocaleString('en-IN')} / case (₹{item.dealerPrice.toLocaleString('en-IN')}
                          /unit)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-[#0f172a]">
                          ₹{item.subtotal.toLocaleString('en-IN')}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...cartItems };
                            delete next[item.productId];
                            setCartItems(next);
                          }}
                          className="text-[10px] text-[#da1e28] hover:underline cursor-pointer"
                          title="Remove item"
                        >
                          Remove ✕
                        </button>
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
                <span className="font-bold">
                  {totalCasesCount} Cases ({totalBottlesCount} Units)
                </span>
              </div>
            )}

            {/* Financial Totals & Tax Calculation */}
            <div className="space-y-1.5 pt-2 border-t border-[#e0e0e0] text-xs">
              <div className="flex justify-between text-[#525252]">
                <span>Wholesale Subtotal (Full Cases):</span>
                <span className="font-mono font-semibold">₹{rawSubtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[#525252]">
                <span>GST (Applicable 18%):</span>
                <span className="font-mono font-semibold">₹{gstTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#161616] pt-2 border-t border-[#e0e0e0]">
                <span>Grand Total:</span>
                <span className="text-[#0f62fe] font-mono text-base">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Dispatch Remarks */}
            <div>
              <label className="block text-[11px] font-bold text-[#525252] mb-1">Shipping & Dispatch Instructions</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g., Dispatch via V-Trans transport to Pune godown..."
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
