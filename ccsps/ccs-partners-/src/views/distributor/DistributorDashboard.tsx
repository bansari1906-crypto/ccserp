import React from 'react';
import { KpiCard } from '../../components/common/KpiCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Order, Dealer, User, AttendanceRecord } from '../../types';
import { ChitraLogo } from '../../components/common/ChitraLogo';

interface DistributorDashboardProps {
  currentUser: User;
  orders?: Order[];
  dealers?: Dealer[];
  activeAttendance?: AttendanceRecord | null;
  workingDurationStr?: string;
  onStartDay?: () => void;
  onEndDay?: () => void;
  onSelectOrder?: (order: Order) => void;
  onCreateOrder?: () => void;
  onTabChange?: (tab: string) => void;
}

export const DistributorDashboard: React.FC<DistributorDashboardProps> = ({
  currentUser,
  orders = [],
  dealers = [],
  activeAttendance,
  workingDurationStr = '00h 00m',
  onStartDay,
  onEndDay,
  onSelectOrder,
  onCreateOrder,
  onTabChange,
}) => {
  const distributorOrders = (orders || []).filter(
    (o) => o && (o.distributorId === currentUser?.id || o.distributorName === currentUser?.businessName)
  );

  const totalSales = distributorOrders.reduce((acc, curr) => acc + (curr.grandTotal || 0), 0);

  const handleNav = (tab: string) => {
    if (onTabChange) onTabChange(tab);
    else if (tab === 'create-order' && onCreateOrder) onCreateOrder();
  };

  const isWorking = Boolean(activeAttendance && activeAttendance.isActive && !activeAttendance.checkOut);
  const isCompleted = Boolean(activeAttendance && activeAttendance.checkOut);

  return (
    <div className="space-y-5 font-body text-xs">
      {/* Salesman Profile & Compact Header */}
      <div className="bg-white border border-[#e2e8f0] p-4 rounded-lg shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ChitraLogo variant="icon" size="md" />
          <div>
            <h1 className="text-base font-bold text-[#0f172a]">{currentUser.name}</h1>
            <p className="text-[#64748b] text-xs">
              {currentUser.role} • {currentUser.businessName || 'CCS Maharashtra Field Operations'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-[#f0fdf4] text-[#15803d] border border-[#86efac] font-bold text-[10px] rounded-full">
                Active Employee
              </span>
              <span className="text-[10px] text-[#94a3b8] font-mono">
                ID: {currentUser.id || 'EMP-104'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-[#e2e8f0]">
          <button
            onClick={() => handleNav('profile')}
            className="px-3 py-1.5 border border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#334155] font-bold text-xs rounded-md shadow-2xs cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">account_circle</span>
            My Profile
          </button>
          <button
            onClick={() => alert('Logged out successfully.')}
            className="px-3 py-1.5 bg-[#fee2e2] hover:bg-[#fecaca] text-[#dc2626] border border-[#fca5a5] font-bold text-xs rounded-md shadow-2xs cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            Logout
          </button>
        </div>
      </div>

      {/* Today's Attendance Live Status Card (Production Grade) */}
      <div className="bg-white border border-[#e2e8f0] p-4 rounded-lg shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shadow-2xs ${
                isWorking
                  ? 'bg-[#16a34a]'
                  : isCompleted
                  ? 'bg-[#0f766e]'
                  : 'bg-[#64748b]'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">
                {isWorking ? 'schedule' : isCompleted ? 'check_circle' : 'event_available'}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                  TODAY'S ATTENDANCE
                </span>
                {isWorking ? (
                  <span className="px-2 py-0.5 bg-[#dcfce7] text-[#15803d] font-extrabold text-[10px] border border-[#86efac] rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
                    Started / Checked In
                  </span>
                ) : isCompleted ? (
                  <span className="px-2 py-0.5 bg-[#ccfbf1] text-[#0f766e] font-extrabold text-[10px] border border-[#5eead4] rounded-full flex items-center gap-1">
                    ✓ Day Completed
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-[#f1f5f9] text-[#64748b] font-bold text-[10px] border border-[#cbd5e1] rounded-full">
                    Not Started
                  </span>
                )}
              </div>

              {isWorking ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs">
                  <p className="font-bold text-[#0f172a] flex items-center gap-1">
                    <span className="text-[#64748b] font-normal">Started:</span> {activeAttendance?.checkIn}
                  </p>
                  <p className="font-bold text-[#16a34a] flex items-center gap-1">
                    <span className="text-[#64748b] font-normal">Working:</span> {workingDurationStr}
                  </p>
                  <p className="text-[#475569] flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-[15px] text-[#16a34a]">location_on</span>
                    {activeAttendance?.currentLocation || activeAttendance?.locationCheckIn || 'Location captured'}
                  </p>
                </div>
              ) : isCompleted ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs">
                  <p className="font-bold text-[#0f172a]">
                    <span className="text-[#64748b] font-normal">Login:</span> {activeAttendance?.checkIn}
                  </p>
                  <p className="font-bold text-[#0f172a]">
                    <span className="text-[#64748b] font-normal">Logout:</span> {activeAttendance?.checkOut}
                  </p>
                  <p className="font-bold text-[#0f766e]">
                    <span className="text-[#64748b] font-normal">Working Hours:</span> {activeAttendance?.workingHours || activeAttendance?.totalHours}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#64748b] mt-0.5">
                  Shift has not started yet today. Capture your check-in selfie to begin your work day.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {isWorking ? (
              <button
                type="button"
                onClick={onEndDay || (() => handleNav('attendance'))}
                className="px-4 py-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-xs rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                End Day (Clock Out)
              </button>
            ) : !isCompleted ? (
              <button
                type="button"
                onClick={onStartDay || (() => handleNav('attendance'))}
                className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                Start Day (Clock In)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNav('attendance')}
                className="px-3.5 py-2 bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1] font-bold text-xs rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[18px]">event_note</span>
                View Attendance
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 6 Clean Quick Action Tiles */}
      <div>
        <h2 className="text-xs font-bold text-[#14532d] uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-[#16a34a]">apps</span>
          Field Sales Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Tile 1: Visit Site */}
          <div
            onClick={() => handleNav('dealer-visit')}
            className="bg-white p-3.5 border border-[#e2e8f0] hover:border-[#16a34a] hover:bg-[#f0fdf4] transition-all cursor-pointer rounded-lg shadow-2xs flex flex-col justify-between space-y-2 group"
          >
            <div className="w-9 h-9 bg-[#dcfce7] text-[#16a34a] rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">pin_drop</span>
            </div>
            <div>
              <div className="font-bold text-[#0f172a] text-xs">📍 Visit Site</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">Record dealer/farmer visit</div>
            </div>
          </div>

          {/* Tile 2: My Attendance */}
          <div
            onClick={() => handleNav('attendance')}
            className="bg-white p-3.5 border border-[#e2e8f0] hover:border-[#16a34a] hover:bg-[#f0fdf4] transition-all cursor-pointer rounded-lg shadow-2xs flex flex-col justify-between space-y-2 group"
          >
            <div className="w-9 h-9 bg-[#dcfce7] text-[#16a34a] rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">event_available</span>
            </div>
            <div>
              <div className="font-bold text-[#0f172a] text-xs">🕒 My Attendance</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">View attendance logs</div>
            </div>
          </div>

          {/* Tile 3: Order Now */}
          <div
            onClick={() => handleNav('create-order')}
            className="bg-white p-3.5 border border-[#e2e8f0] hover:border-[#16a34a] hover:bg-[#f0fdf4] transition-all cursor-pointer rounded-lg shadow-2xs flex flex-col justify-between space-y-2 group"
          >
            <div className="w-9 h-9 bg-[#dcfce7] text-[#16a34a] rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
            </div>
            <div>
              <div className="font-bold text-[#0f172a] text-xs">🛒 Order Now</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">Create new B2B order</div>
            </div>
          </div>

          {/* Tile 4: Order List */}
          <div
            onClick={() => handleNav('orders')}
            className="bg-white p-3.5 border border-[#e2e8f0] hover:border-[#16a34a] hover:bg-[#f0fdf4] transition-all cursor-pointer rounded-lg shadow-2xs flex flex-col justify-between space-y-2 group"
          >
            <div className="w-9 h-9 bg-[#dcfce7] text-[#16a34a] rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">history</span>
            </div>
            <div>
              <div className="font-bold text-[#0f172a] text-xs">📋 Order List</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">View submitted orders</div>
            </div>
          </div>

          {/* Tile 5: Expense List */}
          <div
            onClick={() => handleNav('expenses')}
            className="bg-white p-3.5 border border-[#e2e8f0] hover:border-[#16a34a] hover:bg-[#f0fdf4] transition-all cursor-pointer rounded-lg shadow-2xs flex flex-col justify-between space-y-2 group"
          >
            <div className="w-9 h-9 bg-[#dcfce7] text-[#16a34a] rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            </div>
            <div>
              <div className="font-bold text-[#0f172a] text-xs">₹ Expense List</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">Manage travel claims</div>
            </div>
          </div>

          {/* Tile 6: Plan & Report */}
          <div
            onClick={() => handleNav('daily-plan')}
            className="bg-white p-3.5 border border-[#e2e8f0] hover:border-[#16a34a] hover:bg-[#f0fdf4] transition-all cursor-pointer rounded-lg shadow-2xs flex flex-col justify-between space-y-2 group"
          >
            <div className="w-9 h-9 bg-[#dcfce7] text-[#16a34a] rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">calendar_month</span>
            </div>
            <div>
              <div className="font-bold text-[#0f172a] text-xs">📅 Plan & Report</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">Add daily plan/report</div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="MONTHLY TURNOVER"
          value={`₹${totalSales.toLocaleString('en-IN')}`}
          icon="trending_up"
          trend="up"
        />
        <KpiCard
          label="ASSIGNED CLIENTS"
          value={dealers.length}
          icon="group"
        />
        <KpiCard
          label="PENDING DISPATCHES"
          value={distributorOrders.filter((o) => o.status === 'Dispatched' || o.status === 'Processing').length}
          icon="local_shipping"
          accentBorder="blue"
        />
        <KpiCard
          label="UNPAID INVOICES"
          value={`₹${distributorOrders.filter((o) => o.paymentStatus !== 'Paid').reduce((a, b) => a + (b.grandTotal || 0), 0).toLocaleString('en-IN')}`}
          icon="account_balance_wallet"
          accentBorder="red"
        />
      </div>

      {/* Recent Assigned Orders Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden shadow-2xs">
        <div className="p-3 bg-[#f8fafc] border-b border-[#e2e8f0] font-bold text-xs text-[#14532d] uppercase tracking-wider flex justify-between items-center">
          <span>Assigned Dealer Orders ({distributorOrders.length})</span>
          <button onClick={() => handleNav('create-order')} className="text-[#16a34a] text-xs font-bold hover:underline cursor-pointer">
            + Order Now
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#f8fafc] text-[#64748b] border-b border-[#e2e8f0] uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3">Order ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">Dealer Name</th>
                <th className="p-3 text-right">SKUs</th>
                <th className="p-3 text-right">Grand Total</th>
                <th className="p-3">Status</th>
                <th className="p-3">LR Number</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {distributorOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#64748b]">
                    No assigned orders found.
                  </td>
                </tr>
              ) : (
                distributorOrders.map((ord) => (
                  <tr key={ord.id} onClick={() => onSelectOrder && onSelectOrder(ord)} className="hover:bg-[#f8fafc] cursor-pointer transition-colors">
                    <td className="p-3 font-bold text-[#14532d]">{ord.orderNumber}</td>
                    <td className="p-3 text-[#64748b]">{ord.date}</td>
                    <td className="p-3 font-bold text-[#0f172a]">{ord.dealerName}</td>
                    <td className="p-3 text-right font-semibold">{(ord.items || []).length} SKUs</td>
                    <td className="p-3 text-right font-extrabold text-[#15803d]">
                      ₹{(ord.grandTotal || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={ord.status} />
                    </td>
                    <td className="p-3 font-mono text-[#64748b]">{ord.lrNumber || 'Pending Dispatch'}</td>
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
