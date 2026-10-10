import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

// project imports
import Drawer from './Drawer';
import Header from './Header';
import Footer from './Footer';
import Loader from 'components/Loader';
import Breadcrumbs from 'components/@extended/Breadcrumbs';
import ScrollTop from 'components/ScrollTop';
import useAuth from 'hooks/useAuth';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';

// ==============================|| MAIN LAYOUT ||============================== //

export default function DashboardLayout() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const { menuMasterLoading } = useGetMenuMaster();
  const downXL = useMediaQuery((theme) => theme.breakpoints.down('xl'));

  // set media wise responsive drawer
  useEffect(() => {
    handlerDrawerOpen(!downXL);
  }, [downXL]);

  if (loading || menuMasterLoading) return <Loader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <Box sx={{ display: 'flex', width: '100%' }}>
      <ScrollTop />
      <Header />
      <Drawer />
      <Box component="main" sx={{ width: { xs: '100%', lg: 'calc(100% - 260px)' }, flexGrow: 1, minWidth: 0, p: { xs: 1.5, sm: 2, md: 3 } }}>
        <Toolbar sx={{ mt: 'inherit' }} />
        <Box
          sx={{
            ...{ px: { xs: 0, sm: 2 } },
            position: 'relative',
            minHeight: 'calc(100vh - 110px)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Breadcrumbs />
          <Outlet />
          <Footer />
        </Box>
      </Box>
    </Box>
  );
}
