import React from 'react';
import { User, UserRole } from '../../types';
import { ChitraLogo } from '../common/ChitraLogo';

interface SidebarProps {
  role?: UserRole;
  currentUser?: User;
  activeView?: string;
  activeTab?: string;
  onSelectView?: (view: string) => void;
  onTabChange?: (tab: string) => void;
  onQuickAction?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  currentUser,
  activeView,
  activeTab,
  onSelectView,
  onTabChange,
  onQuickAction,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const rawRole = (role || currentUser?.role || 'ADMIN').toString().toUpperCase();
  const currentRole: UserRole = rawRole.includes('WAREHOUSE')
    ? 'WAREHOUSE'
    : rawRole.includes('ADMIN')
    ? 'ADMIN'
    : rawRole.includes('DISTRIBUTOR')
    ? 'DISTRIBUTOR'
    : 'EMPLOYEE';

  const currentActive = activeView || activeTab || 'dashboard';

  const getNavItems = (): NavItem[] => {
    if (currentRole === 'ADMIN') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { id: 'dealers', label: 'Distributors', icon: 'domain' },
        { id: 'distributors', label: 'Employees', icon: 'badge' },
        { id: 'registration-approval', label: 'Registration Approval', icon: 'how_to_reg' },
        { id: 'products', label: 'Products', icon: 'inventory_2' },
        { id: 'orders', label: 'Orders', icon: 'shopping_cart' },
        { id: 'attendance', label: 'Attendance', icon: 'event_available' },
        { id: 'expenses', label: 'Expenses', icon: 'receipt_long' },
        { id: 'reports', label: 'Reports', icon: 'assessment' },
        { id: 'notifications', label: 'Notifications', icon: 'notifications' },
        { id: 'profile', label: 'Profile', icon: 'person' },
        { id: 'settings', label: 'Settings', icon: 'settings' },
        { id: 'logout', label: 'Logout', icon: 'logout' },
      ];
    } else if (currentRole === 'EMPLOYEE') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { id: 'attendance', label: 'My Attendance', icon: 'event_available' },
        { id: 'visit-site', label: 'Visit Site', icon: 'pin_drop' },
        { id: 'create-order', label: 'Order Now', icon: 'add_shopping_cart' },
        { id: 'orders', label: 'Order List', icon: 'history' },
        { id: 'expenses', label: 'Expense List', icon: 'receipt_long' },
        { id: 'plan-report', label: 'Plan & Report', icon: 'calendar_month' },
        { id: 'dealers', label: 'Distributor List', icon: 'group' },
        { id: 'products', label: 'Products Catalog', icon: 'inventory_2' },
        { id: 'monthly-sales-plan', label: 'Monthly Sales Plan', icon: 'trending_up' },
        { id: 'monthly-collection-plan', label: 'Monthly Collection Plan', icon: 'payments' },
        { id: 'profile', label: 'My Profile', icon: 'person' },
        { id: 'support', label: 'Support', icon: 'headset_mic' },
        { id: 'logout', label: 'Logout', icon: 'logout' },
      ];
    } else if (currentRole === 'DISTRIBUTOR') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { id: 'products', label: 'Products Catalog', icon: 'inventory_2' },
        { id: 'create-order', label: 'Place Order', icon: 'add_shopping_cart' },
        { id: 'orders', label: 'My Orders', icon: 'shopping_cart' },
        { id: 'payments', label: 'Payments / Ledger', icon: 'payments' },
        { id: 'invoices', label: 'Invoices', icon: 'description' },
        { id: 'profile', label: 'My Profile', icon: 'person' },
        { id: 'support', label: 'Support', icon: 'headset_mic' },
        { id: 'logout', label: 'Logout', icon: 'logout' },
      ];
    } else {
      // WAREHOUSE PORTAL (Clean warehouse management items)
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { id: 'orders', label: 'Ready to Dispatch', icon: 'local_shipping' },
        { id: 'order-list', label: 'Dispatched Orders', icon: 'format_list_bulleted' },
        { id: 'support', label: 'Support', icon: 'headset_mic' },
        { id: 'logout', label: 'Logout', icon: 'logout' },
      ];
    }
  };

  const navItems = getNavItems();

  const handleSelect = (id: string) => {
    if (onSelectView) onSelectView(id);
    if (onTabChange) onTabChange(id);
    if (onCloseMobile) onCloseMobile();
  };

  const handleQuick = () => {
    if (onQuickAction) onQuickAction();
    else if (onTabChange) onTabChange('create-order');
    else if (onSelectView) onSelectView('create-order');
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed left-0 top-12 h-[calc(100vh-3rem)] z-40 flex flex-col pt-3 pb-3 bg-white border-r border-[#e2e8f0] w-64 transition-transform duration-200 ease-in-out font-body text-xs font-medium ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Quick Action Button (Hidden for Dealer & Warehouse) */}
        {currentRole !== 'DEALER' && currentRole !== 'WAREHOUSE' && (
          <div className="px-3 mb-3">
            <button
              onClick={handleQuick}
              className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold py-2 px-3 text-xs transition-colors shadow-xs rounded flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>
                {currentRole === 'DISTRIBUTOR'
                  ? 'Create Order'
                  : '+ Quick Action'}
              </span>
            </button>
          </div>
        )}

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              currentActive === item.id ||
              currentActive.toLowerCase() === item.id.toLowerCase() ||
              (currentActive === 'analytics' && item.id === 'dashboard');
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-all rounded-md cursor-pointer ${
                  isActive
                    ? 'bg-[#f0fdf4] text-[#14532d] font-bold border-l-4 border-[#16a34a]'
                    : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`material-symbols-outlined text-[19px] ${
                      isActive ? 'filled text-[#16a34a]' : 'text-[#64748b]'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      isActive
                        ? 'bg-[#16a34a] text-white'
                        : 'bg-[#e2e8f0] text-[#334155]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Links & Logout */}
        <div className="px-2 pt-2 border-t border-[#e2e8f0] mt-auto space-y-0.5">
          <a
            href={(import.meta as any).env?.VITE_APK_URL || '/downloads/CCS-Connect.apk'}
            download="CCS-Connect.apk"
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[#16a34a] hover:bg-[#f0fdf4] hover:text-[#15803d] transition-colors text-xs font-bold rounded-md"
            title="Download Android APK"
          >
            <span className="material-symbols-outlined text-[18px]">android</span>
            <span>Download Mobile App</span>
          </a>
          <button
            onClick={() => handleSelect('support')}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors text-xs font-medium rounded-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">headset_mic</span>
            <span>Support & Assistance</span>
          </button>
          <button
            onClick={() => handleSelect('logout')}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[#dc2626] hover:bg-[#fee2e2] transition-colors text-xs font-medium rounded-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

