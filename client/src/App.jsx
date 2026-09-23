import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/auth/LoginPage'

const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))
const LeadsPage = lazy(() => import('./pages/leads/LeadsPage'))
const CustomersPage = lazy(() => import('./pages/customers/CustomersPage'))
const CustomerDetail = lazy(() => import('./pages/customers/CustomerDetail'))
const QuotationsPage = lazy(() => import('./pages/quotations/QuotationsPage'))
const InstallationsPage = lazy(() => import('./pages/installations/InstallationsPage'))
const AccountsPage = lazy(() => import('./pages/accounts/AccountsPage'))
const RenewalsPage = lazy(() => import('./pages/renewals/RenewalsPage'))
const TicketsPage = lazy(() => import('./pages/tickets/TicketsPage'))
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage'))
const EmployeesPage = lazy(() => import('./pages/employees/EmployeesPage'))
const MyWorkPage = lazy(() => import('./pages/employees/MyWorkPage'))
const HRManagementPage = lazy(() => import('./pages/employees/HRManagementPage'))
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'))
const CalendarPage = lazy(() => import('./pages/calendar/CalendarPage'))
const ChatPage = lazy(() => import('./pages/chat/ChatPage'))
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'))
const UsersPage = lazy(() => import('./pages/users/UsersPage'))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } }
})

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text-secondary)' }}>Loading module...</div>}>
      <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Navigate to="/customers" replace />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="quotations" element={<Navigate to="/customers" replace />} />
        <Route path="installations" element={<InstallationsPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="renewals" element={<RenewalsPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="my-work" element={<MyWorkPage />} />
        <Route path="hrms" element={<HRManagementPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <AppRoutes />
            <Toaster
              position="top-center"
              containerStyle={{ top: 30 }}
              toastOptions={{
                duration: 3500,
                style: {
                  background: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #6366f1',
                  borderRadius: '12px',
                  fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
                  padding: '12px 20px',
                },
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
