import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Paper,
  Grid,
  Divider
} from '@mui/material';
import {
  CloseOutlined,
  EnvironmentOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { getCurrentGpsPosition, requestLocationPermission } from '../../services/locationService';
import { captureBackCameraPhoto } from '../../services/cameraService';
import { submitStartDay } from '../../services/attendanceService';

export default function StartDayDialog({ open, onClose, onSuccess }) {
  // GPS State
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsData, setGpsData] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  // Photos State
  const [backPhoto, setBackPhoto] = useState(null);
  const [backLoading, setBackLoading] = useState(false);
  const [backError, setBackError] = useState(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmedData, setConfirmedData] = useState(null);

  // Reset or initialize on open
  useEffect(() => {
    if (open) {
      setSubmitError(null);
      setConfirmedData(null);
      // Auto-trigger GPS acquisition when modal opens
      handleAcquireGps();
    } else {
      // Clear state when closed
      setGpsData(null);
      setGpsError(null);
      setBackPhoto(null);
      setBackError(null);
      setSubmitting(false);
    }
  }, [open]);

  // Acquire Real GPS
  const handleAcquireGps = async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      await requestLocationPermission();
      const pos = await getCurrentGpsPosition({ timeout: 20000, enableHighAccuracy: true });
      setGpsData(pos);
    } catch (err) {
      console.warn('GPS acquisition error:', err);
      setGpsError(err.message || 'Failed to obtain GPS coordinates. Please ensure GPS is enabled.');
      setGpsData(null);
    } finally {
      setGpsLoading(false);
    }
  };

  // Capture Back Camera Photo
  const handleCaptureBack = async () => {
    setBackLoading(true);
    setBackError(null);
    try {
      const dataUrl = await captureBackCameraPhoto();
      setBackPhoto(dataUrl);
    } catch (err) {
      if (err.code !== 'CANCELLED') {
        setBackError(err.message || 'Failed to capture back camera photo.');
      }
    } finally {
      setBackLoading(false);
    }
  };

  // Submit to Django Backend
  const handleSubmit = async () => {
    if (!gpsData) {
      setSubmitError('Real GPS coordinates must be acquired before starting the day.');
      return;
    }
    if (!backPhoto) {
      setSubmitError('Please capture a back camera worksite photo.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitStartDay({
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        location: gpsData.formattedLocation,
        backPhoto
      });

      setConfirmedData(result.attendance);
      if (onSuccess) {
        onSuccess(result.attendance);
      }
    } catch (err) {
      console.error('Start Day submission failed:', err);
      setSubmitError(err.message || 'Failed to sync Start Day with server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  const isReadyToSubmit = Boolean(gpsData && backPhoto && !submitting);

  return (
    <Dialog open={open} onClose={!submitting ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#2e7d32' }} />
          <Typography variant="h5" fontWeight={700} color="#1b5e20">
            Start Working Day (Attendance)
          </Typography>
        </Stack>
        {!submitting && (
          <IconButton size="small" onClick={onClose} aria-label="close">
            <CloseOutlined />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2.5 }}>
        {confirmedData ? (
          /* SUCCESS VIEW */
          <Box textAlign="center" py={3}>
            <CheckCircleOutlined style={{ fontSize: '4rem', color: '#2e7d32' }} />
            <Typography variant="h4" fontWeight={800} color="#1b5e20" sx={{ mt: 2 }}>
              Day Started Successfully!
            </Typography>
            <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
              Your attendance and GPS location have been confirmed by the CCS backend.
            </Typography>

            <Paper elevation={0} sx={{ p: 2, mt: 3, bgcolor: '#f4fbf5', border: '1px solid #c8e6c9', borderRadius: 2, textAlign: 'left' }}>
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">DATE</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{confirmedData.date || todayFormatted}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">CHECK-IN TIME</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{confirmedData.check_in || 'Recorded'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">VERIFIED LOCATION</Typography>
                  <Typography variant="body2" fontWeight={600} color="#2e7d32">
                    {confirmedData.check_in_location || gpsData?.formattedLocation}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Box>
        ) : (
          /* FORM VIEW */
          <Stack spacing={2.5}>
            {/* Header info */}
            <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="textSecondary">
                  Today: <strong style={{ color: '#0f172a' }}>{todayFormatted}</strong>
                </Typography>
                <Chip label="Field Shift" size="small" color="success" variant="outlined" sx={{ fontWeight: 700 }} />
              </Stack>
            </Box>

            {/* ERROR ALERT */}
            {submitError && (
              <Alert severity="error" onClose={() => setSubmitError(null)}>
                {submitError}
              </Alert>
            )}

            {/* 1. GPS LOCATION SECTION */}
            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: gpsData ? '#a5d6a7' : '#e2e8f0', bgcolor: gpsData ? '#f4fbf5' : '#ffffff', borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: gpsData ? '#e8f5e9' : '#f1f5f9',
                      color: gpsData ? '#2e7d32' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <EnvironmentOutlined style={{ fontSize: '1.2rem' }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} color="#0f172a">
                      1. GPS Field Location
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Real satellite coordinates required
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  size="small"
                  variant="outlined"
                  color={gpsData ? 'success' : 'primary'}
                  disabled={gpsLoading}
                  startIcon={gpsLoading ? <CircularProgress size={14} color="inherit" /> : <SyncOutlined />}
                  onClick={handleAcquireGps}
                  sx={{ textTransform: 'none', borderRadius: 1.5 }}
                >
                  {gpsLoading ? 'Acquiring...' : gpsData ? 'Re-acquire' : 'Get Location'}
                </Button>
              </Stack>

              {/* GPS Data / Error Details */}
              <Box sx={{ mt: 1.5 }}>
                {gpsLoading && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                    <CircularProgress size={18} color="success" />
                    <Typography variant="body2" color="textSecondary">
                      Acquiring real GPS location from device sensors...
                    </Typography>
                  </Stack>
                )}

                {gpsData && !gpsLoading && (
                  <Box sx={{ bgcolor: '#ffffff', p: 1.2, borderRadius: 1.5, border: '1px solid #c8e6c9' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircleOutlined style={{ color: '#2e7d32' }} />
                      <Typography variant="body2" fontWeight={700} color="#1b5e20">
                        GPS Locked: {gpsData.latitude}° N, {gpsData.longitude}° E
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                      Accuracy: ±{gpsData.accuracy} meters • Recorded at {new Date(gpsData.timestamp).toLocaleTimeString()}
                    </Typography>
                  </Box>
                )}

                {gpsError && !gpsLoading && (
                  <Alert
                    severity="warning"
                    icon={<WarningOutlined />}
                    action={
                      <Button color="inherit" size="small" onClick={handleAcquireGps}>
                        Retry
                      </Button>
                    }
                    sx={{ mt: 1 }}
                  >
                    {gpsError}
                  </Alert>
                )}
              </Box>
            </Paper>

            {/* 2. PHOTOS SECTION (FRONT + BACK) */}
            <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} color="#0f172a" sx={{ mb: 0.5 }}>
                2. Verification Photo (Back Camera)
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                Worksite photo is required to authenticate your field shift.
              </Typography>

              <Box sx={{ border: '1px dashed #cbd5e1', borderRadius: 2, p: 2, textAlign: 'center', bgcolor: backPhoto ? '#f8fafc' : '#ffffff' }}>
                <Typography variant="subtitle2" fontWeight={700} color="#1e293b" gutterBottom>
                  Back Camera (Field/Worksite)
                </Typography>

                {backPhoto ? (
                  <Box sx={{ position: 'relative', width: '100%', height: 200, mb: 1.5, borderRadius: 1.5, overflow: 'hidden' }}>
                    <img
                      src={backPhoto}
                      alt="Back Photo Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <Chip
                      label="Field Verified"
                      size="small"
                      color="success"
                      sx={{ position: 'absolute', bottom: 8, left: 8, fontWeight: 700 }}
                    />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: 160,
                      borderRadius: 1.5,
                      bgcolor: '#f1f5f9',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 1.5
                    }}
                  >
                    <CameraOutlined style={{ fontSize: '2.5rem', color: '#94a3b8' }} />
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
                      Rear camera worksite / field photo required
                    </Typography>
                  </Box>
                )}

                {backError && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
                    {backError}
                  </Typography>
                )}

                <Button
                  fullWidth
                  variant={backPhoto ? 'outlined' : 'contained'}
                  color={backPhoto ? 'inherit' : 'secondary'}
                  size="small"
                  startIcon={backLoading ? <CircularProgress size={14} color="inherit" /> : <CameraOutlined />}
                  disabled={backLoading}
                  onClick={handleCaptureBack}
                  sx={{ textTransform: 'none', borderRadius: 1.5, py: 1 }}
                >
                  {backLoading ? 'Opening Rear...' : backPhoto ? 'Retake Photo' : 'Take Back Camera Photo'}
                </Button>
              </Box>
            </Paper>

            {/* 3. VERIFICATION CHECKLIST */}
            <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" fontWeight={700} color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                READY TO START DAY CRITERIA:
              </Typography>
              <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ color: gpsData ? '#2e7d32' : '#94a3b8', fontSize: '0.9rem' }}>
                    {gpsData ? <CheckCircleOutlined /> : '○'}
                  </Box>
                  <Typography variant="caption" color={gpsData ? 'textPrimary' : 'textSecondary'}>
                    Real GPS Coordinates Locked
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ color: backPhoto ? '#2e7d32' : '#94a3b8', fontSize: '0.9rem' }}>
                    {backPhoto ? <CheckCircleOutlined /> : '○'}
                  </Box>
                  <Typography variant="caption" color={backPhoto ? 'textPrimary' : 'textSecondary'}>
                    Back Camera Worksite Photo Captured
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, px: 2.5 }}>
        {confirmedData ? (
          <Button fullWidth variant="contained" color="success" size="large" onClick={onClose} sx={{ py: 1.2, fontWeight: 700, borderRadius: 2 }}>
            Continue to Field Dashboard
          </Button>
        ) : (
          <Stack direction="row" spacing={1.5} width="100%">
            <Button variant="outlined" color="inherit" onClick={onClose} disabled={submitting} sx={{ flex: 1, borderRadius: 2 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="success"
              size="large"
              disabled={!isReadyToSubmit}
              onClick={handleSubmit}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlined />}
              sx={{ flex: 2, py: 1.2, fontWeight: 800, borderRadius: 2 }}
            >
              {submitting ? 'Confirming with Server...' : 'Submit Start Day'}
            </Button>
          </Stack>
        )}
      </DialogActions>
    </Dialog>
  );
}
