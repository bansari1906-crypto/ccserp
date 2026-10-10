import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { ChitraLogo } from '../common/ChitraLogo';

interface TopHeaderProps {
  currentUser: User;
  onRoleChange?: (role: UserRole) => void;
  onUserChange?: (role: string) => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenSupport: () => void;
  onQuickAction?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  toggleMobileMenu?: () => void;
  unreadNotificationsCount?: number;
  onGoBack?: () => void;
  canGoBack?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  onRoleChange,
  onUserChange,
  onOpenSearch,
  onOpenNotifications,
  onOpenSupport,
  onQuickAction,
  activeTab = 'dashboard',
  onTabChange,
  toggleMobileMenu,
  unreadNotificationsCount = 0,
  onGoBack,
  canGoBack = false,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const rawRole = (currentUser.role || 'ADMIN').toString().toUpperCase();
  const displayRole: 'ADMIN' | 'EMPLOYEE' | 'DISTRIBUTOR' | 'WAREHOUSE' = rawRole.includes('WAREHOUSE')
    ? 'WAREHOUSE'
    : rawRole.includes('ADMIN')
    ? 'ADMIN'
    : rawRole.includes('DISTRIBUTOR')
    ? 'DISTRIBUTOR'
    : 'EMPLOYEE';

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-3 sm:px-4 h-12 bg-white border-b border-[#e2e8f0] font-body text-sm shadow-xs">
      {/* Left: Brand Logo + Mobile Toggle + Back Button + Nav Links */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger 3 Lines */}
        <button
          onClick={toggleMobileMenu}
          className="md:hidden text-[#475569] hover:text-[#0f172a] p-1.5 rounded hover:bg-[#f1f5f9] transition-colors cursor-pointer"
          aria-label="Toggle menu"
          title="Open Navigation Menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {/* Universal Back Button for Mobile / Secondary Views */}
        {canGoBack && onGoBack && (
          <button
            onClick={onGoBack}
            className="flex items-center gap-1 px-2 py-1 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] rounded font-bold text-xs transition cursor-pointer border border-[#cbd5e1]"
            title="Go Back"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span className="text-[11px] hidden xs:inline">Back</span>
          </button>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          <ChitraLogo variant="horizontal" size="md" showTagline={true} />
          <span className="hidden sm:inline-block ml-1 px-2 py-0.5 bg-[#dcfce7] text-[#14532d] text-[10px] font-bold border border-[#86efac] uppercase tracking-wider rounded">
            {displayRole} PORTAL
          </span>
        </div>
      </div>

      {/* Right: Search + Notifications + Help + Role Selector + User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Search trigger */}
        <button
          onClick={onOpenSearch}
          className="hidden sm:flex items-center gap-2 bg-white hover:bg-[#f8fafc] px-3 text-xs text-[#475569] cursor-pointer border border-[#cbd5e1] transition-colors rounded-md shadow-2xs h-9"
        >
          <span className="material-symbols-outlined text-[16px] text-[#64748b]">search</span>
          <span className="font-medium">Search ERP (Ctrl+K)</span>
        </button>

        {/* Quick action button (Hidden for Dealer & Warehouse Portal) */}
        {!rawRole.includes('DEALER') && !rawRole.includes('WAREHOUSE') && (
          <button
            onClick={onQuickAction || (() => onTabChange && onTabChange('create-order'))}
            className="p-1.5 text-[#16a34a] hover:text-[#15803d] hover:bg-[#f0fdf4] rounded-md transition-colors cursor-pointer h-9 w-9 flex items-center justify-center"
            title="Quick Action"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
          </button>
        )}

        {/* Notification bell */}
        <button
          onClick={onOpenNotifications}
          className="relative p-1.5 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] border border-transparent hover:border-[#cbd5e1] rounded-md transition-colors cursor-pointer h-9 w-9 flex items-center justify-center"
          title="Notifications"
        >
          <span className="material-symbols-outlined text-[18px]">notifications</span>
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#dc2626] rounded-full animate-pulse" />
          )}
        </button>

        {/* Help button */}
        <button
          onClick={onOpenSupport}
          className="p-1.5 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] border border-transparent hover:border-[#cbd5e1] rounded-md transition-colors cursor-pointer h-9 w-9 flex items-center justify-center"
          title="Support & Help"
        >
          <span className="material-symbols-outlined text-[18px]">help</span>
        </button>

        {/* Authenticated Role Indicator Badge (Strictly Non-Switchable) */}
        <div className="flex items-center gap-2 px-3 bg-[#f8fafc] border border-[#cbd5e1] text-xs text-[#334155] rounded-md shadow-2xs h-9 select-none">
          <span className="w-2 h-2 bg-[#16a34a] rounded-full shrink-0" />
          <span className="hidden sm:inline text-[#64748b] font-medium">Role:</span>
          <span className="font-extrabold text-[#0f172a] tracking-wide">{displayRole}</span>
        </div>

        {/* User Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 px-3 bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] text-xs transition-colors cursor-pointer rounded-md shadow-2xs h-9"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-6 h-6 rounded-full object-cover border border-[#cbd5e1] shrink-0"
            />
            <div className="hidden lg:flex flex-col text-left leading-tight">
              <span className="text-xs font-bold text-[#0f172a]">{currentUser.name}</span>
              <span className="text-[10px] text-[#64748b] font-normal">{currentUser.email || currentUser.code}</span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-[#64748b] hidden lg:inline">
              expand_more
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-1 w-60 bg-white border border-[#e2e8f0] shadow-lg py-2 z-50 text-xs rounded-md">
              <div className="px-3 py-2 border-b border-[#e2e8f0] bg-[#f8fafc]">
                <div className="font-bold text-[#0f172a]">{currentUser.name}</div>
                <div className="text-[11px] text-[#64748b]">{currentUser.email}</div>
                <div className="text-[10px] text-[#16a34a] font-bold mt-1 uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">verified</span>
                  {displayRole} • {currentUser.territory || 'Chitra Crop Science HQ'}
                </div>
              </div>
              <button
                onClick={() => {
                  if (onTabChange) onTabChange('profile');
                  setShowUserMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#f0fdf4] flex items-center gap-2 text-[#334155] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-[#16a34a]">account_circle</span>
                <span>My Profile & Account</span>
              </button>
              <button
                onClick={() => {
                  onOpenSupport();
                  setShowUserMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#f0fdf4] flex items-center gap-2 text-[#334155] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-[#16a34a]">headset_mic</span>
                <span>Help Desk & Support</span>
              </button>
              <div className="border-t border-[#e2e8f0] my-1" />
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  if (onTabChange) onTabChange('logout');
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#fee2e2] flex items-center gap-2 text-[#dc2626] font-medium cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

