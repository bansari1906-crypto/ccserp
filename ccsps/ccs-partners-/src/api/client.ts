import { User, UserRole, Order, Dealer, Distributor, Product, AttendanceRecord, Expense, NotificationItem } from '../types';
import { INITIAL_DEALERS, INITIAL_PRODUCTS } from '../data/mockData';
import { computeProductCasePricing } from '../utils/packaging';

const getBaseUrl = (): string => {
  const envUrl =
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_API_URL ||
    (import.meta as any).env?.VITE_APP_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const customServer = localStorage.getItem('api_server_url') || localStorage.getItem('ccs_api_url');
    if (customServer) {
      return customServer.replace(/\/+$/, '');
    }
  }

  const isNativeApp =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'capacitor:' ||
      Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
      (window.location.hostname === 'localhost' && !(import.meta as any).env?.DEV));

  const isHostingerDomain =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('chitracropsciencepartners.com') ||
      window.location.hostname.includes('hostingerapp.com'));

  // On native Android/Capacitor, localhost points to the device itself.
  // Connect to the official production server API.
  if (isNativeApp || isHostingerDomain) {
    return 'https://chitracropsciencepartners.com/api';
  }

  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:8000/api';
  }

  return 'https://chitracropsciencepartners.com/api';
};

const BASE_URL = getBaseUrl();

export const getAuthToken = (): string | null => {
  const token =
    localStorage.getItem('access_token') ||
    localStorage.getItem('ccs_access_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('access_token') ||
    sessionStorage.getItem('ccs_access_token');
  if (!token || token === 'demo_access_token' || token.startsWith('mock-')) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('ccs_access_token');
    return null;
  }
  return token;
};

export const getHeaders = (tokenOverride?: string): HeadersInit => {
  const token = tokenOverride || getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as any),
  };

  const customServer = typeof window !== 'undefined' ? (localStorage.getItem('api_server_url') || localStorage.getItem('ccs_api_url')) : null;
  const prodApi = 'https://chitracropsciencepartners.com/api';
  const localWifi = 'http://192.168.1.4:8000/api';
  const emulatorUrl = 'http://10.0.2.2:8000/api';
  const localhostUrl = 'http://localhost:8000/api';

  // Extract relative subpath after /api
  let subpath = '';
  if (url.includes('/api/')) {
    subpath = '/' + url.split('/api/')[1];
  } else if (url.startsWith('/api')) {
    subpath = url.replace(/^\/api/, '');
  }

  const candidateUrls: string[] = [];
  // 1. Prioritize requested URL
  candidateUrls.push(url);

  // 2. Candidate fallbacks for mobile / cross-origin connectivity
  if (subpath) {
    if (customServer) {
      candidateUrls.push(`${customServer.replace(/\/+$/, '')}${subpath}`);
    }
    candidateUrls.push(`${localWifi}${subpath}`);
    candidateUrls.push(`${prodApi}${subpath}`);
    candidateUrls.push(`${emulatorUrl}${subpath}`);
    candidateUrls.push(`${localhostUrl}${subpath}`);
    candidateUrls.push(`/api${subpath}`);
  }

  const uniqueUrls = Array.from(new Set(candidateUrls));
  let res: Response | null = null;
  let lastError: any = null;
  let htmlResponseEndpoint: string | null = null;

  for (const targetUrl of uniqueUrls) {
    try {
      const resp = await fetch(targetUrl, {
        ...options,
        headers,
        credentials: 'include',
      });
      const contentType = resp.headers.get('content-type') || '';
      // If server returned 200 with HTML (e.g. Hostinger SPA fallback), it's not the Django backend
      if (resp.ok && contentType.includes('text/html')) {
        htmlResponseEndpoint = targetUrl;
        console.warn(`Endpoint ${targetUrl} returned HTML (SPA frontend fallback), not Django API. Trying next candidate...`);
        continue;
      }
      // If server returned 502/503/504 Bad Gateway / Service Unavailable, failover
      if (resp.status >= 502 && resp.status <= 504) {
        console.warn(`Endpoint ${targetUrl} returned ${resp.status}. Trying next candidate...`);
        continue;
      }
      res = resp;
      break;
    } catch (err: any) {
      console.warn(`Endpoint ${targetUrl} failed:`, err);
      lastError = err;
    }
  }

  if (!res) {
    console.error('All candidate endpoints failed. Last error:', lastError);
    if (htmlResponseEndpoint) {
      throw new Error(`Unable to connect to attendance server. Production server at chitracropsciencepartners.com is currently serving frontend static assets only; the Django backend API is unreachable. Please ensure the backend server is running and accessible.`);
    }
    throw new Error('Unable to connect to attendance server. Please ensure the backend server is running and try again.');
  }

  // Handle 401 Unauthorized: Attempt token refresh using refresh token or cookie
  if (res.status === 401) {
    const refreshToken = localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
        credentials: 'include',
        body: JSON.stringify(refreshToken ? { refresh: refreshToken } : {}),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newAccess = refreshData.access || refreshData.access_token;
        if (newAccess) {
          localStorage.setItem('access_token', newAccess);
          localStorage.setItem('ccs_access_token', newAccess);
          if (refreshData.refresh) {
            localStorage.setItem('refresh_token', refreshData.refresh);
          }
          const retryHeaders = {
            ...headers,
            'Authorization': `Bearer ${newAccess}`,
          };
          res = await fetch(url, {
            ...options,
            headers: retryHeaders,
            credentials: 'include',
          });
          return res;
        }
      }
    } catch (refreshErr) {
      console.warn('Token refresh failed:', refreshErr);
    }

    if (!token) {
      throw new Error('Authentication required. Please sign in with your employee credentials to record attendance.');
    }
  }

  return res;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMsg = `API error (${response.status}): ${response.statusText}`;
    try {
      const data = await response.json();
      if (data.error) errorMsg = data.error;
      else if (data.detail) errorMsg = data.detail;
      else if (data.message) errorMsg = data.message;
      else if (typeof data === 'object') errorMsg = JSON.stringify(data);
    } catch (e) {
      // Non-JSON response error handling
    }
    throw new Error(errorMsg);
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('API returned HTML response instead of JSON.');
  }
  return response.json() as Promise<T>;
}

