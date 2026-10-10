import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { KpiCard } from '../../components/common/KpiCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Order, Dealer, Product, FieldActivity } from '../../types';

interface AdminDashboardProps {
  orders?: Order[];
  dealers?: Dealer[];
  products?: Product[];
  fieldActivities?: FieldActivity[];
  distributors?: any[];
  expenses?: any[];
  onSelectOrder?: (order: Order) => void;
  onNavigate?: (view: string) => void;
  onCreateOrder?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders = [],
  dealers = [],
  products = [],
  fieldActivities = [],
  distributors = [],
  expenses = [],
  onSelectOrder,
  onNavigate = () => {},
}) => {
  const [timeFilter, setTimeFilter] = useState('This Month');

  const salesChartData = orders.length > 0
    ? [{ month: 'Current', sales: Math.round(orders.reduce((a, b) => a + (b.grandTotal || 0), 0) / 1000) }]
    : [{ month: 'No Data', sales: 0 }];

  const pendingOrdersCount = orders.filter((o) => o.status === 'Submitted' || o.status === 'Processing').length;
  const unavailableProductsCount = products.filter(
    (p) => p.status === 'Unavailable' || p.status === 'Inactive' || (p as any).is_available === false
  ).length;
  const pendingExpensesCount = expenses.filter((e) => e.status === 'Pending').length;

  return (
    <div className="space-y-6 font-body text-xs">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e8f0] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#14532d]">Admin Control Tower</h1>
            <span className="px-2 py-0.5 bg-[#dcfce7] text-[#14532d] font-bold text-[10px] border border-[#86efac] rounded uppercase">
              LIVE ERP OPERATIONS
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5">
            Company-wide operational summary of Chitra Crop Science B2B sales, field staff, dealer network, and audit approvals
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('registration-approval')}
            className="px-3 py-1.5 bg-[#fef3c7] hover:bg-[#fde68a] text-[#b45309] border border-[#fcd34d] font-bold text-xs rounded shadow-2xs flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
            0 Pending Approvals
          </button>
          <button
            onClick={() => onNavigate('orders')}
            className="px-3.5 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs rounded shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
            Create Order
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="TOTAL SALES TURNOVER"
          value={`₹${((orders.reduce((acc, curr) => acc + (curr.grandTotal || 0), 0)) / 100000).toFixed(2)} Lakhs`}
          icon="trending_up"
          trend="up"
          onClick={() => onNavigate('orders')}
        />
        <KpiCard
          label="PENDING ORDERS"
          value={pendingOrdersCount}
          icon="pending_actions"
          accentBorder="blue"
          onClick={() => onNavigate('orders')}
        />
        <KpiCard
          label="ACTIVE DISTRIBUTORS"
          value={dealers.length}
          icon="storefront"
          trend="up"
          onClick={() => onNavigate('dealers')}
        />
        <KpiCard
          label="DISTRIBUTOR DEPOTS"
          value={distributors.length}
          icon="badge"
          onClick={() => onNavigate('distributors')}
        />

        <KpiCard
          label="FIELD SALES STAFF"
          value={distributors.length}
          icon="directions_run"
          trend="up"
          onClick={() => onNavigate('distributors')}
        />
        <KpiCard
          label="PENDING REGISTRATIONS"
          value={0}
          icon="how_to_reg"
          accentBorder="yellow"
          onClick={() => onNavigate('registration-approval')}
        />
        <KpiCard
          label="PENDING CLAIMS"
          value={pendingExpensesCount}
          icon="receipt_long"
          accentBorder="yellow"
          onClick={() => onNavigate('expenses')}
        />
        <KpiCard
          label="LOW STOCK SKUS"
          value={lowStockCount}
          icon="warning"
          accentBorder="red"
          onClick={() => onNavigate('products')}
        />
      </div>

      {/* Section 1: ATTENTION REQUIRED */}
      <div className="bg-[#fffbeb] border border-[#fde68a] p-4 rounded-lg shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#fcd34d] pb-2">
          <h2 className="text-xs font-bold text-[#92400e] uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#d97706]">error</span>
            Operational Attention Required
          </h2>
          <span className="text-[11px] font-bold text-[#b45309]">Action Items</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1 */}
          <div
            onClick={() => onNavigate('registration-approval')}
            className="bg-white p-3 border border-[#fcd34d] rounded-md hover:border-[#d97706] transition-all cursor-pointer shadow-2xs flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-[#fef3c7] text-[#d97706] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">person_add</span>
            </div>
            <div>
              <div className="font-bold text-[#0f172a] text-xs">Pending Account Approvals</div>
              <div className="text-[10px] text-[#b45309] font-medium">Dealer & Distributor applications</div>
            </div>
          </div>

          {/* Card 2 */}
          <div
            onClick={() => onNavigate('expenses')}
            className="bg-white p-3 border border-[#fcd34d] rounded-md hover:border-[#d97706] transition-all cursor-pointer shadow-2xs flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-[#fef3c7] text-[#d97706] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            </div>
            <div>
              <div className="font-bold text-[#0f172a] text-xs">{pendingExpensesCount} Pending Expense Claims</div>
              <div className="text-[10px] text-[#b45309] font-medium">Field staff travel fuel & meal claims</div>
            </div>
          </div>

          {/* Card 3 - Product Catalog Availability */}
          <div
            onClick={() => onNavigate('products')}
            className="bg-white p-3 border border-[#e2e8f0] rounded-md hover:border-[#0f62fe] transition-all cursor-pointer shadow-2xs flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-[#f4f4f4] text-[#0f62fe] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">category</span>
            </div>
            <div>
              <div className="font-bold text-[#0f172a] text-xs">{unavailableProductsCount} Unavailable Products</div>
              <div className="text-[10px] text-[#525252] font-medium">Click to manage availability in catalog</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Charts & Field Activity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 bg-white p-4 border border-[#e2e8f0] rounded-lg shadow-2xs">
          <div className="flex justify-between items-center mb-4 border-b border-[#e2e8f0] pb-2">
            <h3 className="text-xs font-bold text-[#14532d] uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px] text-[#16a34a]">show_chart</span>
              Monthly Sales Performance (₹ Lakhs)
            </h3>
            <div className="flex gap-1">
              {['This Month', 'This Quarter', 'Year to Date'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFilter(tf)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded border cursor-pointer ${
                    timeFilter === tf
                      ? 'bg-[#16a34a] text-white border-[#16a34a]'
                      : 'bg-[#f8fafc] text-[#475569] border-[#cbd5e1] hover:bg-[#e2e8f0]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  formatter={(val: number) => [`₹${val} Lakhs`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', fontSize: '12px', borderRadius: '6px' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#16a34a" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Field Activity */}
        <div className="bg-white p-4 border border-[#e2e8f0] rounded-lg shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3 border-b border-[#e2e8f0] pb-2">
              <h3 className="text-xs font-bold text-[#14532d] uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px] text-[#16a34a]">distance</span>
                Today's Field Activity
              </h3>
              <span className="text-[10px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded border border-[#86efac]">
                LIVE GPS
              </span>
            </div>

            <div className="space-y-3">
              {(fieldActivities || []).slice(0, 4).map((act) => (
                <div key={act.id} className="p-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#0f172a] text-xs">{act.employeeName}</div>
                    <div className="text-[10px] text-[#64748b]">{act.action} • {act.location}</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#15803d]">{act.time}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('attendance')}
            className="w-full mt-3 py-2 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#cbd5e1] text-[#334155] font-bold text-xs rounded shadow-2xs cursor-pointer flex items-center justify-center gap-1"
          >
            View Full Field Attendance →
          </button>
        </div>
      </div>

      {/* Section 3: Recent B2B Orders Overview */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden shadow-2xs">
        <div className="p-3 bg-[#f8fafc] border-b border-[#e2e8f0] font-bold text-xs text-[#14532d] uppercase tracking-wider flex justify-between items-center">
          <span>Recent B2B Dealer Orders ({orders.length})</span>
          <button onClick={() => onNavigate('orders')} className="text-[#16a34a] text-xs font-bold hover:underline cursor-pointer">
            View All Orders →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#f8fafc] text-[#64748b] border-b border-[#e2e8f0] uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3">Order ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">Dealer Name</th>
                <th className="p-3">Territory Distributor</th>
                <th className="p-3 text-right">Items</th>
                <th className="p-3 text-right">Grand Total</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#64748b]">
                    No B2B orders found in the database.
                  </td>
                </tr>
              ) : (
                (orders || []).slice(0, 5).map((ord) => (
                  <tr
                    key={ord.id}
                    onClick={() => {
                      if (onSelectOrder) onSelectOrder(ord);
                      onNavigate('orders');
                    }}
                    className="hover:bg-[#f8fafc] cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-bold text-[#14532d]">{ord.orderNumber}</td>
                    <td className="p-3 text-[#64748b]">{ord.date}</td>
                    <td className="p-3 font-bold text-[#0f172a]">{ord.dealerName}</td>
                    <td className="p-3 text-[#64748b]">{ord.distributorName}</td>
                    <td className="p-3 text-right font-semibold">{(ord.items || []).length} SKUs</td>
                    <td className="p-3 text-right font-extrabold text-[#15803d]">
                      ₹{(ord.grandTotal || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={ord.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
