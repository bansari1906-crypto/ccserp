import { Box, Button, Container, Grid, Typography, Stack, Card, CardContent, CardMedia, Avatar, Paper, Divider } from '@mui/material';
import { ArrowRightOutlined, CheckCircleFilled, SafetyCertificateOutlined, ExperimentOutlined, TrophyOutlined, TeamOutlined, AndroidOutlined, LoginOutlined, DownloadOutlined, SafetyOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
// @ts-ignore
import api from 'api/client';
import { products as mockProducts } from 'data/ccsMock';

const stats = [
  { label: 'Year Established', value: '2023', icon: <TrophyOutlined /> },
  { label: 'States Covered', value: 'Across India', icon: <TeamOutlined /> },
  { label: 'Quality Assured', value: '100%', icon: <SafetyCertificateOutlined /> },
  { label: 'Research Labs', value: 'State of Art', icon: <ExperimentOutlined /> }
];

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/products/products/');
        const data = res.data?.results || res.data;
        if (Array.isArray(data) && data.length > 0) {
          // just grab top 4 for featured
          setFeaturedProducts(data.slice(0, 4));
        } else {
          setFeaturedProducts(mockProducts.slice(0, 4));
        }
      } catch (err) {
        console.error('Failed to fetch featured products', err);
        setFeaturedProducts(mockProducts.slice(0, 4));
      }
    };
    fetchProducts();
  }, []);

  return (
    <Box>
      <Helmet>
        <title>Chitra Crop Science | CCS Connect ERP — Official Partner Portal</title>
        <meta name="description" content="Official enterprise portal for Chitra Crop Science partners. Login to CCS Connect ERP and download the official Android APK for order management, verified pricing, dual-camera attendance, and warehouse logistics." />
        <meta property="og:title" content="Chitra Crop Science — CCS Connect ERP" />
        <meta property="og:description" content="Official enterprise platform for Chitra Crop Science distributors, field officers, and logistics." />
      </Helmet>

      {/* Hero Section */}
      <Box sx={{
        position: 'relative',
        minHeight: '92vh',
        display: 'flex',
        alignItems: 'center',
        backgroundImage: 'url(https://images.unsplash.com/photo-1592982537447-6f23f81eb5d5?auto=format&fit=crop&w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(90deg, rgba(17,24,39,0.96) 0%, rgba(17,24,39,0.5) 100%)',
          zIndex: 1
        }
      }}>
        <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 2, py: { xs: 8, md: 0 } }}>
          <Grid container>
            <Grid item xs={12} md={8} lg={7}>
              <Box sx={{ mb: 2.5, display: 'inline-flex', alignItems: 'center', bgcolor: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', px: 2, py: 0.7, borderRadius: 5 }}>
                <Typography variant="body2" color="#4ade80" fontWeight="bold">🌱 Chitra Crop Science • CCS Connect ERP</Typography>
              </Box>
              <Typography variant="h1" fontWeight="900" color="white" sx={{ fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' }, lineHeight: 1.1, mb: 2.5 }}>
                Enterprise Platform for <br/><Box component="span" sx={{ color: '#4ade80' }}>Agriculture Partners.</Box>
              </Typography>
              <Typography variant="h6" color="#d1d5db" sx={{ mb: 4.5, lineHeight: 1.6, fontWeight: 400, maxWidth: 640 }}>
                Welcome to the official Chitra Crop Science business portal. Access verified product availability, wholesale pricing, dual-camera attendance, order management, and real-time dispatch tracking.
              </Typography>

              {/* TWO PROMINENT PRIMARY ACTIONS: LOGIN & DOWNLOAD ANDROID APP */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} sx={{ mb: 4 }}>
                <Button 
                  component={Link} 
                  to="/login" 
                  variant="contained" 
                  color="primary" 
                  size="large" 
                  sx={{ 
                    px: 4.5, 
                    py: 1.8, 
                    fontSize: '1.15rem', 
                    borderRadius: 2.5, 
                    fontWeight: 800,
                    boxShadow: '0 10px 25px -5px rgba(46, 125, 50, 0.5)',
                    '&:hover': { bgcolor: '#1b5e20' }
                  }} 
                  startIcon={<LoginOutlined style={{ fontSize: '22px' }} />}
                >
                  Login to CCS Connect
                </Button>

                <Button 
                  component="a" 
                  href="/downloads/CCS-Connect.apk" 
                  download="CCS-Connect.apk"
                  variant="contained" 
                  size="large" 
                  sx={{ 
                    px: 4, 
                    py: 1.8, 
                    fontSize: '1.15rem', 
                    borderRadius: 2.5, 
                    fontWeight: 800,
                    bgcolor: '#16a34a',
                    color: 'white',
                    boxShadow: '0 10px 25px -5px rgba(22, 163, 74, 0.5)',
                    '&:hover': { bgcolor: '#15803d' }
                  }} 
                  startIcon={<AndroidOutlined style={{ fontSize: '24px' }} />}
                >
                  Download Android App
                </Button>
              </Stack>

              <Typography variant="caption" sx={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleFilled style={{ color: '#4ade80' }} /> Secure role-based portal for Admin, Employees, Distributors & Warehouse
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Stats Section */}
      <Box sx={{ bgcolor: 'primary.main', py: 6, mt: -2 }}>
        <Container maxWidth="xl">
          <Grid container spacing={4} justifyContent="center">
            {stats.map((stat, i) => (
              <Grid item xs={6} md={3} key={i} textAlign="center">
                <Box sx={{ color: 'white', fontSize: 40, mb: 1, opacity: 0.8 }}>{stat.icon}</Box>
                <Typography variant="h3" fontWeight="900" color="white">{stat.value}</Typography>
                <Typography variant="subtitle1" color="rgba(255,255,255,0.8)" fontWeight="bold" textTransform="uppercase">{stat.label}</Typography>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CCS Connect Platform & Mobile App Section */}
      <Box sx={{ py: 10, bgcolor: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
        <Container maxWidth="xl">
          <Box textAlign="center" mb={6}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', bgcolor: '#dcfce7', border: '1px solid #86efac', px: 2, py: 0.5, borderRadius: 5, mb: 1.5 }}>
              <Typography variant="body2" color="#15803d" fontWeight="bold">⚡ Enterprise Business Portal</Typography>
            </Box>
            <Typography variant="h2" fontWeight="800" sx={{ color: '#14532d', fontSize: { xs: '2rem', md: '2.75rem' }, mb: 1.5 }}>
              CCS Connect ERP System
            </Typography>
            <Typography variant="body1" color="#475569" sx={{ maxWidth: 720, mx: 'auto', fontSize: '1.1rem' }}>
              One central database powering our business operations. Available via secure web login and the dedicated Android mobile application.
            </Typography>
          </Box>

          {/* 4 Role Capabilities Grid */}
          <Grid container spacing={3} mb={6}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 3, height: '100%', bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 3 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', fontSize: 22, mb: 2 }}>
                  <AppstoreOutlined />
                </Box>
                <Typography variant="h6" fontWeight="bold" color="#0f172a" gutterBottom>1. Admin Control</Typography>
                <Typography variant="body2" color="#64748b" lineHeight={1.6}>
                  Master product catalog pricing, instant Availability toggle, availability-based order approvals, and credit management.
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 3, height: '100%', bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 3 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d', fontSize: 22, mb: 2 }}>
                  <SafetyOutlined />
                </Box>
                <Typography variant="h6" fontWeight="bold" color="#0f172a" gutterBottom>2. Field Sales</Typography>
                <Typography variant="body2" color="#64748b" lineHeight={1.6}>
                  GPS-tagged dual-photo attendance (front selfie & rear worksite), daily visit logs, distributor order intake, and expense records.
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 3, height: '100%', bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 3 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309', fontSize: 22, mb: 2 }}>
                  <TrophyOutlined />
                </Box>
                <Typography variant="h6" fontWeight="bold" color="#0f172a" gutterBottom>3. Distributors</Typography>
                <Typography variant="body2" color="#64748b" lineHeight={1.6}>
                  Wholesale price catalog, instant order booking, payment ledgers, invoice downloads, and live dispatch tracking.
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 3, height: '100%', bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 3 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7e22ce', fontSize: 22, mb: 2 }}>
                  <CheckCircleFilled />
                </Box>
                <Typography variant="h6" fontWeight="bold" color="#0f172a" gutterBottom>4. Warehouse</Typography>
                <Typography variant="body2" color="#64748b" lineHeight={1.6}>
                  Stock packing lists, LR / Bilty generation, logistics vehicle tracking, and final authorized dispatch operations.
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Download & Web Login Banner */}
          <Paper elevation={0} sx={{ p: { xs: 4, md: 6 }, bgcolor: '#14532d', color: 'white', borderRadius: 4, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={7}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.15)', px: 1.5, py: 0.5, borderRadius: 2, mb: 2 }}>
                  <AndroidOutlined style={{ marginRight: 6, fontSize: 16 }} />
                  <Typography variant="caption" fontWeight="bold">OFFICIAL ANDROID APP & WEB PORTAL</Typography>
                </Box>
                <Typography variant="h3" fontWeight="900" color="white" gutterBottom sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' } }}>
                  Connect from Any Device
                </Typography>
                <Typography variant="body1" sx={{ color: '#d1fae5', mb: 3, lineHeight: 1.7, fontSize: '1.05rem' }}>
                  Use your registered User ID and Password to sign in. The web portal and the Android APK connect to the same central database, ensuring your orders, attendance, and catalog are always synchronized.
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    component={Link}
                    to="/login"
                    variant="contained"
                    sx={{
                      bgcolor: 'white',
                      color: '#14532d',
                      px: 3.5,
                      py: 1.4,
                      fontWeight: 800,
                      borderRadius: 2,
                      '&:hover': { bgcolor: '#f0fdf4' }
                    }}
                    startIcon={<LoginOutlined />}
                  >
                    Login to Web Portal
                  </Button>

                  <Button
                    component="a"
                    href="/downloads/CCS-Connect.apk"
                    download="CCS-Connect.apk"
                    variant="outlined"
                    sx={{
                      color: 'white',
                      borderColor: 'white',
                      borderWidth: 2,
                      px: 3.5,
                      py: 1.4,
                      fontWeight: 800,
                      borderRadius: 2,
                      '&:hover': { borderWidth: 2, borderColor: '#4ade80', bgcolor: 'rgba(74,222,128,0.1)' }
                    }}
                    startIcon={<AndroidOutlined />}
                  >
                    Download APK (Android)
                  </Button>
                </Stack>
              </Grid>

              {/* Android Installation Note Box */}
              <Grid item xs={12} md={5}>
                <Paper elevation={0} sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.25)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Typography variant="subtitle1" fontWeight="bold" color="#4ade80" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AndroidOutlined /> Android Installation Guide
                  </Typography>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', my: 1.5 }} />
                  <Stack spacing={1.2}>
                    <Typography variant="caption" sx={{ color: '#f3f4f6', display: 'block' }}>
                      <strong>1. Download:</strong> Tap &ldquo;Download APK&rdquo; to save <code>CCS-Connect.apk</code>.
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#f3f4f6', display: 'block' }}>
                      <strong>2. Open File:</strong> Locate the APK in your notification bar or Downloads folder.
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#f3f4f6', display: 'block' }}>
                      <strong>3. Allow Source:</strong> If prompted by Android security, enable &ldquo;Allow from this source&rdquo;.
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#f3f4f6', display: 'block' }}>
                      <strong>4. Install & Login:</strong> Complete installation and sign in with your User ID & Password.
                    </Typography>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Paper>
        </Container>
      </Box>

      {/* About / Why Choose Us */}
      <Box sx={{ py: 12, bgcolor: 'background.paper' }}>
        <Container maxWidth="xl">
          <Grid container spacing={8} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box sx={{ position: 'relative' }}>
                <img src="https://images.unsplash.com/photo-1599839619722-39751411ea63?auto=format&fit=crop&w=800&q=80" alt="Farmers" style={{ width: '100%', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} />
                <Box sx={{ position: 'absolute', bottom: -30, right: -30, bgcolor: 'white', p: 3, borderRadius: 4, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                  <Typography variant="h4" fontWeight="bold" color="primary">ISO 9001</Typography>
                  <Typography variant="body2" color="textSecondary">Certified Manufacturing</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="overline" color="primary" fontWeight="bold" fontSize="1rem">Why Choose Us</Typography>
              <Typography variant="h2" fontWeight="bold" gutterBottom sx={{ mt: 1, mb: 3 }}>Innovating for a Greener Tomorrow.</Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 4, fontSize: '1.1rem', lineHeight: 1.7 }}>
                Established by Jethu Dan in 2023, Chitra Crop Science operates with a singular focus: delivering uncompromising quality. From our advanced R&D labs to our ISO-certified manufacturing facilities in Gujarat, we ensure every product passes rigorous quality checks.
              </Typography>
              <Grid container spacing={3}>
                {['Direct Support from Agronomists', 'Transparent Dealer Margins', 'State-of-the-art Formulation Labs', 'Government Approved Formulations'].map((item, i) => (
                  <Grid item xs={12} sm={6} key={i}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <CheckCircleFilled style={{ color: '#2e7d32', fontSize: '20px' }} />
                      <Typography variant="subtitle1" fontWeight="600">{item}</Typography>
                    </Stack>
                  </Grid>
                ))}
              </Grid>
              <Button component={Link} to="/about" variant="text" color="primary" sx={{ mt: 4, fontWeight: 'bold', fontSize: '1rem' }} endIcon={<ArrowRightOutlined />}>Learn More About Us</Button>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Featured Products */}
      <Box sx={{ py: 12, bgcolor: '#f8fafc' }}>
        <Container maxWidth="xl">
          <Box textAlign="center" mb={8}>
            <Typography variant="overline" color="primary" fontWeight="bold" fontSize="1rem">Product Catalogue</Typography>
            <Typography variant="h3" fontWeight="bold" sx={{ mt: 1 }}>Featured Solutions</Typography>
          </Box>
          <Grid container spacing={4}>
            {featuredProducts.length > 0 ? featuredProducts.map((product) => (
              <Grid item xs={12} sm={6} md={3} key={product.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, transition: 'transform 0.3s', '&:hover': { transform: 'translateY(-10px)' }, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                  <CardMedia component="img" height="200" image={product.image_url || product.images?.[0] || 'https://via.placeholder.com/500x300?text=CCS+Product'} alt={product.name} />
                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>{product.name}</Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>{product.technical_name || product.technicalName || product.composition}</Typography>
                    <Typography variant="subtitle2" color="primary.main">{product.category_name || product.category}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )) : (
              <Grid item xs={12}>
                <Typography textAlign="center" color="textSecondary">Loading featured products...</Typography>
              </Grid>
            )}
          </Grid>
          <Box textAlign="center" mt={6}>
            <Button component={Link} to="/products" variant="outlined" color="primary" size="large" sx={{ px: 4, borderRadius: 8 }}>View All Products</Button>
          </Box>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ bgcolor: '#111827', py: 10, textAlign: 'center', color: 'white' }}>
        <Container maxWidth="md">
          <Typography variant="h3" fontWeight="bold" gutterBottom>Ready to elevate your agro business?</Typography>
          <Typography variant="h6" color="#9ca3af" sx={{ mb: 5, fontWeight: 400 }}>
            Join our growing network of dealers who trust Chitra Crop Science for reliable supply, incredible margins, and dedicated support.
          </Typography>
          <Button component={Link} to="/become-dealer" variant="contained" color="primary" size="large" sx={{ px: 6, py: 2, fontSize: '1.2rem', borderRadius: 8 }}>
            Partner With Us Today
          </Button>
        </Container>
      </Box>
    </Box>
  );
}
