import React from 'react';
import { AttendanceRecord } from '../../types';

interface AttendanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
}

export const AttendanceDetailModal: React.FC<AttendanceDetailModalProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn font-body text-xs">
      <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col border border-[#cbd5e1] max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-[#f8fafc] border-b border-[#e2e8f0] flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#dcfce7] text-[#16a34a] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">calendar_month</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0f172a]">Attendance Record Details</h3>
              <p className="text-[11px] text-[#64748b]">
                {record.employeeName} ({record.role}) • {record.date} ({record.day})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Status Banner */}
          <div className="flex items-center justify-between p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#64748b]">Status</span>
              <div className="mt-0.5">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    record.status === 'Working'
                      ? 'bg-[#dbeafe] text-[#1e40af] border border-[#93c5fd]'
                      : record.status === 'Present'
                      ? 'bg-[#dcfce7] text-[#166534] border border-[#86efac]'
                      : record.status === 'Absent'
                      ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
                      : 'bg-[#fef9c3] text-[#854d0e] border border-[#fde047]'
                  }`}
                >
                  {record.status}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-[#64748b]">Total Working Hours</span>
              <div className="text-sm font-extrabold text-[#0f172a] mt-0.5">
                {record.workingHours || record.totalHours || '--'}
              </div>
            </div>
          </div>

          {/* Time & Location Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Login Details */}
            <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-[#166534] font-bold">
                <span className="material-symbols-outlined text-[16px]">login</span>
                <span>Check-In</span>
              </div>
              <div>
                <span className="text-[10px] text-[#15803d]">Time:</span>
                <p className="font-bold text-[#0f172a] text-sm">{record.checkIn || '--'}</p>
              </div>
              <div>
                <span className="text-[10px] text-[#15803d]">Location:</span>
                <p className="text-[#334155] font-medium">{record.locationCheckIn || record.currentLocation || 'Location Recorded'}</p>
              </div>
              {record.latitude && record.longitude && (
                <div>
                  <span className="text-[10px] text-[#15803d]">GPS Coordinates:</span>
                  <p className="font-mono text-[10px] text-[#64748b]">
                    {record.latitude.toFixed(4)}° N, {record.longitude.toFixed(4)}° E
                  </p>
                </div>
              )}
            </div>

            {/* Logout Details */}
            <div className="p-3 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-[#475569] font-bold">
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>Check-Out</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748b]">Time:</span>
                <p className="font-bold text-[#0f172a] text-sm">{record.checkOut || '--'}</p>
              </div>
              <div>
                <span className="text-[10px] text-[#64748b]">Location:</span>
                <p className="text-[#334155] font-medium">{record.locationCheckOut || '--'}</p>
              </div>
            </div>
          </div>

          {/* Photos */}
          {(record.loginImage || record.backCameraImage || record.logoutImage) && (
            <div>
              <h4 className="text-xs font-bold text-[#0f172a] mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#64748b]">photo_library</span>
                Verified Attendance Photos
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {record.loginImage && (
                  <div className="border border-[#e2e8f0] rounded-lg p-2 bg-[#f8fafc]">
                    <span className="text-[10px] font-bold text-[#16a34a] block mb-1">📷 Front Selfie</span>
                    <img
                      src={record.loginImage}
                      alt="Front Selfie"
                      className="w-full h-32 object-cover rounded-md border border-[#cbd5e1]"
                    />
                  </div>
                )}
                {record.backCameraImage && (
                  <div className="border border-[#e2e8f0] rounded-lg p-2 bg-[#f8fafc]">
                    <span className="text-[10px] font-bold text-[#0284c7] block mb-1">📷 Back Camera Photo</span>
                    <img
                      src={record.backCameraImage}
                      alt="Back Camera Photo"
                      className="w-full h-32 object-cover rounded-md border border-[#cbd5e1]"
                    />
                  </div>
                )}
                {record.logoutImage && (
                  <div className="border border-[#e2e8f0] rounded-lg p-2 bg-[#f8fafc]">
                    <span className="text-[10px] font-bold text-[#dc2626] block mb-1">📷 Check-Out Photo</span>
                    <img
                      src={record.logoutImage}
                      alt="Check-Out"
                      className="w-full h-32 object-cover rounded-md border border-[#cbd5e1]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#f8fafc] border-t border-[#e2e8f0] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
