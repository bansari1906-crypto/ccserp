import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { 
  Grid, Typography, Box, Stack, Chip, Button, List, ListItem, ListItemText, ListItemIcon,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton
} from '@mui/material';
import MainCard from 'components/MainCard';
import AnalyticEcommerce from 'components/cards/statistics/AnalyticEcommerce';
import { formatINR } from 'data/ccsMock';

import { 
  EnvironmentOutlined,
  ShoppingCartOutlined, 
  WalletOutlined,
  BellOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  LogoutOutlined,
  PlusCircleOutlined
} from '@ant-design/icons';

// Mock recent orders specific for Distributor view
const recentOrders = [
  { id: 'ORD-89012', date: 'Today', status: 'Pending', total: 45000, dealer: 'Shree Krishna Agro Center' },
  { id: 'ORD-89011', date: 'Today', status: 'Approved', total: 125000, dealer: 'Patel Krishi Bhandar' },
];

const pendingPaymentsList = [
  { id: 'INV-1021', dealer: 'Kisan Seva Kendra', amount: 85000, due: 'Overdue by 5 days' },
  { id: 'INV-1024', dealer: 'Shree Krishna Agro Center', amount: 45000, due: 'Due Today' },
];

import { fetchActiveAttendance } from '../../services/attendanceService';
import StartDayDialog from '../../components/attendance/StartDayDialog';
import EndDayDialog from '../../components/attendance/EndDayDialog';

export default function DistributorDashboard({ data }) {
  const navigate = useNavigate();
  const [activeAtt, setActiveAtt] = useState({ active: false, completed: false, attendance: null });
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  
  const loadAttendance = async () => {
    try {
      const res = await fetchActiveAttendance();
      setActiveAtt(res);
    } catch (err) {
      console.warn('DistributorDashboard attendance fetch error:', err);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const isCheckedIn = activeAtt.active;
  const isCompleted = activeAtt.completed;
  const currentAtt = activeAtt.attendance;

  const handleCheckInOut = () => {
    if (isCheckedIn) {
      setEndDialogOpen(true);
    } else {
      setStartDialogOpen(true);
    }
  };

  return (
    <Grid container rowSpacing={4.5} columnSpacing={2.75}>
      {/* Check In / Out Hero Banner */}
      <Grid item xs={12}>
        <MainCard sx={{ bgcolor: isCheckedIn ? 'success.lighter' : isCompleted ? '#f8fafc' : 'primary.lighter', borderColor: isCheckedIn ? 'success.main' : isCompleted ? '#94a3b8' : 'primary.main', borderStyle: 'solid', borderWidth: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="h4" color={isCheckedIn ? 'success.dark' : isCompleted ? 'textPrimary' : 'primary.dark'} fontWeight={800}>
                {isCheckedIn ? "You are currently Checked In (Field Work Active)" : isCompleted ? "Field Shift Completed Today" : "Ready to start your day in the field?"}
              </Typography>
              <Typography variant="subtitle1" color="textSecondary" mt={0.5}>
                {isCheckedIn 
                  ? `Started at ${currentAtt?.check_in || 'Morning'} • Location: ${currentAtt?.check_in_location || 'GPS Verified'}` 
                  : isCompleted 
                  ? `Completed at ${currentAtt?.check_out || 'Today'} (${currentAtt?.working_hours || 0}h recorded)` 
                  : "Please check in to start logging field visits and orders."}
              </Typography>
            </Box>
            <Button 
              variant="contained" 
              color={isCheckedIn ? "error" : isCompleted ? "inherit" : "primary"}
              size="large"
              disabled={isCompleted}
              onClick={handleCheckInOut}
              startIcon={isCheckedIn ? <LogoutOutlined /> : <CheckCircleOutlined />}
              sx={{ px: 4, py: 1.5, fontSize: '1.1rem', borderRadius: 2 }}
            >
              {isCheckedIn ? "Check Out / End Day" : isCompleted ? "Shift Ended" : "Start Day / Check In"}
            </Button>
          </Stack>
        </MainCard>
      </Grid>
      
      {/* Metrics Row */}
      <Grid item xs={12} sm={6} md={3}>
        <AnalyticEcommerce title="Today's Dealer Visits" count="4 / 8" icon={<EnvironmentOutlined />} color="primary" />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <AnalyticEcommerce title="Today's Orders Taken" count="2" icon={<ShoppingCartOutlined />} color="success" extra="₹1,70,000 value" />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <AnalyticEcommerce title="Today's Collections" count="₹45,000" icon={<WalletOutlined />} color="info" />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <AnalyticEcommerce title="Pending Target" count="₹8,50,000" icon={<ClockCircleOutlined />} color="error" />
      </Grid>

      {/* Quick Actions Row */}
      <Grid item xs={12}>
        <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 1 }}>
          <Button variant="outlined" startIcon={<EnvironmentOutlined />} onClick={() => navigate('/app/operations/dealer-visits')}>New Visit</Button>
          <Button variant="outlined" startIcon={<PlusCircleOutlined />} onClick={() => navigate('/app/orders/create')}>Take Order</Button>
          <Button variant="outlined" startIcon={<WalletOutlined />} onClick={() => navigate('/app/operations/collections')}>Record Payment</Button>
        </Stack>
      </Grid>

      {/* Lists Row */}
      <Grid item xs={12} md={7} lg={8}>
        <MainCard content={false} title="Today's Orders">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order No.</TableCell>
                  <TableCell>Dealer</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentOrders.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell fontWeight="bold">{row.id}</TableCell>
                    <TableCell>{row.dealer}</TableCell>
                    <TableCell>
                      <Chip label={row.status} size="small" color={row.status === 'Approved' ? 'success' : 'warning'} />
                    </TableCell>
                    <TableCell align="right" fontWeight="bold">{formatINR(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </MainCard>
      </Grid>

      <Grid item xs={12} md={5} lg={4}>
        <MainCard content={false} title="Priority Collections (Overdue)">
          <List sx={{ p: 0 }}>
            {pendingPaymentsList.map((payment, index) => (
              <ListItem key={payment.id} divider={index < pendingPaymentsList.length - 1}
                secondaryAction={
                  <Button size="small" variant="contained" color="success" onClick={() => navigate('/app/operations/collections')}>Collect</Button>
                }
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <WalletOutlined style={{ fontSize: '1.15rem', color: '#ff4d4f' }} />
                </ListItemIcon>
                <ListItemText 
                  primary={<Typography variant="subtitle2">{payment.dealer}</Typography>} 
                  secondary={
                    <Typography variant="caption" color="error.main">{formatINR(payment.amount)} - {payment.due}</Typography>
                  } 
                />
              </ListItem>
            ))}
          </List>
        </MainCard>
      </Grid>

      {/* Dialogs */}
      <StartDayDialog 
        open={startDialogOpen} 
        onClose={() => setStartDialogOpen(false)} 
        onSuccess={() => loadAttendance()} 
      />
      <EndDayDialog 
        open={endDialogOpen} 
        onClose={() => setEndDialogOpen(false)} 
        onSuccess={() => loadAttendance()} 
      />
    </Grid>
  );
}

DistributorDashboard.propTypes = {
  data: PropTypes.object
};
