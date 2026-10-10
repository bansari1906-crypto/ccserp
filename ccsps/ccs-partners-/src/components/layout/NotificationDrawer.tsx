import React from 'react';
import { NotificationItem } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications?: NotificationItem[];
  onMarkAllRead?: () => void;
  onNotificationClick?: (item: NotificationItem) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications = [],
  onMarkAllRead,
  onNotificationClick,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffSecs = Math.max(Math.floor(diffMs / 1000), 0);
      if (diffSecs < 60) return 'Just now';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  const getTypeIcon = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'order':
        return { icon: 'shopping_bag', color: 'text-[#0284c7] bg-[#e0f2fe]' };
      case 'approval':
        return { icon: 'verified', color: 'text-[#16a34a] bg-[#dcfce7]' };
      case 'dispatch':
        return { icon: 'local_shipping', color: 'text-[#9333ea] bg-[#f3e8ff]' };
      case 'payment':
        return { icon: 'payments', color: 'text-[#059669] bg-[#d1fae5]' };
      case 'expense':
        return { icon: 'receipt_long', color: 'text-[#d97706] bg-[#fef3c7]' };
      case 'attendance':
      case 'reminder':
        return { icon: 'alarm', color: 'text-[#4f46e5] bg-[#e0e7ff]' };
      case 'stock':
        return { icon: 'warning', color: 'text-[#dc2626] bg-[#fee2e2]' };
      default:
        return { icon: 'notifications', color: 'text-[#64748b] bg-[#f1f5f9]' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs animate-fadeIn font-body text-xs">
      <div className="bg-white w-full max-w-sm h-full border-l border-[#cbd5e1] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc] flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#dbeafe] text-[#2563eb] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#0f172a]">Business Alerts</h3>
              <p className="text-[11px] text-[#64748b]">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#f1f5f9]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-[#94a3b8] space-y-2">
              <span className="material-symbols-outlined text-[42px] text-[#cbd5e1]">notifications_off</span>
              <p className="font-semibold text-xs text-[#64748b]">No notifications yet</p>
              <p className="text-[11px] text-[#94a3b8]">Live business alerts and status updates will appear here.</p>
            </div>
          ) : (
            notifications.map((n) => {
              const { icon, color } = getTypeIcon(n.type);
              return (
                <div
                  key={n.id}
                  onClick={() => onNotificationClick && onNotificationClick(n)}
                  className={`p-3.5 hover:bg-[#f8fafc] transition-colors cursor-pointer flex gap-3 items-start ${
                    !n.isRead ? 'bg-[#eff6ff]/50 border-l-3 border-[#2563eb]' : 'bg-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${color}`}>
                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`text-xs truncate ${!n.isRead ? 'font-extrabold text-[#0f172a]' : 'font-semibold text-[#334155]'}`}>
                        {n.title}
                      </span>
                      <span className="text-[10px] text-[#94a3b8] shrink-0 ml-2 font-mono">
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748b] leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                    {n.destination && (
                      <span className="inline-block mt-1 text-[10px] text-[#2563eb] font-semibold hover:underline">
                        View details →
                      </span>
                    )}
                  </div>

                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#2563eb] shrink-0 mt-1.5" title="Unread" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-between items-center text-xs">
            <button
              onClick={onMarkAllRead}
              disabled={unreadCount === 0}
              className="font-bold text-[#2563eb] hover:text-[#1d4ed8] disabled:text-[#94a3b8] disabled:cursor-not-allowed cursor-pointer"
            >
              Mark all as read
            </button>
            <span className="text-[10px] text-[#94a3b8]">
              {notifications.length} total
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
