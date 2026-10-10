import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status = '' }) => {
  const normalized = (status || '').toLowerCase();

  if (['delivered', 'paid', 'approved', 'present', 'active', 'available', 'in stock', 'resolved'].includes(normalized)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[#defbe6] text-[#0e6027] border border-[#a7f0ba]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#198038] mr-1.5" />
        {status}
      </span>
    );
  }

  if (['processing', 'dispatched', 'in transit', 'submitted', 'open'].includes(normalized)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[#d0e2ff] text-[#001d6c] border border-[#78a9ff]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0f62fe] mr-1.5 animate-pulse" />
        {status}
      </span>
    );
  }

  if (['pending', 'late', 'half day', 'low stock', 'in progress', 'partial', 'upcoming'].includes(normalized)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[#fcf1d3] text-[#715100] border border-[#f1c21b]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f1c21b] mr-1.5" />
        {status}
      </span>
    );
  }

  if (['cancelled', 'rejected', 'absent', 'unavailable', 'out of stock', 'overdue', 'inactive', 'high', 'closed'].includes(normalized)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[#fff1f1] text-[#750e13] border border-[#ffb3b8]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#da1e28] mr-1.5" />
        {status}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[#f4f4f4] text-[#161616] border border-[#e0e0e0]">
      {status}
    </span>
  );
};
