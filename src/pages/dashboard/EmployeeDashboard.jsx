import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Typography, Box, Stack, Button, Card, CardContent, Chip, Alert, CircularProgress } from '@mui/material';
import MainCard from 'components/MainCard';
import AnalyticEcommerce from 'components/cards/statistics/AnalyticEcommerce';
import { formatINR } from 'data/ccsMock';

import { 
  EnvironmentOutlined,
  ShoppingCartOutlined, 
  WalletOutlined,
  CheckCircleOutlined,
  LogoutOutlined,
  CarryOutOutlined,
  CompassOutlined,
  SyncOutlined,
  WarningOutlined
} from '@ant-design/icons';

import { fetchActiveAttendance } from '../../services/attendanceService';
import StartDayDialog from '../../components/attendance/StartDayDialog';
import EndDayDialog from '../../components/attendance/EndDayDialog';

export default function EmployeeDashboard({ data }) {
  const navigate = useNavigate();
  const [attendanceState, setAttendanceState] = useState({
    loading: true,
    active: false,
    completed: false,
    attendance: null,
    error: null
  });

  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  const loadAttendance = useCallback(async () => {
    setAttendanceState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetchActiveAttendance();
      setAttendanceState({
        loading: false,
        active: Boolean(res.active),
        completed: Boolean(res.completed),
        attendance: res.attendance || null,
        error: null
      });
    } catch (err) {
      console.warn('Dashboard attendance fetch error:', err);
      setAttendanceState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Unable to sync attendance status with server.'
      }));
    }
  }, []);

  useEffect(() => {
    loadAttendance();

    // Re-sync when app resumes or gains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadAttendance();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadAttendance]);

  const handleStartDaySuccess = (confirmedAttendance) => {
    setAttendanceState({
      loading: false,
      active: true,
      completed: false,
      attendance: confirmedAttendance,
      error: null
    });
    setStartDialogOpen(false);
  };

  const handleEndDaySuccess = (confirmedAttendance) => {
    setAttendanceState({
      loading: false,
      active: false,
      completed: true,
      attendance: confirmedAttendance,
      error: null
    });
    setEndDialogOpen(false);
  };

  const isCheckedIn = attendanceState.active;
  const isCompleted = attendanceState.completed;
  const currentAttendance = attendanceState.attendance;

  const todayStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  return (
    <Grid container rowSpacing={4.5} columnSpacing={2.75}>
      {/* Attendance Sync Error Notification if offline */}
      {attendanceState.error && (
        <Grid item xs={12}>
          <Alert 
            severity="warning" 
            icon={<WarningOutlined />}
            action={
              <Button color="inherit" size="small" onClick={loadAttendance}>
                Retry Sync
              </Button>
            }
          >
            {attendanceState.error}
          </Alert>
        </Grid>
      )}

      {/* START DAY / CHECK IN-OUT HERO BANNER */}
      <Grid item xs={12}>
        <MainCard
          sx={{
            bgcolor: isCheckedIn ? '#f0fdf4' : isCompleted ? '#f8fafc' : '#eff6ff',
            borderColor: isCheckedIn ? '#22c55e' : isCompleted ? '#94a3b8' : '#3b82f6',
            borderStyle: 'solid',
            borderWidth: 2,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2.5}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <Chip 
                  label={todayStr} 
                  size="small" 
                  sx={{ fontWeight: 700, bgcolor: 'background.paper', border: '1px solid #cbd5e1' }} 
                />
                <Chip 
                  label={isCheckedIn ? "Active Shift" : isCompleted ? "Shift Ended" : "Not Started"} 
                  size="small"
                  color={isCheckedIn ? "success" : isCompleted ? "default" : "primary"}
                  sx={{ fontWeight: 800 }}
                />
              </Stack>

              <Typography variant="h4" color={isCheckedIn ? '#15803d' : isCompleted ? '#334155' : '#1d4ed8'} fontWeight={800}>
                {isCheckedIn 
                  ? "Field Shift Active (Checked In)" 
                  : isCompleted 
                  ? "Today's Field Work Completed" 
                  : "Ready to start your working day?"}
              </Typography>

              <Typography variant="subtitle1" color="textSecondary" mt={0.5}>
                {isCheckedIn
                  ? `Started at ${currentAttendance?.check_in || 'Morning'} • Location: ${currentAttendance?.check_in_location || 'GPS Verified'}`
                  : isCompleted
                  ? `Completed at ${currentAttendance?.check_out || 'Evening'} • Total Hours: ${currentAttendance?.working_hours ? `${currentAttendance.working_hours}h` : 'Recorded'}`
                  : "Acquire real GPS and capture Front + Rear verification photos to begin."}
              </Typography>
            </Box>

            <Box>
              {isCheckedIn ? (
                <Button 
                  variant="contained" 
                  color="error"
                  size="large"
                  onClick={() => setEndDialogOpen(true)}
                  startIcon={<LogoutOutlined />}
                  sx={{ px: 4, py: 1.5, fontSize: '1.05rem', fontWeight: 800, borderRadius: 2 }}
                >
                  Check Out / End Day
                </Button>
              ) : isCompleted ? (
                <Button 
                  variant="outlined" 
                  color="inherit"
                  size="large"
                  disabled
                  startIcon={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
                  sx={{ px: 3, py: 1.5, fontSize: '1rem', fontWeight: 700, borderRadius: 2 }}
                >
                  Shift Completed
                </Button>
              ) : (
                <Button 
                  variant="contained" 
                  color="success"
                  size="large"
                  disabled={attendanceState.loading}
                  onClick={() => setStartDialogOpen(true)}
                  startIcon={attendanceState.loading ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlined />}
                  sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 800, borderRadius: 2, bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
                >
                  Start Day
                </Button>
              )}
            </Box>
          </Stack>
        </MainCard>
      </Grid>
      
      {/* Metrics Row */}
      <Grid item xs={12} sm={4}>
        <AnalyticEcommerce title="Today's Field Visits" count="3 / 6" icon={<EnvironmentOutlined />} color="primary" />
      </Grid>
      <Grid item xs={12} sm={4}>
        <AnalyticEcommerce title="Today's Orders" count="2" icon={<ShoppingCartOutlined />} color="success" />
      </Grid>
      <Grid item xs={12} sm={4}>
        <AnalyticEcommerce title="Today's Collections" count="₹45,000" icon={<WalletOutlined />} color="info" />
      </Grid>

      {/* Quick Actions */}
      <Grid item xs={12} md={6}>
        <MainCard title="Quick Field Actions">
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Button fullWidth variant="outlined" startIcon={<EnvironmentOutlined />} onClick={() => navigate('/app/operations/dealer-visits')} sx={{ py: 2 }}>
                Field Visit
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button fullWidth variant="outlined" color="success" startIcon={<ShoppingCartOutlined />} onClick={() => navigate('/app/orders/create')} sx={{ py: 2 }}>
                New Order
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button fullWidth variant="outlined" color="info" startIcon={<WalletOutlined />} onClick={() => navigate('/app/operations/collections')} sx={{ py: 2 }}>
                Collection
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button fullWidth variant="contained" color="primary" startIcon={<CarryOutOutlined />} onClick={() => navigate('/field/attendance')} sx={{ py: 2 }}>
                Attendance History
              </Button>
            </Grid>
          </Grid>
        </MainCard>
      </Grid>

      {/* Today's Route Plan */}
      <Grid item xs={12} md={6}>
        <MainCard title="Today's Field Plan">
          <Stack spacing={2}>
            <Card variant="outlined" sx={{ bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <CheckCircleOutlined style={{ color: '#16a34a' }} />
                  <Typography variant="subtitle1" fontWeight={700}>Palanpur Depot Visit (Completed)</Typography>
                </Stack>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <CompassOutlined style={{ color: '#2563eb' }} />
                  <Typography variant="subtitle1" fontWeight={700}>Deesa Agro Hub (Pending)</Typography>
                </Stack>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <CompassOutlined style={{ color: '#2563eb' }} />
                  <Typography variant="subtitle1" fontWeight={700}>Kisan Agro Center (Pending)</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </MainCard>
      </Grid>

      {/* Modals */}
      <StartDayDialog 
        open={startDialogOpen} 
        onClose={() => setStartDialogOpen(false)} 
        onSuccess={handleStartDaySuccess} 
      />
      <EndDayDialog 
        open={endDialogOpen} 
        onClose={() => setEndDialogOpen(false)} 
        onSuccess={handleEndDaySuccess} 
      />
    </Grid>
  );
}
