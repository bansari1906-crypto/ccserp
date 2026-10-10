import { Navigate } from 'react-router-dom';
import Home from './home';

export default function AppIndex() {
  const isNativeApp = typeof window !== 'undefined' && (
    window.location.protocol === 'capacitor:' || 
    Boolean(window.Capacitor?.isNativePlatform?.()) ||
    (window.location.hostname === 'localhost' && !import.meta.env.DEV)
  );

  if (isNativeApp) {
    try {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('access_token');
      if (storedUser && token) {
        const user = JSON.parse(storedUser);
        const role = (user?.role || '').toLowerCase();
        if (role.includes('admin')) {
          return <Navigate to="/admin/dashboard" replace />;
        } else if (role.includes('warehouse')) {
          return <Navigate to="/warehouse/dispatch" replace />;
        } else if (role.includes('distributor') || role.includes('employee') || role.includes('sales')) {
          return <Navigate to="/field/dashboard" replace />;
        } else {
          return <Navigate to="/dealer/dashboard" replace />;
        }
      }
    } catch (e) {
      console.error(e);
    }
    // In native mobile app, unauthenticated opens the Login screen directly
    return <Navigate to="/login" replace />;
  }

  // Marketing website
  return <Home />;
}
