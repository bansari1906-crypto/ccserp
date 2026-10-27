import React, { useState, useEffect } from 'react';
import { getCurrentGpsPosition, GpsLocationResult } from '../../services/locationService';
import { captureBackCameraPhoto } from '../../services/cameraService';

interface AttendanceSelfieModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'start' | 'end';
  employeeName?: string;
  onSubmit: (data: {
    photo: string;
    backCameraPhoto?: string;
    location: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
  }) => Promise<void>;
}

export const AttendanceSelfieModal: React.FC<AttendanceSelfieModalProps> = ({
  isOpen,
  onClose,
  mode,
  employeeName = 'Employee',
  onSubmit,
}) => {
  const [backPhoto, setBackPhoto] = useState<string | null>(null);

  const [gpsData, setGpsData] = useState<GpsLocationResult | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [isCapturingBack, setIsCapturingBack] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const isStart = mode === 'start';
  const title = isStart ? 'START DAY ATTENDANCE' : 'END DAY ATTENDANCE';

  // Format today's date (e.g. 05 Oct 2026)
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Fetch real GPS on open
  const fetchGps = async () => {
    setIsDetectingGps(true);
    setGpsError(null);
    try {
      const pos = await getCurrentGpsPosition({ timeout: 15000, enableHighAccuracy: true });
      setGpsData(pos);
    } catch (err: any) {
      console.error('GPS error:', err);
      setGpsError(err.message || 'Unable to acquire accurate GPS coordinates. Please enable GPS and try again.');
      setGpsData(null);
    } finally {
      setIsDetectingGps(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setBackPhoto(null);
      setGpsData(null);
      setGpsError(null);
      setCameraError(null);
      setSubmitError(null);
      setSubmitSuccess(false);
      fetchGps();
    }
  }, [isOpen]);

  const handleTakeBackPhoto = async () => {
    setIsCapturingBack(true);
    setCameraError(null);
    try {
      const photo = await captureBackCameraPhoto();
      setBackPhoto(photo);
    } catch (err: any) {
      if (!err.message?.includes('cancelled')) {
        setCameraError(err.message || 'Failed to capture rear camera photo.');
      }
    } finally {
      setIsCapturingBack(false);
    }
  };

  const isReadyToSubmit = Boolean(
    gpsData &&
    gpsData.latitude &&
    gpsData.longitude &&
    backPhoto &&
    !isSubmitting
  );

  const handleSubmit = async () => {
    if (!gpsData) {
      setSubmitError('Real GPS location is required. Please verify GPS before submitting.');
      return;
    }
    if (!backPhoto) {
      setSubmitError('Back Camera Photo is required to verify work site / field location.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        photo: backPhoto,
        backCameraPhoto: backPhoto,
        location: gpsData.formattedText,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        accuracy: gpsData.accuracy,
      });
      setSubmitSuccess(true);
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('Attendance submission error:', err);
      let msg = err.message || (isStart ? 'Start Day failed. Please try again.' : 'End Day failed. Please try again.');
      if (typeof err === 'object' && err.response?.data?.error) {
        msg = err.response.data.error;
      } else if (typeof err === 'object' && err.response?.data?.detail) {
        msg = err.response.data.detail;
      }
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 overflow-y-auto animate-fadeIn font-body text-xs">
      <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col border border-[#cbd5e1] my-auto">
        {/* Header */}
        <div className="p-4 bg-[#f8fafc] border-b border-[#e2e8f0] flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg ${isStart ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#dc2626]'} flex items-center justify-center`}>
              <span className="material-symbols-outlined text-[22px]">
                {isStart ? 'event_available' : 'logout'}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide">{title}</h3>
              <p className="text-[11px] text-[#64748b] font-medium">
                Employee: <span className="font-semibold text-[#0f172a]">{employeeName}</span> • Date: <span className="font-semibold text-[#0f172a]">{todayFormatted}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 1. GPS Verification Box */}
          <div className="rounded-lg border p-3 bg-[#f8fafc] transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[20px] ${gpsData ? 'text-[#16a34a]' : isDetectingGps ? 'text-[#eab308] animate-spin' : 'text-[#dc2626]'}`}>
                  {gpsData ? 'verified' : isDetectingGps ? 'refresh' : 'location_off'}
                </span>
                <span className="font-bold text-xs uppercase tracking-wider text-[#0f172a]">
                  {gpsData ? '📍 GPS VERIFIED' : isDetectingGps ? '📍 DETECTING REAL GPS...' : '📍 GPS NOT VERIFIED'}
                </span>
              </div>
              <button
                type="button"
                onClick={fetchGps}
                disabled={isDetectingGps || isSubmitting}
                className="text-[11px] text-[#16a34a] hover:text-[#15803d] font-bold underline cursor-pointer disabled:opacity-50"
              >
                {isDetectingGps ? 'Detecting...' : 'Retry GPS'}
              </button>
            </div>

            {gpsData ? (
              <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded border border-[#bbf7d0] text-[11px]">
                <div>
                  <span className="text-[#64748b] block text-[10px]">Latitude</span>
                  <span className="font-mono font-bold text-[#0f172a]">{gpsData.latitude.toFixed(6)}°</span>
                </div>
                <div>
                  <span className="text-[#64748b] block text-[10px]">Longitude</span>
                  <span className="font-mono font-bold text-[#0f172a]">{gpsData.longitude.toFixed(6)}°</span>
                </div>
                <div>
                  <span className="text-[#64748b] block text-[10px]">Accuracy</span>
                  <span className="font-mono font-bold text-[#16a34a]">±{gpsData.accuracy}m</span>
                </div>
              </div>
            ) : gpsError ? (
              <div className="p-2 bg-[#fee2e2] border border-[#fca5a5] rounded text-[#b91c1c] text-[11px] font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{gpsError}</span>
              </div>
            ) : (
              <div className="text-[11px] text-[#64748b] italic">
                Acquiring high-accuracy satellite GPS coordinates from Android device...
              </div>
            )}
          </div>

          {/* Camera Error Banner */}
          {cameraError && (
            <div className="p-2.5 bg-[#fee2e2] text-[#b91c1c] border border-[#fca5a5] rounded-md font-medium text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">videocam_off</span>
              <span>{cameraError}</span>
            </div>
          )}

          {/* 2. Mandatory Back Camera Photo Card */}
          <div className="w-full">
            <div className="border border-[#cbd5e1] rounded-lg p-3 bg-white flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#0f172a] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-[#0284c7]">photo_camera_back</span>
                  📷 BACK CAMERA PHOTO
                </span>
                {backPhoto && (
                  <span className="px-1.5 py-0.5 bg-[#e0f2fe] text-[#0369a1] font-bold text-[10px] rounded">
                    ✓ Captured
                  </span>
                )}
              </div>

              {/* Preview or Empty Placeholder */}
              <div className="relative w-full aspect-16/9 bg-[#0f172a] rounded-lg overflow-hidden flex items-center justify-center border border-[#e2e8f0]">
                {backPhoto ? (
                  <img
                    src={backPhoto}
                    alt="Back Camera Photo Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-4 text-center text-[#94a3b8] space-y-1">
                    <span className="material-symbols-outlined text-[36px] text-[#475569]">
                      landscape
                    </span>
                    <p className="text-[11px] text-[#cbd5e1]">Rear worksite / field photo required</p>
                  </div>
                )}
              </div>

              {backPhoto ? (
                <button
                  type="button"
                  onClick={handleTakeBackPhoto}
                  disabled={isCapturingBack || isSubmitting}
                  className="w-full py-2 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#334155] border border-[#cbd5e1] font-bold text-xs rounded-md cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">cached</span>
                  Retake Back Photo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleTakeBackPhoto}
                  disabled={isCapturingBack || isSubmitting}
                  className="w-full py-2.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs rounded-md shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                  {isCapturingBack ? 'Opening Rear Camera...' : 'Take Back Camera Photo'}
                </button>
              )}
            </div>
          </div>

          {/* Submission Error Banner */}
          {submitError && (
            <div className="p-3 bg-[#fee2e2] text-[#b91c1c] border border-[#fca5a5] rounded-md font-semibold text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{submitError}</span>
            </div>
          )}

          {/* Submission Success Banner */}
          {submitSuccess && (
            <div className="p-3 bg-[#dcfce7] text-[#15803d] border border-[#86efac] rounded-md font-bold text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Day Started Successfully! Updating dashboard...</span>
            </div>
          )}

          {/* Checklist reminder */}
          <div className="p-2.5 bg-[#f1f5f9] rounded-lg border border-[#e2e8f0] text-[11px] text-[#475569] space-y-1">
            <div className="font-semibold text-[#0f172a]">Required for submission:</div>
            <div className="flex items-center gap-2">
              <span className={gpsData ? 'text-[#16a34a] font-bold' : 'text-[#94a3b8]'}>
                {gpsData ? '✓' : '○'} Real device GPS acquired
              </span>
              <span>•</span>
              <span className={backPhoto ? 'text-[#16a34a] font-bold' : 'text-[#94a3b8]'}>
                {backPhoto ? '✓' : '○'} Back camera photo captured
              </span>
            </div>
          </div>
        </div>

        {/* Footer Submit Button */}
        <div className="p-4 bg-[#f8fafc] border-t border-[#e2e8f0]">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isReadyToSubmit}
            className={`w-full py-3 ${
              isStart ? 'bg-[#16a34a] hover:bg-[#15803d]' : 'bg-[#dc2626] hover:bg-[#b91c1c]'
            } text-white font-extrabold text-sm rounded-lg shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
                Submitting... Please wait...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">
                  {isStart ? 'login' : 'logout'}
                </span>
                {isStart ? 'START DAY (CLOCK IN)' : 'END DAY (CLOCK OUT)'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
