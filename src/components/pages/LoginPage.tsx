import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Paper, InputAdornment, IconButton, Alert, CircularProgress, Link as MuiLink } from '@mui/material';
import { LockOutlined, EyeOutlined, EyeInvisibleOutlined, UserOutlined, AndroidOutlined } from '@ant-design/icons';
// @ts-ignore
import api from '../../api/client';
// @ts-ignore
import useAuth from '../../hooks/useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    try {
      // Authenticate strictly with backend Django API
      const response = await api.post('/auth/login/', {
        email_or_username: cleanId,
        password: cleanPass
      });
      const { user, access_token, refresh_token } = response.data;
      login(user, access_token, refresh_token);
      
      const role = (user?.role || '').toLowerCase();
      if (role.includes('admin')) {
        navigate('/admin/dashboard');
      } else if (role.includes('warehouse')) {
        navigate('/warehouse/dispatch');
      } else if (role.includes('employee') || role.includes('sales')) {
        navigate('/field/dashboard');
      } else if (role.includes('distributor')) {
        navigate('/dealer/dashboard');
      } else {
        navigate('/field/dashboard');
      }
    } catch (err: any) {
      if (err?.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err?.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err?.code === 'ERR_NETWORK' || (err?.message && err.message.includes('Network Error'))) {
        setError('Cannot connect to CCS Backend API. Please check your internet connection and try again.');
      } else if (err?.response?.status === 401) {
        setError('Invalid username/email or password. Please verify your credentials.');
      } else if (err?.response?.status === 403) {
        setError('Your account is currently inactive or suspended. Please contact your administrator.');
      } else {
        setError('Login failed. Please check your credentials or verify network connectivity.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* Left side - Agro Image */}
      <Box sx={{
        width: { xs: '100%', md: '50%' },
        backgroundImage: 'url(https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=1200&q=80)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        justifyContent: 'center',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, right: 0, bottom: 0, left: 0,
          backgroundColor: 'rgba(46, 125, 50, 0.7)',
          zIndex: 1
        }
      }}>
        <Box sx={{ position: 'relative', zIndex: 2, textAlign: 'center', color: 'white', px: 4 }}>
          <Typography variant="h2" gutterBottom sx={{ fontWeight: 'bold' }}>CCS Partners</Typography>
          <Typography variant="h5" sx={{ mb: 4, fontWeight: 300 }}>Empowering Agriculture, Together.</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>10k+</Typography>
              <Typography variant="body2">Happy Farmers</Typography>
            </Box>
            <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>500+</Typography>
              <Typography variant="body2">Dealers Network</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Right side - Form */}
      <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 4 }}>
        <Paper elevation={24} sx={{ p: 5, width: '100%', maxWidth: 460, borderRadius: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" color="textPrimary" gutterBottom sx={{ fontWeight: 'bold' }}>Welcome Back</Typography>
            <Typography variant="body1" color="textSecondary">Sign in to your CCS Connect account</Typography>
          </Box>



          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="User ID / Username / Email"
              variant="outlined"
              margin="normal"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><UserOutlined /></InputAdornment>
                }
              }}
              required
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              variant="outlined"
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><LockOutlined /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
              required
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, mb: 3 }}>
              <Typography variant="caption" color="textSecondary">
                User ID & Password only. No OTP or role selection required.
              </Typography>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={loading}
              sx={{ py: 1.5, mb: 2, fontWeight: 'bold', fontSize: '1.1rem' }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In to CCS Connect'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2, pt: 2, borderTop: '1px solid #e2e8f0' }}>
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                Android User? Use the official mobile client:
              </Typography>
              <MuiLink
                href="/downloads/CCS-Connect.apk"
                download="CCS-Connect.apk"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  color: '#16a34a',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline', color: '#15803d' }
                }}
              >
                <AndroidOutlined style={{ fontSize: '20px' }} /> Download Android App (APK)
              </MuiLink>
            </Box>
          </form>
        </Paper>
      </Box>
    </Box>
  );
}