// 1. AUTH API
export const authApi = {
  login: async (username: string, password: string): Promise<{ access_token: string; user: User }> => {
    const res = await apiFetch(`${BASE_URL}/auth/login/`, {
      method: 'POST',
      body: JSON.stringify({ email_or_username: username, password }),
    });
    const data = await handleResponse<{ access_token: string; refresh_token?: string; user: any }>(res);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('ccs_access_token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }

    // Normalize role string to uppercase ('ADMIN', 'EMPLOYEE', 'DISTRIBUTOR', 'WAREHOUSE')
    let normalizedRole: UserRole = 'ADMIN';
    const roleStr = (data.user.role || '').toUpperCase();
    if (roleStr.includes('EMPLOYEE')) normalizedRole = 'EMPLOYEE';
    else if (roleStr.includes('DISTRIBUTOR')) normalizedRole = 'DISTRIBUTOR';
    else if (roleStr.includes('WAREHOUSE')) normalizedRole = 'WAREHOUSE';
    else if (roleStr.includes('ADMIN')) normalizedRole = 'ADMIN';

    const userObj: User = {
      id: String(data.user.id),
      name: data.user.name || data.user.username || 'User',
      email: data.user.email || '',
      role: normalizedRole,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      phone: data.user.phone || '',
      businessName: data.user.company_name || 'CCS Partner',
      kmRate: data.user.km_rate !== undefined && data.user.km_rate !== null ? Number(data.user.km_rate) : undefined,
    };
    localStorage.setItem('user', JSON.stringify(userObj));
    localStorage.setItem('ccs_user', JSON.stringify(userObj));
    return { access_token: data.access_token, user: userObj };
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const res = await apiFetch(`${BASE_URL}/auth/me/`);
      const data = await handleResponse<any>(res);
      let normalizedRole: UserRole = 'ADMIN';
      const roleStr = (data.role || '').toUpperCase();
      if (roleStr.includes('EMPLOYEE')) normalizedRole = 'EMPLOYEE';
      else if (roleStr.includes('DISTRIBUTOR')) normalizedRole = 'DISTRIBUTOR';
      else if (roleStr.includes('WAREHOUSE')) normalizedRole = 'WAREHOUSE';
      else if (roleStr.includes('ADMIN')) normalizedRole = 'ADMIN';

      const userObj: User = {
        id: String(data.id),
        name: data.name || data.username || 'User',
        email: data.email || '',
        role: normalizedRole,
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        phone: data.phone || '',
        businessName: data.company_name || 'CCS Partner',
        kmRate: data.km_rate !== undefined && data.km_rate !== null ? Number(data.km_rate) : undefined,
      };
      localStorage.setItem('user', JSON.stringify(userObj));
      localStorage.setItem('ccs_user', JSON.stringify(userObj));
      return userObj;
    } catch {
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('ccs_access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('ccs_user');
    sessionStorage.clear();
  },

  getStoredUser: (): User | null => {
    const token = getAuthToken();
    if (!token) {
      return null;
    }
    const raw = localStorage.getItem('ccs_user') || localStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getPendingRegistrations: async (): Promise<any[]> => {
    const res = await fetch(`${BASE_URL}/admin/approvals/`, { headers: getHeaders() });
    return handleResponse<any[]>(res);
  },

  approveUser: async (userId: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/admin/approvals/${userId}/approve/`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  rejectUser: async (userId: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/admin/approvals/${userId}/reject/`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  }
};

// 2. DEALERS API
export const dealersApi = {
  getAll: async (): Promise<Dealer[]> => {
    try {
      const res = await fetch(`${BASE_URL}/crm/dealers/`, { headers: getHeaders() });
      const rawData = await handleResponse<any[]>(res);
      if (!Array.isArray(rawData) || rawData.length === 0) {
        return INITIAL_DEALERS;
      }
      return rawData.map((d: any) => ({
        id: String(d.id),
        code: d.dealer_code || d.code || `DLR-${d.id}`,
        name: d.company_name || d.name || 'Dealer',
        ownerName: d.contact_person || d.name || 'Owner',
        phone: d.phone || '',
        email: d.email || '',
        city: d.city || 'Location',
        state: d.state || 'State',
        address: d.address || '',
        gstin: d.gstin || '27AAAAA0000A1Z5',
        pan: d.pan || 'ABCDE1234F',
        distributorId: String(d.distributor || ''),
        distributorName: d.distributor_name || 'CCS Direct',
        creditLimit: Number(d.credit_limit || 500000),
        outstandingBalance: Number(d.outstanding_balance || 0),
        status: d.is_active ? 'Active' : 'Inactive',
        lastOrderDate: d.last_order_date || '',
        totalOrdersCount: Number(d.orders_count || 0),
        totalSalesValue: Number(d.total_sales || 0),
        loyaltyPoints: Number(d.loyalty_points || 0),
      }));
    } catch {
      return INITIAL_DEALERS;
    }
  },

  create: async (dealerData: Partial<Dealer>): Promise<Dealer> => {
    const res = await fetch(`${BASE_URL}/crm/dealers/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        company_name: dealerData.name,
        contact_person: dealerData.ownerName,
        phone: dealerData.phone,
        email: dealerData.email,
        city: dealerData.city,
        state: dealerData.state,
        address: dealerData.address,
        gstin: dealerData.gstin,
        credit_limit: dealerData.creditLimit,
      }),
    });
    const d = await handleResponse<any>(res);
    return {
      id: String(d.id),
      code: d.dealer_code || `DLR-${d.id}`,
      name: d.company_name || dealerData.name || 'Dealer',
      ownerName: d.contact_person || dealerData.ownerName || 'Owner',
      phone: d.phone || '',
      email: d.email || '',
      city: d.city || 'Location',
      state: d.state || 'State',
      address: d.address || '',
      gstin: d.gstin || '',
      pan: d.pan || '',
      distributorId: '',
      distributorName: 'CCS Direct',
      creditLimit: Number(d.credit_limit || 500000),
      outstandingBalance: 0,
      status: 'Active',
      totalOrdersCount: 0,
      totalSalesValue: 0,
      loyaltyPoints: 0,
    };
  }
};

// 3. DISTRIBUTORS API
export const distributorsApi = {
  getAll: async (): Promise<Distributor[]> => {
    const res = await fetch(`${BASE_URL}/crm/distributors/`, { headers: getHeaders() });
    const rawData = await handleResponse<any[]>(res);
    return rawData.map((d: any) => ({
      id: String(d.id),
      code: d.code || `DST-${d.id}`,
      name: d.company_name || d.name || 'Distributor',
      ownerName: d.contact_person || d.name || 'Manager',
      phone: d.phone || '',
      email: d.email || '',
      territory: d.territory || 'North Region',
      city: d.city || 'District HQ',
      state: d.state || 'State',
      dealersCount: Number(d.dealers_count || 0),
      monthlySales: Number(d.monthly_sales || 0),
      outstandingBalance: Number(d.outstanding_balance || 0),
      kmRate: d.km_rate !== undefined && d.km_rate !== null ? Number(d.km_rate) : 5.0,
      status: d.status || (d.is_active ? 'Active' : 'Inactive'),
    }));
  }
};

// 4. PRODUCTS API
export const productsApi = {
  getAll: async (): Promise<Product[]> => {
    try {
      const res = await fetch(`${BASE_URL}/products/`, { headers: getHeaders() });
      const rawData = await handleResponse<any[]>(res);
      if (!Array.isArray(rawData) || rawData.length === 0) {
        return INITIAL_PRODUCTS;
      }
      return rawData.map((p: any) => {
        const isAvail = p.status === 'Available' || p.status === 'Active';
        const displayStatus = isAvail ? 'Available' : 'Unavailable';
        const packSize = p.pack_size || p.packing || 'Standard';
        const dealerPrice = Number(p.dealer_price !== undefined && p.dealer_price !== null ? p.dealer_price : (p.price || 0));
        const pkg = computeProductCasePricing(dealerPrice, packSize);

        return {
          id: String(p.id),
          code: p.barcode || p.code || `PRD-${String(p.id).slice(0, 8).toUpperCase()}`,
          name: p.name,
          technicalName: p.technical_name || p.name,
          category: p.category_name || (typeof p.category === 'object' ? p.category?.name : p.category) || 'General',
          packSize: packSize,
          bottlesPerCase: p.bottles_per_case || pkg.bottlesPerCase,
          casePrice: p.case_price || pkg.casePrice,
          caseSize: p.case_size || pkg.caseSize,
          unitLabel: pkg.unitLabel,
          mrp: Number(p.mrp !== undefined && p.mrp !== null ? p.mrp : 0),
          dealerPrice: dealerPrice,
          distributorPrice: Number(p.distributor_price !== undefined && p.distributor_price !== null ? p.distributor_price : 0),
          gst: Number(p.gst !== undefined && p.gst !== null ? p.gst : 18),
          stock: Number(p.stock !== undefined && p.stock !== null ? p.stock : 0),
          reservedStock: 0,
          warehouse: 'Main Warehouse',
          recommendedCrops: p.recommended_crops ? (Array.isArray(p.recommended_crops) ? p.recommended_crops : [p.recommended_crops]) : ['Wheat', 'Paddy', 'Cotton'],
          dosage: p.dosage || '2ml per liter of water',
          description: p.description || p.technical_name || 'Crop protection formulation.',
          imageUrl: p.image_url || p.image || 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=300',
          status: displayStatus,
          is_available: isAvail,
        };
      });
    } catch {
      return INITIAL_PRODUCTS;
    }
  },

  create: async (productData: Partial<Product>): Promise<Product> => {
    const isAvail = productData.status !== 'Unavailable' && productData.status !== 'Inactive';
    const res = await fetch(`${BASE_URL}/products/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name: productData.name,
        technical_name: productData.technicalName || '',
        category: productData.category || 'Fertilizers',
        pack_size: productData.packSize || '1 Ltr',
        packing: productData.packSize || '1 Ltr',
        barcode: productData.code || '',
        mrp: productData.mrp || 0,
        dealer_price: productData.dealerPrice || 0,
        distributor_price: productData.distributorPrice || (productData.dealerPrice ? Number(productData.dealerPrice) * 0.9 : 0),
        gst: productData.gst !== undefined ? productData.gst : 18,
        status: isAvail ? 'Available' : 'Unavailable'
      })
    });
    const p = await handleResponse<any>(res);
    const savedAvail = p.status === 'Available' || p.status === 'Active';
    return {
      id: String(p.id),
      code: p.barcode || p.code || `PRD-${String(p.id).slice(0, 8).toUpperCase()}`,
      name: p.name,
      technicalName: p.technical_name || p.name,
      category: p.category_name || (typeof p.category === 'object' ? p.category?.name : p.category) || 'Fertilizers',
      packSize: p.pack_size || p.packing || '1 Ltr',
      mrp: Number(p.mrp || 0),
      dealerPrice: Number(p.dealer_price || 0),
      distributorPrice: Number(p.distributor_price || 0),
      gst: Number(p.gst || 18),
      stock: 0,
      reservedStock: 0,
      warehouse: 'Main Warehouse',
      recommendedCrops: ['All Crops'],
      dosage: '2ml per liter',
      description: p.description || '',
      imageUrl: p.image_url || 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=300',
      status: savedAvail ? 'Available' : 'Unavailable',
      is_available: savedAvail,
    };
  },

  update: async (id: string, productData: Partial<Product>): Promise<Product> => {
    const payload: any = {};
    if (productData.name !== undefined) payload.name = productData.name;
    if (productData.technicalName !== undefined) payload.technical_name = productData.technicalName;
    if (productData.category !== undefined) payload.category = productData.category;
    if (productData.packSize !== undefined) {
      payload.pack_size = productData.packSize;
      payload.packing = productData.packSize;
    }
    if (productData.code !== undefined) payload.barcode = productData.code;
    if (productData.mrp !== undefined) payload.mrp = productData.mrp;
    if (productData.dealerPrice !== undefined) payload.dealer_price = productData.dealerPrice;
    if (productData.distributorPrice !== undefined) payload.distributor_price = productData.distributorPrice;
    if (productData.gst !== undefined) payload.gst = productData.gst;
    if (productData.status !== undefined) {
      payload.status = (productData.status === 'Available' || productData.status === 'Active') ? 'Available' : 'Unavailable';
    }

    const res = await fetch(`${BASE_URL}/products/${id}/`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const p = await handleResponse<any>(res);
    const savedAvail = p.status === 'Available' || p.status === 'Active';
    return {
      id: String(p.id),
      code: p.barcode || p.code || `PRD-${String(p.id).slice(0, 8).toUpperCase()}`,
      name: p.name,
      technicalName: p.technical_name || p.name,
      category: p.category_name || (typeof p.category === 'object' ? p.category?.name : p.category) || 'Fertilizers',
      packSize: p.pack_size || p.packing || '1 Ltr',
      mrp: Number(p.mrp || 0),
      dealerPrice: Number(p.dealer_price || 0),
      distributorPrice: Number(p.distributor_price || 0),
      gst: Number(p.gst || 18),
      stock: 0,
      reservedStock: 0,
      warehouse: 'Main Warehouse',
      recommendedCrops: ['All Crops'],
      dosage: '2ml per liter',
      description: p.description || '',
      imageUrl: p.image_url || 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=300',
      status: savedAvail ? 'Available' : 'Unavailable',
      is_available: savedAvail,
    };
  },

  delete: async (id: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/products/${id}/`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  }
};

// 5. ORDERS API
export const ordersApi = {
  getAll: async (): Promise<Order[]> => {
    const res = await fetch(`${BASE_URL}/orders/`, { headers: getHeaders() });
    const rawData = await handleResponse<any[]>(res);
    return rawData.map((o: any) => ({
      id: String(o.id),
      orderNumber: o.order_number || `ORD-${o.id}`,
      date: (o.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
      dealerId: String(o.dealer?.id || o.dealer || '1'),
      dealerName: o.dealer?.username || o.dealer_name || 'Dealer',
      dealerCode: o.dealer?.code || 'DLR-101',
      dealerCity: o.dealer?.city || 'Central City',
      distributorId: String(o.created_by?.id || '1'),
      distributorName: o.created_by?.username || 'Field Executive',
      items: (o.items || []).map((i: any) => ({
        id: String(i.id),
        productId: String(i.product?.id || i.product || '1'),
        productName: i.product_name || i.product?.name || 'Agro Product',
        productCode: i.product_code || i.product?.code || 'PRD-01',
        packSize: i.pack_size || i.packing || i.product?.pack_size || i.product?.packing || '1L',
        quantity: Number(i.quantity),
        dealerPrice: Number(i.rate || 0),
        mrp: Number(i.rate * 1.2),
        subtotal: Number(i.total || 0),
        imageUrl: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=300',
      })),
      subtotal: Number(o.subtotal || 0),
      discount: 0,
      tax: Number(o.gst_total || 0),
      grandTotal: Number(o.grand_total || 0),
      status: (o.status || 'Pending Approval') as any,
      paymentStatus: (o.payment_status || 'Pending') as any,
      lrNumber: o.lr_number,
      transporter: o.transport_details,
      remarks: o.remarks,
      createdAt: o.created_at || new Date().toISOString(),
    }));
  },

  create: async (orderPayload: { dealerId: string; items: { productId: string; quantity: number; rate: number }[]; remarks?: string }): Promise<Order> => {
    const res = await apiFetch(`${BASE_URL}/orders/`, {
      method: 'POST',
      body: JSON.stringify({
        dealer: orderPayload.dealerId,
        items: orderPayload.items.map(i => ({
          product: i.productId,
          quantity: i.quantity,
          rate: i.rate
        })),
        remarks: orderPayload.remarks || ''
      }),
    });
    const o = await handleResponse<any>(res);
    return {
      id: String(o.id),
      orderNumber: o.order_number || `ORD-${o.id}`,
      date: (o.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
      dealerId: String(orderPayload.dealerId),
      dealerName: o.dealer_name || 'Dealer',
      dealerCode: 'DLR-101',
      dealerCity: 'Location',
      distributorId: '1',
      distributorName: 'Self',
      items: (o.items || []).map((i: any) => ({
        id: String(i.id),
        productId: String(i.product?.id || i.product || ''),
        productName: i.product_name || i.product?.name || '',
        productCode: i.product_code || i.product?.code || '',
        packSize: i.pack_size || i.packing || '',
        quantity: Number(i.quantity || 0),
        dealerPrice: Number(i.rate || 0),
        mrp: Number(i.rate * 1.2),
        subtotal: Number(i.total || 0),
      })),
      subtotal: Number(o.subtotal || 0),
      discount: 0,
      tax: Number(o.gst_total || 0),
      grandTotal: Number(o.grand_total || 0),
      status: (o.status || 'Pending Approval') as any,
      paymentStatus: 'Pending',
      remarks: orderPayload.remarks,
      createdAt: o.created_at || new Date().toISOString(),
    };
  },


  updateStatus: async (orderId: string, status: string): Promise<any> => {
    if (status === 'Approved') {
      return ordersApi.approve(orderId);
    }
    if (status === 'Rejected') {
      return ordersApi.reject(orderId);
    }
    if (status === 'Bilty Uploaded') {
      return ordersApi.uploadBilty(orderId, `BILTY-${Date.now().toString().slice(-6)}`);
    }
    if (status === 'Ready to Dispatch') {
      return ordersApi.markReadyDispatch(orderId);
    }
    if (status === 'Dispatched') {
      return ordersApi.generateLr(orderId, `LR-${Date.now().toString().slice(-6)}`, 'VRL Logistics');
    }
    return { status };
  },

  approve: async (orderId: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/approve/`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  reject: async (orderId: string, remarks?: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/reject/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ remarks: remarks || 'Rejected by Admin' })
    });
    return handleResponse(res);
  },

  uploadBilty: async (orderId: string, biltyNumber: string, biltyFileName?: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/upload_bilty/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ bilty_number: biltyNumber, bilty_file_name: biltyFileName || '' })
    });
    return handleResponse(res);
  },

  markReadyDispatch: async (orderId: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/mark_ready_dispatch/`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  generateLr: async (orderId: string, lrNumber: string, transportDetails: string, vehicleNumber?: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/generate_lr/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ lr_number: lrNumber, transport_details: transportDetails, vehicle_number: vehicleNumber || '' })
    });
    return handleResponse(res);
  },

  dispatchOrder: async (orderId: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/dispatch_order/`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  }
};

