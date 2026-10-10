import React, { useState } from 'react';
import { Expense, User } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { hrApi } from '../../api/client';
import { ImageProofModal } from '../../components/common/ImageProofModal';

interface SalesmanExpensesProps {
  currentUser?: User;
  expenses?: Expense[];
  onRefresh?: () => void;
}

export const SalesmanExpenses: React.FC<SalesmanExpensesProps> = ({
  currentUser,
  expenses = [],
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('All Months');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Local expense records synchronized with incoming prop and immediately updated on submit
  const [localExpenses, setLocalExpenses] = useState<Expense[]>(expenses);

  React.useEffect(() => {
    setLocalExpenses(expenses);
  }, [expenses]);

  // Form State for Add Expense (Starting KM, Ending KM, and Admin-assigned KM Rate)
  const [startingKm, setStartingKm] = useState<number | ''>('');
  const [endingKm, setEndingKm] = useState<number | ''>('');
  const [kmValidationErr, setKmValidationErr] = useState('');

  // Other expense fields
  const [busTrainCarFair, setBusTrainCarFair] = useState<number | ''>('');
  const [fairCab, setFairCab] = useState<number | ''>('');
  const [fairAuto, setFairAuto] = useState<number | ''>('');
  const [otherVehicleFair, setOtherVehicleFair] = useState<number | ''>('');
  
  const [food, setFood] = useState<number | ''>('');
  const [laundry, setLaundry] = useState<number | ''>('');
  const [phoneBill, setPhoneBill] = useState<number | ''>('');
  const [internetBill, setInternetBill] = useState<number | ''>('');
  const [localConveyance, setLocalConveyance] = useState<number | ''>('');
  const [courier, setCourier] = useState<number | ''>('');
  const [photocopy, setPhotocopy] = useState<number | ''>('');
  const [otherCharge, setOtherCharge] = useState<number | ''>('');
  
  const [remark, setRemark] = useState('');
  const [billImage, setBillImage] = useState<string | null>(null);

  // Determine employee assigned KM rate from Admin
  // If not configured, kmRate is null/undefined
  const employeeKmRate = currentUser?.kmRate !== undefined && currentUser?.kmRate !== null
    ? Number(currentUser.kmRate)
    : 5.0; // Standard default rate if available

  // Calculate Total KM = Ending KM - Starting KM
  const hasStarting = startingKm !== '';
  const hasEnding = endingKm !== '';
  const numStarting = Number(startingKm) || 0;
  const numEnding = Number(endingKm) || 0;

  const totalKm = (hasStarting && hasEnding && numEnding >= numStarting)
    ? numEnding - numStarting
    : 0;

  // Calculate KM Amount = Total KM * KM Rate
  const calculatedKmAmount = totalKm > 0 && employeeKmRate ? totalKm * employeeKmRate : 0;

  // Validation Check on KM inputs
  const getKmError = (): string => {
    if (hasStarting && numStarting < 0) {
      return 'Starting KM cannot be negative.';
    }
    if (hasStarting && hasEnding && numEnding < numStarting) {
      return 'Ending KM cannot be less than Starting KM.';
    }
    return '';
  };

  // Modal State for Receipt Image Proofs
  const [proofModalState, setProofModalState] = useState<{
    isOpen: boolean;
    title: string;
    imageUrl?: string;
    employeeName?: string;
    date?: string;
    remarks?: string;
    status?: string;
    details?: Record<string, string | number | undefined>;
  }>({
    isOpen: false,
    title: '',
  });

  // Calculate Auto Total Amount (Including Calculated KM Amount)
  const calculatedTotal =
    calculatedKmAmount +
    (Number(busTrainCarFair) || 0) +
    (Number(fairCab) || 0) +
    (Number(fairAuto) || 0) +
    (Number(otherVehicleFair) || 0) +
    (Number(food) || 0) +
    (Number(laundry) || 0) +
    (Number(phoneBill) || 0) +
    (Number(internetBill) || 0) +
    (Number(localConveyance) || 0) +
    (Number(courier) || 0) +
    (Number(photocopy) || 0) +
    (Number(otherCharge) || 0);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Dynamic available months list based on data and current date
  const availableMonths = React.useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(`${monthNames[now.getMonth()]} ${now.getFullYear()}`);

    localExpenses.forEach((e) => {
      if (e.date) {
        const d = new Date(e.date);
        if (!isNaN(d.getTime())) {
          set.add(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
        }
      }
    });
    return ['All Months', ...Array.from(set)];
  }, [localExpenses]);

  // Filter Expense Records based on search, month, and status
  const filteredExpenses = localExpenses.filter((exp) => {
    // Status Filter
    if (selectedStatus !== 'All Statuses' && exp.status !== selectedStatus) {
      return false;
    }

    // Month Filter
    if (selectedMonth !== 'All Months' && exp.date) {
      const d = new Date(exp.date);
      if (!isNaN(d.getTime())) {
        const mStr = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        if (mStr !== selectedMonth) return false;
      }
    }

    // Search Filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchesEmp = (exp.employeeName || '').toLowerCase().includes(term);
      const matchesRemark = (exp.remarks || exp.remark || '').toLowerCase().includes(term);
      const matchesStatus = (exp.status || '').toLowerCase().includes(term);
      const matchesDate = (exp.date || '').toLowerCase().includes(term);
      const matchesType = (exp.type || '').toLowerCase().includes(term);
      if (!matchesEmp && !matchesRemark && !matchesStatus && !matchesDate && !matchesType) {
        return false;
      }
    }

    return true;
  });

  const totalClaimed = filteredExpenses.reduce((sum, e) => sum + (e.totalAmount || e.amount || 0), 0);
  const totalApproved = filteredExpenses.filter((e) => e.status === 'Approved').reduce((sum, e) => sum + (e.approvalAmount || e.amount || 0), 0);
  const pendingCount = filteredExpenses.filter((e) => e.status === 'Pending').length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBillImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check KM rate configuration
    if (employeeKmRate === undefined || employeeKmRate === null) {
      alert('KM rate has not been configured by Admin. Please contact Admin.');
      return;
    }

    // Validate Starting & Ending KM
    const kmErr = getKmError();
    if (kmErr) {
      setKmValidationErr(kmErr);
      alert(kmErr);
      return;
    }

    if (calculatedTotal <= 0) {
      alert('Please enter at least one expense amount or valid KM travel distance.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const created = await hrApi.createExpense({
        category: 'Travel',
        amount: calculatedTotal,
        starting_km: startingKm,
        ending_km: endingKm,
        bus_train_car_fair: busTrainCarFair,
        fair_cab: fairCab,
        fair_auto: fairAuto,
        other_vehicle_fair: otherVehicleFair,
        food: food,
        laundry: laundry,
        phone_bill: phoneBill,
        internet_bill: internetBill,
        local_conveyance: localConveyance,
        courier: courier,
        photocopy: photocopy,
        other_charge: otherCharge,
        bill: billImage || undefined,
        remarks: remark || (totalKm > 0 ? `Field visit (${totalKm} KM @ ₹${employeeKmRate}/KM)` : 'Field sales claim'),
      });

      // Immediately prepend newly created expense to the list so it appears without delay
      setLocalExpenses((prev) => [created, ...prev]);
      setSuccessMsg('Expense claim submitted successfully for approval!');
      setShowAddModal(false);
      resetForm();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("Expense submission error:", err);
      const msg = err.message || (typeof err === 'string' ? err : 'Failed to submit expense claim. Please try again.');
      setErrorMsg(msg);
      // DO NOT close modal or show false success!
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const resetForm = () => {
    setStartingKm('');
    setEndingKm('');
    setKmValidationErr('');
    setBusTrainCarFair('');
    setFairCab('');
    setFairAuto('');
    setOtherVehicleFair('');
    setFood('');
    setLaundry('');
    setPhoneBill('');
    setInternetBill('');
    setLocalConveyance('');
    setCourier('');
    setPhotocopy('');
    setOtherCharge('');
    setRemark('');
    setBillImage(null);
  };

  return (
    <div className="space-y-5 font-body text-xs">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#e2e8f0] p-4 rounded-lg shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-[#14532d] flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-[#16a34a]">receipt_long</span>
            Expense List & Travel Claims
          </h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Manage travel ride KM, vehicle fares, food, phone, local conveyance, and bill receipt proofs.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Add Expense Claim
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-[#dcfce7] text-[#15803d] border border-[#86efac] rounded-md font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {successMsg}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#cbd5e1] border-l-4 border-l-[#16a34a] p-4 rounded-lg shadow-2xs">
          <div className="text-xs font-bold text-[#64748b] uppercase">Total Claimed Amount</div>
          <div className="text-xl font-extrabold text-[#14532d] mt-1">₹{totalClaimed.toLocaleString('en-IN')}</div>
        </div>

        <div className="bg-white border border-[#cbd5e1] border-l-4 border-l-[#15803d] p-4 rounded-lg shadow-2xs">
          <div className="text-xs font-bold text-[#64748b] uppercase">Approved Amount</div>
          <div className="text-xl font-extrabold text-[#15803d] mt-1">₹{totalApproved.toLocaleString('en-IN')}</div>
        </div>

        <div className="bg-white border border-[#cbd5e1] border-l-4 border-l-[#eab308] p-4 rounded-lg shadow-2xs">
          <div className="text-xs font-bold text-[#64748b] uppercase">Pending Claims</div>
          <div className="text-xl font-extrabold text-[#ca8a04] mt-1">{pendingCount} Claims</div>
        </div>
      </div>

      {/* Search, Status & Month Filter */}
      <div className="bg-white border border-[#e2e8f0] p-4 rounded-lg shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-72">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#94a3b8] text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search remark, date, status, employee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-md text-xs focus:outline-none focus:border-[#16a34a]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#64748b] whitespace-nowrap">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-md text-xs font-bold text-[#0f172a] focus:outline-none focus:border-[#16a34a]"
            >
              <option value="All Statuses">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#64748b] whitespace-nowrap">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-md text-xs font-bold text-[#0f172a] focus:outline-none focus:border-[#16a34a]"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Detailed Expense Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden shadow-2xs">
        <div className="p-3 bg-[#f8fafc] border-b border-[#e2e8f0] font-bold text-xs text-[#14532d] uppercase tracking-wider flex justify-between items-center">
          <span>Expense Records & Fares ({filteredExpenses.length})</span>
          <span className="text-[11px] text-[#64748b] font-normal lowercase">Scroll horizontally to view all fare categories</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#f8fafc] text-[#64748b] border-b border-[#e2e8f0] uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3 w-10 text-center">S.No.</th>
                <th className="p-3">Date</th>
                <th className="p-3 text-right">Start KM</th>
                <th className="p-3 text-right">End KM</th>
                <th className="p-3 text-right">Total KM</th>
                <th className="p-3 text-right">KM Rate</th>
                <th className="p-3 text-right">KM Amt (₹)</th>
                <th className="p-3 text-right">Bus/Train/Car</th>
                <th className="p-3 text-right">Cab/Auto/Other</th>
                <th className="p-3 text-right">Food</th>
                <th className="p-3 text-right">Laundry</th>
                <th className="p-3 text-right">Phone/Internet</th>
                <th className="p-3 text-right">Conveyance</th>
                <th className="p-3 text-right">Courier/Photo</th>
                <th className="p-3 text-right">Other</th>
                <th className="p-3 text-right">Total Claim (₹)</th>
                <th className="p-3 text-right">Approval (₹)</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Proof Bill</th>
                <th className="p-3">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filteredExpenses.map((exp, idx) => {
                const totalCabAutoOther = (exp.fairCab || 0) + (exp.fairAuto || 0) + (exp.otherVehicleFair || 0);
                const phoneAndInternet = (exp.phoneBill || 0) + (exp.internetBill || 0);
                const courierAndPhoto = (exp.courier || 0) + (exp.photocopy || 0);
                const proofUrl = exp.proofImage || exp.billUrl;
                const sKm = exp.startingKm ?? (exp as any).starting_km;
                const eKm = exp.endingKm ?? (exp as any).ending_km;
                const tKm = exp.totalKm ?? (exp as any).total_km ?? exp.totalRideKm ?? exp.rideKm ?? 0;
                const kRate = exp.kmRate ?? (exp as any).km_rate;
                const kAmt = exp.kmAmount ?? (exp as any).km_amount ?? 0;

                return (
                  <tr key={exp.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="p-3 text-center font-bold text-[#64748b]">{exp.sNo || idx + 1}</td>
                    <td className="p-3 font-semibold text-[#0f172a]">{exp.date}</td>
                    <td className="p-3 text-right font-mono text-[#0f172a]">{sKm !== undefined && sKm !== null ? sKm : '-'}</td>
                    <td className="p-3 text-right font-mono text-[#0f172a]">{eKm !== undefined && eKm !== null ? eKm : '-'}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#15803d]">{tKm} KM</td>
                    <td className="p-3 text-right font-mono text-[#475569]">{kRate !== undefined && kRate !== null ? `₹${kRate}/KM` : '-'}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#14532d]">₹{Number(kAmt).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono text-[#475569]">₹{(exp.busTrainCarFair || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono text-[#475569]">₹{totalCabAutoOther.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono text-[#475569]">₹{(exp.food || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono text-[#475569]">₹{(exp.laundry || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono text-[#475569]">₹{phoneAndInternet.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono text-[#475569]">₹{(exp.localConveyance || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono text-[#475569]">₹{courierAndPhoto.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono text-[#475569]">₹{(exp.otherCharge || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-extrabold text-[#14532d]">₹{(exp.totalAmount || exp.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-bold text-[#15803d]">₹{(exp.approvalAmount || (exp.status === 'Approved' ? exp.amount : 0)).toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      <StatusBadge status={exp.status} />
                    </td>
                    <td className="p-3 text-center">
                      {proofUrl ? (
                        <button
                          onClick={() =>
                            setProofModalState({
                              isOpen: true,
                              title: 'Expense Receipt Voucher Proof',
                              imageUrl: proofUrl,
                              employeeName: exp.employeeName,
                              date: exp.date,
                              remarks: exp.remarks || exp.remark,
                              status: exp.status,
                              details: {
                                TotalAmount: `₹${(exp.totalAmount || exp.amount).toLocaleString('en-IN')}`,
                                StartingKM: `${sKm !== undefined ? sKm : '-'}`,
                                EndingKM: `${eKm !== undefined ? eKm : '-'}`,
                                TotalKM: `${tKm} KM`,
                                KMRate: kRate !== undefined ? `₹${kRate}/KM` : '-',
                                KMAmount: `₹${Number(kAmt).toLocaleString('en-IN')}`,
                                Dealer: exp.dealerVisited || 'Field Visits',
                              },
                            })
                          }
                          className="px-2.5 py-1 bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#15803d] border border-[#86efac] rounded text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">receipt</span>
                          View Proof
                        </button>
                      ) : (
                        <span className="px-2 py-0.5 bg-[#f1f5f9] text-[#94a3b8] text-[10px] font-bold rounded">
                          No Proof
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-[#475569] max-w-xs truncate">{exp.remarks || exp.remark || 'Field sales claim'}</td>
                  </tr>
                );
              })}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={20} className="p-8 text-center text-[#64748b]">
                    No expense claims found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Structured Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-[#cbd5e1] rounded-lg max-w-2xl w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#e2e8f0] pb-3">
              <h2 className="text-sm font-bold text-[#14532d] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#16a34a]">add_card</span>
                Add New Sales Expense Claim
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#64748b] hover:text-[#0f172a] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {employeeKmRate === undefined || employeeKmRate === null ? (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                KM rate has not been configured by Admin. Please contact Admin.
              </div>
            ) : null}

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitExpense} className="space-y-4">
              {/* Group 1: Travel Expenses */}
              <div className="bg-[#f8fafc] p-3.5 rounded-lg border border-[#e2e8f0] space-y-3">
                <h3 className="text-xs font-bold text-[#14532d] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#16a34a]">directions_car</span>
                  1. Travel & Vehicle Expenses (Vehicle KM Calculation)
                </h3>

                {/* Starting KM, Ending KM, Total KM, KM Rate, KM Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 bg-white p-3 rounded-md border border-[#cbd5e1]">
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">
                      Starting KM <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 10200"
                      min="0"
                      value={startingKm}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setStartingKm(val);
                        setKmValidationErr('');
                      }}
                      className="w-full px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a] focus:outline-none focus:border-[#16a34a]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">
                      Ending KM <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 10275"
                      min="0"
                      value={endingKm}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setEndingKm(val);
                        setKmValidationErr('');
                      }}
                      className="w-full px-2.5 py-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a] focus:outline-none focus:border-[#16a34a]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#64748b] mb-1">
                      Total KM (Auto)
                    </label>
                    <div className="px-2.5 py-1.5 bg-[#f1f5f9] border border-[#cbd5e1] rounded text-xs font-mono font-extrabold text-[#15803d]">
                      {totalKm} KM
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#64748b] mb-1">
                      KM Rate (Admin)
                    </label>
                    <div className="px-2.5 py-1.5 bg-[#f1f5f9] border border-[#cbd5e1] rounded text-xs font-mono font-bold text-[#0f172a] truncate" title={`₹${employeeKmRate} / KM (Admin assigned)`}>
                      ₹{employeeKmRate}/KM
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#14532d] mb-1">
                      KM Amount (₹)
                    </label>
                    <div className="px-2.5 py-1.5 bg-[#dcfce7] border border-[#86efac] rounded text-xs font-mono font-extrabold text-[#15803d]">
                      ₹{calculatedKmAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* KM Validation Error Message */}
                {getKmError() && (
                  <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-[11px] font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    {getKmError()}
                  </div>
                )}

                <div className="text-[11px] text-[#64748b] italic">
                  Note: Total KM = Ending KM - Starting KM. KM Amount = Total KM × ₹{employeeKmRate}/KM (Admin assigned rate is read-only).
                </div>

                {/* Other Vehicle Fares */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-[#e2e8f0]">
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Bus / Train / Car Fare (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={busTrainCarFair}
                      onChange={(e) => setBusTrainCarFair(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Cab / Taxi Fare (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={fairCab}
                      onChange={(e) => setFairCab(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Auto Fare (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={fairAuto}
                      onChange={(e) => setFairAuto(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Other Vehicle Fare (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={otherVehicleFair}
                      onChange={(e) => setOtherVehicleFair(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Daily Expenses */}
              <div className="bg-[#f8fafc] p-3 rounded-lg border border-[#e2e8f0] space-y-3">
                <h3 className="text-xs font-bold text-[#14532d] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#16a34a]">restaurant</span>
                  2. Daily Expenses & Office Charges
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Food / Meals (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={food}
                      onChange={(e) => setFood(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Laundry (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={laundry}
                      onChange={(e) => setLaundry(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Phone Bill (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={phoneBill}
                      onChange={(e) => setPhoneBill(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Internet Bill (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={internetBill}
                      onChange={(e) => setInternetBill(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Local Conveyance (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={localConveyance}
                      onChange={(e) => setLocalConveyance(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Courier Charges (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={courier}
                      onChange={(e) => setCourier(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Photocopy (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={photocopy}
                      onChange={(e) => setPhotocopy(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] mb-1">Other Charge (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={otherCharge}
                      onChange={(e) => setOtherCharge(Number(e.target.value) || '')}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-bold text-[#0f172a]"
                    />
                  </div>
                </div>
              </div>

              {/* Total Calculation Banner */}
              <div className="bg-[#f0fdf4] border border-[#86efac] p-3 rounded-lg flex justify-between items-center">
                <span className="font-bold text-xs text-[#14532d]">Auto-Calculated Total Amount:</span>
                <span className="text-base font-extrabold text-[#15803d]">₹{calculatedTotal.toLocaleString('en-IN')}</span>
              </div>

              {/* Remark & Proof Photo Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#334155] mb-1">Remark / Purpose</label>
                  <textarea
                    rows={3}
                    placeholder="Enter visit details, dealer names, or voucher notes..."
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    className="w-full p-2 bg-[#f8fafc] border border-[#cbd5e1] rounded text-xs font-medium text-[#0f172a]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#334155] mb-1">Upload Receipt / Bill Proof</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="w-full text-xs text-[#64748b] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#f0fdf4] file:text-[#16a34a] cursor-pointer"
                  />
                  {billImage && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={billImage} alt="Receipt Preview" className="w-12 h-12 object-cover rounded border border-[#cbd5e1]" />
                      <span className="text-[10px] text-[#16a34a] font-bold">✓ Bill Proof Attached</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[#f1f5f9] text-[#475569] font-bold text-xs rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs rounded-md shadow-2xs"
                >
                  {submitting ? 'Submitting Claim...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Image Proof Viewer Modal */}
      <ImageProofModal
        isOpen={proofModalState.isOpen}
        onClose={() => setProofModalState({ ...proofModalState, isOpen: false })}
        title={proofModalState.title}
        imageUrl={proofModalState.imageUrl}
        employeeName={proofModalState.employeeName}
        date={proofModalState.date}
        remarks={proofModalState.remarks}
        status={proofModalState.status}
        details={proofModalState.details}
      />
    </div>
  );
};
