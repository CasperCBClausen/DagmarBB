import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { useAuthStore } from './store/authStore';

// Lazy-loaded pages
const HomePage = React.lazy(() => import('./pages/guest/HomePage'));
const BookingConfirmPage = React.lazy(() => import('./pages/guest/BookingConfirmPage'));
const AvailabilityPage = React.lazy(() => import('./pages/guest/AvailabilityPage'));
const AboutPage = React.lazy(() => import('./pages/guest/AboutPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const FinancialsPage = React.lazy(() => import('./pages/admin/FinancialsPage'));
const AdministrationPage = React.lazy(() => import('./pages/admin/AdministrationPage'));
const PricingPage = React.lazy(() => import('./pages/admin/PricingPage'));
const CleaningPage = React.lazy(() => import('./pages/admin/CleaningPage'));
const BookingMockupPage = React.lazy(() => import('./pages/test/BookingMockupPage'));
const MyBookingPage = React.lazy(() => import('./pages/guest/MyBookingPage'));
const AdminBookingDetailPage = React.lazy(() => import('./pages/admin/AdminBookingDetailPage'));

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  if (!user || user.role !== 'ADMIN') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireStaff({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  if (!user || !['ADMIN', 'CLEANER'].includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Suspense fallback={
        <div className="min-h-screen bg-bg flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rooms" element={<Navigate to="/book" replace />} />
          <Route path="/rooms/:slug" element={<Navigate to="/book" replace />} />
          <Route path="/book" element={<AvailabilityPage />} />
          <Route path="/book/confirm/:ref" element={<BookingConfirmPage />} />
          <Route path="/book/:roomSlug" element={<Navigate to="/book" replace />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/financials" element={<RequireAdmin><FinancialsPage /></RequireAdmin>} />
          <Route path="/admin/administration" element={<RequireAdmin><AdministrationPage /></RequireAdmin>} />
          <Route path="/admin/pricing" element={<RequireAdmin><PricingPage /></RequireAdmin>} />
          <Route path="/admin/cleaning" element={<RequireStaff><CleaningPage /></RequireStaff>} />
          <Route path="/my-booking" element={<MyBookingPage />} />
          <Route path="/admin/booking/:id" element={<RequireAdmin><AdminBookingDetailPage /></RequireAdmin>} />
          <Route path="/mockup" element={<BookingMockupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ThemeSwitcher />
    </>
  );
}
