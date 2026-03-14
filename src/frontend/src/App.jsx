import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import AuthGuard from './components/guards/AuthGuard';
import TherapistGuard from './components/guards/TherapistGuard';
import AdminGuard from './components/guards/AdminGuard';
import Landing from './pages/Landing';
import Register from './pages/Register';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import Subscription from './pages/Subscription';
import ClientDetail from './pages/ClientDetail';
import SessionDetail from './pages/SessionDetail';
import ExerciseLibrary from './pages/ExerciseLibrary';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import AdminTherapists from './pages/AdminTherapists';
import AdminSettings from './pages/AdminSettings';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminSystemLogs from './pages/AdminSystemLogs';
import AdminAIUsage from './pages/AdminAIUsage';
import AdminAIModels from './pages/AdminAIModels';
import TherapistGuide from './pages/TherapistGuide';
import NotFound from './pages/NotFound';
import InstallPrompt from './components/InstallPrompt';
import NotificationToast from './components/NotificationToast';

/**
 * GuardedLayout - Wraps content with AuthGuard + TherapistGuard + AppLayout.
 * Used for therapist dashboard routes.
 */
function GuardedLayout({ children }) {
  return (
    <AuthGuard>
      <TherapistGuard>
        <NotificationToast />
        <AppLayout>{children}</AppLayout>
      </TherapistGuard>
    </AuthGuard>
  );
}

/**
 * AdminLayout - Wraps content with AuthGuard + TherapistGuard + AdminGuard + AppLayout.
 * Used for superadmin routes.
 */
function AdminLayout({ children }) {
  return (
    <AuthGuard>
      <TherapistGuard>
        <AdminGuard>
          <AppLayout>{children}</AppLayout>
        </AdminGuard>
      </TherapistGuard>
    </AuthGuard>
  );
}

function App() {
  return (
    <BrowserRouter>
      <InstallPrompt />
      <Routes>
        {/* Public routes - no sidebar, no guards */}
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Authenticated therapist routes - AuthGuard + TherapistGuard + AppLayout */}
        <Route path="/dashboard" element={<GuardedLayout><Dashboard /></GuardedLayout>} />
        <Route path="/clients" element={<GuardedLayout><ClientList /></GuardedLayout>} />
        <Route path="/clients/:id" element={<GuardedLayout><ClientDetail /></GuardedLayout>} />
        <Route path="/sessions/:id" element={<GuardedLayout><SessionDetail /></GuardedLayout>} />
        <Route path="/exercises" element={<GuardedLayout><ExerciseLibrary /></GuardedLayout>} />
        <Route path="/analytics" element={<GuardedLayout><Analytics /></GuardedLayout>} />
        <Route path="/settings" element={<GuardedLayout><Settings /></GuardedLayout>} />
        <Route path="/subscription" element={<GuardedLayout><Subscription /></GuardedLayout>} />
        <Route path="/subscription/success" element={<GuardedLayout><Subscription /></GuardedLayout>} />
        <Route path="/dashboard/guide" element={<GuardedLayout><TherapistGuide /></GuardedLayout>} />

        {/* Admin routes - AuthGuard + TherapistGuard + AdminGuard + AppLayout */}
        <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
        <Route path="/admin/therapists" element={<AdminLayout><AdminTherapists /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
        <Route path="/admin/logs" element={<AdminLayout><AdminAuditLogs /></AdminLayout>} />
        <Route path="/admin/system-logs" element={<AdminLayout><AdminSystemLogs /></AdminLayout>} />
        <Route path="/admin/ai-usage" element={<AdminLayout><AdminAIUsage /></AdminLayout>} />
        <Route path="/admin/ai-models" element={<AdminLayout><AdminAIModels /></AdminLayout>} />
        <Route path="/admin/*" element={<AdminLayout><AdminDashboard /></AdminLayout>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
