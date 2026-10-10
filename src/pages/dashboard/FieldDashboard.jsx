import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import useAuth from 'hooks/useAuth';
import api from 'api/client';
import { fetchActiveAttendance } from '../../services/attendanceService';
import { DistributorDashboard as StitchDistributorDashboard } from '../../views/distributor/DistributorDashboard';

export default function FieldDashboardPage({ data: dashboardData }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [activeAttendance, setActiveAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentUser = {
    id: user?.id || 'dist-id',
    name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'Distributor',
    email: user?.email || 'distributor@chitracropscience.com',
    role: 'DISTRIBUTOR',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    phone: user?.phone || '—',
    territory: user?.territory || 'North Gujarat Depot',
    code: user?.ccs_id || `DIST-${(user?.id || '01').slice(0, 6)}`,
    businessName: user?.company_name || 'Gujarat Agro Agency',
    city: user?.city || 'Depot',
  };

  const fetchDistributorData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, dealersRes, attRes] = await Promise.all([
        api.get('/orders/orders/').catch(() => ({ data: [] })),
        api.get('/admin/users/?role=Dealer').catch(() => ({ data: [] })),
        fetchActiveAttendance().catch(() => null),
      ]);

      if (attRes) {
        setActiveAttendance(attRes);
      }

      if (Array.isArray(ordersRes.data)) {
        const mappedOrders = ordersRes.data.map((o) => ({
          id: String(o.id),
          orderNumber: o.order_number || `ORD-${o.id}`,
          date: new Date(o.created_at || Date.now()).toISOString().split('T')[0],
          dealerName: o.dealer_name || 'Agri Store',
          dealerCode: `DLR-${o.dealer || '01'}`,
          dealerCity: 'Palanpur',
          distributorId: currentUser.id,
          distributorName: currentUser.businessName,
          status: o.status || 'Pending Approval',
          paymentStatus: o.payment_status || 'Pending',
          subtotal: parseFloat(o.subtotal || o.total_amount || 0),
          discount: parseFloat(o.discount || 0),
          tax: parseFloat(o.gst_total || 0),
          grandTotal: parseFloat(o.grand_total || o.total_amount || 0),
          items: (o.items || []).map((i) => ({
            id: String(i.id || Math.random()),
            productId: String(i.product),
            productName: i.product_name || 'Crop Product',
            productCode: 'PRD-01',
            packSize: '1 Ltr',
            quantity: i.quantity || 1,
            dealerPrice: parseFloat(i.rate || 0),
            mrp: parseFloat(i.rate || 0) * 1.2,
            subtotal: parseFloat(i.total || 0),
          })),
        }));
        setOrders(mappedOrders);
      } else {
        setOrders([]);
      }

      if (Array.isArray(dealersRes.data)) {
        const mappedDealers = dealersRes.data.map((d) => ({
          id: String(d.id),
          name: d.company_name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.username,
          code: d.ccs_id || `DLR-${d.id.slice(0, 6)}`,
          ownerName: `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.username,
          city: d.city || 'Depot',
          state: d.state || 'Gujarat',
          phone: d.phone || '—',
          email: d.email || '—',
          gstin: d.gstin || '—',
          creditLimit: parseFloat(d.credit_limit || 0),
          outstandingBalance: parseFloat(d.outstanding_amount || 0),
          status: d.is_active ? 'Active' : 'Inactive',
          distributorName: currentUser.businessName,
          territory: d.territory || 'General',
        }));
        setDealers(mappedDealers);
      } else {
        setDealers([]);
      }
    } catch (err) {
      console.error('Error fetching distributor real data:', err);
      setError(err?.response?.data?.error || 'Failed to connect to backend database.');
      setOrders([]);
      setDealers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributorData();
  }, [currentUser.id, currentUser.businessName]);

  const handleSelectOrder = () => {
    navigate('/field/orders');
  };

  const handleCreateOrder = () => {
    navigate('/field/orders/create');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, maxWidth: 650, mx: 'auto', mt: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" startIcon={<ReloadOutlined />} onClick={fetchDistributorData}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <StitchDistributorDashboard
      currentUser={currentUser}
      orders={orders}
      dealers={dealers}
      onSelectOrder={handleSelectOrder}
      onCreateOrder={handleCreateOrder}
      onCheckIn={() => navigate('/field/attendance')}
      activeAttendance={activeAttendance}
    />
  );
}