// Helper formatting functions for Attendance
const formatTimeToAMPM = (timeStr?: string | null): string => {
  if (!timeStr) return '--';
  if (timeStr.includes('T')) {
    try {
      return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      // fallback
    }
  }
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = hours < 10 ? `0${hours}` : `${hours}`;
    return `${strHours}:${minutes} ${ampm}`;
  }
  return timeStr;
};

const formatWorkingHours = (decimalHours?: number | string | null): string => {
  if (decimalHours === null || decimalHours === undefined || decimalHours === '') return '--';
  const num = typeof decimalHours === 'string' ? parseFloat(decimalHours) : decimalHours;
  if (isNaN(num) || num <= 0) return '00h 00m';
  const hrs = Math.floor(num);
  const mins = Math.round((num - hrs) * 60);
  const strHrs = hrs < 10 ? `0${hrs}` : `${hrs}`;
  const strMins = mins < 10 ? `0${mins}` : `${mins}`;
  return `${strHrs}h ${strMins}m`;
};

const mapBackendAttendanceToRecord = (a: any, index = 1): AttendanceRecord => {
  const dateObj = a.date ? new Date(a.date) : new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = !isNaN(dateObj.getTime()) ? dayNames[dateObj.getDay()] : 'Today';

  const checkInFormatted = (a.check_in || a.clock_in) ? formatTimeToAMPM(a.check_in || a.clock_in) : '--';
  const checkOutFormatted = (a.check_out || a.clock_out) ? formatTimeToAMPM(a.check_out || a.clock_out) : undefined;
  const workingHoursFormatted = a.working_hours !== undefined && a.working_hours !== null
    ? formatWorkingHours(a.working_hours)
    : undefined;

  let statusVal: any = a.status || 'Present';
  if (a.is_active && !a.check_out) {
    statusVal = 'Working';
  }

  const resolvePhotoUrl = (url?: string | null) => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    const host = BASE_URL.replace(/\/api\/?$/, '');
    return url.startsWith('/') ? `${host}${url}` : `${host}/${url}`;
  };

  return {
    id: String(a.id),
    sNo: index,
    date: a.date || new Date().toISOString().split('T')[0],
    day,
    employeeId: String(a.employee_id || a.employee || '1'),
    employeeName: a.employee_name || a.user?.username || 'Employee',
    role: a.employee_role || a.user?.role || 'Distributor',
    checkIn: checkInFormatted,
    checkOut: checkOutFormatted,
    breakDuration: '0h 30m',
    totalHours: workingHoursFormatted || '00h 00m',
    workingHours: workingHoursFormatted,
    overtime: '0h 00m',
    status: statusVal,
    locationCheckIn: a.check_in_location || a.current_location || 'Location Recorded',
    locationCheckOut: a.check_out_location,
    latitude: a.check_in_latitude ? Number(a.check_in_latitude) : undefined,
    longitude: a.check_in_longitude ? Number(a.check_in_longitude) : undefined,
    currentLocation: a.current_location || a.check_in_location || 'Location Recorded',
    currentLatitude: a.current_latitude ? Number(a.current_latitude) : undefined,
    currentLongitude: a.current_longitude ? Number(a.current_longitude) : undefined,
    currentLocationTimestamp: a.current_location_timestamp,
    isActive: Boolean(a.is_active && !a.check_out),
    loginImage: resolvePhotoUrl(a.check_in_photo),
    backCameraImage: resolvePhotoUrl(a.back_camera_photo),
    logoutImage: resolvePhotoUrl(a.check_out_photo),
  };
};

