import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './app/(dashboard)/layout';
import { ProtectedRoute, GuestRoute } from './components/auth/RouteGuards';

// Loading fallback
function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-teal border-t-transparent" />
    </div>
  );
}

// Auth Pages (wrapped in GuestRoute so logged-in users go to /)
const LoginPage = lazy(() => import('./app/(auth)/login/page'));
const RegisterPage = lazy(() => import('./app/(auth)/register/page'));
const ForgotPasswordPage = lazy(() => import('./app/(auth)/forgot-password/page'));
const ResetPasswordPage = lazy(() => import('./app/(auth)/reset-password/page'));
const VerifyEmailPage = lazy(() => import('./app/(auth)/verify-email/page'));
const VerifyOtpPage = lazy(() => import('./app/(auth)/verify-otp/page'));
const ActivateInvitationPage = lazy(() => import('./app/(auth)/activate-invitation/page'));

// Public Pages
const PrivacyPage = lazy(() => import('./app/privacy/page'));
const TermsPage = lazy(() => import('./app/terms/page'));
const VisitorPassPage = lazy(() => import('./app/visitor-pass/[token]/page'));

// Dashboard Pages (Protected)
const DashboardPage = lazy(() => import('./app/(dashboard)/page'));
const AuditPage = lazy(() => import('./app/(dashboard)/audit/page'));
const CalendarPage = lazy(() => import('./app/(dashboard)/calendar/page'));
const CheckoutsPage = lazy(() => import('./app/(dashboard)/checkouts/page'));
const ComplaintsPage = lazy(() => import('./app/(dashboard)/complaints/page'));
const ComplaintDetailPage = lazy(() => import('./app/(dashboard)/complaints/[id]/page'));
const ContractDetailPage = lazy(() => import('./app/(dashboard)/contracts/[id]/page'));
const ExpensesPage = lazy(() => import('./app/(dashboard)/expenses/page'));
const GuestPermitsPage = lazy(() => import('./app/(dashboard)/guest-permits/page'));
const InvoicesPage = lazy(() => import('./app/(dashboard)/invoices/page'));
const InvoiceDetailPage = lazy(() => import('./app/(dashboard)/invoices/[id]/page'));
const NotificationsPage = lazy(() => import('./app/(dashboard)/notifications/page'));
const PaymentsPage = lazy(() => import('./app/(dashboard)/payments/page'));
const PropertiesPage = lazy(() => import('./app/(dashboard)/properties/page'));
const ReportsPage = lazy(() => import('./app/(dashboard)/reports/page'));
const RoomsPage = lazy(() => import('./app/(dashboard)/rooms/page'));
const RoomAddPage = lazy(() => import('./app/(dashboard)/rooms/add/page'));
const RoomTransfersPage = lazy(() => import('./app/(dashboard)/rooms/transfers/page'));
const RulesPage = lazy(() => import('./app/(dashboard)/rules/page'));
const SettingsPage = lazy(() => import('./app/(dashboard)/settings/page'));
const TenantsPage = lazy(() => import('./app/(dashboard)/tenants/page'));
const TenantInvitationsPage = lazy(() => import('./app/(dashboard)/tenants/invitations/page'));
const TenantDetailPage = lazy(() => import('./app/(dashboard)/tenants/[id]/page'));
const TenantDocumentsPage = lazy(() => import('./app/(dashboard)/tenants/[id]/documents/page'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/activate-invitation" element={<ActivateInvitationPage />} />

        {/* Public Routes */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/visitor-pass/:token" element={<VisitorPassPage />} />

        {/* Dashboard Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/checkouts" element={<CheckoutsPage />} />
            <Route path="/complaints" element={<ComplaintsPage />} />
            <Route path="/complaints/:id" element={<ComplaintDetailPage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/guest-permits" element={<GuestPermitsPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/rooms/add" element={<RoomAddPage />} />
            <Route path="/rooms/transfers" element={<RoomTransfersPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/tenants/invitations" element={<TenantInvitationsPage />} />
            <Route path="/tenants/:id" element={<TenantDetailPage />} />
            <Route path="/tenants/:id/documents" element={<TenantDocumentsPage />} />
          </Route>
        </Route>

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
