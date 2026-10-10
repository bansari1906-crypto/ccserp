import React, { useState } from 'react';
import { AttendanceRecord, User } from '../../types';
import { hrApi } from '../../api/client';
import { AttendanceSelfieModal } from '../../components/common/AttendanceSelfieModal';
import { AttendanceDetailModal } from '../../components/common/AttendanceDetailModal';

interface SalesmanAttendanceProps {
  currentUser?: User;
  attendanceRecords?: AttendanceRecord[];
  activeAttendance?: AttendanceRecord | null;
  workingDurationStr?: string;
  onRefresh?: () => void;
  onStartDayClick?: () => void;
  onEndDayClick?: () => void;
}

export const SalesmanAttendance: React.FC<SalesmanAttendanceProps> = ({
  currentUser,
  attendanceRecords = [],
  activeAttendance,
  workingDurationStr = '00h 00m',
  onRefresh,
  onStartDayClick,
  onEndDayClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('All Months');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Modal State for Selfie Capture (Local fallback if parent doesn't handle)
  const [selfieModalMode, setSelfieModalMode] = useState<'start' | 'end' | null>(null);

  // Detail Modal State
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const isWorking = Boolean(
    activeAttendance &&
    (activeAttendance.isActive || activeAttendance.status === 'Working') &&
    (!activeAttendance.checkOut || activeAttendance.checkOut === '--')
  );
  const isCompleted = Boolean(
    activeAttendance &&
    !activeAttendance.isActive &&
    activeAttendance.checkOut &&
    activeAttendance.checkOut !== '--'
  );

  // Calculate Dynamic KPI Counts
  const presentCount = attendanceRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length;
  const workingCount = attendanceRecords.filter((r) => r.status === 'Working' || r.status === 'Running').length;
  const absentCount = attendanceRecords.filter((r) => r.status === 'Absent').length;
  const halfDayCount = attendanceRecords.filter((r) => r.status === 'Half Day').length;

  // Filter records
  const filteredRecords = attendanceRecords.filter((rec) => {
    const matchesSearch =
      (rec.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.date || '').includes(searchTerm) ||
      (rec.status || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.locationCheckIn || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleSelfieSubmit = async (data: {
    photo: string;
    backCameraPhoto?: string;
    location: string;
    latitude?: number;
    longitude?: number;
  }) => {
    setLoading(true);
    try {
      if (selfieModalMode === 'start') {
        await hrApi.clockIn({
          location: data.location,
          latitude: data.latitude,
          longitude: data.longitude,
          photo: data.photo,
          backCameraPhoto: data.backCameraPhoto,
        });
        setSuccessMsg('Check-in recorded successfully! Shift started.');
      } else {
        await hrApi.clockOut({
          location: data.location,
          latitude: data.latitude,
          longitude: data.longitude,
          photo: data.photo,
        });
        setSuccessMsg('Shift ended successfully! Attendance recorded.');
      }
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Attendance submission error:', err);
      throw err;
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  return (
    <div className="space-y-5 font-body text-xs">
      {/* Header Banner */}
      <div className="bg-white border border-[#e2e8f0] p-4 rounded-lg shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-[#16a34a]">event_available</span>
              Daily Attendance & Working Log
            </h1>
            <p className="text-xs text-[#64748b] mt-0.5">
              Manage daily shift login, working hours, and view historical attendance records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isWorking ? (
              <button
                type="button"
                onClick={() => (onEndDayClick ? onEndDayClick() : setSelfieModalMode('end'))}
                disabled={loading}
                className="px-4 py-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-xs rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                End Day (Clock Out)
              </button>
            ) : !isCompleted ? (
              <button
                type="button"
                onClick={() => (onStartDayClick ? onStartDayClick() : setSelfieModalMode('start'))}
                disabled={loading}
                className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                Start Day (Clock In)
              </button>
            ) : (
              <span className="px-3 py-1.5 bg-[#f0fdf4] text-[#166534] border border-[#86efac] font-bold text-xs rounded-md flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Day Completed
              </span>
            )}
          </div>
        </div>

        {/* Live Working Status Strip */}
        <div className="mt-3 pt-3 border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[#64748b] font-semibold">Today's Shift:</span>
            {isWorking ? (
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 bg-[#dcfce7] text-[#15803d] font-bold rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
                  Started / Checked In
                </span>
                <span className="text-[#0f172a] font-bold">
                  Started at {activeAttendance?.checkIn}
                </span>
                <span className="text-[#16a34a] font-bold">
                  ({workingDurationStr} elapsed)
                </span>
                <span className="text-[#64748b]">
                  • {activeAttendance?.currentLocation || activeAttendance?.locationCheckIn}
                </span>
              </div>
            ) : isCompleted ? (
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 bg-[#ccfbf1] text-[#0f766e] font-bold rounded-full">
                  ✓ Day Completed
                </span>
                <span className="text-[#0f172a] font-bold">
                  {activeAttendance?.checkIn} - {activeAttendance?.checkOut} ({activeAttendance?.workingHours || activeAttendance?.totalHours})
                </span>
              </div>
            ) : (
              <span className="text-[#64748b]">
                Not started yet today. Click 'Start Day' to check in.
              </span>
            )}
          </div>

          <span className="text-[11px] text-[#94a3b8] font-mono">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-[#dcfce7] text-[#15803d] border border-[#86efac] rounded-md font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {successMsg}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#cbd5e1] border-l-4 border-l-[#16a34a] p-3 rounded-lg shadow-2xs">
          <div className="text-[11px] font-bold text-[#64748b] uppercase">Present Days</div>
          <div className="text-lg font-bold text-[#14532d] mt-1">{presentCount}</div>
        </div>

        <div className="bg-white border border-[#cbd5e1] border-l-4 border-l-[#2563eb] p-3 rounded-lg shadow-2xs">
          <div className="text-[11px] font-bold text-[#64748b] uppercase">Active / Working</div>
          <div className="text-lg font-bold text-[#1d4ed8] mt-1">{workingCount || (isWorking ? 1 : 0)}</div>
        </div>

        <div className="bg-white border border-[#cbd5e1] border-l-4 border-l-[#dc2626] p-3 rounded-lg shadow-2xs">
          <div className="text-[11px] font-bold text-[#64748b] uppercase">Absent</div>
          <div className="text-lg font-bold text-[#dc2626] mt-1">{absentCount}</div>
        </div>

        <div className="bg-white border border-[#cbd5e1] border-l-4 border-l-[#0284c7] p-3 rounded-lg shadow-2xs">
          <div className="text-[11px] font-bold text-[#64748b] uppercase">Half Day</div>
          <div className="text-lg font-bold text-[#0369a1] mt-1">{halfDayCount}</div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white border border-[#e2e8f0] p-4 rounded-lg shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#94a3b8] text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search date, status, location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-md text-xs focus:outline-none focus:border-[#16a34a]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-[#64748b] whitespace-nowrap">Filter Month:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-md text-xs font-bold text-[#0f172a] focus:outline-none focus:border-[#16a34a]"
          >
            <option value="All Months">All Months (2026)</option>
            <option value="September">September 2026</option>
            <option value="August">August 2026</option>
            <option value="July">July 2026</option>
          </select>
        </div>
      </div>

      {/* Clean Attendance Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden shadow-2xs">
        <div className="p-3 bg-[#f8fafc] border-b border-[#e2e8f0] font-bold text-xs text-[#0f172a] uppercase tracking-wider flex justify-between items-center">
          <span>Attendance History ({filteredRecords.length})</span>
          <span className="text-[11px] text-[#64748b] font-normal lowercase">Click Details to view full record</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#f8fafc] text-[#64748b] border-b border-[#e2e8f0] uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3 w-12 text-center">S.No.</th>
                <th className="p-3">Date</th>
                <th className="p-3">Login Time</th>
                <th className="p-3">Logout Time</th>
                <th className="p-3 text-right">Working Hours</th>
                <th className="p-3">Location</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filteredRecords.map((rec, idx) => (
                <tr key={rec.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="p-3 text-center font-bold text-[#64748b]">{rec.sNo || idx + 1}</td>
                  <td className="p-3 font-bold text-[#0f172a]">
                    {rec.date} <span className="text-[10px] font-normal text-[#64748b]">({rec.day})</span>
                  </td>
                  <td className="p-3 font-semibold text-[#0f172a]">{rec.checkIn || '--'}</td>
                  <td className="p-3 font-semibold text-[#0f172a]">{rec.checkOut || '--'}</td>
                  <td className="p-3 text-right font-extrabold text-[#0f172a]">
                    {rec.workingHours || rec.totalHours || '--'}
                  </td>
                  <td className="p-3 text-[#475569] max-w-[200px] truncate">
                    {rec.locationCheckIn || rec.currentLocation || 'Recorded'}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        rec.status === 'Working'
                          ? 'bg-[#dbeafe] text-[#1e40af] border border-[#93c5fd]'
                          : rec.status === 'Present'
                          ? 'bg-[#dcfce7] text-[#166534] border border-[#86efac]'
                          : rec.status === 'Absent'
                          ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
                          : 'bg-[#fef9c3] text-[#854d0e] border border-[#fde047]'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(rec)}
                      className="px-2.5 py-1 bg-white hover:bg-[#f1f5f9] text-[#0f172a] border border-[#cbd5e1] rounded font-bold text-[11px] shadow-2xs cursor-pointer inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px] text-[#64748b]">visibility</span>
                      View Details
                    </button>
                  </td>
                </tr>
              ))}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#64748b]">
                    No attendance records found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Details Modal */}
      <AttendanceDetailModal
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        record={selectedRecord}
      />

      {/* Selfie Attendance Modal */}
      {selfieModalMode && (
        <AttendanceSelfieModal
          isOpen={Boolean(selfieModalMode)}
          onClose={() => setSelfieModalMode(null)}
          mode={selfieModalMode}
          employeeName={currentUser?.name || 'Employee'}
          onSubmit={handleSelfieSubmit}
        />
      )}
    </div>
  );
};
