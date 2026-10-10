import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Stack,
  Chip,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent
} from '@mui/material';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  PushpinOutlined,
  SearchOutlined,
  EyeOutlined,
  EnvironmentOutlined,
  CameraOutlined,
  WarningOutlined,
  SyncOutlined,
  CloseOutlined
} from '@ant-design/icons';
import EnterpriseTable from 'components/ui/EnterpriseTable';
import MainCard from 'components/MainCard';

import { fetchActiveAttendance, fetchAttendanceHistory } from '../../services/attendanceService';
import StartDayDialog from '../../components/attendance/StartDayDialog';
import EndDayDialog from '../../components/attendance/EndDayDialog';

export default function FieldAttendance() {
  const [activeData, setActiveData] = useState({
    loading: true,
    active: false,
    completed: false,
    attendance: null,
    error: null
  });

  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  // Photo viewer dialog
  const [viewPhoto, setViewPhoto] = useState(null);

  const loadData = useCallback(async () => {
    setActiveData((prev) => ({ ...prev, loading: true, error: null }));
    setHistoryLoading(true);

    // 1. Fetch today's active attendance
    try {
      const activeRes = await fetchActiveAttendance();
      setActiveData({
        loading: false,
        active: Boolean(activeRes.active),
        completed: Boolean(activeRes.completed),
        attendance: activeRes.attendance || null,
        error: null
      });
    } catch (err) {
      console.warn('FieldAttendance active fetch error:', err);
      setActiveData((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Unable to sync today attendance status from server.'
      }));
    }

    // 2. Fetch attendance history
    try {
      const records = await fetchAttendanceHistory();
      setHistoryRecords(records);
      setHistoryError(null);
    } catch (err) {
      console.warn('FieldAttendance history fetch error:', err);
      setHistoryError('Could not load attendance history from database.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Auto refresh on focus
    const handleVisChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    window.addEventListener('visibilitychange', handleVisChange);
    return () => window.removeEventListener('visibilitychange', handleVisChange);
  }, [loadData]);

  const isCheckedIn = activeData.active;
  const isCompleted = activeData.completed;
  const currentAtt = activeData.attendance;

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  // Filter history
  const filteredHistory = historyRecords.filter((item) => {
    const itemDate = item.date || '';
    const itemStatus = item.status || 'Present';
    const matchesSearch = itemDate.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || itemStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate monthly stats from real records
  const totalDays = historyRecords.length;
  const presentDays = historyRecords.filter((r) => r.status !== 'Absent').length;
  const totalHours = historyRecords.reduce((sum, r) => sum + (parseFloat(r.working_hours) || 0), 0);

  const columns = [
    {
      field: 'date',
      headerName: 'Date',
      flex: 1.2,
      minWidth: 120,
      renderCell: (params) => (
        <Typography fontWeight={700} color="#101828">
          {params.value}
        </Typography>
      )
    },
    {
      field: 'check_in',
      headerName: 'Check In',
      flex: 1,
      minWidth: 110,
      renderCell: (params) => (
        <Typography variant="body2" color="textSecondary">
          {params.value || '—'}
        </Typography>
      )
    },
    {
      field: 'check_out',
      headerName: 'Check Out',
      flex: 1,
      minWidth: 110,
      renderCell: (params) => (
        <Typography variant="body2" color="textSecondary">
          {params.value || 'In Progress'}
        </Typography>
      )
    },
    {
      field: 'working_hours',
      headerName: 'Working Hours',
      flex: 1.2,
      minWidth: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? `${params.value}h` : 'Active'}
          size="small"
          sx={{ bgcolor: '#f1f5f9', fontWeight: 700, borderRadius: 1.5 }}
        />
      )
    },
    {
      field: 'check_in_location',
      headerName: 'GPS Location',
      flex: 1.5,
      minWidth: 150,
      renderCell: (params) => (
        <Typography variant="caption" color="textSecondary" noWrap title={params.value}>
          {params.value || 'GPS Verified'}
        </Typography>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      minWidth: 110,
      renderCell: (params) => (
        <Chip
          label={params.value || 'Present'}
          color={params.value === 'Working' ? 'info' : params.value === 'Present' ? 'success' : 'error'}
          size="small"
          sx={{ fontWeight: 700, height: 24, fontSize: '0.72rem' }}
        />
      )
    },
    {
      field: 'action',
      headerName: 'Photos',
      flex: 0.8,
      minWidth: 90,
      renderCell: (params) => {
        const row = params.row;
        const hasPhotos = row.check_in_photo || row.back_camera_photo;
        if (!hasPhotos) return <Typography variant="caption" color="textSecondary">—</Typography>;
        return (
          <IconButton
            size="small"
            color="success"
            onClick={() => setViewPhoto({ front: row.check_in_photo, back: row.back_camera_photo })}
          >
            <EyeOutlined />
          </IconButton>
        );
      }
    }
  ];

  return (
    <Grid container rowSpacing={3} columnSpacing={2.75}>
      {/* Header */}
      <Grid item xs={12}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="#101828" sx={{ letterSpacing: '-0.5px' }}>
            My Attendance
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.2 }}>
            Real-time GPS verified check-ins, working hours, and field attendance history.
          </Typography>
        </Box>
      </Grid>

      {/* Sync / Offline Alert */}
      {activeData.error && (
        <Grid item xs={12}>
          <Alert
            severity="warning"
            icon={<WarningOutlined />}
            action={
              <Button color="inherit" size="small" onClick={loadData}>
                Retry
              </Button>
            }
          >
            {activeData.error}
          </Alert>
        </Grid>
      )}

      {/* Today's Status & Monthly Summary */}
      <Grid item xs={12} md={5}>
        <MainCard title="Today's Attendance Status">
          <Stack spacing={2.5} alignItems="center" py={1.5}>
            <Box
              sx={{
                width: 76,
                height: 76,
                borderRadius: '50%',
                bgcolor: isCheckedIn ? '#e8f5e9' : isCompleted ? '#f8fafc' : '#eff6ff',
                color: isCheckedIn ? '#2e7d32' : isCompleted ? '#64748b' : '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid',
                borderColor: isCheckedIn ? '#a5d6a7' : isCompleted ? '#cbd5e1' : '#93c5fd'
              }}
            >
              {isCheckedIn ? (
                <CheckCircleOutlined style={{ fontSize: '2.5rem' }} />
              ) : (
                <ClockCircleOutlined style={{ fontSize: '2.5rem' }} />
              )}
            </Box>

            <Box textAlign="center">
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" mb={0.5}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: isCheckedIn ? '#2e7d32' : isCompleted ? '#64748b' : '#3b82f6'
                  }}
                />
                <Typography variant="h5" fontWeight={800} color="#101828">
                  {isCheckedIn ? 'Checked In (Active)' : isCompleted ? 'Shift Completed' : 'Not Checked In'}
                </Typography>
              </Stack>
              <Typography color="textSecondary" variant="body2">
                {isCheckedIn
                  ? `Check-in Time: ${currentAtt?.check_in || 'Today'} • GPS Locked`
                  : isCompleted
                  ? `Completed at ${currentAtt?.check_out || 'Today'} (${currentAtt?.working_hours || 0}h)`
                  : "Tap 'Start Day' to verify GPS and capture photos to start."}
              </Typography>
            </Box>

            {/* Confirmed Location Badge */}
            {isCheckedIn && currentAtt?.check_in_location && (
              <Box sx={{ bgcolor: '#f4fbf5', p: 1.2, borderRadius: 1.5, border: '1px solid #c8e6c9', width: '100%' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <EnvironmentOutlined style={{ color: '#2e7d32' }} />
                  <Typography variant="caption" fontWeight={700} color="#1b5e20" noWrap>
                    {currentAtt.check_in_location}
                  </Typography>
                </Stack>
              </Box>
            )}

            {/* Action Buttons */}
            {isCheckedIn ? (
              <Button
                variant="contained"
                color="error"
                size="large"
                startIcon={<PushpinOutlined />}
                onClick={() => setEndDialogOpen(true)}
                sx={{ px: 4, py: 1.2, fontWeight: 800, borderRadius: 2 }}
              >
                Check Out (End Shift)
              </Button>
            ) : isCompleted ? (
              <Button variant="outlined" color="inherit" size="large" disabled sx={{ px: 4, py: 1.2, fontWeight: 700, borderRadius: 2 }}>
                Shift Completed Today
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<PushpinOutlined />}
                disabled={activeData.loading}
                onClick={() => setStartDialogOpen(true)}
                sx={{ px: 4, py: 1.2, fontWeight: 800, borderRadius: 2, bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
              >
                Start Day (Check In)
              </Button>
            )}
          </Stack>
        </MainCard>
      </Grid>

      {/* Monthly Summary Cards */}
      <Grid item xs={12} md={7}>
        <MainCard title="Attendance Summary (Current Month)">
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 2 }}>
                <Typography variant="caption" fontWeight={700} color="#2e7d32" sx={{ letterSpacing: '0.5px' }}>
                  PRESENT DAYS
                </Typography>
                <Typography variant="h3" fontWeight={800} color="#1b5e20" sx={{ mt: 0.5 }}>
                  {presentDays}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
                <Typography variant="caption" fontWeight={700} color="#1d4ed8" sx={{ letterSpacing: '0.5px' }}>
                  RECORDED
                </Typography>
                <Typography variant="h3" fontWeight={800} color="#1e40af" sx={{ mt: 0.5 }}>
                  {totalDays}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8eaf6', border: '1px solid #c5cae9', borderRadius: 2 }}>
                <Typography variant="caption" fontWeight={700} color="#283593" sx={{ letterSpacing: '0.5px' }}>
                  TOTAL HOURS
                </Typography>
                <Typography variant="h3" fontWeight={800} color="#1a237e" sx={{ mt: 0.5 }}>
                  {totalHours.toFixed(1)}h
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff8e1', border: '1px solid #ffe0b2', borderRadius: 2 }}>
                <Typography variant="caption" fontWeight={700} color="#f57f17" sx={{ letterSpacing: '0.5px' }}>
                  STATUS
                </Typography>
                <Typography variant="h4" fontWeight={800} color="#e65100" sx={{ mt: 0.5 }}>
                  {isCheckedIn ? 'Active' : 'Offline'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </MainCard>
      </Grid>

      {/* Attendance History Section */}
      <Grid item xs={12}>
        <MainCard
          title="Attendance History"
          secondary={
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                size="small"
                placeholder="Search date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined />
                    </InputAdornment>
                  )
                }}
                sx={{ width: 180 }}
              />
              <Button size="small" variant="outlined" startIcon={<SyncOutlined />} onClick={loadData}>
                Refresh
              </Button>
            </Stack>
          }
        >
          {historyLoading ? (
            <Box textAlign="center" py={4}>
              <CircularProgress size={30} />
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Loading attendance history from backend...
              </Typography>
            </Box>
          ) : (
            <EnterpriseTable
              columns={columns}
              rows={filteredHistory.map((item, idx) => ({ id: item.id || idx, ...item }))}
              initialState={{ pagination: { paginationModel: { pageSize: 7 } } }}
              pageSizeOptions={[7, 15, 30]}
            />
          )}
        </MainCard>
      </Grid>

      {/* Start Day Dialog */}
      <StartDayDialog
        open={startDialogOpen}
        onClose={() => setStartDialogOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* End Day Dialog */}
      <EndDayDialog
        open={endDialogOpen}
        onClose={() => setEndDialogOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* Photo Viewer Modal */}
      <Dialog open={Boolean(viewPhoto)} onClose={() => setViewPhoto(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={700}>Attendance Verification Photos</Typography>
          <IconButton size="small" onClick={() => setViewPhoto(null)}>
            <CloseOutlined />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {viewPhoto?.front && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Front Camera Selfie</Typography>
                <img src={viewPhoto.front} alt="Front Selfie" style={{ width: '100%', borderRadius: 8, maxHeight: 250, objectFit: 'cover' }} />
              </Grid>
            )}
            {viewPhoto?.back && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Back Camera Worksite</Typography>
                <img src={viewPhoto.back} alt="Back Camera Photo" style={{ width: '100%', borderRadius: 8, maxHeight: 250, objectFit: 'cover' }} />
              </Grid>
            )}
          </Grid>
        </DialogContent>
      </Dialog>
    </Grid>
  );
}