// 6. ATTENDANCE & EXPENSES API
export const hrApi = {
  getAttendance: async (): Promise<AttendanceRecord[]> => {
    const res = await apiFetch(`${BASE_URL}/hr/attendance/`);
    const rawData = await handleResponse<any[]>(res);
    return rawData.map((a: any, idx: number) => mapBackendAttendanceToRecord(a, idx + 1));
  },

  getActiveAttendance: async (): Promise<{ active: boolean; completed?: boolean; attendance: AttendanceRecord | null }> => {
    try {
      const res = await apiFetch(`${BASE_URL}/hr/attendance/active/`);
      const data = await handleResponse<{ active: boolean; completed?: boolean; attendance: any }>(res);
      return {
        active: Boolean(data.active),
        completed: Boolean(data.completed),
        attendance: data.attendance ? mapBackendAttendanceToRecord(data.attendance) : null,
      };
    } catch (e) {
      console.warn("Could not fetch active attendance:", e);
      return { active: false, completed: false, attendance: null };
    }
  },

  clockIn: async (data: { location?: string; latitude?: number; longitude?: number; photo?: string; backCameraPhoto?: string }): Promise<AttendanceRecord> => {
    const res = await apiFetch(`${BASE_URL}/hr/attendance/`, {
      method: 'POST',
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        check_in_location: data.location || 'Current Location',
        check_in_latitude: data.latitude,
        check_in_longitude: data.longitude,
        check_in_photo: data.photo || data.backCameraPhoto || '',
        back_camera_photo: data.backCameraPhoto || data.photo || ''
      })
    });
    const a = await handleResponse<any>(res);
    return mapBackendAttendanceToRecord(a);
  },

  updateLocation: async (data: { location?: string; latitude: number; longitude: number }): Promise<any> => {
    const res = await apiFetch(`${BASE_URL}/hr/attendance/update_location/`, {
      method: 'POST',
      body: JSON.stringify({
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude
      })
    });
    return handleResponse(res);
  },

  clockOut: async (data: { location?: string; latitude?: number; longitude?: number; photo?: string }): Promise<AttendanceRecord> => {
    const res = await apiFetch(`${BASE_URL}/hr/attendance/check_out/`, {
      method: 'POST',
      body: JSON.stringify({
        check_out_location: data.location || 'Current Location',
        check_out_latitude: data.latitude,
        check_out_longitude: data.longitude,
        check_out_photo: data.photo || ''
      })
    });
    const a = await handleResponse<any>(res);
    return mapBackendAttendanceToRecord(a);
  },

  getExpenses: async (): Promise<Expense[]> => {
    const res = await apiFetch(`${BASE_URL}/hr/expenses/`);
    const rawData = await handleResponse<any>(res);
    const rawArray = Array.isArray(rawData) ? rawData : (rawData?.results || []);
    return rawArray.map((e: any, idx: number) => {
      const startingKm = e.starting_km !== null && e.starting_km !== undefined ? Number(e.starting_km) : undefined;
      const endingKm = e.ending_km !== null && e.ending_km !== undefined ? Number(e.ending_km) : undefined;
      const totalKm = e.total_km !== null && e.total_km !== undefined ? Number(e.total_km) : (
        startingKm !== undefined && endingKm !== undefined ? Math.max(endingKm - startingKm, 0) : undefined
      );
      const kmRate = e.km_rate !== null && e.km_rate !== undefined ? Number(e.km_rate) : undefined;
      const kmAmount = e.km_amount !== null && e.km_amount !== undefined ? Number(e.km_amount) : (
        totalKm !== undefined && kmRate !== undefined ? totalKm * kmRate : 0
      );

      return {
        id: String(e.id),
        sNo: idx + 1,
        employeeId: String(e.employee || e.user?.id || '1'),
        employeeName: e.employee_name || e.user?.username || 'Employee',
        date: e.date || new Date().toISOString().split('T')[0],
        type: e.category || 'Field Sales Expense Claim',
        startingKm,
        endingKm,
        totalKm,
        kmRate,
        kmAmount,
        rideKm: totalKm,
        totalRideKm: totalKm,
        busTrainCarFair: e.bus_train_car_fair ? Number(e.bus_train_car_fair) : 0,
        fairCab: e.fair_cab ? Number(e.fair_cab) : 0,
        fairAuto: e.fair_auto ? Number(e.fair_auto) : 0,
        otherVehicleFair: e.other_vehicle_fair ? Number(e.other_vehicle_fair) : 0,
        food: e.food ? Number(e.food) : 0,
        laundry: e.laundry ? Number(e.laundry) : 0,
        phoneBill: e.phone_bill ? Number(e.phone_bill) : 0,
        internetBill: e.internet_bill ? Number(e.internet_bill) : 0,
        localConveyance: e.local_conveyance ? Number(e.local_conveyance) : 0,
        courier: e.courier ? Number(e.courier) : 0,
        photocopy: e.photocopy ? Number(e.photocopy) : 0,
        otherCharge: e.other_charge ? Number(e.other_charge) : 0,
        amount: Number(e.amount),
        totalAmount: Number(e.amount),
        approvalAmount: e.status === 'Approved' ? Number(e.amount) : 0,
        remarks: e.remarks || e.description || '',
        remark: e.remarks || e.description || '',
        status: (e.status || 'Pending') as any,
        billUrl: e.bill || undefined,
        proofImage: e.bill || undefined,
      };
    });
  },

  createExpense: async (data: {
    category?: string;
    amount: number;
    remarks?: string;
    starting_km?: number | '';
    ending_km?: number | '';
    bus_train_car_fair?: number | '';
    fair_cab?: number | '';
    fair_auto?: number | '';
    other_vehicle_fair?: number | '';
    food?: number | '';
    laundry?: number | '';
    phone_bill?: number | '';
    internet_bill?: number | '';
    local_conveyance?: number | '';
    courier?: number | '';
    photocopy?: number | '';
    other_charge?: number | '';
    bill?: string | null;
  }): Promise<Expense> => {
    const payload: Record<string, any> = {
      category: data.category || 'Travel',
      amount: data.amount,
      description: data.remarks || '',
      remarks: data.remarks || '',
      date: new Date().toISOString().split('T')[0]
    };

    if (data.starting_km !== undefined && data.starting_km !== '') payload.starting_km = Number(data.starting_km);
    if (data.ending_km !== undefined && data.ending_km !== '') payload.ending_km = Number(data.ending_km);
    if (data.bus_train_car_fair !== undefined && data.bus_train_car_fair !== '') payload.bus_train_car_fair = Number(data.bus_train_car_fair);
    if (data.fair_cab !== undefined && data.fair_cab !== '') payload.fair_cab = Number(data.fair_cab);
    if (data.fair_auto !== undefined && data.fair_auto !== '') payload.fair_auto = Number(data.fair_auto);
    if (data.other_vehicle_fair !== undefined && data.other_vehicle_fair !== '') payload.other_vehicle_fair = Number(data.other_vehicle_fair);
    if (data.food !== undefined && data.food !== '') payload.food = Number(data.food);
    if (data.laundry !== undefined && data.laundry !== '') payload.laundry = Number(data.laundry);
    if (data.phone_bill !== undefined && data.phone_bill !== '') payload.phone_bill = Number(data.phone_bill);
    if (data.internet_bill !== undefined && data.internet_bill !== '') payload.internet_bill = Number(data.internet_bill);
    if (data.local_conveyance !== undefined && data.local_conveyance !== '') payload.local_conveyance = Number(data.local_conveyance);
    if (data.courier !== undefined && data.courier !== '') payload.courier = Number(data.courier);
    if (data.photocopy !== undefined && data.photocopy !== '') payload.photocopy = Number(data.photocopy);
    if (data.other_charge !== undefined && data.other_charge !== '') payload.other_charge = Number(data.other_charge);
    if (data.bill) payload.bill = data.bill;

    const res = await apiFetch(`${BASE_URL}/hr/expenses/`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const e = await handleResponse<any>(res);
    return {
      id: String(e.id),
      employeeId: String(e.employee || e.user?.id || '1'),
      employeeName: e.employee_name || e.user?.username || 'Employee',
      date: e.date || new Date().toISOString().split('T')[0],
      type: (e.category || data.category || 'Travel') as any,
      amount: Number(e.amount),
      totalAmount: Number(e.amount),
      approvalAmount: e.status === 'Approved' ? Number(e.amount) : 0,
      startingKm: e.starting_km !== null ? Number(e.starting_km) : undefined,
      endingKm: e.ending_km !== null ? Number(e.ending_km) : undefined,
      totalKm: e.total_km !== null ? Number(e.total_km) : undefined,
      kmRate: e.km_rate !== null ? Number(e.km_rate) : undefined,
      kmAmount: e.km_amount !== null ? Number(e.km_amount) : 0,
      busTrainCarFair: e.bus_train_car_fair ? Number(e.bus_train_car_fair) : 0,
      fairCab: e.fair_cab ? Number(e.fair_cab) : 0,
      fairAuto: e.fair_auto ? Number(e.fair_auto) : 0,
      otherVehicleFair: e.other_vehicle_fair ? Number(e.other_vehicle_fair) : 0,
      food: e.food ? Number(e.food) : 0,
      laundry: e.laundry ? Number(e.laundry) : 0,
      phoneBill: e.phone_bill ? Number(e.phone_bill) : 0,
      internetBill: e.internet_bill ? Number(e.internet_bill) : 0,
      localConveyance: e.local_conveyance ? Number(e.local_conveyance) : 0,
      courier: e.courier ? Number(e.courier) : 0,
      photocopy: e.photocopy ? Number(e.photocopy) : 0,
      otherCharge: e.other_charge ? Number(e.other_charge) : 0,
      remarks: e.remarks || e.description || data.remarks || '',
      remark: e.remarks || e.description || data.remarks || '',
      status: (e.status || 'Pending') as any,
      billUrl: e.bill || undefined,
      proofImage: e.bill || undefined,
    };
  },

  approveExpense: async (expenseId: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/hr/expenses/${expenseId}/approve/`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  rejectExpense: async (expenseId: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/hr/expenses/${expenseId}/reject/`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  getVisits: async (): Promise<any[]> => {
    const res = await fetch(`${BASE_URL}/hr/visits/`, { headers: getHeaders() });
    const rawData = await handleResponse<any[]>(res);
    return rawData.map((v: any) => ({
      id: String(v.id),
      date: v.date || (v.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
      time: v.start_time || (v.created_at ? new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:00 AM'),
      visitType: v.visit_type || 'Distributor',
      customerName: v.customer_name || v.dealer_name || 'Customer',
      customerMobile: v.customer_mobile || '',
      dealerId: v.dealer ? String(v.dealer) : undefined,
      dealerName: v.dealer_name || '',
      location: v.location || 'Location Captured',
      latitude: v.latitude ? Number(v.latitude) : null,
      longitude: v.longitude ? Number(v.longitude) : null,
      purpose: v.visit_purpose || v.notes || 'Field Visit',
      status: 'Completed' as const,
      proofPhoto: v.photo || null,
      proofVideo: v.video || null,
      notes: v.notes || '',
      employeeName: v.employee_name || 'Staff'
    }));
  },

  recordVisit: async (payload: {
    dealerId?: string;
    visitType: string;
    customerName: string;
    customerMobile: string;
    location: string;
    latitude?: number;
    longitude?: number;
    purpose: string;
    notes?: string;
    photo?: string;
    videoUrl?: string;
    videoName?: string;
  }): Promise<any> => {
    const body: any = {
      visit_type: payload.visitType,
      customer_name: payload.customerName,
      customer_mobile: payload.customerMobile,
      visit_purpose: payload.purpose,
      location: payload.location,
      latitude: payload.latitude || null,
      longitude: payload.longitude || null,
      notes: payload.notes || '',
    };
    if (payload.dealerId) {
      body.dealer = payload.dealerId;
    }
    const res = await fetch(`${BASE_URL}/hr/visits/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    const v = await handleResponse<any>(res);
    return {
      id: String(v.id),
      date: v.date || new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      visitType: v.visit_type || payload.visitType,
      customerName: v.customer_name || payload.customerName,
      customerMobile: v.customer_mobile || payload.customerMobile,
      dealerId: v.dealer ? String(v.dealer) : payload.dealerId,
      dealerName: v.dealer_name || '',
      location: v.location || payload.location,
      latitude: v.latitude ? Number(v.latitude) : payload.latitude,
      longitude: v.longitude ? Number(v.longitude) : payload.longitude,
      purpose: v.visit_purpose || payload.purpose,
      status: 'Completed',
      proofPhoto: v.photo || payload.photo || null,
      proofVideo: v.video || payload.videoUrl || null,
      videoName: payload.videoName || null,
      notes: v.notes || payload.notes,
      employeeName: v.employee_name || 'Staff'
    };
  },

  createVisit: async (payload: any): Promise<any> => {
    return hrApi.recordVisit(payload);
  }
};

// 7. DASHBOARD API
export const dashboardApi = {
  getStats: async (): Promise<any> => {
    const res = await fetch(`${BASE_URL}/common/dashboard/`, { headers: getHeaders() });
    return handleResponse<any>(res);
  }
};

// 8. ADMIN EMPLOYEE MANAGEMENT API
export const adminApi = {
  updateEmployeeKmRate: async (userId: string, kmRate: number): Promise<any> => {
    const res = await fetch(`${BASE_URL}/admin/users/${userId}/`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ km_rate: kmRate })
    });
    return handleResponse(res);
  }
};

// 9. NOTIFICATIONS API
export const notificationsApi = {
  getAll: async (): Promise<NotificationItem[]> => {
    try {
      const res = await apiFetch(`${BASE_URL}/notifications/`);
      const rawData = await handleResponse<any[]>(res);
      const list = Array.isArray(rawData) ? rawData : (rawData as any)?.results || [];
      return list.map((n: any) => ({
        id: String(n.id),
        title: n.title,
        message: n.message,
        type: n.type || 'System',
        eventType: n.event_type,
        referenceId: n.reference_id,
        referenceType: n.reference_type,
        destination: n.destination,
        isRead: Boolean(n.is_read),
        createdAt: n.created_at || new Date().toISOString(),
      }));
    } catch (e) {
      console.warn("Could not fetch notifications from backend:", e);
      return [];
    }
  },

  getUnreadCount: async (): Promise<number> => {
    try {
      const res = await apiFetch(`${BASE_URL}/notifications/unread_count/`);
      const data = await handleResponse<{ unread_count: number }>(res);
      return data.unread_count || 0;
    } catch {
      return 0;
    }
  },

  markRead: async (id: string): Promise<any> => {
    const res = await apiFetch(`${BASE_URL}/notifications/${id}/mark_read/`, { method: 'POST' });
    return handleResponse(res);
  },

  markAllRead: async (): Promise<any> => {
    const res = await apiFetch(`${BASE_URL}/notifications/mark_all_read/`, { method: 'POST' });
    return handleResponse(res);
  },

  registerDeviceToken: async (token: string, platform = 'android'): Promise<any> => {
    try {
      const res = await apiFetch(`${BASE_URL}/notifications/devices/`, {
        method: 'POST',
        body: JSON.stringify({ token, platform })
      });
      return handleResponse(res);
    } catch (e) {
      console.warn("Could not register device push token:", e);
    }
  },

  unregisterDeviceToken: async (token?: string): Promise<any> => {
    try {
      const res = await apiFetch(`${BASE_URL}/notifications/devices/unregister/`, {
        method: 'POST',
        body: JSON.stringify(token ? { token } : {})
      });
      return handleResponse(res);
    } catch (e) {
      console.warn("Could not unregister device push token:", e);
    }
  }
};

