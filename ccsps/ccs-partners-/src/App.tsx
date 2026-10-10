import React, { useState, useEffect } from 'react';
import { User, UserRole, Order, OrderStatus, Expense, Dealer, Distributor, Product, AttendanceRecord, NotificationItem } from './types';
import { INITIAL_DEALERS, INITIAL_PRODUCTS } from './data/mockData';
import {
  authApi,
  dealersApi,
  distributorsApi,
  productsApi,
  ordersApi,
  hrApi,
  notificationsApi
} from './api/client';
import { realtimeService } from './services/websocket';

// Component Imports
import { TopHeader } from './components/layout/TopHeader';
import { Sidebar } from './components/layout/Sidebar';
import { GlobalSearchModal } from './components/layout/GlobalSearchModal';
import { NotificationDrawer } from './components/layout/NotificationDrawer';
import { SupportModal } from './components/layout/SupportModal';
import { LoginScreen } from './components/LoginScreen';
import { AttendanceSelfieModal } from './components/common/AttendanceSelfieModal';

// Views
import { AdminDashboard } from './views/admin/AdminDashboard';
import { AdminOrders } from './views/admin/AdminOrders';
import { AdminOrderDetail } from './views/admin/AdminOrderDetail';
import { AdminDispatch } from './views/admin/AdminDispatch';
import { AdminDealers } from './views/admin/AdminDealers';
import { AdminDistributors } from './views/admin/AdminDistributors';
import { AdminProducts } from './views/admin/AdminProducts';
import { AdminFieldOps } from './views/admin/AdminFieldOps';
import { AdminAttendance } from './views/admin/AdminAttendance';
import { AdminExpenses } from './views/admin/AdminExpenses';
import { AdminReports } from './views/admin/AdminReports';
import { AdminUserApproval } from './views/admin/AdminUserApproval';
import { UserProfileView } from './views/admin/AdminProfileView';
import { AdminSettingsView } from './views/admin/AdminSettingsView';

import { DistributorDashboard } from './views/distributor/DistributorDashboard';
import { SalesmanAttendance } from './views/salesman/SalesmanAttendance';
import { SalesmanExpenses } from './views/salesman/SalesmanExpenses';
import { SalesmanVisitSite } from './views/salesman/SalesmanVisitSite';
import { SalesmanPlanReport } from './views/salesman/SalesmanPlanReport';
import { MonthlySalesPlanView } from './views/salesman/MonthlySalesPlanView';
import { MonthlyCollectionPlanView } from './views/salesman/MonthlyCollectionPlanView';
import { DealerDashboard } from './views/dealer/DealerDashboard';
import { DealerProfileView } from './views/dealer/DealerProfileView';
import { DealerProductsView } from './views/dealer/DealerProductsView';
import { DealerOrderHistoryView } from './views/dealer/DealerOrderHistoryView';
import { DealerInvoicesView } from './views/dealer/DealerInvoicesView';
import { DealerPaymentsView } from './views/dealer/DealerPaymentsView';

import { CreateOrderWizard } from './views/orders/CreateOrderWizard';
import { SupportView } from './views/SupportView';
import { WarehouseDashboard } from './views/warehouse/WarehouseDashboard';
import { WarehouseOrders } from './views/warehouse/WarehouseOrders';
import { WarehouseOrderDetail } from './views/warehouse/WarehouseOrderDetail';

