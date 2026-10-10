import React from 'react';
import { KpiCard } from '../../components/common/KpiCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { Order, Dealer, User } from '../../types/stitchTypes';

interface DistributorDashboardProps {
  currentUser: User;
  orders?: Order[];
  dealers?: Dealer[];
  onSelectOrder?: (order: Order) => void;
  onCreateOrder?: () => void;
  onCheckIn?: () => void;
  activeAttendance?: any;
}

export const DistributorDashboard: React.FC<DistributorDashboardProps> = ({
  currentUser,
  orders = [],
  dealers = [],
  onSelectOrder,
  onCreateOrder,
  onCheckIn,
  activeAttendance,
}) => {
  const distributorOrders = (orders || []).filter(
    (o) => o && (o.distributorId === currentUser?.id || o.distributorName === currentUser?.businessName)
  );

  const totalSales = distributorOrders.reduce((acc, curr) => acc + (curr.grandTotal || 0), 0);

  return (
    <div className="space-y-6 font-body text-xs bg-[#F5FBF6] p-2 md:p-4 rounded-2xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#A5D6A7]/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1B5E20] tracking-tight">Distributor Operations Hub</h1>
            <span className="px-2.5 py-0.5 bg-[#E8F5E9] text-[#1B5E20] font-bold text-xs rounded-full border border-[#A5D6A7]">
              {currentUser.territory || 'Palanpur Zone'}
            </span>
          </div>
          <p className="text-xs text-[#525252] mt-1 font-medium">
            Welcome back, <span className="font-bold text-[#1B5E20]">{currentUser.name}</span> ({currentUser.businessName})
          </p>
        </div>

        <button
          onClick={onCreateOrder}
          className="px-5 py-2 text-xs font-bold bg-[#2E7D32] text-white hover:bg-[#1B5E20] rounded-lg transition-all shadow-md cursor-pointer"
        >
          + Create Order for Dealer
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="MONTHLY TURNOVER"
          value={`₹${(totalSales || 1850000).toLocaleString('en-IN')}`}
          icon="trending_up"
          trend="up"
          accentBorder="green"
        />
        <KpiCard
          label="ACTIVE DEALERS"
          value={dealers.length || 42}
          icon="storefront"
          accentBorder="green"
        />
        <KpiCard
          label="DISPATCHES IN TRANSIT"
          value={distributorOrders.filter((o) => o.status === 'Dispatched' || o.status === 'Processing').length || 3}
          icon="local_shipping"
          accentBorder="green"
        />
        <KpiCard
          label="LEDGER OUTSTANDING"
          value="₹1.45 Lakhs"
          icon="account_balance_wallet"
          accentBorder="red"
        />
      </div>

      {/* Primary Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={onCreateOrder}
          className="bg-white p-5 rounded-2xl border border-[#e2e8f0] hover:border-[#2E7D32] transition-all cursor-pointer shadow-xs hover:shadow-md flex items-center gap-3"
        >
          <div className="w-11 h-11 bg-[#E8F5E9] text-[#2E7D32] rounded-full flex items-center justify-center font-bold text-lg">
            🛒
          </div>
          <div>
            <div className="font-bold text-[#1B5E20] text-sm">Place B2B Order</div>
            <div className="text-xs text-[#525252] font-medium">Direct order entry for assigned dealers</div>
          </div>
        </div>

        <div 
          onClick={onCheckIn}
          className="bg-white p-5 rounded-2xl border border-[#e2e8f0] hover:border-[#2E7D32] transition-all cursor-pointer shadow-xs hover:shadow-md flex items-center gap-3"
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg ${activeAttendance?.active ? 'bg-[#E8F5E9] text-[#1B5E20]' : 'bg-[#eff6ff] text-[#2563eb]'}`}>
            {activeAttendance?.active ? '✓' : '📍'}
          </div>
          <div>
            <div className="font-bold text-[#1B5E20] text-sm">Daily Field Check-in (Start Day)</div>
            <div className={`text-xs font-bold ${activeAttendance?.active ? 'text-[#2E7D32]' : 'text-[#2563eb]'}`}>
              {activeAttendance?.active 
                ? `✓ Checked in at ${activeAttendance?.attendance?.check_in || 'Morning'}` 
                : activeAttendance?.completed
                ? `✓ Shift Ended (${activeAttendance?.attendance?.working_hours || 0}h)`
                : 'Click to start day with GPS verification'}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0] hover:border-[#2E7D32] transition-all cursor-pointer shadow-xs hover:shadow-md flex items-center gap-3">
          <div className="w-11 h-11 bg-[#FFF8E1] text-[#F57F17] rounded-full flex items-center justify-center font-bold text-lg">
            📄
          </div>
          <div>
            <div className="font-bold text-[#1B5E20] text-sm">Submit Fuel/KM Expense</div>
            <div className="text-xs text-[#525252] font-medium">Claim daily dealer visit travel expenses</div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto shadow-xs p-5">
        <div className="flex justify-between items-center mb-4 border-b border-[#e2e8f0] pb-3 font-bold text-xs text-[#1B5E20] uppercase tracking-wider">
          <span>Assigned Dealer Orders ({distributorOrders.length})</span>
          <button onClick={onCreateOrder} className="text-[#2E7D32] text-xs font-bold hover:underline cursor-pointer">
            + New Order ➔
          </button>
        </div>
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-[#E8F5E9] text-[#1B5E20] border-b border-[#A5D6A7]">
            <tr>
              <th className="p-3 font-bold">Order ID</th>
              <th className="p-3 font-bold">Date</th>
              <th className="p-3 font-bold">Dealer Name</th>
              <th className="p-3 font-bold text-right">SKUs</th>
              <th className="p-3 font-bold text-right">Grand Total</th>
              <th className="p-3 font-bold">Status</th>
              <th className="p-3 font-bold">LR Number</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {distributorOrders.map((ord) => (
              <tr key={ord.id} onClick={() => onSelectOrder && onSelectOrder(ord)} className="hover:bg-[#F5FBF6] cursor-pointer transition-colors">
                <td className="p-3 font-bold text-[#2E7D32]">{ord.orderNumber}</td>
                <td className="p-3 text-[#525252] font-medium">{ord.date}</td>
                <td className="p-3 font-bold text-[#161616]">{ord.dealerName}</td>
                <td className="p-3 text-right font-bold">{(ord.items || []).length} SKUs</td>
                <td className="p-3 text-right font-bold text-[#1B5E20]">
                  ₹{(ord.grandTotal || 0).toLocaleString('en-IN')}
                </td>
                <td className="p-3">
                  <StatusBadge status={ord.status} />
                </td>
                <td className="p-3 font-mono text-[#525252] font-semibold">{ord.lrNumber || 'Pending Dispatch'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

