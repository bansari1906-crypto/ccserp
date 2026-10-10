import { useState, useEffect } from 'react';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button, Container, Stack, Grid, IconButton, Divider, Link as MuiLink } from '@mui/material';
import { FacebookOutlined, TwitterOutlined, InstagramOutlined, LinkedinOutlined, EnvironmentOutlined, PhoneOutlined, MailOutlined, AndroidOutlined } from '@ant-design/icons';
import { APK_DOWNLOAD_URL } from '../../api/client';

export default function WebsiteLayout() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Login dropdown state
  const [anchorEl, setAnchorEl] = useState(null);
  const openLogin = Boolean(anchorEl);
  const handleLoginClick = (event) => setAnchorEl(event.currentTarget);
  const handleLoginClose = () => setAnchorEl(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'About Us', path: '/about' },
    { label: 'Products', path: '/products' },
    { label: 'Become Dealer', path: '/become-dealer' },
    { label: 'Join Us', path: '/join-us' },
    { label: 'Contact Us', path: '/contact' }
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#fdfdfd' }}>
      <AppBar 
        position="fixed" 
        elevation={scrolled ? 4 : 0} 
        sx={{ 
          bgcolor: scrolled ? 'rgba(255, 255, 255, 0.95)' : 'white', 
          backdropFilter: scrolled ? 'blur(10px)' : 'none',
          transition: 'all 0.3s ease-in-out',
          borderBottom: scrolled ? 'none' : '1px solid #eaeaea',
          py: scrolled ? 0.5 : 1
        }}
      >
        <Container maxWidth="xl">
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 0, sm: 2 } }}>
            <Stack direction="row" alignItems="center" spacing={1.5} component={RouterLink} to="/" sx={{ textDecoration: 'none', color: 'primary.main' }}>
              <img src="/logo.png" alt="CCS" style={{ height: 42 }} onError={(e) => e.target.style.display='none'} />
              <Box>
                <Typography variant="h5" fontWeight="900" sx={{ letterSpacing: '-0.5px', color: '#16a34a', lineHeight: 1.1 }}>
                  Chitra Crop Science
                </Typography>
                <Typography variant="caption" fontWeight="700" sx={{ color: '#4b5563', letterSpacing: '0.5px', display: 'block', fontSize: '0.75rem' }}>
                  CCS CONNECT ERP
                </Typography>
              </Box>
            </Stack>
            
            {/* Desktop Navigation & Actions */}
            <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
              {navItems.map((item) => (
                <Button 
                  key={item.label}
                  component={RouterLink} 
                  to={item.path}
                  sx={{ 
                    color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '0.95rem',
                    '&:hover': { color: 'primary.main', bgcolor: 'transparent' }
                  }}
                >
                  {item.label}
                </Button>
              ))}
              
              <Button
                component="a"
                href={APK_DOWNLOAD_URL}
                download="CCS-Connect.apk"
                variant="outlined"
                color="success"
                startIcon={<AndroidOutlined />}
                sx={{ 
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 2,
                  borderWidth: 2,
                  '&:hover': { borderWidth: 2 }
                }}
              >
                Download APK
              </Button>

              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                color="primary"
                sx={{ 
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 2.5
                }}
              >
                Login to CCS Connect
              </Button>
            </Stack>

            {/* Mobile Actions: Prominent Login & Download */}
            <Stack direction="row" spacing={1} sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
              <Button
                component="a"
                href={APK_DOWNLOAD_URL}
                download="CCS-Connect.apk"
                variant="outlined"
                color="success"
                size="small"
                startIcon={<AndroidOutlined />}
                sx={{ fontWeight: 700, textTransform: 'none', px: 1.2, py: 0.5, fontSize: '0.75rem' }}
              >
                APK
              </Button>

              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                color="primary"
                size="small"
                sx={{ fontWeight: 700, textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.75rem' }}
              >
                Login
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, pt: { xs: 8, md: 10 } }}>
        <Outlet />
      </Box>

      <Box component="footer" sx={{ bgcolor: '#111827', color: '#e5e7eb', pt: 8, pb: 4, mt: 'auto' }}>
        <Container maxWidth="xl">
          <Grid container spacing={6}>
            <Grid item xs={12} md={4}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                <img src="/logo.png" alt="CCS" style={{ height: 40, filter: 'brightness(0) invert(1)' }} onError={(e) => e.target.style.display='none'} />
                <Typography variant="h5" fontWeight="bold" color="white">CCS Partners</Typography>
              </Stack>
              <Typography variant="body2" sx={{ mb: 3, lineHeight: 1.8, color: '#9ca3af' }}>
                Pioneering the future of agriculture with world-class crop solutions. Empowering farmers and building a resilient supply chain across India.
              </Typography>
              <Stack direction="row" spacing={1}>
                <IconButton component="a" href="https://facebook.com" target="_blank" rel="noopener noreferrer" sx={{ color: '#9ca3af', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}><FacebookOutlined /></IconButton>
                <IconButton component="a" href="https://instagram.com/" target="_blank" rel="noopener noreferrer" sx={{ color: '#9ca3af', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}><InstagramOutlined /></IconButton>
                <IconButton component="a" href="https://indiamart.com/chitracropscience" target="_blank" rel="noopener noreferrer" title="IndiaMART" sx={{ color: '#9ca3af', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                  <img src="https://img.icons8.com/color/24/000000/indiamart.png" alt="IndiaMART" style={{ width: 20, filter: 'grayscale(100%)', opacity: 0.7 }} />
                </IconButton>
              </Stack>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <Typography variant="h6" color="white" fontWeight="bold" mb={3}>Quick Links</Typography>
              <Stack spacing={2}>
                {navItems.map(item => (
                  <MuiLink key={item.label} component={RouterLink} to={item.path} sx={{ color: '#9ca3af', textDecoration: 'none', '&:hover': { color: 'primary.light' } }}>
                    {item.label}
                  </MuiLink>
                ))}
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="h6" color="white" fontWeight="bold" mb={3}>Resources</Typography>
              <Stack spacing={2}>
                <MuiLink component={RouterLink} to="/contact" sx={{ color: '#9ca3af', textDecoration: 'none', '&:hover': { color: 'primary.light' } }}>Contact Support</MuiLink>
                <MuiLink 
                  href={APK_DOWNLOAD_URL} 
                  download="CCS-Connect.apk" 
                  sx={{ 
                    color: '#4ade80', 
                    fontWeight: 700, 
                    textDecoration: 'none', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 1, 
                    '&:hover': { color: '#86efac', textDecoration: 'underline' } 
                  }}
                >
                  <AndroidOutlined style={{ fontSize: '18px' }} /> Download APK
                </MuiLink>
                <MuiLink href="#" sx={{ color: '#9ca3af', textDecoration: 'none', '&:hover': { color: 'primary.light' } }}>Download Brochure</MuiLink>
                <MuiLink href="#" sx={{ color: '#9ca3af', textDecoration: 'none', '&:hover': { color: 'primary.light' } }}>Privacy Policy</MuiLink>
                <MuiLink href="#" sx={{ color: '#9ca3af', textDecoration: 'none', '&:hover': { color: 'primary.light' } }}>Terms & Conditions</MuiLink>
              </Stack>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography variant="h6" color="white" fontWeight="bold" mb={3}>Contact Us</Typography>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <EnvironmentOutlined style={{ fontSize: '20px', color: '#4ade80', marginTop: '2px' }} />
                  <Typography variant="body2" color="#9ca3af">Block-D, 404, Signature 2,<br/>Near Sanand Cross Road, S.G. Highway,<br/>Makarba, Ahmedabad, Gujarat 382210</Typography>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                  <PhoneOutlined style={{ fontSize: '20px', color: '#4ade80' }} />
                  <Typography variant="body2" color="#9ca3af">+91 80004 50380</Typography>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                  <MailOutlined style={{ fontSize: '20px', color: '#4ade80' }} />
                  <Typography variant="body2" color="#9ca3af">chitracropscience22@gmail.com</Typography>
                </Stack>
              </Stack>
            </Grid>
          </Grid>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 4 }} />
          
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="#9ca3af">
              © {new Date().getFullYear()} Chitra Crop Science Partners. All rights reserved.
            </Typography>
            <Typography variant="body2" color="#9ca3af" sx={{ mt: { xs: 2, md: 0 } }}>
              Designed for a Greener Tomorrow.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