export default function App() {
  // State: Current Authenticated User
  const [currentUser, setCurrentUser] = useState<User | null>(() => authApi.getStoredUser());

  // State: Active Navigation Tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // State: Selected Order & Dealer
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);

  // State: Modals & Drawers
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // State: Core Enterprise Data from Backend
  const [orders, setOrders] = useState<Order[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>(INITIAL_DEALERS);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [activeAttendance, setActiveAttendance] = useState<AttendanceRecord | null>(null);
  const [workingDurationStr, setWorkingDurationStr] = useState<string>('00h 00m');
  const [selfieModalConfig, setSelfieModalConfig] = useState<{ isOpen: boolean; mode: 'start' | 'end' }>({
    isOpen: false,
    mode: 'start',
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Sync to LocalStorage for persistent image evidence across refreshes
  useEffect(() => {
    if (attendance && attendance.length > 0) {
      localStorage.setItem('ccs_attendance_records', JSON.stringify(attendance));
    }
  }, [attendance]);

  useEffect(() => {
    if (expenses && expenses.length > 0) {
      localStorage.setItem('ccs_expense_records', JSON.stringify(expenses));
    }
  }, [expenses]);

  // Compute live elapsed working duration
  const computeWorkingDuration = (checkInStr?: string): string => {
    if (!checkInStr || checkInStr === '--') return '00h 00m';
    try {
      const now = new Date();
      let checkInDate = new Date();
      if (checkInStr.includes('AM') || checkInStr.includes('PM')) {
        const [time, modifier] = checkInStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        checkInDate.setHours(hours, minutes, 0, 0);
      } else if (checkInStr.includes(':')) {
        const [hours, minutes] = checkInStr.split(':').map(Number);
        checkInDate.setHours(hours, minutes, 0, 0);
      }
      const diffMs = Math.max(0, now.getTime() - checkInDate.getTime());
      const totalSecs = Math.floor(diffMs / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const strH = hrs < 10 ? `0${hrs}` : `${hrs}`;
      const strM = mins < 10 ? `0${mins}` : `${mins}`;
      return `${strH}h ${strM}m`;
    } catch {
      return '00h 00m';
    }
  };

  // Live Timer: runs every second when active working session exists
  useEffect(() => {
    const isSessionActive = Boolean(
      activeAttendance &&
      (activeAttendance.isActive || activeAttendance.status === 'Working') &&
      (!activeAttendance.checkOut || activeAttendance.checkOut === '--')
    );
    if (isSessionActive) {
      setWorkingDurationStr(computeWorkingDuration(activeAttendance?.checkIn));
      const timer = setInterval(() => {
        setWorkingDurationStr(computeWorkingDuration(activeAttendance?.checkIn));
      }, 1000);
      return () => clearInterval(timer);
    } else if (activeAttendance && activeAttendance.checkOut && activeAttendance.checkOut !== '--') {
      setWorkingDurationStr(activeAttendance.workingHours || activeAttendance.totalHours || '00h 00m');
    }
  }, [activeAttendance]);

  // Live Periodic Location Updater: sends latest coordinates to backend
  useEffect(() => {
    const isSessionActive = Boolean(
      activeAttendance &&
      (activeAttendance.isActive || activeAttendance.status === 'Working') &&
      (!activeAttendance.checkOut || activeAttendance.checkOut === '--')
    );
    if (!currentUser || !isSessionActive) return;

    const pushLocation = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              await hrApi.updateLocation({
                latitude: lat,
                longitude: lng,
                location: `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E (GPS Live)`,
              });
            } catch (e) {
              console.warn("Location sync notice:", e);
            }
          },
          () => {},
          { timeout: 8000 }
        );
      }
    };

    pushLocation();
    const locInterval = setInterval(pushLocation, 60000); // every 60s
    return () => clearInterval(locInterval);
  }, [currentUser, activeAttendance]);

  // Unread Notification Count
  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  // Fetch real enterprise data from Django REST Backend
  const loadBackendData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [
        fetchedOrders,
        dealersList,
        distributorsList,
        productsList,
        expensesList,
        attendanceList,
        activeAttendanceRes,
        notificationsList
      ] = await Promise.all([
        ordersApi.getAll().catch((err) => { console.error("Orders API error:", err); return []; }),
        dealersApi.getAll().catch((err) => { console.error("Dealers API error:", err); return INITIAL_DEALERS; }),
        distributorsApi.getAll().catch((err) => { console.error("Distributors API error:", err); return []; }),
        productsApi.getAll().catch((err) => { console.error("Products API error:", err); return INITIAL_PRODUCTS; }),
        hrApi.getExpenses().catch((err) => { console.error("Expenses API error:", err); return []; }),
        hrApi.getAttendance().catch((err) => { console.error("Attendance API error:", err); return []; }),
        hrApi.getActiveAttendance().catch(() => ({ active: false, completed: false, attendance: null })),
        notificationsApi.getAll().catch((err) => { console.error("Notifications API error:", err); return []; }),
      ]);

      if (fetchedOrders) setOrders(fetchedOrders);
      if (dealersList && dealersList.length > 0) setDealers(dealersList);
      if (distributorsList) setDistributors(distributorsList);
      if (productsList && productsList.length > 0) setProducts(productsList);
      if (expensesList) setExpenses(expensesList);
      if (attendanceList) setAttendance(attendanceList as any);
      if (notificationsList) setNotifications(notificationsList);
      if (activeAttendanceRes && activeAttendanceRes.attendance) {
        setActiveAttendance(activeAttendanceRes.attendance);
      } else {
        setActiveAttendance(null);
      }
    } catch (e) {
      console.warn("Backend sync notice:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadBackendData();
      // Fast fallback sync
      const pollInterval = setInterval(() => {
        loadBackendData();
      }, 20000);
      return () => clearInterval(pollInterval);
    }
  }, [currentUser]);

  // Real-Time Event Bus Subscription: Instant zero-refresh sync
  useEffect(() => {
    if (!currentUser) return;

    realtimeService.connect();

    const unsubscribe = realtimeService.subscribe('*', (payload, event) => {
      const eventName = event.event || event.type;
      console.log(`[ERP Realtime] Event: ${eventName}`, payload);
      if (eventName === 'notification.created') {
        setNotifications((prev) => [
          {
            id: String(payload.id || `notif-${Date.now()}`),
            title: payload.title || 'System Alert',
            message: payload.message || '',
            type: payload.type || 'System',
            eventType: payload.event_type,
            referenceId: payload.reference_id,
            referenceType: payload.reference_type,
            destination: payload.destination,
            isRead: Boolean(payload.is_read),
            createdAt: payload.created_at || new Date().toISOString(),
          },
          ...prev.filter((n) => n.id !== String(payload.id)),
        ]);
      } else {
        loadBackendData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Handle Logout: Clean session, detach push token and reset state completely
  const handleLogout = () => {
    notificationsApi.unregisterDeviceToken().catch(() => {});
    authApi.logout();
    setCurrentUser(null);
    setActiveTab('dashboard');
    setSelectedOrder(null);
    setSelectedDealer(null);
    setAttendance([]);
    setActiveAttendance(null);
    setOrders([]);
    setExpenses([]);
    setNotifications([]);
  };

  const handleCreateOrderSubmit = async (newOrder: Order) => {
    let finalOrder = newOrder;
    try {
      const created = await ordersApi.create({
        dealerId: newOrder.dealerId || dealers[0]?.id || '1',
        items: newOrder.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          rate: i.dealerPrice
        })),
        remarks: newOrder.remarks
      });
      finalOrder = { ...newOrder, ...created, items: newOrder.items };
    } catch (err) {
      console.warn("Order created locally:", err);
    }
    setOrders((prev) => [finalOrder, ...prev]);
    setSelectedOrder(finalOrder);

    // Redirect user to orders list
    setActiveTab('orders');
  };

  const handleAddProduct = async (productData: Partial<Product>) => {
    try {
      const newProd = await productsApi.create(productData);
      setProducts((prev) => [newProd, ...prev]);
    } catch (e: any) {
      console.error("Failed to create product:", e);
      alert(e?.message || "Failed to create product");
      throw e;
    }
  };

  const handleUpdateProduct = async (id: string, productData: Partial<Product>) => {
    try {
      const updated = await productsApi.update(id, productData);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (e: any) {
      console.error("Failed to update product:", e);
      throw e;
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await productsApi.delete(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      console.error("Failed to delete product:", e);
      throw e;
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await ordersApi.updateStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (e: any) {
      console.error("Status update API notice:", e);
      alert(e?.message || `Failed to update order status to ${newStatus}`);
    }
  };


  // Business Workflow Stage 2: Office/Admin Bilty Upload
  // Attaches transport bilty number and PDF receipt to an approved order,
  // transitioning state to 'Bilty Uploaded' and notifying the Warehouse team.
  const handleUploadBilty = async (orderId: string, biltyNumber: string, biltyFileName?: string) => {
    try {
      await ordersApi.uploadBilty(orderId, biltyNumber, biltyFileName);
    } catch (e) {
      console.warn("Bilty upload notice:", e);
    }
    const updateObj = {
      status: 'Bilty Uploaded' as OrderStatus,
      biltyNumber,
      biltyPdf: biltyFileName || `${biltyNumber}.pdf`,
      biltyDate: new Date().toISOString().split('T')[0],
      biltyUploadedByName: currentUser?.name || 'Office Admin',
    };
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, ...updateObj } : ord))
    );
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, ...updateObj } : null));
    }
  };

  const handleMarkReadyDispatch = async (orderId: string) => {
    try {
      await ordersApi.markReadyDispatch(orderId);
    } catch (e) {
      console.warn("Ready to dispatch notice:", e);
    }
    const updateObj = { status: 'Ready to Dispatch' as OrderStatus };
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, ...updateObj } : ord))
    );
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, ...updateObj } : null));
    }
  };

  // Business Workflow Stage 4: Warehouse Lorry Receipt (LR) Generation & Final Dispatch
  // Warehouse attaches transporter details, vehicle number, and physical LR receipt scan.
  // Transitions status to 'Dispatched' / 'In Transit' and locks order inventory.
  const handleGenerateLr = async (
    orderId: string,
    lrNumber: string,
    transporter: string,
    vehicleNumber?: string,
    lrReceiptUpload?: string
  ) => {
    try {
      await ordersApi.generateLr(orderId, lrNumber, transporter, vehicleNumber);
    } catch (e) {
      console.warn("LR generation notice:", e);
    }
    const updateObj = {
      status: 'Ready to Dispatch' as OrderStatus,
      lrNumber,
      transporter,
      vehicleNumber: vehicleNumber || 'MH-12-PQ-9988',
      lrReceiptUpload: lrReceiptUpload || 'LR_Receipt_Doc.pdf',
      lrDate: new Date().toISOString().split('T')[0],
      lrGeneratedByName: currentUser?.name || 'Warehouse Officer',
    };
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, ...updateObj } : ord))
    );
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, ...updateObj } : null));
    }
  };

  const handleDispatchOrder = async (orderId: string) => {
    try {
      await ordersApi.dispatchOrder(orderId);
    } catch (e) {
      console.warn("Order dispatch notice:", e);
    }
    const updateObj = {
      status: 'Dispatched' as OrderStatus,
    };
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, ...updateObj } : ord))
    );
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, ...updateObj } : null));
    }
  };

  const handleApproveExpense = async (expenseId: string) => {
    try {
      await hrApi.approveExpense(expenseId);
    } catch (e) {
      console.warn("Approve expense notice:", e);
    }
    setExpenses((prev) =>
      prev.map((exp) => (exp.id === expenseId ? { ...exp, status: 'Approved' } : exp))
    );
  };

  const handleRejectExpense = async (expenseId: string) => {
    try {
      await hrApi.rejectExpense(expenseId);
    } catch (e) {
      console.warn("Reject expense notice:", e);
    }
    setExpenses((prev) =>
      prev.map((exp) => (exp.id === expenseId ? { ...exp, status: 'Rejected' } : exp))
    );
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await notificationsApi.markAllRead();
    } catch (e) {
      console.warn("Failed to mark all notifications read:", e);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      try {
        await notificationsApi.markRead(notif.id);
      } catch (e) {
        console.warn("Failed to mark notification read:", e);
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
    }
    setIsNotificationOpen(false);

    // Contextual navigation
    const dest = notif.destination;
    if (dest) {
      if (dest === 'orders' || dest.startsWith('order')) {
        setActiveTab('orders');
        if (notif.referenceId) {
          const found = orders.find((o) => o.id === notif.referenceId);
          if (found) setSelectedOrder(found);
        }
      } else if (dest === 'attendance') {
        setActiveTab('attendance');
      } else if (dest === 'expenses') {
        setActiveTab('expenses');
      } else if (dest === 'dispatch') {
        setActiveTab('dispatch');
      } else if (dest === 'products') {
        setActiveTab('products');
      } else {
        setActiveTab(dest);
      }
    }
  };

  const handleSelectSearchResult = (type: string, item: any) => {
    if (type === 'order') {
      setSelectedOrder(item as Order);
      setActiveTab('orders');
    } else if (type === 'dealer') {
      setSelectedDealer(item as Dealer);
      setActiveTab('dealer-profile');
    } else if (type === 'product') {
      setActiveTab('products');
    }
  };

  // Render Login Screen if unauthenticated
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  // Render View Routing Logic
  const renderMainContent = () => {
    // Direct Order Wizard View
    if (activeTab === 'create-order') {
      return (
        <CreateOrderWizard
          products={products}
          dealers={dealers}
          onSaveOrder={handleCreateOrderSubmit}
          onCancel={() => setActiveTab('dashboard')}
        />
      );
    }

    // View specific Dealer Profile directly
    if (activeTab === 'dealer-profile') {
      return (
        <DealerProfileView
          currentUser={currentUser}
          dealer={selectedDealer || dealers[0]}
          onBack={() => {
            setSelectedDealer(null);
            setActiveTab('dealers');
          }}
        />
      );
    }

    const currentRole = (currentUser.role || 'ADMIN').toString().toUpperCase();

    // 1. EMPLOYEE ROLE VIEWS (Field Sales & Attendance Portal)
    if (currentRole === 'EMPLOYEE') {
      if (selectedOrder) {
        return (
          <AdminOrderDetail
            order={selectedOrder}
            currentUser={currentUser}
            onBack={() => setSelectedOrder(null)}
            onUpdateStatus={handleUpdateOrderStatus}
            onUploadBilty={handleUploadBilty}
            onMarkReadyDispatch={handleMarkReadyDispatch}
            onGenerateLr={handleGenerateLr}
          />
        );
      }

      switch (activeTab) {
        case 'profile':
          return <UserProfileView currentUser={currentUser} />;
        case 'attendance':
          return (
            <SalesmanAttendance
              currentUser={currentUser}
              attendanceRecords={attendance}
              activeAttendance={activeAttendance}
              workingDurationStr={workingDurationStr}
              onRefresh={loadBackendData}
              onStartDayClick={() => setSelfieModalConfig({ isOpen: true, mode: 'start' })}
              onEndDayClick={() => setSelfieModalConfig({ isOpen: true, mode: 'end' })}
            />
          );
        case 'dealer-visit':
        case 'visit-site':
          return <SalesmanVisitSite currentUser={currentUser} />;
        case 'daily-plan':
        case 'plan-report':
          return <SalesmanPlanReport currentUser={currentUser} />;
        case 'dealers':
          return (
            <AdminDealers
              dealers={dealers}
              onAddDealer={async (d) => {
                try {
                  const created = await dealersApi.create(d);
                  setDealers([created, ...dealers]);
                } catch {
                  setDealers([d, ...dealers]);
                }
              }}
              onSelectDealer={(dealer) => {
                setSelectedDealer(dealer);
                setActiveTab('dealer-profile');
              }}
            />
          );
        case 'orders':
          return (
            <AdminOrders
              orders={orders}
              onSelectOrder={(ord) => setSelectedOrder(ord)}
              onCreateOrder={() => setActiveTab('create-order')}
            />
          );
        case 'expense-approval-status':
        case 'expenses':
          return <SalesmanExpenses currentUser={currentUser} expenses={expenses} onRefresh={loadBackendData} />;
        case 'reports':
          return <AdminReports />;
        case 'product-details':
        case 'products':
          return (
            <AdminProducts
              products={products}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              userRole={currentUser?.role}
            />
          );
        case 'monthly-sales-plan':
          return <MonthlySalesPlanView currentUser={currentUser || undefined} />;
        case 'monthly-collection-plan':
          return <MonthlyCollectionPlanView currentUser={currentUser || undefined} />;
        case 'support':
          return <SupportView currentUser={currentUser} />;
        case 'notifications':
          return (
            <div className="p-6 bg-white rounded-xl shadow-sm border border-[#e2e8f0]">
              <h2 className="text-lg font-bold text-[#14532d] mb-4">Notifications</h2>
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg">
                    <p className="font-semibold text-xs text-[#14532d]">{n.title}</p>
                    <p className="text-xs text-[#475569]">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        case 'dashboard':
        default:
          return (
            <DistributorDashboard
              currentUser={currentUser}
              orders={orders}
              dealers={dealers}
              activeAttendance={activeAttendance}
              workingDurationStr={workingDurationStr}
              onStartDay={() => setSelfieModalConfig({ isOpen: true, mode: 'start' })}
              onEndDay={() => setSelfieModalConfig({ isOpen: true, mode: 'end' })}
              onSelectOrder={(ord) => setSelectedOrder(ord)}
              onCreateOrder={() => setActiveTab('create-order')}
              onTabChange={(tab) => setActiveTab(tab)}
            />
          );
      }
    }

    // 2. DISTRIBUTOR ROLE VIEWS (Distributor Business Portal)
    if (currentRole === 'DISTRIBUTOR') {
      if (selectedOrder) {
        return (
          <AdminOrderDetail
            order={selectedOrder}
            onBack={() => setSelectedOrder(null)}
            onUpdateStatus={handleUpdateOrderStatus}
          />
        );
      }

      switch (activeTab) {
        case 'profile':
          return <DealerProfileView currentUser={currentUser} dealer={selectedDealer || undefined} />;
        case 'product-details':
        case 'products':
          return <DealerProductsView products={products} />;
        case 'orders':
          return <DealerOrderHistoryView orders={orders} currentUser={currentUser} />;
        case 'payments':
          return <DealerPaymentsView currentUser={currentUser} />;
        case 'invoices':
          return <DealerInvoicesView orders={orders} currentUser={currentUser} />;
        case 'support':
          return <SupportView currentUser={currentUser} />;
        case 'dashboard':
        default:
          return <DealerDashboard currentUser={currentUser} orders={orders} onOpenInvoices={() => setActiveTab('invoices')} />;
      }
    }

    // 3. WAREHOUSE ROLE VIEWS
    if (currentRole === 'warehouse') {
      if (selectedOrder) {
        return (
          <WarehouseOrderDetail
            order={selectedOrder}
            onUpdateOrder={(updatedOrder) => {
              handleGenerateLr(
                updatedOrder.id,
                updatedOrder.lrNumber || '',
                updatedOrder.transporter || '',
                updatedOrder.vehicleNumber || '',
                updatedOrder.lrReceiptUpload
              );
              setSelectedOrder(updatedOrder);
            }}
            onDispatchOrder={handleDispatchOrder}
            onBack={() => setSelectedOrder(null)}
          />
        );
      }

      switch (activeTab) {
        case 'orders':
          return (
            <WarehouseOrders
              orders={orders}
              initialMode="ready"
              onSelectOrder={(ord) => setSelectedOrder(ord)}
            />
          );
        case 'order-list':
          return (
            <WarehouseOrders
              orders={orders}
              initialMode="dispatched"
              onSelectOrder={(ord) => setSelectedOrder(ord)}
            />
          );
        case 'support':
          return <SupportView currentUser={currentUser} />;
        case 'dashboard':
        default:
          return (
            <WarehouseDashboard
              orders={orders}
              onSelectOrder={(ord) => setSelectedOrder(ord)}
              onNavigateToOrders={(tab) => setActiveTab(tab === 'ready' ? 'orders' : 'order-list')}
            />
          );
      }
    }

    // 4. ADMIN ROLE VIEWS (EXACTLY 13 APPROVED ITEMS)
    if (selectedOrder && activeTab === 'orders') {
      return (
        <AdminOrderDetail
          order={selectedOrder}
          currentUser={currentUser}
          onBack={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateOrderStatus}
          onUploadBilty={handleUploadBilty}
          onMarkReadyDispatch={handleMarkReadyDispatch}
          onGenerateLr={handleGenerateLr}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <AdminDashboard
            orders={orders}
            dealers={dealers}
            distributors={distributors}
            products={products}
            expenses={expenses}
            fieldActivities={[]}
            onSelectOrder={(ord) => {
              setSelectedOrder(ord);
              setActiveTab('orders');
            }}
            onCreateOrder={() => setActiveTab('create-order')}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        );
      case 'registration-approval':
      case 'user-approval':
        return <AdminUserApproval />;
      case 'orders':
        return (
          <AdminOrders
            orders={orders}
            onSelectOrder={(ord) => setSelectedOrder(ord)}
            onCreateOrder={() => setActiveTab('create-order')}
          />
        );
      case 'dealers':
        return (
          <AdminDealers
            dealers={dealers}
            onAddDealer={async (d) => {
              try {
                const created = await dealersApi.create(d);
                setDealers([created, ...dealers]);
              } catch {
                setDealers([d, ...dealers]);
              }
            }}
            onSelectDealer={(dealer) => {
              setSelectedDealer(dealer);
              setActiveTab('dealer-profile');
            }}
            onSwitchToDealerPortal={(dealer) => {
              if (currentUser) {
                setCurrentUser({ ...currentUser, role: 'DISTRIBUTOR' as any });
              }
              setSelectedDealer(dealer);
              setActiveTab('profile');
            }}
          />
        );
      case 'distributors':
        return (
          <AdminDistributors
            distributors={distributors}
            onAddDistributor={(dist) => setDistributors([dist, ...distributors])}
            onRefresh={loadBackendData}
          />
        );
      case 'products':
        return (
          <AdminProducts
            products={products}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            userRole={currentUser?.role}
          />
        );
      case 'attendance':
        return <AdminAttendance currentUser={currentUser} attendanceRecords={attendance} onRefresh={loadBackendData} />;
      case 'expenses':
        return (
          <AdminExpenses
            currentUser={currentUser}
            expenses={expenses}
            onApproveExpense={handleApproveExpense}
            onRejectExpense={handleRejectExpense}
            onRefresh={loadBackendData}
          />
        );
      case 'reports':
        return <AdminReports />;
      case 'dispatch':
      case 'warehouse':
      case 'field-ops':
        return (
          <AdminDispatch
            orders={orders}
            onSelectOrder={(ord) => {
              setSelectedOrder(ord);
              setActiveTab('orders');
            }}
            onGenerateLr={handleGenerateLr}
          />
        );
      case 'profile':
        return <UserProfileView currentUser={currentUser} />;
      case 'settings':
        return <AdminSettingsView />;
      case 'notifications':
        return (
          <div className="p-6 bg-white rounded-xl shadow-sm border border-[#e2e8f0]">
            <h2 className="text-lg font-bold text-[#14532d] mb-4">System Notifications</h2>
            <div className="space-y-3">
              {notifications.map((n) => (
                <div key={n.id} className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg">
                  <p className="font-semibold text-xs text-[#14532d]">{n.title}</p>
                  <p className="text-xs text-[#475569]">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return (
          <AdminDashboard
            orders={orders}
            dealers={dealers}
            distributors={distributors}
            products={products}
            expenses={expenses}
            fieldActivities={[]}
            onSelectOrder={(ord) => {
              setSelectedOrder(ord);
              setActiveTab('orders');
            }}
            onCreateOrder={() => setActiveTab('create-order')}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-body text-[#161616] flex flex-col selection:bg-[#16a34a] selection:text-white">
      {/* Carbon Shell Top Header */}
      <TopHeader
        currentUser={currentUser}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNotifications={() => setIsNotificationOpen(true)}
        onOpenSupport={() => setIsSupportOpen(true)}
        activeTab={activeTab}
        canGoBack={Boolean(selectedOrder || (activeTab && activeTab !== 'dashboard'))}
        onGoBack={() => {
          if (selectedOrder) {
            setSelectedOrder(null);
          } else {
            setActiveTab('dashboard');
          }
        }}
        toggleMobileMenu={() => setIsMobileNavOpen((prev) => !prev)}
        onTabChange={(tab) => {
          setIsMobileNavOpen(false);
          if (tab === 'logout') {
            handleLogout();
          } else {
            setActiveTab(tab);
            setSelectedOrder(null);
          }
        }}
        onQuickAction={() => {
          setIsMobileNavOpen(false);
          setActiveTab('create-order');
        }}
      />

      {/* Main Layout Container */}
      <div className="flex flex-1 pt-12">
        {/* Left Sidebar */}
        <Sidebar
          currentUser={currentUser}
          activeTab={activeTab}
          isMobileOpen={isMobileNavOpen}
          onCloseMobile={() => setIsMobileNavOpen(false)}
          onTabChange={(tab) => {
            setIsMobileNavOpen(false);
            if (tab === 'logout') {
              handleLogout();
            } else {
              setActiveTab(tab);
              setSelectedOrder(null);
            }
          }}
        />

        {/* Main Content Area */}
        <main className="flex-1 md:ml-56 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full transition-all duration-150">
          {loading && (
            <div className="mb-4 p-2 bg-[#dcfce7] border border-[#86efac] text-[#14532d] text-xs rounded font-medium flex items-center justify-between">
              <span>Syncing with Django REST API PostgreSQL Database...</span>
              <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-[#16a34a] border-t-transparent"></span>
            </div>
          )}
          {renderMainContent()}
        </main>
      </div>

      {/* Modals & Drawers */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        orders={orders}
        dealers={dealers}
        products={products}
        onSelectResult={handleSelectSearchResult}
      />

      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onNotificationClick={handleNotificationClick}
      />

      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />

      {/* Attendance Selfie Modal */}
      {selfieModalConfig.isOpen && (
        <AttendanceSelfieModal
          isOpen={selfieModalConfig.isOpen}
          onClose={() => setSelfieModalConfig((prev) => ({ ...prev, isOpen: false }))}
          mode={selfieModalConfig.mode}
          employeeName={currentUser?.name || 'Employee'}
          onSubmit={async (data) => {
            try {
              if (selfieModalConfig.mode === 'start') {
                const rec = await hrApi.clockIn(data);
                setActiveAttendance(rec);
                setAttendance((prev) => [rec, ...prev.filter((a) => a.id !== rec.id)]);
              } else {
                const rec = await hrApi.clockOut(data);
                setActiveAttendance(rec);
                setAttendance((prev) => [rec, ...prev.filter((a) => a.id !== rec.id)]);
              }
              await loadBackendData();
            } catch (err: any) {
              console.error("Attendance submission error:", err);
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}
